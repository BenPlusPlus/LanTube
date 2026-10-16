// Per-person watch history. Each visit to a video is a session; sessions close
// together in time form a sitting ("Last night", "Saturday morning").

import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import { getPerson } from './household.ts'
import { getChannel, getVideo, isInProgress, progressOf, recordProgress, resetProgress, type Video } from './library.ts'
import { people, videos, watchProgress, watchSessions } from './tables.ts'

export interface WatchSession {
  id: string
  personId: string
  videoId: string
  startedAt: number
  /** Last time this session heard from the player. */
  endedAt: number
  /** Last reported playback position, seconds. */
  lastT: number
  /** Seconds of the video actually played (seeks don't count). */
  watchedSec: number
}

export interface SittingRow {
  video: Video
  /** When this video was (last) started in the sitting. */
  at: number
  watchedSec: number
  /** Seconds to resume from (0 when no position is saved), or null when finished. */
  resumeAt: number | null
  finished: boolean
}

export interface Sitting {
  id: string
  label: string
  startedAt: number
  endedAt: number
  watchedSec: number
  /** Chronological, so the first row is the first segment of the bar. */
  rows: SittingRow[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** A return to the same video within this window continues the session. */
const SESSION_GAP = 30 * MINUTE
/** A pause longer than this ends a sitting. */
const SITTING_GAP = 45 * MINUTE
/** Below this, a session is a skim, not a watch. */
const MIN_WATCHED_SEC = 5
const MAX_SITTINGS = 50

let sessions: WatchSession[] = []

const writes = new Map<string, Promise<unknown>>()

/** Overlapping progress would persist a stale session. */
function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
  let prior = writes.get(key) ?? Promise.resolve()
  let next = prior.then(work, work)
  writes.set(key, next.then(() => undefined, () => undefined))
  return next
}

function latestSession(personId: string, videoId: string, now: number): WatchSession | undefined {
  for (let i = sessions.length - 1; i >= 0; i--) {
    let session = sessions[i]
    if (session.personId === personId && session.videoId === videoId) {
      return now - session.endedAt <= SESSION_GAP ? session : undefined
    }
  }
  return undefined
}

function openSession(personId: string, video: Video, now: number): WatchSession {
  return {
    id: randomUUID(),
    personId,
    videoId: video.id,
    startedAt: now,
    endedAt: now,
    lastT: progressOf(video, personId) ?? 0,
    watchedSec: 0,
  }
}

async function persistWatch(session: WatchSession, progress?: { positionSec: number | undefined }) {
  let person = getPerson(session.personId)
  if (!person || person.id === person.slug) return
  if (!(await db.findOne(people, { where: { id: session.personId } }))) return
  let video = await db.findOne(videos, { where: { slug: session.videoId } })
  if (!video) return
  await db.transaction(async (tx) => {
    let fields = {
      ended_at: new Date(session.endedAt),
      last_t: Math.round(session.lastT),
      watched_sec: Math.round(session.watchedSec),
    }
    let row = await tx.findOne(watchSessions, { where: { id: session.id } })
    if (row) await tx.update(watchSessions, session.id, fields)
    else {
      await tx.create(watchSessions, {
        id: session.id,
        person_id: session.personId,
        video_id: video.id,
        started_at: new Date(session.startedAt),
        ...fields,
      })
    }
    if (progress) {
      await tx.deleteMany(watchProgress, { where: { person_id: session.personId, video_id: video.id } })
      if (progress.positionSec !== undefined) {
        await tx.create(watchProgress, {
          person_id: session.personId,
          video_id: video.id,
          position_sec: progress.positionSec,
        })
      }
    }
  })
}

/** The player started this video for a signed-in person. */
export async function recordWatchStart(personId: string, video: Video, now = Date.now()) {
  return serialize(`${personId}:${video.id}`, async () => {
    if (latestSession(personId, video.id, now)) return
    let session = openSession(personId, video, now)
    await persistWatch(session)
    sessions.push(session)
  })
}

/** The player reported a position. Updates both history and the person's resume point. */
export async function recordWatchProgress(
  personId: string,
  video: Video,
  positionSec: number,
  fileDurationSec?: number,
  now = Date.now(),
) {
  return serialize(`${personId}:${video.id}`, async () => {
    let session = latestSession(personId, video.id, now)
    let created = !session
    if (!session) session = openSession(personId, video, now)
    let delta = positionSec - session.lastT
    let wall = (now - session.endedAt) / 1000
    // Forward motion no faster than real time is watching; anything else is a seek.
    let watchedSec = session.watchedSec
    if (delta > 0 && delta <= wall + 5) watchedSec += delta
    let next: WatchSession = { ...session, lastT: positionSec, endedAt: now, watchedSec }
    let duration = fileDurationSec !== undefined ? Math.round(fileDurationSec) : video.durationSec
    let clamped = Math.min(Math.max(positionSec, 0), duration)
    await persistWatch(next, { positionSec: clamped < 5 ? undefined : Math.round(clamped) })
    if (created) sessions.push(next)
    else {
      session.lastT = next.lastT
      session.endedAt = next.endedAt
      session.watchedSec = next.watchedSec
    }
    recordProgress(video, personId, positionSec, fileDurationSec)
  })
}

export function sessionsFor(personId: string): WatchSession[] {
  return sessions.filter((session) => session.personId === personId)
}

/** Distinct videos this person watched since a moment. */
export function videosWatchedSince(personId: string, since: number): number {
  let ids = new Set<string>()
  for (let session of sessionsFor(personId)) {
    if (session.watchedSec >= MIN_WATCHED_SEC && session.endedAt >= since) ids.add(session.videoId)
  }
  return ids.size
}

function matches(video: Video, q: string): boolean {
  if (!q) return true
  let channel = getChannel(video.channelId)
  return video.title.toLocaleLowerCase().includes(q) || (channel?.name.toLocaleLowerCase().includes(q) ?? false)
}

/** A person's sittings, newest first. Each video appears once, in the sitting it was last watched. */
export function sittingsFor(personId: string, query = '', now = Date.now()): Sitting[] {
  let watched = sessionsFor(personId)
    .filter((session) => session.watchedSec >= MIN_WATCHED_SEC && getVideo(session.videoId))
    .sort((a, b) => a.startedAt - b.startedAt)

  let groups: WatchSession[][] = []
  let groupEnd = -Infinity
  for (let session of watched) {
    if (session.startedAt - groupEnd > SITTING_GAP) groups.push([])
    groups[groups.length - 1].push(session)
    groupEnd = Math.max(groupEnd, session.endedAt)
  }

  let lastGroup = new Map<string, number>()
  groups.forEach((group, index) => group.forEach((session) => lastGroup.set(session.videoId, index)))

  let q = query.trim().toLocaleLowerCase()
  let sittings: Sitting[] = []
  groups.forEach((group, index) => {
    let byVideo = new Map<string, WatchSession[]>()
    for (let session of group) {
      if (lastGroup.get(session.videoId) !== index) continue
      let list = byVideo.get(session.videoId) ?? []
      list.push(session)
      byVideo.set(session.videoId, list)
    }

    let rows: (SittingRow & { from: number; to: number })[] = []
    for (let [videoId, list] of byVideo) {
      let video = getVideo(videoId)!
      if (!matches(video, q)) continue
      let progress = progressOf(video, personId)
      let resuming = isInProgress(video, personId)
      rows.push({
        video,
        at: list[list.length - 1].startedAt,
        from: list[0].startedAt,
        to: Math.max(...list.map((session) => session.endedAt)),
        watchedSec: list.reduce((sum, session) => sum + session.watchedSec, 0),
        resumeAt: resuming ? progress! : progress === undefined ? 0 : null,
        finished: !resuming && progress !== undefined,
      })
    }
    if (rows.length === 0) return
    rows.sort((a, b) => a.at - b.at)

    let startedAt = Math.min(...rows.map((row) => row.from))
    sittings.push({
      id: `sitting-${startedAt}`,
      label: sittingLabel(startedAt, now),
      startedAt,
      endedAt: Math.max(...rows.map((row) => row.to)),
      watchedSec: rows.reduce((sum, row) => sum + row.watchedSec, 0),
      rows: rows.map(({ from, to, ...row }) => row),
    })
  })

  return sittings.reverse().slice(0, MAX_SITTINGS)
}

// ---------- Labels and times (the host's local time) ----------

type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function startOfDay(at: number): number {
  let date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthDayYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Tonight", "Last night", "Yesterday morning", "Saturday evening", "Sunday morning, Sep 27". */
export function sittingLabel(at: number, now = Date.now()): string {
  let hour = new Date(at).getHours()
  let part = partOfDay(hour)
  // Small hours belong to the night before.
  let day = hour < 5 ? at - DAY : at
  let daysAgo = Math.round((startOfDay(now) - startOfDay(day)) / DAY)

  if (daysAgo <= 0) return part === 'night' ? 'Tonight' : `This ${part}`
  if (daysAgo === 1) return part === 'night' ? 'Last night' : `Yesterday ${part}`
  let name = weekday.format(day)
  if (daysAgo < 7) return `${name} ${part}`
  let sameYear = new Date(day).getFullYear() === new Date(now).getFullYear()
  return `${name} ${part}, ${(sameYear ? monthDay : monthDayYear).format(day)}`
}

function clock(at: number): { time: string; meridiem: string } {
  let date = new Date(at)
  let h = date.getHours()
  let m = String(date.getMinutes()).padStart(2, '0')
  return { time: `${h % 12 || 12}:${m}`, meridiem: h < 12 ? 'am' : 'pm' }
}

/** "9:52 pm" */
export function formatClock(at: number): string {
  let { time, meridiem } = clock(at)
  return `${time} ${meridiem}`
}

/** "8:40–10:05 pm", "11:40 am–12:15 pm", or "9:52 pm" when it all fits in one minute. */
export function formatRange(from: number, to: number): string {
  let a = clock(from)
  let b = clock(to)
  if (a.time === b.time && a.meridiem === b.meridiem) return `${a.time} ${a.meridiem}`
  if (a.meridiem === b.meridiem) return `${a.time}–${b.time} ${b.meridiem}`
  return `${a.time} ${a.meridiem}–${b.time} ${b.meridiem}`
}

// ---------- Seed ----------

interface SeedWatch {
  videoId: string
  /** Seconds watched; also where they stopped, since seeds start from 0. Omit to watch to the end. */
  sec?: number
  /** Gap after the previous video in the sitting, minutes. */
  gapMin?: number
}

function seedSitting(personId: string, startedAt: number, watches: SeedWatch[]) {
  let at = startedAt
  for (let { videoId, sec, gapMin = 2 } of watches) {
    let video = getVideo(videoId)
    if (!video) continue
    let watchedSec = sec ?? video.durationSec
    at += gapMin * MINUTE
    sessions.push({
      id: randomUUID(),
      personId,
      videoId,
      startedAt: at,
      endedAt: at + watchedSec * 1000,
      lastT: watchedSec,
      watchedSec,
    })
    recordProgress(video, personId, watchedSec)
    at += watchedSec * 1000
  }
}

/**
 * Sittings sit at fixed local clock times on past days, so they read naturally whatever
 * the hour. Each video was added at least a day before the earliest that time can be.
 */
function seed(now: number) {
  let local = (daysAgo: number, hour: number, minute = 0) => {
    let date = new Date(now)
    date.setDate(date.getDate() - daysAgo)
    date.setHours(hour, minute, 0, 0)
    return date.getTime()
  }

  seedSitting('mia', local(1, 20, 40), [
    { videoId: 'sourdough-4', sec: 130, gapMin: 0 },
    { videoId: 'nocturne', gapMin: 3 },
    { videoId: 'christmas-2009', gapMin: 2 },
  ])
  seedSitting('mia', local(2, 9, 15), [
    { videoId: 'boss-attempt-14', gapMin: 0 },
    { videoId: 'treehouse-3', sec: 398, gapMin: 4 },
  ])
  seedSitting('mia', local(4, 19, 30), [
    { videoId: 'dance-week-2', gapMin: 0 },
    { videoId: 'kitchen-reveal' },
  ])
  seedSitting('mia', local(9, 14, 5), [
    { videoId: 'hilltop-camp', gapMin: 0 },
    { videoId: 'first-place', gapMin: 6 },
  ])

  seedSitting('leo', local(2, 16, 0), [
    { videoId: 'treehouse-3', gapMin: 0 },
    { videoId: 'boss-attempt-14', sec: 240 },
  ])
  seedSitting('ruth', local(1, 19, 0), [
    { videoId: 'rosie-one', gapMin: 0 },
    { videoId: 'christmas-2009', sec: 1790 },
  ])
  seedSitting('tomas', local(4, 20, 0), [
    { videoId: 'kitchen-reveal', gapMin: 0 },
    { videoId: 'nocturne' },
  ])
  seedSitting('priya', local(2, 8, 0), [{ videoId: 'cardinal', gapMin: 0 }])
}

export async function loadCatalogueHistory() {
  let videoRows = await db.findMany(videos)
  let slugById = new Map(videoRows.map((row) => [row.id, row.slug]))
  let present = new Set(sessions.map((session) => session.id))
  let rows = await db.findMany(watchSessions, { orderBy: ['started_at', 'asc'] })
  for (let row of rows) {
    if (present.has(row.id)) continue
    let videoId = slugById.get(row.video_id)
    if (!videoId || !getVideo(videoId)) continue
    let startedAt = row.started_at instanceof Date ? row.started_at.getTime() : Date.parse(String(row.started_at))
    let endedAt = row.ended_at instanceof Date ? row.ended_at.getTime() : Date.parse(String(row.ended_at))
    sessions.push({
      id: row.id,
      personId: row.person_id,
      videoId,
      startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
      endedAt: Number.isFinite(endedAt) ? endedAt : Date.now(),
      lastT: row.last_t,
      watchedSec: row.watched_sec,
    })
    present.add(row.id)
  }
  for (let row of await db.findMany(watchProgress)) {
    let slug = slugById.get(row.video_id)
    let video = slug ? getVideo(slug) : undefined
    if (!video) continue
    recordProgress(video, row.person_id, row.position_sec)
  }
}

export function resetHistory(now = Date.now()) {
  sessions = []
  resetProgress()
  if (process.env.NODE_ENV === 'test') seed(now)
}

export function forgetRemovedPerson(personId: string) {
  sessions = sessions.filter((session) => session.personId !== personId)
}

if (process.env.NODE_ENV === 'test') resetHistory()
