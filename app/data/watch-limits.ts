// Parental controls: a daily watch limit per limited Person, plus extra time a
// Parent gives for today only. A watch day runs from 5 am to 5 am, host time.

import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import { sessionsFor } from './history.ts'
import { getPerson, type Person } from './household.ts'
import { people, watchExtensions, watchLimits } from './tables.ts'

/** Daily limits a Parent can choose, in minutes. */
export const LIMIT_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180] as const
/** Extra time a Parent can give for today, in minutes. */
export const EXTEND_STEPS = [5, 10, 20, 30, 60] as const

const DAY_STARTS_AT_HOUR = 5

export interface Extension {
  id: string
  personId: string
  day: string
  minutes: number
  grantedBy: string | null
}

export interface Allowance {
  limitMin: number
  extraMin: number
  usedSec: number
  remainingSec: number
}

let limits = new Map<string, number>()
let extensions: Extension[] = []

/** Parents and Admins are never limited. */
export function isLimitable(person: Person): boolean {
  return !person.isParent && !person.isAdmin
}

function watchDayStart(at: number): Date {
  let date = new Date(at)
  if (date.getHours() < DAY_STARTS_AT_HOUR) date.setDate(date.getDate() - 1)
  date.setHours(DAY_STARTS_AT_HOUR, 0, 0, 0)
  return date
}

/** "2026-05-20" for any moment from 5 am on the 20th to 4:59 am on the 21st. */
export function watchDay(at = Date.now()): string {
  let date = watchDayStart(at)
  let m = String(date.getMonth() + 1).padStart(2, '0')
  let d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function limitFor(personId: string): number | null {
  return limits.get(personId) ?? null
}

/** Minutes of extra time given today. Several grants add up. */
export function extraToday(personId: string, now = Date.now()): number {
  let day = watchDay(now)
  return extensions
    .filter((extension) => extension.personId === personId && extension.day === day)
    .reduce((sum, extension) => sum + extension.minutes, 0)
}

/** Seconds of video played since this watch day began. A sitting that runs across 5 am counts only its share after 5 am. */
export function usedTodaySec(personId: string, now = Date.now()): number {
  let start = watchDayStart(now).getTime()
  return sessionsFor(personId)
    .filter((session) => session.endedAt >= start && session.startedAt <= now)
    .reduce((sum, session) => {
      if (session.startedAt >= start) return sum + session.watchedSec
      let span = session.endedAt - session.startedAt
      return sum + (span > 0 ? (session.watchedSec * (session.endedAt - start)) / span : 0)
    }, 0)
}

/** Today's allowance, or null when this Person may watch without a limit. */
export function allowanceFor(person: Person, now = Date.now()): Allowance | null {
  if (!isLimitable(person)) return null
  let limitMin = limitFor(person.id)
  if (limitMin === null) return null
  let extraMin = extraToday(person.id, now)
  let usedSec = Math.round(usedTodaySec(person.id, now))
  return { limitMin, extraMin, usedSec, remainingSec: Math.max(0, (limitMin + extraMin) * 60 - usedSec) }
}

/** True when this Person has a limit and has used it all today. */
export function isTimeUp(person: Person | null | undefined, now = Date.now()): boolean {
  if (!person) return false
  let allowance = allowanceFor(person, now)
  return allowance !== null && allowance.remainingSec <= 0
}

/** Mockup people live only in memory; catalogue people also persist. */
async function isCatalogued(personId: string) {
  let person = getPerson(personId)
  if (!person || person.id === person.slug) return false
  return Boolean(await db.findOne(people, { where: { id: personId } }))
}

type Result = true | { error: string }

function check(actorId: string, targetId: string): Person | { error: string } {
  if (!getPerson(actorId)?.isParent) return { error: 'You need to be a Parent.' }
  let target = getPerson(targetId)
  if (!target) return { error: 'That person isn’t in the house.' }
  if (!isLimitable(target)) return { error: `${target.name} is a Parent or Admin, so there’s no limit to set.` }
  return target
}

/** Sets or removes (null) a Person's daily limit. */
export async function setDailyLimit(actorId: string, targetId: string, minutes: number | null): Promise<Result> {
  let target = check(actorId, targetId)
  if ('error' in target) return target
  if (minutes !== null && !(LIMIT_PRESETS as readonly number[]).includes(minutes)) {
    return { error: 'Choose one of the listed limits.' }
  }
  if (await isCatalogued(target.id)) {
    await db.transaction(async (tx) => {
      await tx.deleteMany(watchLimits, { where: { person_id: target.id } })
      if (minutes !== null) await tx.create(watchLimits, { person_id: target.id, daily_min: minutes })
    })
  }
  if (minutes === null) limits.delete(target.id)
  else limits.set(target.id, minutes)
  return true
}

/** Gives extra time for today only. */
export async function extendToday(actorId: string, targetId: string, minutes: number, now = Date.now()): Promise<Result> {
  let target = check(actorId, targetId)
  if ('error' in target) return target
  if (!(EXTEND_STEPS as readonly number[]).includes(minutes)) return { error: 'Choose one of the listed amounts.' }
  if (limitFor(target.id) === null) return { error: `${target.name} has no limit, so there’s nothing to extend.` }
  let extension: Extension = { id: randomUUID(), personId: target.id, day: watchDay(now), minutes, grantedBy: actorId }
  if (await isCatalogued(target.id)) {
    await db.create(watchExtensions, {
      id: extension.id,
      person_id: extension.personId,
      day: extension.day,
      minutes,
      granted_by: (await isCatalogued(actorId)) ? actorId : null,
    })
  }
  extensions = extensions.filter((entry) => entry.day >= extension.day)
  extensions.push(extension)
  return true
}

/** Takes back all of today's extra time. */
export async function clearExtraToday(actorId: string, targetId: string, now = Date.now()): Promise<Result> {
  let target = check(actorId, targetId)
  if ('error' in target) return target
  let day = watchDay(now)
  if (await isCatalogued(target.id)) {
    await db.deleteMany(watchExtensions, { where: { person_id: target.id, day } })
  }
  extensions = extensions.filter((extension) => !(extension.personId === target.id && extension.day === day))
  return true
}

export async function loadCatalogueWatchLimits(now = Date.now()) {
  for (let row of await db.findMany(watchLimits)) limits.set(row.person_id, row.daily_min)
  let day = watchDay(now)
  let present = new Set(extensions.map((extension) => extension.id))
  for (let row of await db.findMany(watchExtensions, { where: { day } })) {
    if (present.has(row.id)) continue
    extensions.push({ id: row.id, personId: row.person_id, day: row.day, minutes: row.minutes, grantedBy: row.granted_by })
  }
}

export function resetWatchLimits() {
  limits = new Map()
  extensions = []
}

export function forgetRemovedPerson(personId: string) {
  limits.delete(personId)
  extensions = extensions.filter((extension) => extension.personId !== personId)
}
