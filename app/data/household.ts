import { randomUUID } from 'node:crypto'

import { notNull, sql } from 'remix/data-table'

import { db } from '../db.ts'
import { hueFor, slugify } from '../ui/public/identity.ts'
import { hashPassword, verifyPasswordHash } from './password.ts'
import { resetCatalogueTags } from './tags.ts'
import { channelManagers, channels, people, tags, videoAudience, videoTags, videos } from './tables.ts'

export interface Person {
  id: string
  slug: string
  name: string
  hue: number
  photo?: string
  isAdmin?: boolean
  isParent?: boolean
}

interface Record {
  person: Person
  password?: string
  passwordHash?: string
}

const mockup: Record[] = [
  { person: { id: 'mia', slug: 'mia', name: 'Mia', hue: 172 }, password: 'house' },
  { person: { id: 'tomas', slug: 'tomas', name: 'Tomás', hue: 32 }, password: 'house' },
  { person: { id: 'ruth', slug: 'ruth', name: 'Ruth', hue: 268 }, password: 'house' },
  { person: { id: 'leo', slug: 'leo', name: 'Leo', hue: 112 }, password: 'house' },
  { person: { id: 'priya', slug: 'priya', name: 'Priya', hue: 338 }, password: 'house' },
]

let extras: Record[] = []
let catalogueRecords: Record[] = []
let includeMockup = process.env.NODE_ENV === 'test'

function records(): Record[] {
  return includeMockup ? [...mockup, ...catalogueRecords, ...extras] : [...catalogueRecords, ...extras]
}

function personFromRow(row: {
  id: string
  slug: string
  name: string
  hue: number
  photo_path: string | null
  password_hash: string
  is_admin: boolean
  is_parent: boolean
}): Record {
  return {
    person: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      hue: row.hue,
      photo: row.photo_path ?? undefined,
      isAdmin: row.is_admin,
      isParent: row.is_parent,
    },
    passwordHash: row.password_hash,
  }
}

export function listPeople(): Person[] {
  return records().map((row) => row.person)
}

export function getPerson(id: string): Person | undefined {
  return records().find((row) => row.person.id === id || row.person.slug === id)?.person
}

export function isParent(personId: string | undefined | null): boolean {
  return personId != null && getPerson(personId)?.isParent === true
}

export function personFromSession(session: { get(key: string): unknown }): Person | null {
  let id = session.get('personId')
  if (typeof id !== 'string') return null
  return getPerson(id) ?? null
}

export function verifyPassword(id: string, password: string): boolean {
  let row = records().find((entry) => entry.person.id === id || entry.person.slug === id)
  if (!row) return false
  if (row.passwordHash) return verifyPasswordHash(row.passwordHash, password)
  return row.password === password
}

export { hueFor, slugify }

export async function loadCataloguePeople() {
  let rows = await db.findMany(people)
  catalogueRecords = rows.filter((row) => row.removed_at == null).map(personFromRow)
}

/** `isIdTaken` lets callers reserve slugs outside the household, such as custom channel URLs. */
export async function createPerson(
  name: string,
  password: string,
  photo?: string,
  isIdTaken: (id: string) => boolean = () => false,
  parent = false,
): Promise<Person | { error: string }> {
  let trimmed = name.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 1 || trimmed.length > 32) {
    return { error: 'Use a name between 1 and 32 letters.' }
  }
  if (password.length < 4) {
    return { error: 'Choose a password of at least 4 characters.' }
  }
  let taken = records().some((row) => row.person.name.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0)
  if (taken) {
    return { error: 'Someone in the house already uses that name.' }
  }

  let base = slugify(trimmed)
  let slug = base
  let n = 2
  while (getPerson(slug) || isIdTaken(slug) || catalogueRecords.some((row) => row.person.slug === slug)) {
    slug = `${base}-${n}`
    n++
  }

  let passwordHash = hashPassword(password)
  let id = randomUUID()
  let channelId = randomUUID()
  let hue = hueFor(trimmed)

  let created = await db.transaction(async (tx) => {
    await tx.exec(sql`lock table people in share row exclusive mode`)
    let count = await tx.count(people)
    let isAdmin = count === 0
    let isParent = isAdmin && parent
    await tx.create(people, {
      id,
      slug,
      name: trimmed,
      hue,
      photo_path: photo ?? null,
      password_hash: passwordHash,
      is_admin: isAdmin,
      is_parent: isParent,
    })
    await tx.create(channels, {
      id: channelId,
      slug,
      name: trimmed,
      kind: 'person',
      hue,
      photo_path: photo ?? null,
      owner_id: id,
    })
    return { isAdmin, isParent }
  })

  let person: Person = {
    id,
    slug,
    name: trimmed,
    hue,
    photo,
    isAdmin: created.isAdmin,
    isParent: created.isParent,
  }
  catalogueRecords.push({ person, passwordHash })
  return person
}

function recordOf(id: string): Record | undefined {
  return records().find((entry) => entry.person.id === id)
}

/** Display name and photo may change; the slug does not. Home channel name follows the display name. */
export async function updatePersonDetails(
  id: string,
  input: { name: string; photo?: string; removePhoto?: boolean },
): Promise<Person | { error: string; field: 'name' | 'photo' }> {
  let row = recordOf(id)
  if (!row) return { error: 'Sign in to change your details.', field: 'name' }

  let trimmed = input.name.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 1 || trimmed.length > 32) {
    return { error: 'Use a name between 1 and 32 letters.', field: 'name' }
  }
  let taken = records().some(
    (entry) =>
      entry.person.id !== row.person.id &&
      entry.person.name.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (taken) {
    return { error: 'Someone in the house already uses that name.', field: 'name' }
  }

  let photo = row.person.photo
  if (input.photo) photo = input.photo
  else if (input.removePhoto) photo = undefined

  row.person.name = trimmed
  row.person.photo = photo

  if (catalogueRecords.some((entry) => entry.person.id === row.person.id)) {
    await db.update(people, row.person.id, { name: trimmed, photo_path: photo ?? null })
    await db.updateMany(
      channels,
      { name: trimmed, photo_path: photo ?? null },
      { where: { owner_id: row.person.id, kind: 'person' } },
    )
  }

  return row.person
}

/** A Person may change their own password; the current password must match. */
export async function changeOwnPassword(
  id: string,
  current: string,
  next: string,
): Promise<true | { error: string; field: 'current' | 'password' }> {
  if (next.length < 4) {
    return { error: 'Choose a password of at least 4 characters.', field: 'password' }
  }
  let row = recordOf(id)
  if (!row) return { error: 'Sign in to change your details.', field: 'current' }
  if (!verifyPassword(id, current)) {
    return { error: 'That isn’t your current password. Try again.', field: 'current' }
  }

  let passwordHash = hashPassword(next)
  row.passwordHash = passwordHash
  delete row.password

  if (catalogueRecords.some((entry) => entry.person.id === row.person.id)) {
    await db.update(people, row.person.id, { password_hash: passwordHash })
  }
  return true
}

export function resetHousehold() {
  extras = []
  catalogueRecords = []
  includeMockup = process.env.NODE_ENV === 'test'
}

/** Zero People: no mockup overlay, empty catalogue. Use in first-run tests. */
export async function useEmptyHouse() {
  extras = []
  catalogueRecords = []
  includeMockup = false
  await db.deleteMany(videoTags, { where: notNull(videoTags.video_id) })
  await db.deleteMany(videoAudience, { where: notNull(videoAudience.video_id) })
  await db.deleteMany(videos, { where: notNull(videos.id) })
  await db.deleteMany(channelManagers, { where: notNull(channelManagers.channel_id) })
  await db.deleteMany(channels, { where: notNull(channels.id) })
  await db.deleteMany(people, { where: notNull(people.id) })
  await db.deleteMany(tags, { where: notNull(tags.id) })
  resetCatalogueTags()
}
