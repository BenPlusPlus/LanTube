import * as fs from 'node:fs/promises'

import { normalizeChapters, type VideoChapter } from '../ui/public/chapter-list.ts'

export {
  chapterAt,
  chaptersFromJson,
  chaptersToJson,
  chapterSpans,
  normalizeChapters,
  type ChapterSpan,
  type VideoChapter,
} from '../ui/public/chapter-list.ts'

const NS_PER_SEC = 1_000_000_000
const MP4_TICKS_PER_SEC = 10_000_000

export async function chaptersFromFile(filePath: string): Promise<VideoChapter[]> {
  let fh: fs.FileHandle | undefined
  try {
    fh = await fs.open(filePath, 'r')
    let stat = await fh.stat()
    if (!stat.isFile() || stat.size < 8) return []
    let head = Buffer.alloc(4)
    await fh.read(head, 0, 4, 0)
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
      return normalizeChapters(await readMatroskaChapters(fh, stat.size))
    }
    return normalizeChapters(await readMp4Chapters(fh, stat.size))
  } catch {
    return []
  } finally {
    await fh?.close()
  }
}

async function readAt(fh: fs.FileHandle, pos: number, len: number): Promise<Buffer> {
  let buf = Buffer.alloc(len)
  let { bytesRead } = await fh.read(buf, 0, len, pos)
  return buf.subarray(0, bytesRead)
}

async function readMp4Chapters(fh: fs.FileHandle, fileSize: number): Promise<VideoChapter[]> {
  let found: VideoChapter[] = []
  async function walk(start: number, end: number, depth: number) {
    if (depth > 12) return
    let pos = start
    while (pos + 8 <= end && pos + 8 <= fileSize) {
      let header = await readAt(fh, pos, 16)
      if (header.length < 8) break
      let size = header.readUInt32BE(0)
      let type = header.subarray(4, 8).toString('latin1')
      let headerSize = 8
      if (size === 1) {
        if (header.length < 16) break
        size = Number(header.readBigUInt64BE(8))
        headerSize = 16
      } else if (size === 0) {
        size = end - pos
      }
      if (!Number.isFinite(size) || size < headerSize) break
      let boxEnd = Math.min(pos + size, end, fileSize)
      if (type === 'chpl') {
        found = parseChpl(await readAt(fh, pos + headerSize, boxEnd - (pos + headerSize)))
        return
      }
      if (type === 'moov' || type === 'udta' || type === 'meta' || type === 'trak') {
        let payload = pos + headerSize
        if (type === 'meta' && boxEnd - payload >= 4) payload += 4
        await walk(payload, boxEnd, depth + 1)
        if (found.length) return
      }
      if (size === 0) break
      pos = boxEnd
    }
  }
  await walk(0, fileSize, 0)
  return found
}

function parseChpl(payload: Buffer): VideoChapter[] {
  if (payload.length < 5) return []
  let version = payload[0]
  let offset = 4
  if (version !== 0) {
    if (payload.length < 9) return []
    offset = 8
  }
  if (offset >= payload.length) return []
  let count = payload[offset]
  offset += 1
  let chapters: VideoChapter[] = []
  for (let i = 0; i < count; i++) {
    if (offset + 9 > payload.length) break
    let startTicks = payload.readBigUInt64BE(offset)
    offset += 8
    let titleLen = payload[offset]
    offset += 1
    if (offset + titleLen > payload.length) break
    let title = payload.subarray(offset, offset + titleLen).toString('utf8')
    offset += titleLen
    chapters.push({ startSec: Number(startTicks) / MP4_TICKS_PER_SEC, title })
  }
  return chapters
}

const ID = {
  ebml: 0x1a45dfa3,
  segment: 0x18538067,
  seekHead: 0x114d9b74,
  seek: 0x4dbb,
  seekId: 0x53ab,
  seekPosition: 0x53ac,
  chapters: 0x1043a770,
  edition: 0x45b9,
  chapterAtom: 0xb6,
  chapterTimeStart: 0x91,
  chapterDisplay: 0x80,
  chapterString: 0x85,
  chapterHidden: 0x98,
  cluster: 0x1f43b675,
} as const

async function readVint(
  fh: fs.FileHandle,
  pos: number,
  asId = false,
): Promise<{ value: number; length: number } | null> {
  let first = await readAt(fh, pos, 1)
  if (first.length < 1) return null
  let lead = first[0]
  let length = 1
  let mask = 0x80
  while (length <= 8 && (lead & mask) === 0) {
    length++
    mask >>= 1
  }
  if (length > 8) return null
  let bytes = length === 1 ? first : Buffer.concat([first, await readAt(fh, pos + 1, length - 1)])
  if (bytes.length < length) return null
  if (asId) {
    let value = 0
    for (let i = 0; i < length; i++) value = (value << 8) + bytes[i]
    return { value, length }
  }
  let value = bytes[0] & (mask - 1)
  for (let i = 1; i < length; i++) value = value * 256 + bytes[i]
  return { value, length }
}

async function readMatroskaChapters(fh: fs.FileHandle, fileSize: number): Promise<VideoChapter[]> {
  let pos = 0
  let header = await readVint(fh, pos, true)
  if (!header || header.value !== ID.ebml) return []
  pos += header.length
  let size = await readVint(fh, pos)
  if (!size) return []
  pos += size.length + size.value
  let segmentId = await readVint(fh, pos, true)
  if (!segmentId || segmentId.value !== ID.segment) return []
  pos += segmentId.length
  let segmentSize = await readVint(fh, pos)
  if (!segmentSize) return []
  pos += segmentSize.length
  let segmentStart = pos
  let segmentEnd =
    segmentSize.value === 0x00ffffffffffffff || segmentSize.value > fileSize
      ? fileSize
      : Math.min(fileSize, segmentStart + segmentSize.value)

  let chapterOffset: number | null = null
  let walkEnd = Math.min(segmentEnd, segmentStart + 2_000_000)
  let cursor = segmentStart
  while (cursor + 2 < walkEnd) {
    let id = await readVint(fh, cursor, true)
    if (!id) break
    let body = await readVint(fh, cursor + id.length)
    if (!body) break
    let payload = cursor + id.length + body.length
    let next = payload + body.value
    if (id.value === ID.seekHead) {
      chapterOffset = await chapterOffsetFromSeekHead(fh, payload, Math.min(next, segmentEnd), segmentStart)
    } else if (id.value === ID.chapters) {
      return parseChapterPayload(fh, payload, Math.min(next, segmentEnd))
    }
    if (id.value === ID.cluster) break
    if (!Number.isFinite(next) || next <= cursor) break
    cursor = next
  }
  if (chapterOffset == null) return []
  let at = chapterOffset
  let id = await readVint(fh, at, true)
  if (!id || id.value !== ID.chapters) return []
  let body = await readVint(fh, at + id.length)
  if (!body) return []
  let payload = at + id.length + body.length
  return parseChapterPayload(fh, payload, Math.min(payload + body.value, fileSize))
}

async function chapterOffsetFromSeekHead(
  fh: fs.FileHandle,
  start: number,
  end: number,
  segmentStart: number,
): Promise<number | null> {
  let pos = start
  while (pos + 2 < end) {
    let id = await readVint(fh, pos, true)
    if (!id) break
    let body = await readVint(fh, pos + id.length)
    if (!body) break
    let payload = pos + id.length + body.length
    let next = payload + body.value
    if (id.value === ID.seek) {
      let seekId: number | null = null
      let seekPos: number | null = null
      let inner = payload
      while (inner + 2 < next) {
        let child = await readVint(fh, inner, true)
        if (!child) break
        let childSize = await readVint(fh, inner + child.length)
        if (!childSize) break
        let dataAt = inner + child.length + childSize.length
        if (child.value === ID.seekId) {
          let bytes = await readAt(fh, dataAt, childSize.value)
          seekId = 0
          for (let b of bytes) seekId = (seekId << 8) + b
        } else if (child.value === ID.seekPosition) {
          let bytes = await readAt(fh, dataAt, childSize.value)
          seekPos = 0
          for (let b of bytes) seekPos = seekPos * 256 + b
        }
        inner = dataAt + childSize.value
      }
      if (seekId === ID.chapters && seekPos != null) return segmentStart + seekPos
    }
    pos = next
  }
  return null
}

async function parseChapterPayload(fh: fs.FileHandle, start: number, end: number): Promise<VideoChapter[]> {
  let chapters: VideoChapter[] = []
  async function walk(pos: number, limit: number, atom: { start?: number; title?: string; hidden?: boolean }) {
    let cursor = pos
    while (cursor + 2 < limit) {
      let id = await readVint(fh, cursor, true)
      if (!id) break
      let body = await readVint(fh, cursor + id.length)
      if (!body) break
      let payload = cursor + id.length + body.length
      let next = Math.min(payload + body.value, limit)
      if (id.value === ID.edition || id.value === ID.chapterAtom || id.value === ID.chapterDisplay) {
        let child = id.value === ID.chapterAtom ? { start: undefined, title: undefined, hidden: false } : atom
        await walk(payload, next, child)
        if (id.value === ID.chapterAtom && child.start != null && !child.hidden) {
          chapters.push({ startSec: child.start / NS_PER_SEC, title: child.title ?? '' })
        }
      } else if (id.value === ID.chapterTimeStart) {
        let bytes = await readAt(fh, payload, next - payload)
        let value = 0
        for (let b of bytes) value = value * 256 + b
        atom.start = value
      } else if (id.value === ID.chapterString) {
        atom.title = (await readAt(fh, payload, next - payload)).toString('utf8')
      } else if (id.value === ID.chapterHidden) {
        let bytes = await readAt(fh, payload, Math.max(1, next - payload))
        atom.hidden = bytes[0] === 1
      }
      if (next <= cursor) break
      cursor = next
    }
  }
  await walk(start, end, {})
  return chapters
}
