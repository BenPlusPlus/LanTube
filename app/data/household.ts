export interface Person {
  id: string
  name: string
  hue: number
  photo?: string
}

interface Record {
  person: Person
  password: string
}

const seed: Record[] = [
  { person: { id: 'mia', name: 'Mia', hue: 172 }, password: 'house' },
  { person: { id: 'tomas', name: 'Tomás', hue: 32 }, password: 'house' },
  { person: { id: 'ruth', name: 'Ruth', hue: 268 }, password: 'house' },
  { person: { id: 'leo', name: 'Leo', hue: 112 }, password: 'house' },
  { person: { id: 'priya', name: 'Priya', hue: 338 }, password: 'house' },
]

let extras: Record[] = []

function records(): Record[] {
  return [...seed, ...extras]
}

export function listPeople(): Person[] {
  return records().map((row) => row.person)
}

export function getPerson(id: string): Person | undefined {
  return records().find((row) => row.person.id === id)?.person
}

export function personFromSession(session: { get(key: string): unknown }): Person | null {
  let id = session.get('personId')
  if (typeof id !== 'string') return null
  return getPerson(id) ?? null
}

export function verifyPassword(id: string, password: string): boolean {
  let row = records().find((entry) => entry.person.id === id)
  return row !== undefined && row.password === password
}

function slugify(name: string): string {
  let slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'person'
}

function hueFor(name: string): number {
  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  return hue
}

export function createPerson(name: string, password: string, photo?: string): Person | { error: string } {
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
  let id = base
  let n = 2
  while (getPerson(id)) {
    id = `${base}-${n}`
    n++
  }

  let person: Person = { id, name: trimmed, hue: hueFor(trimmed), photo }
  extras.push({ person, password })
  return person
}

export function resetHousehold() {
  extras = []
}
