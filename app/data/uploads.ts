import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { insertUploadedVideo, videoSlugTaken } from './catalogue.ts'
import { slugify } from './household.ts'
import {
  addUploadedVideo,
  canPost,
  channelsFor,
  getChannel,
  getVideo,
  namedAudience,
  type Channel,
  type Video,
} from './library.ts'
import { findOrCreateTags, parseTagNames } from './tags.ts'
import { mediaDir, videoExtensions } from './media.ts'
import { addVideo, getPlaylist } from './playlists.ts'

/** Uploads land in the media folder, so they stream like everything else on the host. */
const uploadsDir = path.join(mediaDir, 'uploads')
const workDir = path.join(mediaDir, '.lantube')
const incomingDir = path.join(workDir, 'incoming')
const postersDir = path.join(workDir, 'posters')

const GB = 1024 ** 3
const MB = 1024 ** 2
/** A sent file waits this long for its details before it's swept away. */
const STAGED_TTL_MS = 24 * 3_600_000
const TITLE_MAX = 100

export const uploadLimits = {
  title: TITLE_MAX,
  /** Streamed straight to disk with JavaScript. */
  file: 64 * GB,
  /** Without JavaScript, the browser sends everything in one form, which the host holds in memory. */
  formFile: 512 * MB,
  poster: 2 * MB,
} as const

export type UploadVisibility = 'house' | 'private'

/** A file that reached the host but isn't a video in the library yet. */
export interface StagedUpload {
  id: string
  ownerId: string
  /** The name on the uploader's machine. Display only; never a path. */
  name: string
  ext: string
  size: number
  path: string
  at: number
}

const staged = new Map<string, StagedUpload>()

export function extensionOf(name: string): string | null {
  let ext = path.extname(name).toLowerCase()
  return videoExtensions.includes(ext) ? ext : null
}

/** Strips anything that isn't a plain display name: paths, control characters, excess length. */
function displayName(name: string): string {
  let base = name.split(/[\\/]/).pop() ?? ''
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'video'
}

async function sweep(now = Date.now()) {
  for (let [id, upload] of staged) {
    if (now - upload.at > STAGED_TTL_MS) {
      staged.delete(id)
      await fsp.rm(upload.path, { force: true })
    }
  }
  let entries: fs.Dirent[] = []
  try {
    entries = await fsp.readdir(incomingDir, { withFileTypes: true })
  } catch {
    return
  }
  for (let entry of entries) {
    let id = entry.name.split('.')[0]
    if (staged.has(id)) continue
    let file = path.join(incomingDir, entry.name)
    let stat = await fsp.stat(file).catch(() => null)
    if (stat && now - stat.mtimeMs > STAGED_TTL_MS) await fsp.rm(file, { force: true })
  }
}

export class UploadTooLargeError extends Error {
  constructor(public limit: number) {
    super(`Upload exceeds ${limit} bytes`)
  }
}

/** Streams a video to the host's disk, counting bytes as it goes, and holds it until it's published. */
export async function stageUpload(
  ownerId: string,
  name: string,
  body: ReadableStream<Uint8Array>,
  limit: number = uploadLimits.file,
): Promise<StagedUpload | null> {
  let ext = extensionOf(name)
  if (!ext) return null
  await sweep()
  await fsp.mkdir(incomingDir, { recursive: true })
  let id = crypto.randomUUID()
  let file = path.join(incomingDir, `${id}${ext}.part`)
  let size = 0
  let counted = Readable.fromWeb(body as import('node:stream/web').ReadableStream<Uint8Array>)
  counted.on('data', (chunk: Uint8Array) => {
    size += chunk.byteLength
    if (size > limit) counted.destroy(new UploadTooLargeError(limit))
  })
  try {
    await pipeline(counted, fs.createWriteStream(file, { flags: 'wx' }))
  } catch (error) {
    await fsp.rm(file, { force: true })
    throw error
  }
  if (size === 0) {
    await fsp.rm(file, { force: true })
    return null
  }
  let upload: StagedUpload = { id, ownerId, name: displayName(name), ext, size, path: file, at: Date.now() }
  staged.set(id, upload)
  return upload
}

export function getStaged(id: string, ownerId: string): StagedUpload | undefined {
  let upload = staged.get(id)
  return upload && upload.ownerId === ownerId ? upload : undefined
}

export async function discardStaged(id: string) {
  let upload = staged.get(id)
  if (!upload) return
  staged.delete(id)
  await fsp.rm(upload.path, { force: true })
}

export interface UploadInput {
  uploadId: string
  channelId: string
  title: string
  tags: string[]
  playlistId: string
  visibility: UploadVisibility
  audienceIds: string[]
  durationSec: number
  /** A JPEG still picked in the browser. */
  poster?: Blob
}

export type UploadField = 'file' | 'channel' | 'title' | 'playlist' | 'poster' | 'tags'

export type UploadResult = { video: Video } | { error: string; field: UploadField }

/** Channels this person may post to: their own first, then the ones they run, then the ones they help with. */
export function destinationsFor(personId: string): Channel[] {
  let home = getChannel(personId)
  let { runs, postsTo } = channelsFor(personId)
  return [...(home ? [home] : []), ...runs, ...postsTo]
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

async function uniqueVideoId(title: string): Promise<string> {
  let base = slugify(title, 'video').slice(0, 60).replace(/-+$/, '') || 'video'
  let id = base
  let n = 2
  while (getVideo(id) || (await videoSlugTaken(id))) {
    id = `${base}-${n}`
    n++
  }
  return id
}

/** Checks the details, moves the staged file into the library, and adds the video. */
export async function publishUpload(personId: string, input: UploadInput): Promise<UploadResult> {
  let upload = getStaged(input.uploadId, personId)
  if (!upload) return { error: 'Choose a video to upload.', field: 'file' }

  let channel = getChannel(input.channelId)
  if (!channel || !canPost(channel, personId)) return { error: 'Pick a channel you can post to.', field: 'channel' }

  let title = input.title.trim().replace(/\s+/g, ' ')
  if (title.length < 1 || title.length > TITLE_MAX) {
    return { error: `Give the video a title between 1 and ${TITLE_MAX} characters.`, field: 'title' }
  }

  let playlist = input.playlistId ? getPlaylist(input.playlistId) : undefined
  if (input.playlistId && (!playlist || playlist.ownerId !== personId)) {
    return { error: 'That playlist isn’t one of yours. Pick another, or none.', field: 'playlist' }
  }

  let poster: Uint8Array | undefined
  if (input.poster && input.poster.size > 0) {
    if (input.poster.size > uploadLimits.poster) return { error: 'That poster frame is too large. Pick another frame.', field: 'poster' }
    poster = new Uint8Array(await input.poster.arrayBuffer())
    if (!isJpeg(poster)) return { error: 'That poster frame didn’t come through. Pick it again.', field: 'poster' }
  }

  let parsed = parseTagNames(input.tags ?? [])
  if (parsed.error) return { error: parsed.error, field: 'tags' }
  let tagRows = await findOrCreateTags(parsed.names)
  let tags = tagRows.map((tag) => tag.slug)
  let id = await uniqueVideoId(title)
  let relative = path.posix.join('uploads', channel.id, `${id}${upload.ext}`)
  let destination = path.join(uploadsDir, channel.id, `${id}${upload.ext}`)

  await fsp.mkdir(path.dirname(destination), { recursive: true })
  try {
    await fsp.rename(upload.path, destination)
  } catch {
    await fsp.copyFile(upload.path, destination, fs.constants.COPYFILE_EXCL)
    await fsp.rm(upload.path, { force: true })
  }
  staged.delete(upload.id)

  let thumb = ''
  if (poster) {
    await fsp.mkdir(postersDir, { recursive: true })
    await fsp.writeFile(path.join(postersDir, `${id}.jpg`), poster)
    thumb = `/poster/${id}`
  }

  let duration = Number.isFinite(input.durationSec) ? Math.round(Math.min(Math.max(input.durationSec, 0), 86_400)) : 0
  let audienceIds = input.visibility === 'private' ? namedAudience(personId, input.audienceIds ?? []) : []
  let video = addUploadedVideo({
    id,
    title,
    channelId: channel.id,
    durationSec: duration,
    thumb,
    tags,
    file: relative,
    postedBy: personId,
    private: input.visibility === 'private' ? true : undefined,
    audience: input.visibility === 'private' ? audienceIds : undefined,
  })
  await insertUploadedVideo({
    slug: id,
    title,
    channelSlug: channel.id,
    ownerId: personId,
    durationSec: duration,
    filePath: relative,
    posterPath: thumb || null,
    visibility: input.visibility,
    tagIds: tagRows.map((tag) => tag.id),
    audienceIds,
  })
  if (playlist) addVideo(playlist, video.id)
  return { video }
}

/** Where a published upload's poster is kept, if it has one. */
export function posterPathFor(video: Video): string | null {
  if (video.thumb !== `/poster/${video.id}`) return null
  let file = path.join(postersDir, `${video.id}.jpg`)
  return fs.existsSync(file) ? file : null
}
