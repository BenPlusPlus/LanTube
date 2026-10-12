import * as fs from 'node:fs'
import * as path from 'node:path'

import type { Video } from './library.ts'

/** The folder LanTube streams video files from. Point LANTUBE_MEDIA_DIR at your library. */
export const mediaDir = path.resolve(process.env.LANTUBE_MEDIA_DIR ?? 'media')

const mimeTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
  '.avi': 'video/x-msvideo',
}

/** File types LanTube accepts as videos. */
export const videoExtensions = Object.keys(mimeTypes)

export function mimeTypeFor(file: string): string {
  return mimeTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export interface MediaFile {
  /** Absolute path on the host. */
  path: string
  /** Path as shown to people, relative to the media folder. */
  displayPath: string
  type: string
  exists: boolean
}

export function mediaFileFor(video: Video): MediaFile | null {
  let relative = video.file ?? `${video.id}.mp4`
  let absolute = path.resolve(mediaDir, relative)
  // Never serve anything outside the media folder.
  if (absolute !== mediaDir && !absolute.startsWith(mediaDir + path.sep)) return null
  let type = mimeTypes[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream'
  let exists = false
  try {
    exists = fs.statSync(absolute).isFile()
  } catch {}
  return { path: absolute, displayPath: relative.split(path.sep).join('/'), type, exists }
}
