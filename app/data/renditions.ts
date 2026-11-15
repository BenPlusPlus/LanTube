import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { getVideo, videos, type Video } from './library.ts'
import { mediaDir, mediaFileFor } from './media.ts'

/**
 * Renditions: lighter copies of a Video's file that LanTube makes so slow connections can keep up.
 * They are bytes LanTube created (ADR 0003), kept apart from the house's originals, and made one at a
 * time in the background at low priority. A Video plays its original file until its Renditions exist.
 */
export const renditionsDir = path.join(mediaDir, '.lantube', 'renditions')

/** Bump when the ladder or encoder settings change, so every Video is made again. */
export const LADDER_VERSION = 1

export interface Rung {
  /** The short side, so a portrait phone video gets the same steps as a landscape one. */
  height: number
  videoKbps: number
  audioKbps: number
}

/** Steps from a good TV picture down to something a far bedroom's Wi‑Fi can carry. */
export const LADDER: readonly Rung[] = [
  { height: 1080, videoKbps: 5000, audioKbps: 128 },
  { height: 720, videoKbps: 2800, audioKbps: 128 },
  { height: 480, videoKbps: 1200, audioKbps: 96 },
  { height: 360, videoKbps: 700, audioKbps: 96 },
]

/** What ffprobe says about a file, reduced to what the ladder needs. */
export interface SourceProbe {
  videoIndex: number
  /** As displayed, with any rotation applied. */
  width: number
  height: number
  videoKbps?: number
  audioIndex?: number
  durationSec?: number
}

export interface PlannedRung {
  name: string
  width: number
  height: number
  videoKbps: number
  audioKbps: number
}

const SEGMENT_SEC = 4
const STAMP_FILE = 'source.json'
const MASTER = 'master.m3u8'

/** Paths a player may ask for inside one Video's Renditions. Anything else is a 404. */
const SERVABLE = /^(?:master\.m3u8|\d{3,4}p\/(?:index\.m3u8|init(?:_\d+)?\.mp4|seg-\d{5,}\.m4s))$/

const TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp4': 'video/mp4',
  '.m4s': 'video/iso.segment',
}

type Json = Record<string, unknown>

function num(value: unknown): number | undefined {
  let n = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function even(n: number) {
  return Math.max(2, Math.floor(n / 2) * 2)
}

/** Reads `ffprobe -show_streams -show_format` JSON. Null when there's no picture to make copies of. */
export function parseProbe(data: unknown): SourceProbe | null {
  let root = (data ?? {}) as Json
  let streams = (Array.isArray(root.streams) ? root.streams : []) as Json[]
  let format = (root.format ?? {}) as Json
  let video = streams.find((stream) => {
    let disposition = (stream.disposition ?? {}) as Json
    return stream.codec_type === 'video' && !disposition.attached_pic && num(stream.width) && num(stream.height)
  })
  if (!video || typeof video.index !== 'number') return null
  let audio = streams.find((stream) => stream.codec_type === 'audio' && typeof stream.index === 'number')

  let sideData = (Array.isArray(video.side_data_list) ? video.side_data_list : []) as Json[]
  let tags = (video.tags ?? {}) as Json
  let rotation = Number(sideData.find((entry) => entry.rotation !== undefined)?.rotation ?? tags.rotate ?? 0)
  let sideways = Number.isFinite(rotation) && Math.abs(Math.round(rotation / 90)) % 2 === 1
  let width = num(video.width)!
  let height = num(video.height)!

  let bitRate = num(video.bit_rate)
  if (bitRate === undefined) {
    let total = num(format.bit_rate)
    if (total !== undefined) bitRate = total - (num(audio?.bit_rate) ?? (audio ? 128_000 : 0))
  }

  return {
    videoIndex: video.index,
    width: sideways ? height : width,
    height: sideways ? width : height,
    videoKbps: bitRate !== undefined && bitRate > 0 ? Math.round(bitRate / 1000) : undefined,
    audioIndex: audio ? (audio.index as number) : undefined,
    durationSec: num(format.duration) ?? num(video.duration),
  }
}

/**
 * The steps to make for this file: never larger than the source, never a bigger bitrate than the
 * source already spends, and no step that would cost as much as the one above it.
 */
export function planLadder(probe: Pick<SourceProbe, 'width' | 'height' | 'videoKbps'>): PlannedRung[] {
  let short = Math.min(probe.width, probe.height)
  let long = Math.max(probe.width, probe.height)
  let landscape = probe.width >= probe.height
  let steps = LADDER.filter((rung) => rung.height <= short)
  // Smaller than the bottom step: one copy at its own size, so it still plays everywhere.
  if (steps.length === 0) steps = [{ ...LADDER[LADDER.length - 1], height: even(short) }]

  let planned: PlannedRung[] = []
  for (let rung of steps) {
    let videoKbps = probe.videoKbps ? Math.min(rung.videoKbps, probe.videoKbps) : rung.videoKbps
    let above = planned[planned.length - 1]
    if (above && videoKbps >= above.videoKbps) continue
    let side = even((long * rung.height) / short)
    planned.push({
      name: `${rung.height}p`,
      width: landscape ? side : rung.height,
      height: landscape ? rung.height : side,
      videoKbps,
      audioKbps: rung.audioKbps,
    })
  }
  return planned
}

/** ffmpeg copies output paths into the master playlist, where only `/` is a URL separator. */
function forwardSlashes(file: string) {
  return file.split(path.sep).join('/')
}

/** One ffmpeg run that writes every step as HLS (fMP4 segments) with keyframes lined up across steps. */
export function ffmpegArgs(source: string, probe: SourceProbe, rungs: PlannedRung[], outDir: string): string[] {
  let n = rungs.length
  let input = `[0:${probe.videoIndex}]`
  let filters =
    n === 1
      ? [`${input}scale=${rungs[0].width}:${rungs[0].height},format=yuv420p[v0]`]
      : [
          `${input}split=${n}${rungs.map((_, i) => `[s${i}]`).join('')}`,
          ...rungs.map((rung, i) => `[s${i}]scale=${rung.width}:${rung.height},format=yuv420p[v${i}]`),
        ]
  let hasAudio = probe.audioIndex !== undefined

  let args = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'error', '-progress', 'pipe:1', '-y', '-i', source]
  args.push('-filter_complex', filters.join(';'))
  rungs.forEach((_, i) => args.push('-map', `[v${i}]`))
  if (hasAudio) rungs.forEach(() => args.push('-map', `0:${probe.audioIndex}`))
  args.push('-c:v', 'libx264', '-preset', 'veryfast')
  rungs.forEach((rung, i) => {
    args.push(
      `-b:v:${i}`,
      `${rung.videoKbps}k`,
      `-maxrate:v:${i}`,
      `${Math.round(rung.videoKbps * 1.07)}k`,
      `-bufsize:v:${i}`,
      `${Math.round(rung.videoKbps * 1.5)}k`,
    )
  })
  // Same keyframe times in every step, so a player can change steps at any segment boundary.
  args.push('-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SEC})`, '-sc_threshold', '0')
  if (hasAudio) {
    args.push('-c:a', 'aac', '-ac', '2')
    rungs.forEach((rung, i) => args.push(`-b:a:${i}`, `${rung.audioKbps}k`))
  }
  args.push(
    '-max_muxing_queue_size',
    '1024',
    '-f',
    'hls',
    '-hls_time',
    String(SEGMENT_SEC),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'fmp4',
    '-hls_fmp4_init_filename',
    'init.mp4',
    '-hls_segment_filename',
    forwardSlashes(path.join(outDir, '%v', 'seg-%05d.m4s')),
    '-master_pl_name',
    MASTER,
    '-var_stream_map',
    rungs.map((rung, i) => (hasAudio ? `v:${i},a:${i},name:${rung.name}` : `v:${i},name:${rung.name}`)).join(' '),
    forwardSlashes(path.join(outDir, '%v', 'index.m3u8')),
  )
  return args
}

/* ---------- On disk ---------- */

interface Stamp {
  version: number
  size: number
  mtimeMs: number
}

function stampOf(file: string): Stamp | null {
  try {
    let stat = fs.statSync(file)
    return { version: LADDER_VERSION, size: stat.size, mtimeMs: Math.round(stat.mtimeMs) }
  } catch {
    return null
  }
}

function readStamp(file: string): Stamp | null {
  try {
    let value = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Stamp>
    return typeof value.version === 'number' && typeof value.size === 'number' && typeof value.mtimeMs === 'number'
      ? (value as Stamp)
      : null
  } catch {
    return null
  }
}

function sameStamp(a: Stamp | null, b: Stamp | null) {
  return a !== null && b !== null && a.version === b.version && a.size === b.size && a.mtimeMs === b.mtimeMs
}

/** A slug is one plain path segment; anything else never reaches the disk. */
function dirFor(videoId: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(videoId)) return null
  return path.join(renditionsDir, videoId)
}

function failedMarkerFor(videoId: string) {
  return path.join(renditionsDir, `${videoId}.failed.json`)
}

/** True when this Video has finished Renditions made from the file that's on the share now. */
export function renditionsReady(video: Video): boolean {
  let dir = dirFor(video.id)
  let media = mediaFileFor(video)
  if (!dir || !media?.exists) return false
  if (!fs.existsSync(path.join(dir, MASTER))) return false
  return sameStamp(readStamp(path.join(dir, STAMP_FILE)), stampOf(media.path))
}

function failedBefore(video: Video): boolean {
  let media = mediaFileFor(video)
  return media?.exists === true && sameStamp(readStamp(failedMarkerFor(video.id)), stampOf(media.path))
}

/** The file to send for a playlist or segment request, or null if it isn't one LanTube made. */
export function renditionFileFor(video: Video, relative: string): { path: string; type: string } | null {
  if (!SERVABLE.test(relative)) return null
  let dir = dirFor(video.id)
  if (!dir) return null
  let file = path.join(dir, ...relative.split('/'))
  try {
    if (!fs.statSync(file).isFile()) return null
  } catch {
    return null
  }
  return { path: file, type: TYPES[path.extname(file)] ?? 'application/octet-stream' }
}

/* ---------- The queue ---------- */

interface Job {
  videoId: string
  title: string
  cancelled: boolean
  /** 0 to 1, from ffmpeg's progress. */
  done: number
  stop?: () => void
}

const queue: string[] = []
let current: Job | null = null
let draining = false
let enabled = false
/** ffmpeg or ffprobe isn't installed: stop trying and say so once. */
let unavailable = false
let tools = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }

/** `LANTUBE_RENDITIONS=off` turns this off; tests leave it off unless they turn it on. */
export function renditionsEnabledIn(env: NodeJS.ProcessEnv): boolean {
  let setting = env.LANTUBE_RENDITIONS?.toLowerCase()
  if (setting === 'off' || setting === '0' || setting === 'false') return false
  if (setting === 'on' || setting === '1' || setting === 'true') return true
  return env.NODE_ENV !== 'test'
}

/** Starts making Renditions for every Video that lacks them, newest first. Returns at once. */
export function startRenditions(env: NodeJS.ProcessEnv = process.env, options: { backfill?: boolean } = {}) {
  enabled = renditionsEnabledIn(env)
  unavailable = false
  if (!enabled) return
  tools = { ffmpeg: env.LANTUBE_FFMPEG || 'ffmpeg', ffprobe: env.LANTUBE_FFPROBE || 'ffprobe' }
  if (options.backfill === false) return
  void sweepPartials().then(() => {
    let newestFirst = [...videos].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)
    for (let video of newestFirst) if (!queue.includes(video.id)) queue.push(video.id)
    void drain()
  })
}

/** A Video someone just added: make its Renditions before the backlog. */
export function queueRenditions(videoId: string) {
  if (!enabled || unavailable) return
  let at = queue.indexOf(videoId)
  if (at !== -1) queue.splice(at, 1)
  queue.unshift(videoId)
  void drain()
}

/** The Video is leaving the library: stop any work on it and delete what LanTube made. */
export async function removeRenditions(videoId: string) {
  let at = queue.indexOf(videoId)
  if (at !== -1) queue.splice(at, 1)
  if (current?.videoId === videoId) {
    current.cancelled = true
    current.stop?.()
  }
  let dir = dirFor(videoId)
  if (!dir) return
  await fsp.rm(dir, { recursive: true, force: true })
  await fsp.rm(failedMarkerFor(videoId), { force: true })
}

/** Stops the running encode when the Host shuts down; its half-made copy is swept on the next start. */
export function stopRenditions() {
  queue.length = 0
  if (current) {
    current.cancelled = true
    current.stop?.()
  }
}

export interface RenditionsStatus {
  enabled: boolean
  unavailable: boolean
  waiting: number
  making?: { videoId: string; title: string; percent: number }
}

export function renditionsStatus(): RenditionsStatus {
  return {
    enabled,
    unavailable,
    waiting: queue.length,
    making: current
      ? { videoId: current.videoId, title: current.title, percent: Math.floor(current.done * 100) }
      : undefined,
  }
}

async function sweepPartials() {
  let entries: fs.Dirent[] = []
  try {
    entries = await fsp.readdir(renditionsDir, { withFileTypes: true })
  } catch {
    return
  }
  for (let entry of entries) {
    if (entry.isDirectory() && entry.name.includes('.partial-')) {
      await fsp.rm(path.join(renditionsDir, entry.name), { recursive: true, force: true })
    }
  }
}

async function drain() {
  if (draining) return
  draining = true
  try {
    while (queue.length > 0 && !unavailable) {
      let id = queue.shift()!
      let video = getVideo(id)
      if (!video || !mediaFileFor(video)?.exists || renditionsReady(video) || failedBefore(video)) continue
      let job: Job = { videoId: id, title: video.title, cancelled: false, done: 0 }
      current = job
      try {
        await makeRenditions(video, job)
      } catch (error) {
        if (job.cancelled) continue
        let failure = error as NodeJS.ErrnoException
        if (failure.code === 'ENOENT' && failure.syscall?.startsWith('spawn')) {
          unavailable = true
          queue.length = 0
          console.warn(`LanTube can’t run ${tools.ffmpeg} or ${tools.ffprobe}, so videos play at their original quality only.`)
          break
        }
        console.warn(`LanTube couldn’t make lighter copies of “${video.title}”: ${(error as Error).message}`)
        await markFailed(video, error as Error)
      } finally {
        current = null
      }
    }
  } finally {
    draining = false
  }
}

async function markFailed(video: Video, error: Error) {
  let media = mediaFileFor(video)
  let stamp = media ? stampOf(media.path) : null
  if (!stamp) return
  await fsp.mkdir(renditionsDir, { recursive: true })
  await fsp.writeFile(failedMarkerFor(video.id), JSON.stringify({ ...stamp, error: error.message.slice(-2000) }))
}

async function makeRenditions(video: Video, job: Job) {
  let media = mediaFileFor(video)
  let dir = dirFor(video.id)
  if (!media?.exists || !dir) return
  let stamp = stampOf(media.path)

  let probed = await run(tools.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', media.path], job)
  let probe = parseProbe(JSON.parse(probed.stdout))
  if (!probe) throw new Error('ffprobe found no picture in the file')
  let rungs = planLadder(probe)

  let partial = path.join(renditionsDir, `${video.id}.partial-${randomUUID().slice(0, 8)}`)
  await fsp.mkdir(partial, { recursive: true })
  try {
    await run(tools.ffmpeg, ffmpegArgs(media.path, probe, rungs, partial), job, probe.durationSec)
    if (job.cancelled) throw new Error('cancelled')
    // The file changed while it was being read; the next start makes it again.
    if (!sameStamp(stamp, stampOf(media.path))) throw new Error('the file changed while LanTube was reading it')
    await fsp.writeFile(path.join(partial, STAMP_FILE), JSON.stringify(stamp))
    await fsp.rm(dir, { recursive: true, force: true })
    await fsp.rename(partial, dir)
    await fsp.rm(failedMarkerFor(video.id), { force: true })
    if (job.cancelled) await fsp.rm(dir, { recursive: true, force: true })
  } catch (error) {
    await fsp.rm(partial, { recursive: true, force: true })
    throw error
  }
}

/** Runs a tool at low priority. Rejects with its last words on stderr when it fails. */
function run(command: string, args: string[], job: Job, durationSec?: number): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    if (job.cancelled) return reject(new Error('cancelled'))
    // Linux niceness is per thread and ffmpeg starts its encoder threads early, so start it niced
    // (nice execs ffmpeg, so the pid and kill below are ffmpeg's). Windows sets the class after spawn.
    let niced = process.platform !== 'win32'
    let child = niced
      ? spawn('nice', ['-n', '19', command, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    job.stop = () => child.kill('SIGKILL')
    if (!niced) {
      try {
        if (child.pid) os.setPriority(child.pid, os.constants.priority.PRIORITY_LOW)
      } catch {}
    }

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (durationSec === undefined) {
        stdout += chunk
        return
      }
      let last = [...chunk.matchAll(/out_time_us=(\d+)/g)].at(-1)
      if (last) job.done = Math.min(1, Number(last[1]) / 1e6 / durationSec)
    })
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      job.stop = undefined
      if (code === 0) return resolve({ stdout })
      // nice reports a missing program as exit 127; treat it like spawning a missing program.
      if (niced && code === 127) {
        return reject(Object.assign(new Error(`${command} not found`), { code: 'ENOENT', syscall: `spawn ${command}` }))
      }
      reject(new Error(job.cancelled ? 'cancelled' : stderr.trim() || `${path.basename(command)} exited with ${code}`))
    })
  })
}
