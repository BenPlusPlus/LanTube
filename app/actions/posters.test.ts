import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { addUploadedVideo, deleteVideo, type Video } from '../data/library.ts'
import { mediaDir } from '../data/media.ts'
import { forgetPoster, postersDir, queuePosterSizes, removePoster, startPosterSizes, thumbSources } from '../data/posters.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

const id = 'poster-sizes-clip'
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

async function get(url: string) {
  let response = await router.fetch(new Request(new URL(url, 'http://localhost')))
  return { response, body: await response.text() }
}

function addClip(): Video {
  return addUploadedVideo({ id, title: 'Poster sizes clip', channelId: 'mia', durationSec: 60, thumb: `/poster/${id}`, tags: [] })
}

function writePoster(bytes: string) {
  fs.mkdirSync(postersDir, { recursive: true })
  fs.writeFileSync(path.join(postersDir, `${id}.jpg`), bytes)
  forgetPoster(id)
}

/** What the background job leaves, as far as cards and the route can tell. */
function writeSizes() {
  for (let width of [320, 480, 640]) fs.writeFileSync(path.join(postersDir, `${id}.${width}.jpg`), `${width}px copy`)
  forgetPoster(id)
}

/** The channel page's `<img>` for this clip. */
async function cardImage() {
  let { body } = await get(routes.channel.href({ channelId: 'mia' }))
  let tag = body.match(new RegExp(`<img[^>]*src="/poster/${id}[^"]*"[^>]*>`))?.[0]
  assert.ok(tag, 'the clip has a card with its poster')
  let attr = (name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]?.replaceAll('&amp;', '&')
  return { src: attr('src')!, srcset: attr('srcset'), sizes: attr('sizes') }
}

afterEach(() => {
  deleteVideo(id)
  fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  forgetPoster(id)
  startPosterSizes({ NODE_ENV: 'test' })
})

describe('Poster sizes on cards', () => {
  it('loads the full poster until its smaller copies exist, then lets the browser pick one', async () => {
    addClip()
    writePoster('full poster')

    let before = await cardImage()
    assert.equal(before.srcset, undefined)
    assert.equal((await get(before.src)).body, 'full poster')

    writeSizes()
    let after = await cardImage()
    assert.ok(after.srcset, 'the card offers the smaller copies')
    assert.match(after.sizes ?? '', /^auto, /)
    let candidates = after.srcset.split(', ').map((entry) => entry.split(' '))
    assert.deepEqual(
      candidates.map(([, descriptor]) => descriptor),
      ['320w', '480w', '640w'],
    )
    for (let [url, descriptor] of candidates) {
      let { response, body } = await get(url)
      assert.equal(body, `${descriptor.slice(0, -1)}px copy`)
      assert.equal(response.headers.get('Cache-Control'), 'private, max-age=31536000, immutable')
    }
  })

  it('has the browser check again on a URL that is out of date or stands in for a missing copy', async () => {
    addClip()
    writePoster('first poster')
    let first = await cardImage()

    // A Video deleted and uploaded again under the same slug gets a new poster and new URLs.
    await new Promise((resolve) => setTimeout(resolve, 20))
    writePoster('second poster')
    let second = await cardImage()
    assert.notEqual(second.src, first.src)

    let stale = await get(first.src)
    assert.equal(stale.body, 'second poster')
    assert.equal(stale.response.headers.get('Cache-Control'), 'private, no-cache')

    // Asked for a copy that isn't made yet: the full poster, but not kept.
    let early = await get(`${second.src}&w=320`)
    assert.equal(early.body, 'second poster')
    assert.equal(early.response.headers.get('Cache-Control'), 'private, no-cache')

    assert.equal((await get(second.src)).response.headers.get('Cache-Control'), 'private, max-age=31536000, immutable')
  })
})

describe('Making poster sizes', () => {
  async function until(check: () => boolean, ms: number) {
    let end = Date.now() + ms
    while (!check()) {
      if (Date.now() > end) return false
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return true
  }

  function dimensions(file: string) {
    let probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' })
    return probe.stdout.trim()
  }

  it('writes 320, 480 and 640 wide copies, then removes them with the poster', { skip: hasFfmpeg ? undefined : 'ffmpeg is not installed', timeout: 30_000 }, async () => {
    fs.mkdirSync(postersDir, { recursive: true })
    let poster = path.join(postersDir, `${id}.jpg`)
    let made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720', '-frames:v', '1', '-update', '1', '-q:v', '2', poster])
    assert.equal(made.status, 0, String(made.stderr))
    let video = addClip()

    startPosterSizes({ NODE_ENV: 'test' }, { enabled: true, backfill: false })
    queuePosterSizes(id)
    assert.ok(await until(() => thumbSources(video)?.srcset !== undefined, 20_000), 'the copies were never made')

    let full = fs.statSync(poster).size
    for (let [width, height] of [
      [320, 180],
      [480, 270],
      [640, 360],
    ]) {
      let copy = path.join(postersDir, `${id}.${width}.jpg`)
      assert.equal(dimensions(copy), `${width},${height}`)
      assert.ok(fs.statSync(copy).size < full, `the ${width}px copy is smaller than the poster`)
    }
    assert.deepEqual(
      fs.readdirSync(postersDir).filter((name) => name.includes('.partial')),
      [],
      'no half-made copy is left behind',
    )

    await removePoster(video)
    assert.deepEqual(fs.readdirSync(postersDir), [])
    assert.equal(thumbSources(video)?.srcset, undefined)
  })
})
