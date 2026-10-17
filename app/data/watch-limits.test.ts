import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { recordWatchProgress, recordWatchStart, resetHistory } from './history.ts'
import {
  createPerson,
  getPerson,
  removePerson,
  resetHousehold,
  useEmptyHouse,
  type Person,
} from './household.ts'
import { getVideo, resetChannels } from './library.ts'
import {
  allowanceFor,
  clearExtraToday,
  extendToday,
  extraToday,
  isTimeUp,
  limitFor,
  loadCatalogueWatchLimits,
  resetWatchLimits,
  setDailyLimit,
  usedTodaySec,
  watchDay,
} from './watch-limits.ts'

function local(day: number, hour: number, minute = 0) {
  return new Date(2026, 4, day, hour, minute).getTime()
}

/** Ruth acts as the Parent; mockup People carry no roles of their own. */
function withParent(id = 'ruth') {
  getPerson(id)!.isParent = true
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

describe('watch limits', () => {
  afterEach(() => {
    dropRoles()
    resetWatchLimits()
    resetHistory()
  })

  it('starts each watch day at 5 am, so the small hours belong to the night before', () => {
    assert.equal(watchDay(local(20, 4, 59)), '2026-05-19')
    assert.equal(watchDay(local(20, 5, 0)), '2026-05-20')
    assert.equal(watchDay(local(20, 23, 30)), '2026-05-20')
  })

  it('gives each limited Person their own daily limit', async () => {
    withParent()
    assert.equal(await setDailyLimit('ruth', 'leo', 5), true)
    assert.equal(await setDailyLimit('ruth', 'priya', 30), true)

    assert.equal(allowanceFor(getPerson('leo')!)?.limitMin, 5)
    assert.equal(allowanceFor(getPerson('priya')!)?.limitMin, 30)
    assert.equal(allowanceFor(getPerson('mia')!), null)

    assert.equal(await setDailyLimit('ruth', 'leo', null), true)
    assert.equal(limitFor('leo'), null)
  })

  it('adds up extra time given twice in a day, and Clear takes it all back', async () => {
    withParent()
    let now = local(20, 18)
    await setDailyLimit('ruth', 'leo', 30)
    assert.equal(await extendToday('ruth', 'leo', 5, now), true)
    assert.equal(await extendToday('ruth', 'leo', 5, now), true)

    assert.equal(extraToday('leo', now), 10)
    assert.equal(allowanceFor(getPerson('leo')!, now)?.remainingSec, 40 * 60)

    assert.equal(await clearExtraToday('ruth', 'leo', now), true)
    assert.equal(extraToday('leo', now), 0)
  })

  it('lets extra time lapse at 5 am the next morning', async () => {
    withParent()
    await setDailyLimit('ruth', 'leo', 30)
    await extendToday('ruth', 'leo', 20, local(20, 23))

    assert.equal(extraToday('leo', local(21, 4, 30)), 20)
    assert.equal(extraToday('leo', local(21, 5, 0)), 0)
  })

  it('counts video played since 5 am today and calls time when the limit and extra time are used', async () => {
    withParent()
    let video = getVideo('treehouse-3')!
    let start = local(20, 19)
    await setDailyLimit('ruth', 'priya', 5)

    await recordWatchStart('priya', video, start)
    await recordWatchProgress('priya', video, 240, undefined, start + 240_000)
    assert.equal(Math.round(usedTodaySec('priya', start + 240_000)), 240)
    assert.equal(isTimeUp(getPerson('priya'), start + 240_000), false)

    await recordWatchProgress('priya', video, 300, undefined, start + 300_000)
    assert.equal(isTimeUp(getPerson('priya'), start + 300_000), true)

    await extendToday('ruth', 'priya', 10, start + 300_000)
    assert.equal(allowanceFor(getPerson('priya')!, start + 300_000)?.remainingSec, 600)

    assert.equal(Math.round(usedTodaySec('priya', local(21, 6))), 0)
  })

  it('charges a sitting that runs across 5 am only for the minutes after 5 am', async () => {
    let video = getVideo('treehouse-3')!
    let start = local(21, 4, 50)
    await recordWatchStart('priya', video, start)
    for (let s = 60; s <= 1200; s += 60) await recordWatchProgress('priya', video, s, undefined, start + s * 1000)

    assert.equal(Math.round(usedTodaySec('priya', local(21, 5, 10))), 600)
  })

  it('counts play at double speed as watching', async () => {
    let video = getVideo('treehouse-3')!
    let start = local(20, 19)
    await recordWatchStart('priya', video, start)
    await recordWatchProgress('priya', video, 30, undefined, start + 15_000)
    assert.equal(Math.round(usedTodaySec('priya', start + 15_000)), 30)
  })

  it('never limits Parents or Admins', async () => {
    withParent()
    await setDailyLimit('ruth', 'leo', 5)
    getPerson('leo')!.isAdmin = true

    assert.equal(allowanceFor(getPerson('leo')!), null)
    let refused = await setDailyLimit('ruth', 'leo', 10)
    assert.ok(refused !== true && /Parent or Admin/.test(refused.error))
  })

  it('takes changes from Parents only, in the listed amounts', async () => {
    let notParent = await setDailyLimit('mia', 'leo', 10)
    assert.ok(notParent !== true && /need to be a Parent/.test(notParent.error))

    withParent()
    let odd = await setDailyLimit('ruth', 'leo', 7)
    assert.ok(odd !== true && /listed limits/.test(odd.error))

    await setDailyLimit('ruth', 'leo', 10)
    let oddExtra = await extendToday('ruth', 'leo', 15)
    assert.ok(oddExtra !== true && /listed amounts/.test(oddExtra.error))
  })

  it('won’t extend someone who has no limit', async () => {
    withParent()
    let result = await extendToday('ruth', 'leo', 5)
    assert.ok(result !== true && /no limit/.test(result.error))
  })
})

describe('watch limits in the catalogue', () => {
  afterEach(async () => {
    resetWatchLimits()
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
  })

  async function household() {
    await useEmptyHouse()
    let parent = (await createPerson('Sam', 'house', undefined, undefined, true)) as Person
    let child = (await createPerson('Kit', 'house')) as Person
    assert.ok(parent.isParent && !child.isParent)
    return { parent, child }
  }

  it('keeps limits and today’s extra time across a host restart', async () => {
    let { parent, child } = await household()
    await setDailyLimit(parent.id, child.id, 20)
    await extendToday(parent.id, child.id, 5)
    await extendToday(parent.id, child.id, 10)

    resetWatchLimits()
    await loadCatalogueWatchLimits()

    assert.equal(limitFor(child.id), 20)
    assert.equal(extraToday(child.id), 15)
  })

  it('forgets a removed Person’s limit', async () => {
    let { parent, child } = await household()
    await setDailyLimit(parent.id, child.id, 20)
    await extendToday(parent.id, child.id, 5)
    assert.equal(await removePerson(parent.id, child.id), true)

    resetWatchLimits()
    await loadCatalogueWatchLimits()
    assert.equal(limitFor(child.id), null)
    assert.equal(extraToday(child.id), 0)
  })
})
