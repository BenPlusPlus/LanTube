import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { assign, resetAssignments } from '../data/assignments.ts'
import { restoreDefaultBrand, setUnsignedWatch } from '../data/brand.ts'
import { recordWatchProgress, recordWatchStart, resetHistory } from '../data/history.ts'
import { getPerson } from '../data/household.ts'
import { addUploadedVideo, deleteVideo, getVideo } from '../data/library.ts'
import { mediaDir } from '../data/media.ts'
import { LADDER_VERSION, renditionsDir } from '../data/renditions.ts'
import { resetWatchLimits, setDailyLimit } from '../data/watch-limits.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

async function signIn(personId: string) {
  let response = await router.fetch(
    new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `intent=signin&personId=${personId}&password=house`,
      redirect: 'manual',
    }),
  )
  let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
  assert.ok(header, 'Expected an lt_session cookie')
  return header.split(';', 1)[0]
}

async function get(pathname: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(pathname, 'http://localhost'), {
      redirect: 'manual',
      ...(cookie ? { headers: { Cookie: cookie } } : undefined),
    }),
  )
  return { response, body: await response.text() }
}

/** Renditions as the encoder leaves them, stamped against the file that's on the share. */
function makeRenditions(videoId: string, sourceFile: string) {
  let dir = path.join(renditionsDir, videoId)
  fs.mkdirSync(path.join(dir, '480p'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'master.m3u8'), '#EXTM3U\n480p/index.m3u8\n')
  fs.writeFileSync(path.join(dir, '480p', 'index.m3u8'), '#EXTM3U\nseg-00000.m4s\n')
  fs.writeFileSync(path.join(dir, '480p', 'seg-00000.m4s'), 'segment bytes')
  let stat = fs.statSync(path.join(mediaDir, sourceFile))
  fs.writeFileSync(
    path.join(dir, 'source.json'),
    JSON.stringify({ version: LADDER_VERSION, size: stat.size, mtimeMs: Math.round(stat.mtimeMs) }),
  )
}

const tahoe = 'tahoe-day-2'
const master = routes.hls.href({ videoId: tahoe, path: 'master.m3u8' })

function withTahoeRenditions() {
  let video = getVideo(tahoe)!
  makeRenditions(tahoe, video.file ?? `${tahoe}.mp4`)
}

describe('Renditions on Watch', () => {
  afterEach(() => {
    fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  })

  it('offers the HLS ladder only once the host has made it', async () => {
    let before = await get(routes.watch.href({ videoId: tahoe }))
    assert.doesNotMatch(before.body, /"hlsSrc"/)
    assert.match(before.body, new RegExp(`src="${routes.media.href({ videoId: tahoe })}"`))

    withTahoeRenditions()
    let after = await get(routes.watch.href({ videoId: tahoe }))
    assert.match(after.body, new RegExp(`"hlsSrc":"${master}"`))
    // The original stays available so the player can fall back to it.
    assert.match(after.body, new RegExp(`"src":"${routes.media.href({ videoId: tahoe })}"`))
  })
})

describe('/hls', () => {
  afterEach(async () => {
    fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
    for (let id of ['mia', 'tomas', 'ruth', 'leo', 'priya']) {
      let person = getPerson(id)
      if (person) {
        person.isParent = undefined
        person.isAdmin = undefined
      }
    }
    deleteVideo('hls-secret-clip')
    resetAssignments()
    resetWatchLimits()
    resetHistory()
    await restoreDefaultBrand()
  })

  it('serves playlists and segments with their HLS types, and nothing else', async () => {
    withTahoeRenditions()
    let playlist = await get(master)
    assert.equal(playlist.response.status, 200)
    assert.equal(playlist.response.headers.get('Content-Type'), 'application/vnd.apple.mpegurl')
    assert.match(playlist.body, /480p\/index\.m3u8/)

    let segment = await get(routes.hls.href({ videoId: tahoe, path: '480p/seg-00000.m4s' }))
    assert.equal(segment.response.status, 200)
    assert.equal(segment.response.headers.get('Content-Type'), 'video/iso.segment')

    assert.equal((await get(routes.hls.href({ videoId: tahoe, path: 'source.json' }))).response.status, 404)
    assert.equal((await get(`/hls/${tahoe}/480p/..%2F..%2F..%2F${tahoe}.mp4`)).response.status, 404)
  })

  it('is a 404 before the host has made anything', async () => {
    assert.equal((await get(master)).response.status, 404)
  })

  it('hides a private Video’s Renditions from people who cannot watch it', async () => {
    addUploadedVideo({
      id: 'hls-secret-clip',
      title: 'Secret clip',
      channelId: 'mia',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
      private: true,
      audience: ['priya'],
      file: getVideo(tahoe)!.file,
    })
    makeRenditions('hls-secret-clip', getVideo(tahoe)!.file ?? `${tahoe}.mp4`)
    let secret = routes.hls.href({ videoId: 'hls-secret-clip', path: 'master.m3u8' })

    assert.equal((await get(secret)).response.status, 404)
    assert.equal((await get(secret, await signIn('leo'))).response.status, 404)
    assert.equal((await get(secret, await signIn('priya'))).response.status, 200)
  })

  it('holds the same Assignment, daily limit, and sign-in rules as the original file', async () => {
    withTahoeRenditions()
    getPerson('ruth')!.isParent = true

    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    let assigned = await get(master, await signIn('leo'))
    assert.equal(assigned.response.status, 403)
    assert.match(assigned.body, /Finish your assigned videos first/)

    await setDailyLimit('ruth', 'priya', 5)
    let spent = getVideo('treehouse-3')!
    await recordWatchStart('priya', spent, Date.now() - 5 * 60_000)
    await recordWatchProgress('priya', spent, 5 * 60, undefined, Date.now())
    let timeUp = await get(routes.hls.href({ videoId: tahoe, path: '480p/seg-00000.m4s' }), await signIn('priya'))
    assert.equal(timeUp.response.status, 403)
    assert.match(timeUp.body, /Time’s up for today/)

    await setUnsignedWatch(false)
    assert.equal((await get(master)).response.status, 401)
  })
})
