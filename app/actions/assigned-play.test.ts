import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { assign, highWaterOf, isAssigned, resetAssignments, unassign } from '../data/assignments.ts'
import { restoreDefaultBrand, setUnsignedWatch } from '../data/brand.ts'
import { recordWatchProgress, recordWatchStart, resetHistory } from '../data/history.ts'
import { getPerson } from '../data/household.ts'
import { getVideo } from '../data/library.ts'
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

async function get(path: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      redirect: 'manual',
      ...(cookie ? { headers: { Cookie: cookie } } : undefined),
    }),
  )
  return { response, html: await response.text() }
}

function withRoles() {
  getPerson('ruth')!.isParent = true
  getPerson('mia')!.isAdmin = true
  getPerson('tomas')!.isAdmin = true
}

function dropRoles() {
  for (let id of ['mia', 'tomas', 'ruth', 'leo', 'priya']) {
    let person = getPerson(id)
    if (person) {
      person.isParent = undefined
      person.isAdmin = undefined
    }
  }
}

describe('assigned play gate on Watch', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
    resetWatchLimits()
    resetHistory()
  })

  it('shows Finish your assigned videos first and a Home control, without loading the player', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    let leo = await signIn('leo')
    let { response, html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }), leo)

    assert.equal(response.status, 200)
    assert.match(html, /<h1[^>]*>Lake Tahoe 2025, day 2: Emerald Bay at sunset<\/h1>/)
    assert.match(html, /Finish your assigned videos first/)
    assert.match(html, new RegExp(`href="${routes.home.href()}"[^>]*>Home`))
    assert.doesNotMatch(html, /class="player-video"/)
    assert.doesNotMatch(html, new RegExp(`src="${routes.media.href({ videoId: 'tahoe-day-2' })}"`))
  })

  it('still plays a Video assigned to that Person', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    let leo = await signIn('leo')
    let { html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }), leo)

    assert.doesNotMatch(html, /Finish your assigned videos first/)
    assert.match(html, new RegExp(`src="${routes.media.href({ videoId: 'tahoe-day-2' })}"`))
  })

  it('caps assigned Watch at 1.5× and starts a never-started Video at 0', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), 0)
    let leo = await signIn('leo')
    let { html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }), leo)

    assert.match(html, /"maxRate":1\.5\b/)
    assert.match(html, /"furthestAt":0\b/)
    assert.doesNotMatch(html, /"resumeAt"/)
    assert.match(html, />1\.5×</)
    assert.doesNotMatch(html, />1\.75×</)
    assert.doesNotMatch(html, />2×</)
  })

  it('keeps resume and opens high-water when assigning an in-progress Video', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 200, undefined, start + 200_000)
    assert.equal(await assign('ruth', 'leo', video.id), true)
    assert.equal(highWaterOf('leo', video.id), 200)

    let leo = await signIn('leo')
    let { html } = await get(routes.watch.href({ videoId: video.id }), leo)
    assert.match(html, /"resumeAt":200\b/)
    assert.match(html, /"furthestAt":200\b/)
    assert.match(html, /"maxRate":1\.5\b/)
  })

  it('starts at 0 when assigning a Video this Person already finished', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 1470, undefined, start + 1470_000)
    assert.equal(await assign('ruth', 'leo', video.id), true)
    assert.equal(highWaterOf('leo', video.id), 0)

    let leo = await signIn('leo')
    let { html } = await get(routes.watch.href({ videoId: video.id }), leo)
    assert.doesNotMatch(html, /"resumeAt"/)
    assert.match(html, /"furthestAt":0\b/)
    assert.match(html, /"maxRate":1\.5\b/)
  })

  it('restores the full speed ladder after the Assignment is gone', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(await unassign('ruth', 'leo', 'tahoe-day-2'), true)
    let leo = await signIn('leo')
    let { html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }), leo)

    assert.doesNotMatch(html, /"maxRate"/)
    assert.doesNotMatch(html, /"furthestAt"/)
    assert.match(html, />1\.5×</)
    assert.match(html, />1\.75×</)
    assert.match(html, />2×</)
  })
})

describe('assigned play gate on /media and play', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
    resetWatchLimits()
    resetHistory()
  })

  it('returns 403 for a non-assigned Video while Assignments remain, and 200 after the set is empty', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    let leo = await signIn('leo')
    let media = routes.media.href({ videoId: 'tahoe-day-2' })

    let blocked = await get(media, leo)
    assert.equal(blocked.response.status, 403)
    assert.match(blocked.html, /Finish your assigned videos first/)

    let play = await router.fetch(
      new Request(new URL(routes.watchActivity.href({ videoId: 'tahoe-day-2' }), 'http://localhost'), {
        method: 'POST',
        body: new URLSearchParams({ event: 'play' }),
        headers: { Cookie: leo, 'Content-Type': 'application/x-www-form-urlencoded' },
        redirect: 'manual',
      }),
    )
    assert.equal(play.status, 403)

    assert.equal(await unassign('ruth', 'leo', 'rosie-one'), true)
    assert.equal(isAssigned('leo', 'rosie-one'), false)
    assert.equal((await get(media, leo)).response.status, 200)
  })

  it('returns 200 for an assigned Video', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    let leo = await signIn('leo')
    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }), leo)).response.status, 200)
  })

  it('still serves the original assigned file with Range', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    let leo = await signIn('leo')
    let response = await router.fetch(
      new Request(new URL(routes.media.href({ videoId: 'tahoe-day-2' }), 'http://localhost'), {
        headers: { Cookie: leo, Range: 'bytes=0-9' },
        cache: 'no-store',
      }),
    )

    assert.equal(response.status, 206)
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-9/256')
    assert.equal((await response.arrayBuffer()).byteLength, 10)
  })
})

describe('assigned play vs daily time-up', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
    resetWatchLimits()
    resetHistory()
  })

  it('still shows time-up on an assigned Video and keeps the Assignment', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)
    await setDailyLimit('ruth', 'priya', 5)
    let spent = getVideo('treehouse-3')!
    let start = Date.now() - 5 * 60_000
    await recordWatchStart('priya', spent, start)
    await recordWatchProgress('priya', spent, 5 * 60, undefined, Date.now())

    let priya = await signIn('priya')
    let { html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }), priya)
    assert.match(html, /That’s all the watching for today/)
    assert.doesNotMatch(html, /Finish your assigned videos first/)
    assert.match(html, /"timeLeftSec":0/)

    let media = await get(routes.media.href({ videoId: 'tahoe-day-2' }), priya)
    assert.equal(media.response.status, 403)
    assert.match(media.html, /Time’s up for today/)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)
  })
})

describe('assigned play vs unsigned watch', () => {
  afterEach(async () => {
    dropRoles()
    resetAssignments()
    await restoreDefaultBrand()
  })

  it('does not apply the Assignment gate to unsigned requests', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)

    let watch = await get(routes.watch.href({ videoId: 'tahoe-day-2' }))
    assert.equal(watch.response.status, 200)
    assert.doesNotMatch(watch.html, /Finish your assigned videos first/)
    assert.match(watch.html, new RegExp(`src="${routes.media.href({ videoId: 'tahoe-day-2' })}"`))
    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }))).response.status, 200)
  })

  it('still follows the house Unsigned watch setting', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    await setUnsignedWatch(false)

    let watch = await get(routes.watch.href({ videoId: 'tahoe-day-2' }))
    assert.equal(watch.response.status, 303)
    assert.equal(watch.response.headers.get('Location'), routes.signin.index.href())
    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }))).response.status, 401)
  })
})


