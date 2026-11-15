import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { getVideo, thumbUrl, videos, type Video } from './library.ts'
import { mediaDir } from './media.ts'

/**
 * Posters: the still an uploader picks for a Video, up to 1280px wide. Cards are a few hundred
 * pixels across, so the Host also makes smaller copies and cards pick the one that fits. All of
 * them are bytes LanTube created (ADR 0003) and go when the Video goes.
 */
export const postersDir = path.join(mediaDir, '.lantube', 'posters')

/** The smaller copies' widths. Never the full poster: a phone's 3x screen still gets 640. */
export const POSTER_WIDTHS = [320, 480, 640] as const

/** A versioned poster URL never changes what it points at, so the browser can keep it. */
const KEEP = 'private, max-age=31536000, immutable'
/** Unversioned, out of date, or standing in for a copy not made yet: check back each time. */
const RECHECK = 'private, no-cache'

type PosterVideo = Pick<Video, 'id' | 'thumb'>

function hasPoster(video: PosterVideo) {
  return video.thumb === `/poster/${video.id}` && /^[a-z0-9][a-z0-9-]*$/i.test(video.id)
}

function originalFile(videoId: string) {
  return path.join(postersDir, `${videoId}.jpg`)
}

/** Slugs never hold a dot, so `<slug>.<width>.jpg` can't be another Video's poster. */
function sizeFile(videoId: string, width: number) {
  return path.join(postersDir, `${videoId}.${width}.jpg`)
}

function partialFile(videoId: string, width: number) {
  return path.join(postersDir, `${videoId}.${width}.partial.jpg`)
}

/** Where a published upload's poster is kept, if it has one. */
export function posterPathFor(video: PosterVideo): string | null {
  if (!hasPoster(video)) return null
  let file = originalFile(video.id)
  return fs.existsSync(file) ? file : null
}

function mtimeOf(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return null
  }
}

interface PosterState {
  /** From the poster's mtime: a re-uploaded slug gets new URLs. */
  version: string
  /** Every smaller copy exists and is no older than the poster. */
  sized: boolean
}

/**
 * The share may be a network mount, and a page can show sixty cards, so what's on disk is read
 * once per Video and kept. Only LanTube writes posters, and it forgets an entry whenever it does.
 */
const known = new Map<string, PosterState | null>()

function readState(videoId: string): PosterState | null {
  let mtime = mtimeOf(originalFile(videoId))
  if (mtime === null) return null
  let sized = POSTER_WIDTHS.every((width) => (mtimeOf(sizeFile(videoId, width)) ?? -1) >= mtime)
  return { version: Math.round(mtime).toString(36), sized }
}

function stateOf(video: PosterVideo): PosterState | null {
  if (!hasPoster(video)) return null
  let state = known.get(video.id)
  if (state === undefined) {
    state = readState(video.id)
    known.set(video.id, state)
  }
  return state
}

/** The poster on disk changed (written or removed): read it again next time. */
export function forgetPoster(videoId: string) {
  known.delete(videoId)
}

/** The full still: versioned for an uploaded poster, as-is for anything else. */
export function stillUrl(video: PosterVideo): string | null {
  let url = thumbUrl(video)
  if (!url || !hasPoster(video)) return url
  let state = stateOf(video)
  return state ? `${url}?v=${state.version}` : url
}

export interface ThumbSources {
  src: string
  srcset?: string
}

/** What a card's `<img>` loads: the smaller copies once they're made, else the full still. */
export function thumbSources(video: PosterVideo): ThumbSources | null {
  let url = thumbUrl(video)
  if (!url) return null
  let state = hasPoster(video) ? stateOf(video) : null
  if (!state) return { src: url }
  let v = `v=${state.version}`
  if (!state.sized) return { src: `${url}?${v}` }
  let widest = POSTER_WIDTHS[POSTER_WIDTHS.length - 1]
  return {
    src: `${url}?w=${widest}&${v}`,
    srcset: POSTER_WIDTHS.map((width) => `${url}?w=${width}&${v} ${width}w`).join(', '),
  }
}

/** The file `/poster/:videoId` sends for this query, and how long the browser may keep it. */
export function posterToServe(video: PosterVideo, params: URLSearchParams): { path: string; cacheControl: string } | null {
  let original = posterPathFor(video)
  if (!original) return null
  let state = stateOf(video)
  let file = original
  let asked = params.get('w')
  if (asked !== null) {
    let width = Number(asked)
    let sized = POSTER_WIDTHS.includes(width as (typeof POSTER_WIDTHS)[number]) ? sizeFile(video.id, width) : null
    if (sized && state?.sized && fs.existsSync(sized)) file = sized
    else if (state?.sized) forgetPoster(video.id)
  }
  let exact = state !== null && params.get('v') === state.version && (asked === null || file !== original)
  return { path: file, cacheControl: exact ? KEEP : RECHECK }
}

/** Removes the poster and every copy made from it. */
export async function removePoster(video: PosterVideo) {
  if (!hasPoster(video)) return
  let at = queue.indexOf(video.id)
  if (at !== -1) queue.splice(at, 1)
  let files = [originalFile(video.id), ...POSTER_WIDTHS.flatMap((width) => [sizeFile(video.id, width), partialFile(video.id, width)])]
  await Promise.all(files.map((file) => fsp.rm(file, { force: true })))
  forgetPoster(video.id)
}

/* ---------- Making the smaller copies ---------- */

const queue: string[] = []
let draining = false
let enabled = false
/** ffmpeg isn't installed: cards load full posters, and LanTube says so once. */
let unavailable = false
let ffmpeg = 'ffmpeg'

/**
 * Starts making smaller copies for every poster that lacks them, newest first. Returns at once.
 * Off under test unless a test turns it on.
 */
export function startPosterSizes(env: NodeJS.ProcessEnv = process.env, options: { backfill?: boolean; enabled?: boolean } = {}) {
  enabled = options.enabled ?? env.NODE_ENV !== 'test'
  unavailable = false
  ffmpeg = env.LANTUBE_FFMPEG || 'ffmpeg'
  if (!enabled || options.backfill === false) return
  let newestFirst = [...videos].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)
  for (let video of newestFirst) if (hasPoster(video) && !queue.includes(video.id)) queue.push(video.id)
  void drain()
}

/** A poster someone just added: make its copies before the backlog. */
export function queuePosterSizes(videoId: string) {
  if (!enabled || unavailable) return
  let at = queue.indexOf(videoId)
  if (at !== -1) queue.splice(at, 1)
  queue.unshift(videoId)
  void drain()
}

/** One ffmpeg run that writes every width, never wider than the poster itself. */
export function posterSizeArgs(source: string, outputs: { width: number; file: string }[]): string[] {
  let n = outputs.length
  let split = `[0:v]split=${n}${outputs.map((_, i) => `[s${i}]`).join('')}`
  let scales = outputs.map((output, i) => `[s${i}]scale='min(${output.width},iw)':-2[o${i}]`)
  let args = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', source, '-filter_complex', [split, ...scales].join(';')]
  outputs.forEach((output, i) => args.push('-map', `[o${i}]`, '-frames:v', '1', '-update', '1', '-q:v', '5', output.file))
  return args
}

async function drain() {
  if (draining) return
  draining = true
  try {
    while (queue.length > 0 && !unavailable) {
      let id = queue.shift()!
      let video = getVideo(id)
      if (!video || !posterPathFor(video)) continue
      forgetPoster(id)
      if (stateOf(video)?.sized) continue
      try {
        await makeSizes(video)
      } catch (error) {
        let failure = error as NodeJS.ErrnoException
        if (failure.code === 'ENOENT' && failure.syscall?.startsWith('spawn')) {
          unavailable = true
          queue.length = 0
          console.warn(`LanTube can’t run ${ffmpeg}, so cards load full-size posters.`)
          break
        }
        console.warn(`LanTube couldn’t make smaller posters for “${video.title}”: ${failure.message}`)
      } finally {
        forgetPoster(id)
      }
    }
  } finally {
    draining = false
  }
}

async function makeSizes(video: Video) {
  let source = originalFile(video.id)
  let outputs = POSTER_WIDTHS.map((width) => ({ width, file: partialFile(video.id, width) }))
  try {
    await run(ffmpeg, posterSizeArgs(source, outputs))
    // Deleted while ffmpeg ran: the finally below leaves nothing behind.
    if (!getVideo(video.id) || !fs.existsSync(source)) return
    for (let output of outputs) await fsp.rename(output.file, sizeFile(video.id, output.width))
  } finally {
    await Promise.all(outputs.map((output) => fsp.rm(output.file, { force: true })))
  }
  if (!getVideo(video.id)) await removePoster(video)
}

/** Runs ffmpeg at low priority, like Renditions. Rejects with its last words on stderr when it fails. */
function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let niced = process.platform !== 'win32'
    let child = niced
      ? spawn('nice', ['-n', '19', command, ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
      : spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    if (!niced) {
      try {
        if (child.pid) os.setPriority(child.pid, os.constants.priority.PRIORITY_LOW)
      } catch {}
    }
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      // nice reports a missing program as exit 127; treat it like spawning a missing program.
      if (niced && code === 127) {
        return reject(Object.assign(new Error(`${command} not found`), { code: 'ENOENT', syscall: `spawn ${command}` }))
      }
      reject(new Error(stderr.trim() || `${path.basename(command)} exited with ${code}`))
    })
  })
}
