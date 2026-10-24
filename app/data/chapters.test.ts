import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { chaptersFromFile } from './chapters.ts'

const files: string[] = []

afterEach(async () => {
  for (let file of files.splice(0)) await fsp.rm(file, { force: true })
})

function box(type: string, payload: Buffer) {
  let buf = Buffer.alloc(8 + payload.length)
  buf.writeUInt32BE(buf.length, 0)
  buf.write(type, 4, 4, 'ascii')
  payload.copy(buf, 8)
  return buf
}

function chplBox(chapters: { startSec: number; title: string }[]) {
  let titles = chapters.map((chapter) => Buffer.from(chapter.title, 'utf8'))
  let payload = Buffer.alloc(5 + titles.reduce((n, title) => n + 9 + title.length, 0))
  payload[4] = chapters.length
  let offset = 5
  for (let i = 0; i < chapters.length; i++) {
    payload.writeBigUInt64BE(BigInt(Math.round(chapters[i].startSec * 10_000_000)), offset)
    offset += 8
    payload[offset] = titles[i].length
    offset += 1
    titles[i].copy(payload, offset)
    offset += titles[i].length
  }
  return box('chpl', payload)
}

function idBuf(id: number) {
  if (id <= 0xff) return Buffer.from([id])
  if (id <= 0xffff) return Buffer.from([(id >> 8) & 0xff, id & 0xff])
  if (id <= 0xffffff) return Buffer.from([(id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff])
  return Buffer.from([(id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff])
}

function sizeBuf(n: number) {
  if (n < 127) return Buffer.from([0x80 | n])
  let buf = Buffer.alloc(3)
  buf[0] = 0x20
  buf.writeUInt16BE(n, 1)
  return buf
}

function el(id: number, payload: Buffer) {
  return Buffer.concat([idBuf(id), sizeBuf(payload.length), payload])
}

function uint(n: number) {
  if (n === 0) return Buffer.from([0])
  let bytes: number[] = []
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n = Math.floor(n / 256)
  }
  return Buffer.from(bytes)
}

async function writeTemp(name: string, bytes: Buffer) {
  let file = path.join(os.tmpdir(), `lantube-${name}-${Date.now()}`)
  await fsp.writeFile(file, bytes)
  files.push(file)
  return file
}

describe('chaptersFromFile', () => {
  it('reads Nero chapters from an MP4 udta box', async () => {
    let bytes = Buffer.concat([
      box('ftyp', Buffer.from('isom')),
      box(
        'moov',
        box(
          'udta',
          chplBox([
            { startSec: 0, title: 'Dock' },
            { startSec: 12.5, title: 'Bay' },
          ]),
        ),
      ),
    ])
    let chapters = await chaptersFromFile(await writeTemp('chpl.mp4', bytes))
    assert.deepEqual(chapters, [
      { startSec: 0, title: 'Dock' },
      { startSec: 12.5, title: 'Bay' },
    ])
  })

  it('reads Matroska chapter atoms', async () => {
    let atom = (startNs: number, title: string) =>
      el(
        0xb6,
        Buffer.concat([
          el(0x91, uint(startNs)),
          el(0x80, el(0x85, Buffer.from(title, 'utf8'))),
        ]),
      )
    let segment = el(
      0x18538067,
      el(0x1043a770, el(0x45b9, Buffer.concat([atom(0, 'Cold open'), atom(15_000_000_000, 'Credits')]))),
    )
    let bytes = Buffer.concat([el(0x1a45dfa3, Buffer.from([0x42, 0x86, 0x81, 0x01])), segment])
    let chapters = await chaptersFromFile(await writeTemp('chapters.mkv', bytes))
    assert.deepEqual(chapters, [
      { startSec: 0, title: 'Cold open' },
      { startSec: 15, title: 'Credits' },
    ])
  })

  it('returns nothing when the file has no chapter list', async () => {
    let bytes = Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov', box('mvhd', Buffer.alloc(4)))])
    assert.deepEqual(await chaptersFromFile(await writeTemp('plain.mp4', bytes)), [])
  })
})
