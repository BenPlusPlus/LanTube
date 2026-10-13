import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import { getPerson, slugify } from './household.ts'
import { canWatch, getVideo, NEW_WINDOW_DAYS, type Video } from './library.ts'
import { people, playlistVideos as playlistVideoTable, playlists as playlistTable, videos } from './tables.ts'

export type Visibility = 'private' | 'public'

/** What last happened to a playlist; the house list is ordered by it. */
export type ActivityKind = 'created' | 'added' | 'removed' | 'reordered' | 'renamed' | 'shared' | 'unshared' | 'described'

export interface PlaylistActivity {
  kind: ActivityKind
  /** Epoch ms. */
  at: number
  /** For `added`: the videos that arrived, oldest first. */
  videoIds: string[]
}

export interface Playlist {
  id: string
  name: string
  ownerId: string
  visibility: Visibility
  description?: string
  videoIds: string[]
  activity: PlaylistActivity
}

export interface PlaylistInput {
  name: string
  description: string
  visibility: Visibility
}

const DAY = 86_400_000
const NAME_MAX = 60
const DESCRIPTION_MAX = 280
/** Adds within this window read as one change ("added 3 videos"), not three. */
const MERGE_ADDS_MS = 30 * 60_000

export const playlistLimits = { name: NAME_MAX, description: DESCRIPTION_MAX } as const

/** Test fixture; production catalogue starts empty. */
function seed(): Playlist[] {
  let now = Date.now()
  let ago = (days: number) => now - days * DAY
  return [
    {
      id: 'trips-we-rewatch',
      name: 'Trips we keep rewatching',
      ownerId: 'mia',
      visibility: 'public',
      description: 'The ones we put on when it’s raining and everyone wants to be somewhere else.',
      videoIds: ['hilltop-camp', 'fetch-arnside', 'cardinal', 'tahoe-day-2'],
      activity: { kind: 'added', at: ago(0.09), videoIds: ['tahoe-day-2'] },
    },
    {
      id: 'twice-best-stages',
      name: 'Twice, best stages',
      ownerId: 'mia',
      visibility: 'public',
      videoIds: ['twice-oakland', 'dance-week-2'],
      activity: { kind: 'created', at: ago(4.2), videoIds: [] },
    },
    {
      id: 'for-rosies-birthday',
      name: 'For Rosie’s birthday',
      ownerId: 'mia',
      visibility: 'private',
      description: 'Montage picks. Don’t tell Ruth.',
      videoIds: ['rosie-one', 'christmas-2009', 'fetch-arnside'],
      activity: { kind: 'reordered', at: ago(6.5), videoIds: [] },
    },
    {
      id: 'wind-down',
      name: 'Wind-down',
      ownerId: 'mia',
      visibility: 'private',
      videoIds: ['nocturne', 'cardinal', 'hilltop-camp'],
      activity: { kind: 'created', at: ago(20), videoIds: [] },
    },
    {
      id: 'best-boss-fights',
      name: 'Best boss fights',
      ownerId: 'leo',
      visibility: 'public',
      description: 'Every boss I beat, with proof.',
      videoIds: ['first-place', 'family-cup', 'boss-attempt-14'],
      activity: { kind: 'added', at: ago(0.13), videoIds: ['family-cup', 'boss-attempt-14'] },
    },
    {
      id: 'sunday-cooking',
      name: 'Sunday cooking',
      ownerId: 'tomas',
      visibility: 'public',
      description: 'What we made, and what we learned making it.',
      videoIds: ['kitchen-reveal', 'sourdough-4'],
      activity: { kind: 'added', at: ago(1.2), videoIds: ['sourdough-4'] },
    },
    {
      id: 'rosies-first-year',
      name: 'Rosie’s first year',
      ownerId: 'ruth',
      visibility: 'public',
      videoIds: ['christmas-2009', 'fetch-arnside', 'rosie-one'],
      activity: { kind: 'shared', at: ago(2.3), videoIds: [] },
    },
    {
      id: 'garden-birds',
      name: 'Garden birds',
      ownerId: 'priya',
      visibility: 'public',
      description: 'Feeder regulars and the occasional surprise.',
      videoIds: ['cardinal', 'hilltop-camp'],
      activity: { kind: 'renamed', at: ago(5), videoIds: [] },
    },
    {
      id: 'practice-tapes',
      name: 'Practice tapes',
      ownerId: 'tomas',
      visibility: 'private',
      videoIds: ['nocturne', 'garage-drums'],
      activity: { kind: 'added', at: ago(8), videoIds: ['garage-drums'] },
    },
    {
      id: 'soccer-season',
      name: 'Soccer season',
      ownerId: 'priya',
      visibility: 'public',
      videoIds: ['u9-final', 'no-training-wheels'],
      activity: { kind: 'removed', at: ago(12), videoIds: [] },
    },
    {
      id: 'treehouse-build',
      name: 'Treehouse build',
      ownerId: 'leo',
      visibility: 'public',
      videoIds: ['treehouse-3', 'no-training-wheels'],
      activity: { kind: 'created', at: ago(15), videoIds: [] },
    },
  ]
}

let playlists: Playlist[] = process.env.NODE_ENV === 'test' ? seed() : []

export function resetPlaylists() {
  playlists = process.env.NODE_ENV === 'test' ? seed() : []
}

function newestActivityFirst(list: Playlist[]): Playlist[] {
  return [...list].sort((a, b) => b.activity.at - a.activity.at)
}

export function getPlaylist(id: string): Playlist | undefined {
  return playlists.find((playlist) => playlist.id === id)
}

/** Private playlists exist only for their owner; everyone else gets "not found". */
export function canSee(playlist: Playlist, viewerId: string | undefined | null): boolean {
  return playlist.visibility === 'public' || playlist.ownerId === viewerId
}

export function isOwner(playlist: Playlist, viewerId: string | undefined | null): boolean {
  return viewerId != null && playlist.ownerId === viewerId
}

/** A person's own playlists, private included, most recently changed first. */
export function playlistsOwnedBy(personId: string): Playlist[] {
  return newestActivityFirst(playlists.filter((playlist) => playlist.ownerId === personId))
}

/** House-visible playlists of everyone except the viewer, most recently changed first. */
export function housePlaylists(viewerId?: string | null): Playlist[] {
  return newestActivityFirst(
    playlists.filter((playlist) => playlist.visibility === 'public' && playlist.ownerId !== viewerId && getPerson(playlist.ownerId)),
  )
}

/** The playlist's videos this viewer may see; someone's private upload stays out of their shared list. */
export function playlistVideos(playlist: Playlist, viewerId?: string | null): Video[] {
  return playlist.videoIds
    .map((id) => getVideo(id))
    .filter((video): video is Video => video !== undefined && canWatch(video, viewerId))
}

export function playlistDuration(playlist: Playlist, viewerId?: string | null): number {
  return playlistVideos(playlist, viewerId).reduce((sum, video) => sum + video.durationSec, 0)
}

export function daysSince(at: number, now = Date.now()): number {
  return Math.max(0, (now - at) / DAY)
}

/** Videos to show for a playlist's last change: what arrived, or else what follows the cover. */
export function activityVideos(playlist: Playlist, limit = 3, viewerId?: string | null): { video: Video; fresh: boolean }[] {
  let fresh = playlist.activity.kind === 'added' && daysSince(playlist.activity.at) < NEW_WINDOW_DAYS
  let added = playlist.activity.kind === 'added'
    ? [...playlist.activity.videoIds].reverse().map((id) => getVideo(id)).filter((video): video is Video => !!video && playlist.videoIds.includes(video.id) && canWatch(video, viewerId))
    : []
  let rest = playlistVideos(playlist, viewerId).slice(1).filter((video) => !added.includes(video))
  return [...added.map((video) => ({ video, fresh })), ...rest.map((video) => ({ video, fresh: false }))].slice(0, limit)
}

/** The sentence after the owner's name: "added 2 videos", "made this playlist". */
export function describeActivity(activity: PlaylistActivity): string {
  switch (activity.kind) {
    case 'added':
      return activity.videoIds.length === 1 ? 'added a video' : `added ${activity.videoIds.length} videos`
    case 'removed':
      return 'removed a video'
    case 'reordered':
      return 'changed the order'
    case 'renamed':
      return 'renamed this playlist'
    case 'shared':
      return 'shared this with the house'
    case 'unshared':
      return 'made this private'
    case 'described':
      return 'updated the description'
    case 'created':
      return 'made this playlist'
  }
}

/** "1 hr 52 min", "54 min", "Under a minute". */
export function formatLength(totalSec: number): string {
  let minutes = Math.round(totalSec / 60)
  if (totalSec > 0 && minutes === 0) return 'Under a minute'
  let h = Math.floor(minutes / 60)
  let m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** The owner's playlists that already hold this video. */
export function savedIn(videoId: string, ownerId: string): Playlist[] {
  return playlistsOwnedBy(ownerId).filter((playlist) => playlist.videoIds.includes(videoId))
}

function activityOf(kind: ActivityKind, videoIds: string[] = [], at = Date.now()): PlaylistActivity {
  return { kind, at, videoIds }
}

const writes = new Map<string, Promise<unknown>>()

/** Overlapping Save would persist a stale join list. */
function serialize<T>(id: string, work: () => Promise<T>): Promise<T> {
  let prior = writes.get(id) ?? Promise.resolve()
  let next = prior.then(work, work)
  writes.set(id, next.then(() => undefined, () => undefined))
  return next
}

async function videoUuidsFor(slugs: string[]) {
  if (slugs.length === 0) return []
  let rows = await db.findMany(videos)
  let idBySlug = new Map(rows.map((row) => [row.slug, row.id]))
  return slugs.flatMap((slug) => {
    let id = idBySlug.get(slug)
    return id ? [id] : []
  })
}

async function persistPlaylist(playlist: Playlist) {
  let person = getPerson(playlist.ownerId)
  if (!person || person.id === person.slug) return
  let owner = await db.findOne(people, { where: { id: playlist.ownerId } })
  if (!owner) return
  let row = await db.findOne(playlistTable, { where: { slug: playlist.id } })
  if (!row || row.owner_id !== playlist.ownerId) return
  let videoUuids = await videoUuidsFor(playlist.videoIds)
  await db.transaction(async (tx) => {
    await tx.update(playlistTable, row.id, {
      name: playlist.name,
      visibility: playlist.visibility,
      description: playlist.description ?? null,
      activity_kind: playlist.activity.kind,
      activity_at: new Date(playlist.activity.at),
      activity_video_ids: playlist.activity.videoIds.join(','),
    })
    await tx.deleteMany(playlistVideoTable, { where: { playlist_id: row.id } })
    if (videoUuids.length) {
      await tx.createMany(
        playlistVideoTable,
        videoUuids.map((video_id, position) => ({ playlist_id: row.id, video_id, position })),
      )
    }
  })
}

export async function loadCataloguePlaylists() {
  let rows = await db.findMany(playlistTable)
  let joins = await db.findMany(playlistVideoTable, {
    orderBy: [
      ['playlist_id', 'asc'],
      ['position', 'asc'],
    ],
  })
  let videoRows = await db.findMany(videos)
  let slugById = new Map(videoRows.map((row) => [row.id, row.slug]))
  let videosByPlaylist = new Map<string, string[]>()
  for (let join of joins) {
    let slug = slugById.get(join.video_id)
    if (!slug) continue
    let list = videosByPlaylist.get(join.playlist_id)
    if (list) list.push(slug)
    else videosByPlaylist.set(join.playlist_id, [slug])
  }
  let present = new Set(playlists.map((playlist) => playlist.id))
  for (let row of rows) {
    if (present.has(row.slug)) continue
    let at = row.activity_at instanceof Date ? row.activity_at.getTime() : Date.parse(String(row.activity_at))
    playlists.push({
      id: row.slug,
      name: row.name,
      ownerId: row.owner_id,
      visibility: row.visibility === 'public' ? 'public' : 'private',
      description: row.description ?? undefined,
      videoIds: videosByPlaylist.get(row.id) ?? [],
      activity: {
        kind: row.activity_kind as ActivityKind,
        at: Number.isFinite(at) ? at : Date.now(),
        videoIds: row.activity_video_ids ? row.activity_video_ids.split(',').filter(Boolean) : [],
      },
    })
    present.add(row.slug)
  }
}

type Invalid = { error: string; field: 'name' | 'description' }

function clean(input: PlaylistInput, ownerId: string, editingId?: string): PlaylistInput | Invalid {
  let name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > NAME_MAX) {
    return { error: `Give the playlist a name between 1 and ${NAME_MAX} characters.`, field: 'name' }
  }
  let taken = playlists.find(
    (playlist) =>
      playlist.ownerId === ownerId &&
      playlist.id !== editingId &&
      playlist.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (taken) return { error: `You already have a playlist called ${taken.name}.`, field: 'name' }
  let description = input.description.trim()
  if (description.length > DESCRIPTION_MAX) {
    return { error: `Keep the description under ${DESCRIPTION_MAX} characters.`, field: 'description' }
  }
  let visibility: Visibility = input.visibility === 'public' ? 'public' : 'private'
  return { name, description, visibility }
}

export async function createPlaylist(ownerId: string, input: PlaylistInput, firstVideoId?: string): Promise<Playlist | Invalid> {
  let valid = clean(input, ownerId)
  if ('error' in valid) return valid

  return serialize(`owner:${ownerId}`, async () => {
    let again = clean(input, ownerId)
    if ('error' in again) return again

    let base = slugify(again.name, 'playlist')
    let id = base
    let n = 2
    while (getPlaylist(id) || id === 'new') {
      id = `${base}-${n}`
      n++
    }

    let first = firstVideoId && getVideo(firstVideoId) ? [firstVideoId] : []
    let playlist: Playlist = {
      id,
      name: again.name,
      ownerId,
      visibility: again.visibility,
      description: again.description || undefined,
      videoIds: first,
      activity: activityOf('created'),
    }

    let person = getPerson(ownerId)
    if (person && person.id !== person.slug && (await db.findOne(people, { where: { id: ownerId } }))) {
      if (await db.findOne(playlistTable, { where: { slug: id } })) {
        return { error: `You already have a playlist called ${again.name}.`, field: 'name' }
      }
      let videoUuids = await videoUuidsFor(playlist.videoIds)
      let rowId = randomUUID()
      try {
        await db.transaction(async (tx) => {
          await tx.create(playlistTable, {
            id: rowId,
            slug: id,
            owner_id: ownerId,
            name: playlist.name,
            visibility: playlist.visibility,
            description: playlist.description ?? null,
            activity_kind: playlist.activity.kind,
            activity_at: new Date(playlist.activity.at),
            activity_video_ids: playlist.activity.videoIds.join(','),
          })
          if (videoUuids.length) {
            await tx.createMany(
              playlistVideoTable,
              videoUuids.map((video_id, position) => ({ playlist_id: rowId, video_id, position })),
            )
          }
        })
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          return { error: `You already have a playlist called ${again.name}.`, field: 'name' }
        }
        throw error
      }
    }
    playlists.push(playlist)
    return playlist
  })
}

export async function updatePlaylist(playlist: Playlist, input: PlaylistInput): Promise<Playlist | Invalid> {
  return serialize(playlist.id, async () => {
    let valid = clean(input, playlist.ownerId, playlist.id)
    if ('error' in valid) return valid
    let shared = playlist.visibility === 'private' && valid.visibility === 'public'
    let unshared = playlist.visibility === 'public' && valid.visibility === 'private'
    let renamed = playlist.name !== valid.name
    let described = (playlist.description ?? '') !== valid.description
    let activity = playlist.activity
    if (shared) activity = activityOf('shared')
    else if (unshared) activity = activityOf('unshared')
    else if (renamed) activity = activityOf('renamed')
    else if (described) activity = activityOf('described')
    let next: Playlist = {
      ...playlist,
      name: valid.name,
      description: valid.description || undefined,
      visibility: valid.visibility,
      activity,
    }
    await persistPlaylist(next)
    playlist.name = next.name
    playlist.description = next.description
    playlist.visibility = next.visibility
    playlist.activity = next.activity
    return playlist
  })
}

export async function deletePlaylist(playlist: Playlist) {
  return serialize(playlist.id, async () => {
    let row = await db.findOne(playlistTable, { where: { slug: playlist.id } })
    if (row && row.owner_id === playlist.ownerId) await db.delete(playlistTable, row.id)
    playlists = playlists.filter((other) => other.id !== playlist.id)
  })
}

export async function addVideo(playlist: Playlist, videoId: string): Promise<boolean> {
  if (!getVideo(videoId)) return false
  return serialize(playlist.id, async () => {
    if (playlist.videoIds.includes(videoId)) return false
    let now = Date.now()
    let last = playlist.activity
    let activity =
      last.kind === 'added' && now - last.at < MERGE_ADDS_MS
        ? activityOf('added', [...last.videoIds, videoId], now)
        : activityOf('added', [videoId], now)
    let next: Playlist = { ...playlist, videoIds: [...playlist.videoIds, videoId], activity }
    await persistPlaylist(next)
    playlist.videoIds = next.videoIds
    playlist.activity = next.activity
    return true
  })
}

export async function removeVideo(playlist: Playlist, videoId: string): Promise<boolean> {
  return serialize(playlist.id, async () => {
    if (!playlist.videoIds.includes(videoId)) return false
    let videoIds = playlist.videoIds.filter((id) => id !== videoId)
    let activity = playlist.activity
    if (activity.kind === 'added' && activity.videoIds.includes(videoId)) {
      let left = activity.videoIds.filter((id) => id !== videoId)
      if (left.length > 0) activity = { ...activity, videoIds: left }
      else activity = activityOf('removed')
    } else {
      activity = activityOf('removed')
    }
    let next: Playlist = { ...playlist, videoIds, activity }
    await persistPlaylist(next)
    playlist.videoIds = next.videoIds
    playlist.activity = next.activity
    return true
  })
}

export async function moveVideo(playlist: Playlist, videoId: string, delta: -1 | 1): Promise<boolean> {
  return serialize(playlist.id, async () => {
    let from = playlist.videoIds.indexOf(videoId)
    let to = from + delta
    if (from < 0 || to < 0 || to >= playlist.videoIds.length) return false
    let ids = [...playlist.videoIds]
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    let next: Playlist = { ...playlist, videoIds: ids, activity: activityOf('reordered') }
    await persistPlaylist(next)
    playlist.videoIds = next.videoIds
    playlist.activity = next.activity
    return true
  })
}
