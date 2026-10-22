import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from './catalogue.ts'
import {
  advanceHighWater,
  assign,
  assignablePeople,
  assignmentsFor,
  dropImpossibleAssignments,
  forgetDeletedVideo,
  highWaterOf,
  houseHasLimitablePeople,
  isAssigned,
  loadCatalogueAssignments,
  mustFinishAssignedFirst,
  resetAssignments,
  unassign,
} from './assignments.ts'
import { recordWatchProgress, recordWatchStart, resetHistory } from './history.ts'
import {
  createPerson,
  getPerson,
  removePerson,
  resetHousehold,
  updatePersonRoles,
  useEmptyHouse,
  type Person,
} from './household.ts'
import {
  addUploadedVideo,
  canWatch,
  deleteVideo,
  getChannel,
  getVideo,
  isInProgress,
  resetChannels,
  updateChannel,
} from './library.ts'

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

describe('assignments', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
    resetHistory()
    let secret = getVideo('secret-clip')
    if (secret) deleteVideo(secret.id)
  })

  it('lets a Parent assign a house-visible Video to each limitable Person, and unassign', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), false)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), 0)
    assert.equal(highWaterOf('priya', 'tahoe-day-2'), undefined)

    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)

    assert.equal(await unassign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), false)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), undefined)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)
  })

  it('omits Parents and Admins from Assign to, and refuses them as assignees', async () => {
    withRoles()
    let names = assignablePeople(getVideo('tahoe-day-2')!).map((person) => person.id)
    assert.deepEqual(names.sort(), ['leo', 'priya'])

    let tomas = await assign('ruth', 'tomas', 'tahoe-day-2')
    assert.ok(tomas !== true && /Parent or Admin/.test(tomas.error))
    assert.equal(isAssigned('tomas', 'tahoe-day-2'), false)

    let notParent = await assign('mia', 'leo', 'tahoe-day-2')
    assert.ok(notParent !== true && /need to be a Parent/.test(notParent.error))
  })

  it('will not assign a private Video the Person cannot already watch, and does not grant sight', async () => {
    withRoles()
    let secret = addUploadedVideo({
      id: 'secret-clip',
      title: 'Secret clip',
      channelId: 'mia',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
      private: true,
      audience: ['priya'],
    })
    assert.equal(canWatch(secret, 'leo'), false)
    assert.equal(canWatch(secret, 'priya'), true)

    let names = assignablePeople(secret).map((person) => person.id)
    assert.deepEqual(names, ['priya'])

    let refused = await assign('ruth', 'leo', 'secret-clip')
    assert.ok(refused !== true && /Audience first/.test(refused.error))
    assert.equal(isAssigned('leo', 'secret-clip'), false)
    assert.equal(canWatch(secret, 'leo'), false)

    assert.equal(await assign('ruth', 'priya', 'secret-clip'), true)
    assert.equal(canWatch(secret, 'leo'), false)
    assert.equal(canWatch(secret, 'priya'), true)
    assert.deepEqual(secret.audience, ['priya'])
  })

  it('hides Assign to when the house has no limitable People', () => {
    withRoles()
    assert.equal(houseHasLimitablePeople(), true)
    getPerson('leo')!.isParent = true
    getPerson('priya')!.isAdmin = true
    assert.equal(houseHasLimitablePeople(), false)
  })

  it('blocks a limitable Person from any Video that is not assigned while Assignments remain', async () => {
    withRoles()
    let leo = getPerson('leo')
    let priya = getPerson('priya')
    let ruth = getPerson('ruth')

    assert.equal(mustFinishAssignedFirst(leo, 'tahoe-day-2'), false)
    assert.equal(mustFinishAssignedFirst(null, 'tahoe-day-2'), false)

    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    assert.equal(mustFinishAssignedFirst(leo, 'rosie-one'), false)
    assert.equal(mustFinishAssignedFirst(leo, 'tahoe-day-2'), true)
    assert.equal(mustFinishAssignedFirst(priya, 'tahoe-day-2'), false)
    assert.equal(mustFinishAssignedFirst(ruth, 'tahoe-day-2'), false)
    assert.equal(mustFinishAssignedFirst(undefined, 'tahoe-day-2'), false)
  })

  it('drops the Assignment when this Person watches to within 15 seconds of the end', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    assert.equal(await assign('ruth', 'leo', video.id), true)
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 1462, undefined, start + 1462_000)

    assert.equal(isAssigned('leo', video.id), false)
    assert.equal(highWaterOf('leo', video.id), undefined)
    assert.equal(assignmentsFor('leo').length, 0)
    assert.equal(mustFinishAssignedFirst(getPerson('leo'), 'rosie-one'), false)
  })

  it('does not finish the Assignment on a skim to the end', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    assert.equal(await assign('ruth', 'leo', video.id), true)
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 1470, undefined, start + 100)

    assert.equal(isAssigned('leo', video.id), true)
    assert.equal(mustFinishAssignedFirst(getPerson('leo'), 'rosie-one'), true)
  })

  it('lets a Parent assign the same Video again after it ended, as a new duty from 0', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    let leo = getPerson('leo')
    assert.equal(await assign('ruth', 'leo', video.id), true)
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 1470, undefined, start + 1470_000)
    assert.equal(isAssigned('leo', video.id), false)

    assert.equal(await assign('ruth', 'leo', video.id), true)
    assert.equal(isAssigned('leo', video.id), true)
    assert.equal(isInProgress(video, 'leo'), false)
    assert.equal(highWaterOf('leo', video.id), 0)
    assert.equal(mustFinishAssignedFirst(leo, 'rosie-one'), true)

    await recordWatchStart('leo', video, start + 4_000_000)
    await recordWatchProgress('leo', video, 1470, undefined, start + 4_000_100)
    assert.equal(isAssigned('leo', video.id), true)
  })

  it('drops the Assignment when the Video is deleted', async () => {
    withRoles()
    addUploadedVideo({
      id: 'secret-clip',
      title: 'Secret clip',
      channelId: 'mia',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
    })
    assert.equal(await assign('ruth', 'leo', 'secret-clip'), true)
    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)
    deleteVideo('secret-clip')
    forgetDeletedVideo('secret-clip')
    assert.equal(isAssigned('leo', 'secret-clip'), false)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)
  })

  it('drops that Person’s Assignments when they become Parent or Admin', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)
    assert.equal(await assign('ruth', 'leo', 'rosie-one'), true)
    let parent = await updatePersonRoles('mia', 'priya', { isAdmin: false, isParent: true })
    assert.ok(!('error' in parent))
    assert.equal(isAssigned('priya', 'tahoe-day-2'), false)
    assert.equal(isAssigned('leo', 'rosie-one'), true)

    let admin = await updatePersonRoles('mia', 'leo', { isAdmin: true, isParent: false })
    assert.ok(!('error' in admin))
    assert.equal(isAssigned('leo', 'rosie-one'), false)
  })

  it('drops an Assignment when the Person loses sight of a private Video', async () => {
    withRoles()
    let secret = addUploadedVideo({
      id: 'secret-clip',
      title: 'Secret clip',
      channelId: 'mia',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
      private: true,
      audience: ['leo'],
    })
    assert.equal(await assign('ruth', 'leo', 'secret-clip'), true)
    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)

    secret.audience = []
    await dropImpossibleAssignments()

    assert.equal(canWatch(secret, 'leo'), false)
    assert.equal(isAssigned('leo', 'secret-clip'), false)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)
  })

  it('opens high-water at the resume point when assigning an in-progress Video', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 200, undefined, start + 200_000)
    assert.equal(isInProgress(video, 'leo'), true)

    assert.equal(await assign('ruth', 'leo', video.id), true)
    assert.equal(highWaterOf('leo', video.id), 200)
  })

  it('keeps the furthest playhead and does not move it backward', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    await advanceHighWater('leo', 'tahoe-day-2', 40)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), 40)
    await advanceHighWater('leo', 'tahoe-day-2', 30)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), 40)
    await advanceHighWater('leo', 'tahoe-day-2', 88)
    assert.equal(highWaterOf('leo', 'tahoe-day-2'), 88)
  })

  it('raises high-water when this Person watches farther', async () => {
    withRoles()
    let video = getVideo('tahoe-day-2')!
    assert.equal(await assign('ruth', 'leo', video.id), true)
    let start = Date.now()
    await recordWatchStart('leo', video, start)
    await recordWatchProgress('leo', video, 55, undefined, start + 55_000)
    assert.equal(highWaterOf('leo', video.id), 55)
  })

  it('drops an Assignment when a Manager loses sight of a private Video on that channel', async () => {
    withRoles()
    let secret = addUploadedVideo({
      id: 'secret-clip',
      title: 'Secret clip',
      channelId: 'twice',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
      private: true,
    })
    assert.equal(canWatch(secret, 'priya'), true)
    assert.equal(await assign('ruth', 'priya', 'secret-clip'), true)
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)

    let channel = getChannel('twice')!
    await updateChannel(channel, { name: channel.name, description: channel.description ?? '', managerIds: [] })
    try {
      assert.equal(canWatch(secret, 'priya'), false)
      assert.equal(isAssigned('priya', 'secret-clip'), false)
      assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    } finally {
      resetChannels()
    }
  })
})

describe('assignments in the catalogue', () => {
  afterEach(async () => {
    resetAssignments()
    resetHistory()
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
  })

  async function household(durationSec = 20) {
    await useEmptyHouse()
    let parent = (await createPerson('Sam', 'house', undefined, undefined, true)) as Person
    let child = (await createPerson('Kit', 'house')) as Person
    let other = (await createPerson('Nia', 'house')) as Person
    let slug = 'kit-duty'
    let inserted = await insertUploadedVideo({
      slug,
      title: 'Lake walk',
      channelSlug: parent.slug,
      ownerId: parent.id,
      durationSec,
      filePath: `uploads/${parent.slug}/${slug}.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    if (getVideo(slug)) deleteVideo(slug)
    addUploadedVideo({
      id: slug,
      title: 'Lake walk',
      channelId: parent.slug,
      durationSec,
      thumb: '',
      tags: [],
      file: `uploads/${parent.slug}/${slug}.mp4`,
      postedBy: parent.id,
    })
    return { parent, child, other, slug }
  }

  it('keeps an Assignment across a host restart', async () => {
    let { parent, child, slug } = await household()
    assert.equal(await assign(parent.id, child.id, slug), true)

    resetAssignments()
    await loadCatalogueAssignments()

    assert.equal(isAssigned(child.id, slug), true)
    let [row] = assignmentsFor(child.id)
    assert.equal(row?.assignedBy, parent.id)
    assert.ok((row?.assignedAt ?? 0) > 0)
    assert.equal(highWaterOf(child.id, slug), 0)
  })

  it('restores high-water from the catalogue after a host restart', async () => {
    let { parent, child, slug } = await household(120)
    let video = getVideo(slug)!
    let start = Date.now()
    await recordWatchStart(child.id, video, start)
    await recordWatchProgress(child.id, video, 40, undefined, start + 40_000)
    assert.equal(await assign(parent.id, child.id, slug), true)
    assert.equal(highWaterOf(child.id, slug), 40)

    await advanceHighWater(child.id, slug, 55)
    resetAssignments()
    await loadCatalogueAssignments()
    assert.equal(isAssigned(child.id, slug), true)
    assert.equal(highWaterOf(child.id, slug), 55)
  })

  it('clears catalogue Assignment rows when the house is emptied', async () => {
    let { parent, child, slug } = await household()
    assert.equal(await assign(parent.id, child.id, slug), true)

    await useEmptyHouse()
    resetAssignments()
    resetHousehold()
    await loadCatalogueAssignments()
    assert.equal(isAssigned(child.id, slug), false)
  })

  it('does not restore a finished Assignment after a host restart', async () => {
    let { parent, child, slug } = await household()
    assert.equal(await assign(parent.id, child.id, slug), true)
    let video = getVideo(slug)!
    let start = Date.now()
    await recordWatchStart(child.id, video, start)
    await recordWatchProgress(child.id, video, 20, undefined, start + 20_000)

    resetAssignments()
    await loadCatalogueAssignments()
    assert.equal(isAssigned(child.id, slug), false)
  })

  it('drops catalogue Assignments when the Person is removed', async () => {
    let { parent, child, slug } = await household()
    assert.equal(await assign(parent.id, child.id, slug), true)
    assert.equal(await removePerson(parent.id, child.id), true)

    resetAssignments()
    await loadCatalogueAssignments()
    assert.equal(isAssigned(child.id, slug), false)
  })
})
