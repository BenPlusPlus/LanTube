import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import {
  createPerson,
  getPerson,
  listPeople,
  loadCataloguePeople,
  removePerson,
  resetHousehold,
  setPersonPassword,
  updatePersonRoles,
  useEmptyHouse,
  verifyPassword,
  type Person,
} from './household.ts'
import { resetChannels } from './library.ts'

afterEach(async () => {
  await useEmptyHouse()
  resetHousehold()
  resetChannels()
})

async function join(name: string) {
  let person = await createPerson(name, 'lantern')
  assert.ok(!('error' in person))
  assert.notEqual(person.id, person.slug)
  return person
}

async function restored(person: Person) {
  resetHousehold()
  await loadCataloguePeople()
  return getPerson(person.id)
}

describe('House roles', () => {
  it('lets an Admin grant and revoke Admin and Parent on another Person, and keeps the flags after reload', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    assert.equal(sam.isAdmin, true)
    assert.equal(alex.isAdmin, false)
    assert.equal(alex.isParent, false)

    let granted = await updatePersonRoles(sam.id, alex.id, { isAdmin: true, isParent: true })
    assert.ok(!('error' in granted))
    assert.equal(granted.isAdmin, true)
    assert.equal(granted.isParent, true)
    assert.equal(getPerson(alex.id)?.isAdmin, true)
    assert.equal(getPerson(alex.id)?.isParent, true)

    let afterGrant = await restored(alex)
    assert.equal(afterGrant?.isAdmin, true)
    assert.equal(afterGrant?.isParent, true)

    let revoked = await updatePersonRoles(sam.id, alex.id, { isAdmin: false, isParent: false })
    assert.ok(!('error' in revoked))
    assert.equal(revoked.isAdmin, false)
    assert.equal(revoked.isParent, false)

    let afterRevoke = await restored(alex)
    assert.equal(afterRevoke?.isAdmin, false)
    assert.equal(afterRevoke?.isParent, false)
  })

  it('lets an Admin take or drop Parent on themselves, including leaving the house with zero Parents', async () => {
    let sam = await join('Sam')
    assert.equal(sam.isParent, false)

    let taken = await updatePersonRoles(sam.id, sam.id, { isAdmin: true, isParent: true })
    assert.ok(!('error' in taken))
    assert.equal(taken.isParent, true)
    assert.equal(getPerson(sam.id)?.isAdmin, true)

    let dropped = await updatePersonRoles(sam.id, sam.id, { isAdmin: true, isParent: false })
    assert.ok(!('error' in dropped))
    assert.equal(dropped.isParent, false)
    assert.equal(getPerson(sam.id)?.isAdmin, true)
  })

  it('does not let the last Admin revoke their own Admin', async () => {
    let sam = await join('Sam')
    await join('Alex')

    let result = await updatePersonRoles(sam.id, sam.id, { isAdmin: false, isParent: false })
    assert.deepEqual(result, { error: 'The house needs at least one Admin.' })
    assert.equal(getPerson(sam.id)?.isAdmin, true)

    resetHousehold()
    await loadCataloguePeople()
    assert.equal(getPerson(sam.id)?.isAdmin, true)
  })

  it('lets an Admin revoke their own Admin when another Admin remains', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    let granted = await updatePersonRoles(sam.id, alex.id, { isAdmin: true, isParent: false })
    assert.ok(!('error' in granted))

    let result = await updatePersonRoles(sam.id, sam.id, { isAdmin: false, isParent: false })
    assert.ok(!('error' in result))
    assert.equal(result.isAdmin, false)
    assert.equal(getPerson(sam.id)?.isAdmin, false)
    assert.equal(getPerson(alex.id)?.isAdmin, true)
  })

  it('does not let a Person who is not an Admin change roles', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')

    let result = await updatePersonRoles(alex.id, alex.id, { isAdmin: true, isParent: true })
    assert.ok('error' in result)
    assert.equal(getPerson(alex.id)?.isAdmin, false)
    assert.equal(getPerson(alex.id)?.isParent, false)
    assert.equal(getPerson(sam.id)?.isAdmin, true)
  })
})

describe('Admin-set password', () => {
  it('lets an Admin set a new password for someone else without the old one', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    assert.equal(verifyPassword(alex.id, 'lantern'), true)

    let result = await setPersonPassword(sam.id, alex.id, 'torch')
    assert.equal(result, true)
    assert.equal(verifyPassword(alex.id, 'torch'), true)
    assert.equal(verifyPassword(alex.id, 'lantern'), false)

    resetHousehold()
    await loadCataloguePeople()
    assert.equal(verifyPassword(alex.id, 'torch'), true)
    assert.equal(verifyPassword(alex.id, 'lantern'), false)
  })

  it('rejects a password shorter than 4 characters and leaves the old one working', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')

    let result = await setPersonPassword(sam.id, alex.id, 'abc')
    assert.deepEqual(result, { error: 'Choose a password of at least 4 characters.' })
    assert.equal(verifyPassword(alex.id, 'lantern'), true)
  })

  it('does not let an Admin set their own password here', async () => {
    let sam = await join('Sam')

    let result = await setPersonPassword(sam.id, sam.id, 'torch')
    assert.ok(result !== true)
    assert.equal(verifyPassword(sam.id, 'lantern'), true)
  })

  it('does not let a Person who is not an Admin set a password', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')

    let result = await setPersonPassword(alex.id, sam.id, 'torch')
    assert.ok(result !== true)
    assert.equal(verifyPassword(sam.id, 'lantern'), true)
  })
})

describe('Remove a Person', () => {
  it('lets an Admin remove a Person, who cannot sign in after, and keeps the slug reserved after reload', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    assert.equal(verifyPassword(alex.id, 'lantern'), true)

    let result = await removePerson(sam.id, alex.id)
    assert.equal(result, true)
    assert.equal(getPerson(alex.id), undefined)
    assert.equal(getPerson(alex.slug), undefined)
    assert.equal(
      listPeople().some((person) => person.id === alex.id),
      false,
    )
    assert.equal(verifyPassword(alex.id, 'lantern'), false)
    assert.equal(verifyPassword(alex.slug, 'lantern'), false)

    let reuse = await createPerson('Alex', 'lantern')
    assert.ok(!('error' in reuse))
    assert.notEqual(reuse.slug, alex.slug)

    resetHousehold()
    await loadCataloguePeople()
    assert.equal(getPerson(alex.id), undefined)
    assert.equal(verifyPassword(alex.id, 'lantern'), false)
    let again = await createPerson('Alex Lane', 'lantern')
    assert.ok(!('error' in again))
    assert.notEqual(again.slug, alex.slug)
  })

  it('does not let the last Admin remove themselves', async () => {
    let sam = await join('Sam')
    await join('Alex')

    let result = await removePerson(sam.id, sam.id)
    assert.deepEqual(result, { error: 'The house needs at least one Admin.' })
    assert.equal(getPerson(sam.id)?.isAdmin, true)
    assert.equal(verifyPassword(sam.id, 'lantern'), true)

    resetHousehold()
    await loadCataloguePeople()
    assert.equal(getPerson(sam.id)?.isAdmin, true)
  })

  it('does not let a Person who is not an Admin remove someone', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')

    let result = await removePerson(alex.id, sam.id)
    assert.deepEqual(result, { error: 'You need to be an Admin.' })
    assert.equal(getPerson(sam.id)?.isAdmin, true)
    assert.equal(verifyPassword(sam.id, 'lantern'), true)
  })
})
