import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import type { Video } from './library.ts'
import { mediaDir } from './media.ts'

const MB = 1024 ** 2

/** Sidecar .vtt files LanTube wrote; never a house original on the share. */
export const captionsDir = path.join(mediaDir, '.lantube', 'captions')

export const captionsLimits = {
  file: 1 * MB,
} as const

export function captionsRelative(slug: string) {
  return `.lantube/captions/${slug}.vtt`
}

/** Absolute path on the host, if this Video has a .vtt LanTube can serve. */
export function captionsFileFor(video: Video): string | null {
  if (!video.captions) return null
  let absolute = path.resolve(mediaDir, video.captions)
  if (absolute !== mediaDir && !absolute.startsWith(mediaDir + path.sep)) return null
  try {
    if (!fs.statSync(absolute).isFile()) return null
  } catch {
    return null
  }
  return absolute
}

export type CaptionsRead = { text: string } | { error: string }

/** A WebVTT file is UTF-8 text whose first cue-bearing line is WEBVTT. */
export function readCaptionsBytes(bytes: Uint8Array): CaptionsRead {
  if (bytes.byteLength === 0) return { error: 'Choose a .vtt subtitles file.' }
  if (bytes.byteLength > captionsLimits.file) {
    return { error: 'That subtitles file is too large. Use a .vtt under 1 MB.' }
  }
  if (bytes.includes(0)) return { error: 'That isn’t a WebVTT subtitles file.' }
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '')
  if (text.includes('\uFFFD') && bytes[0] === 0xff) return { error: 'That isn’t a WebVTT subtitles file.' }
  let first = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!first || !first.startsWith('WEBVTT')) {
    return { error: 'That isn’t a WebVTT subtitles file. The first line has to be WEBVTT.' }
  }
  return { text: text.replace(/\r\n/g, '\n') }
}

export async function readCaptionsBlob(file: Blob): Promise<CaptionsRead> {
  if (file.size > captionsLimits.file) {
    return { error: 'That subtitles file is too large. Use a .vtt under 1 MB.' }
  }
  return readCaptionsBytes(new Uint8Array(await file.arrayBuffer()))
}

export async function writeCaptions(slug: string, text: string): Promise<string> {
  await fsp.mkdir(captionsDir, { recursive: true })
  let relative = captionsRelative(slug)
  await fsp.writeFile(path.join(mediaDir, relative), text, 'utf8')
  return relative
}

export async function unlinkCaptions(video: Video) {
  let file = captionsFileFor(video)
  if (file) await fsp.rm(file, { force: true })
}
