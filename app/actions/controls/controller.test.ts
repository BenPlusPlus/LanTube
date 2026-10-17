import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { recordWatchProgress, recordWatchStart, resetHistory } from '../../data/history.ts'
import { getPerson } from '../../data/household.ts'
import { getVideo } from '../../data/library.ts'
import { extraToday, limitFor, resetWatchLimits, setDailyLimit } from '../../data/watch-limits.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

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

function post(path: string, fields: Record<string, string>, cookie?: string) {
  let body = new FormData()
  for (let [key, value] of Object.entries(fields)) body.set(key, value)
  return router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      method: 'POST',
      body,
      headers: cookie ? { Cookie: cookie } : undefined,
      redirect: 'manual',
    }),
  )
}

const controls = routes.controls.action.href()

function makeRoles() {
  getPerson('ruth')!.isParent = true
  getPerson('mia')!.isAdmin = true
}

function dropRoles() {
  for (let id of ['mia', 'tomas', 'ruth', 'leo', 'priya']) {
    let person = getPerson(id)!
    person.isParent = undefined
    person.isAdmin = undefined
  }
}

describe('parental controls page', () => {
  afterEach(() => {
    dropRoles()
    resetWatchLimits()
    resetHistory()
  })

  it('sends signed-out visitors to sign in', async () => {
    let { response } = await get(routes.controls.index.href())
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.signin.index.href())
  })

  it('is for Parents only, even an Admin who isn’t one', async () => {
    makeRoles()
    let { response, html } = await get(routes.controls.index.href(), await signIn('mia'))
    assert.equal(response.status, 403)
    assert.match(html, /You need to be a Parent/)

    let refused = await post(controls, { intent: 'limit', personId: 'leo', minutes: '5' }, await signIn('mia'))
    assert.equal(refused.status, 403)
    assert.equal(limitFor('leo'), null)
  })

  it('lists one row per limited Person and names the Parents and Admins who aren’t limited', async () => {
    makeRoles()
    let { response, html } = await get(routes.controls.index.href(), await signIn('ruth'))
    assert.equal(response.status, 200)
    for (let id of ['tomas', 'leo', 'priya']) assert.match(html, new RegExp(`id="controls-${id}"`))
    assert.doesNotMatch(html, /id="controls-ruth"/)
    assert.doesNotMatch(html, /id="controls-mia"/)
    assert.match(html, /Parents and Admins aren’t limited: Mia and Ruth\./)
  })

  it('shows the Parental controls link in the account menu to Parents only', async () => {
    makeRoles()
    assert.match((await get(routes.home.href(), await signIn('ruth'))).html, /Parental controls/)
    assert.doesNotMatch((await get(routes.home.href(), await signIn('leo'))).html, /Parental controls/)
  })

  it('sets different limits for different people', async () => {
    makeRoles()
    let ruth = await signIn('ruth')
    let saved = await post(controls, { intent: 'limit', personId: 'leo', minutes: '5' }, ruth)
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), `${routes.controls.index.href()}#controls-leo`)
    await post(controls, { intent: 'limit', personId: 'priya', minutes: '30' }, ruth)

    assert.equal(limitFor('leo'), 5)
    assert.equal(limitFor('priya'), 30)

    let { html } = await get(routes.controls.index.href(), ruth)
    assert.match(html, /id="controls-leo"[\s\S]*?5 min left[\s\S]*?id="controls-priya"/)
    assert.match(html, /id="controls-priya"[\s\S]*?30 min left/)

    await post(controls, { intent: 'limit', personId: 'leo', minutes: 'none' }, ruth)
    assert.equal(limitFor('leo'), null)
  })

  it('adds 5 minutes twice as 10 minutes of extra time, and Clear removes it', async () => {
    makeRoles()
    let ruth = await signIn('ruth')
    await post(controls, { intent: 'limit', personId: 'leo', minutes: '20' }, ruth)
    assert.equal((await post(controls, { intent: 'extend', personId: 'leo', minutes: '5' }, ruth)).status, 303)
    assert.equal((await post(controls, { intent: 'extend', personId: 'leo', minutes: '5' }, ruth)).status, 303)

    let { html } = await get(routes.controls.index.href(), ruth)
    assert.match(html, /id="controls-leo"[\s\S]*?30 min left[\s\S]*?\+10 min/)
    assert.equal(extraToday('leo'), 10)

    await post(controls, { intent: 'clear', personId: 'leo' }, ruth)
    assert.equal(extraToday('leo'), 0)
  })

  it('explains a change it can’t make on that person’s row', async () => {
    makeRoles()
    let response = await post(controls, { intent: 'extend', personId: 'leo', minutes: '5' }, await signIn('ruth'))
    let html = await response.text()
    assert.equal(response.status, 400)
    assert.match(html, /id="controls-error-leo" role="alert"[^>]*>Leo has no limit, so there’s nothing to extend\./)
  })
})

describe('watching with a daily limit', () => {
  afterEach(() => {
    dropRoles()
    resetWatchLimits()
    resetHistory()
  })

  async function useUp(personId: string, minutes: number) {
    getPerson('ruth')!.isParent = true
    await setDailyLimit('ruth', personId, minutes)
    let video = getVideo('treehouse-3')!
    let start = Date.now() - minutes * 60_000
    await recordWatchStart(personId, video, start)
    await recordWatchProgress(personId, video, minutes * 60, undefined, Date.now())
  }

  it('tells the player how much time is left, and nothing to someone without a limit', async () => {
    getPerson('ruth')!.isParent = true
    await setDailyLimit('ruth', 'leo', 10)

    let leo = await post(routes.watchActivity.href({ videoId: 'rosie-one' }), { event: 'play' }, await signIn('leo'))
    assert.equal(leo.status, 200)
    assert.deepEqual(await leo.json(), { remainingSec: 600 })

    let tomas = await post(routes.watchActivity.href({ videoId: 'rosie-one' }), { event: 'play' }, await signIn('tomas'))
    assert.equal(tomas.status, 204)
    assert.match((await get(routes.watch.href({ videoId: 'rosie-one' }), await signIn('leo'))).html, /"timeLeftSec":600/)
  })

  it('stops someone whose time is up: the player, the file, and the play count', async () => {
    await useUp('priya', 5)
    let priya = await signIn('priya')

    assert.match((await get(routes.watch.href({ videoId: 'tahoe-day-2' }), priya)).html, /"timeLeftSec":0/)
    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }), priya)).response.status, 403)
    let play = await post(routes.watchActivity.href({ videoId: 'tahoe-day-2' }), { event: 'play' }, priya)
    assert.deepEqual(await play.json(), { remainingSec: 0 })

    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }), await signIn('tomas'))).response.status, 200)
  })

  it('lets extra time reach someone whose time was up', async () => {
    await useUp('priya', 5)
    let priya = await signIn('priya')
    await post(controls, { intent: 'extend', personId: 'priya', minutes: '10' }, await signIn('ruth'))

    assert.equal((await get(routes.media.href({ videoId: 'tahoe-day-2' }), priya)).response.status, 200)
    assert.match((await get(routes.watch.href({ videoId: 'tahoe-day-2' }), priya)).html, /"timeLeftSec":600/)
  })
})
