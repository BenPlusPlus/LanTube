import { db } from '../db.ts'
import { getPerson, listPeople, type Person } from './household.ts'
import { canWatch, getVideo, type Video } from './library.ts'
import { assignments as assignmentRows, people, videos } from './tables.ts'
import { isLimitable } from './watch-limits.ts'

export interface Assignment {
  personId: string
  videoId: string
  assignedBy: string | null
  assignedAt: number
}

type Result = true | { error: string }

let rows: Assignment[] = []

async function isCataloguedPerson(personId: string) {
  let person = getPerson(personId)
  if (!person || person.id === person.slug) return false
  return Boolean(await db.findOne(people, { where: { id: personId } }))
}

function keyOf(personId: string, videoId: string) {
  return `${personId}:${videoId}`
}

export function houseHasLimitablePeople(): boolean {
  return listPeople().some(isLimitable)
}

export function assignablePeople(video: Video): Person[] {
  return listPeople().filter((person) => isLimitable(person) && canWatch(video, person.id))
}

export function isAssigned(personId: string, videoId: string): boolean {
  return rows.some((row) => row.personId === personId && row.videoId === videoId)
}

export function assignmentsFor(personId: string): Assignment[] {
  return rows
    .filter((row) => row.personId === personId)
    .sort((a, b) => b.assignedAt - a.assignedAt)
}

export function mustFinishAssignedFirst(person: Person | null | undefined, videoId: string): boolean {
  if (!person || !isLimitable(person)) return false
  if (assignmentsFor(person.id).length === 0) return false
  return !isAssigned(person.id, videoId)
}

function check(actorId: string, targetId: string, videoId: string): { target: Person } | { error: string } {
  if (!getPerson(actorId)?.isParent) return { error: 'You need to be a Parent.' }
  let target = getPerson(targetId)
  if (!target) return { error: 'That person isn’t in the house.' }
  if (!isLimitable(target)) return { error: `${target.name} is a Parent or Admin, so there’s no Assignment to give.` }
  let video = getVideo(videoId)
  if (!video) return { error: 'That video isn’t in the house.' }
  if (!canWatch(video, target.id)) {
    return { error: `${target.name} can’t watch this yet. Name them on Audience first.` }
  }
  return { target }
}

async function persistCreate(row: Assignment) {
  if (!(await isCataloguedPerson(row.personId))) return
  let video = await db.findOne(videos, { where: { slug: row.videoId } })
  if (!video) return
  let assignedBy = row.assignedBy && (await isCataloguedPerson(row.assignedBy)) ? row.assignedBy : null
  await db.create(assignmentRows, {
    person_id: row.personId,
    video_id: video.id,
    assigned_by: assignedBy,
    assigned_at: new Date(row.assignedAt),
  })
}

async function persistDelete(personId: string, videoId: string) {
  if (!(await isCataloguedPerson(personId))) return
  let video = await db.findOne(videos, { where: { slug: videoId } })
  if (!video) return
  await db.deleteMany(assignmentRows, { where: { person_id: personId, video_id: video.id } })
}

export async function assign(actorId: string, personId: string, videoId: string, now = Date.now()): Promise<Result> {
  let checked = check(actorId, personId, videoId)
  if ('error' in checked) return checked
  if (isAssigned(checked.target.id, videoId)) return true
  let row: Assignment = {
    personId: checked.target.id,
    videoId,
    assignedBy: actorId,
    assignedAt: now,
  }
  await persistCreate(row)
  rows.push(row)
  return true
}

export async function unassign(actorId: string, personId: string, videoId: string): Promise<Result> {
  if (!getPerson(actorId)?.isParent) return { error: 'You need to be a Parent.' }
  let target = getPerson(personId)
  if (!target) return { error: 'That person isn’t in the house.' }
  if (!isAssigned(target.id, videoId)) return true
  await persistDelete(target.id, videoId)
  rows = rows.filter((row) => !(row.personId === target.id && row.videoId === videoId))
  return true
}

export async function loadCatalogueAssignments() {
  let videoRows = await db.findMany(videos)
  let slugById = new Map(videoRows.map((row) => [row.id, row.slug]))
  let present = new Set(rows.map((row) => keyOf(row.personId, row.videoId)))
  for (let row of await db.findMany(assignmentRows)) {
    let videoId = slugById.get(row.video_id)
    if (!videoId || !getVideo(videoId) || !getPerson(row.person_id)) continue
    let key = keyOf(row.person_id, videoId)
    if (present.has(key)) continue
    let assignedAt = row.assigned_at instanceof Date ? row.assigned_at.getTime() : Date.parse(String(row.assigned_at))
    rows.push({
      personId: row.person_id,
      videoId,
      assignedBy: row.assigned_by,
      assignedAt: Number.isFinite(assignedAt) ? assignedAt : Date.now(),
    })
    present.add(key)
  }
}

export function resetAssignments() {
  rows = []
}

export function forgetRemovedPerson(personId: string) {
  rows = rows.filter((row) => row.personId !== personId)
}
