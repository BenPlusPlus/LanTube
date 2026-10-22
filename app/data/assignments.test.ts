import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from './catalogue.ts'
import {
  assign,
  assignablePeople,
  assignmentsFor,
  houseHasLimitablePeople,
  isAssigned,
  loadCatalogueAssignments,
  mustFinishAssignedFirst,
  resetAssignments,
  unassign,
} from './assignments.ts'
import {
  createPerson,
  getPerson,
  resetHousehold,
  useEmptyHouse,
  type Person,
} from './household.ts'
import { addUploadedVideo, canWatch, deleteVideo, getVideo, resetChannels } from './library.ts'

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
    let secret = getVideo('secret-clip')
    if (secret) deleteVideo(secret.id)
  })

  it('lets a Parent assign a house-visible Video to each limitable Person, and unassign', async () => {
    withRoles()
    assert.equal(await assign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), false)

    assert.equal(await assign('ruth', 'priya', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)

    assert.equal(await unassign('ruth', 'leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), false)
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
})

describe('assignments in the catalogue', () => {
  afterEach(async () => {
    resetAssignments()
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
  })

  async function household() {
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
      durationSec: 20,
      filePath: `uploads/${parent.slug}/${slug}.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    addUploadedVideo({
      id: slug,
      title: 'Lake walk',
      channelId: parent.slug,
      durationSec: 20,
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
})
