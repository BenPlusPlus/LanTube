// Synthetic household playlists used until real persistence exists. Names, contents
// and activity times are illustrative, like the rest of the seeded library.

import { getPerson, slugify } from './household.ts'
import { canWatch, getVideo, NEW_WINDOW_DAYS, type Video } from './library.ts'

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

let playlists: Playlist[] = seed()

export function resetPlaylists() {
  playlists = seed()
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

/** Public playlists of everyone except the viewer, most recently changed first. */
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

function touch(playlist: Playlist, kind: ActivityKind, videoIds: string[] = []) {
  playlist.activity = { kind, at: Date.now(), videoIds }
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

export function createPlaylist(ownerId: string, input: PlaylistInput, firstVideoId?: string): Playlist | Invalid {
  let valid = clean(input, ownerId)
  if ('error' in valid) return valid

  let base = slugify(valid.name, 'playlist')
  let id = base
  let n = 2
  while (getPlaylist(id) || id === 'new') {
    id = `${base}-${n}`
    n++
  }

  let first = firstVideoId && getVideo(firstVideoId) ? [firstVideoId] : []
  let playlist: Playlist = {
    id,
    name: valid.name,
    ownerId,
    visibility: valid.visibility,
    description: valid.description || undefined,
    videoIds: first,
    activity: { kind: 'created', at: Date.now(), videoIds: [] },
  }
  playlists.push(playlist)
  return playlist
}

export function updatePlaylist(playlist: Playlist, input: PlaylistInput): Playlist | Invalid {
  let valid = clean(input, playlist.ownerId, playlist.id)
  if ('error' in valid) return valid
  let shared = playlist.visibility === 'private' && valid.visibility === 'public'
  let unshared = playlist.visibility === 'public' && valid.visibility === 'private'
  let renamed = playlist.name !== valid.name
  let described = (playlist.description ?? '') !== valid.description
  playlist.name = valid.name
  playlist.description = valid.description || undefined
  playlist.visibility = valid.visibility
  if (shared) touch(playlist, 'shared')
  else if (unshared) touch(playlist, 'unshared')
  else if (renamed) touch(playlist, 'renamed')
  else if (described) touch(playlist, 'described')
  return playlist
}

export function deletePlaylist(playlist: Playlist) {
  playlists = playlists.filter((other) => other.id !== playlist.id)
}

export function addVideo(playlist: Playlist, videoId: string): boolean {
  if (!getVideo(videoId) || playlist.videoIds.includes(videoId)) return false
  playlist.videoIds.push(videoId)
  let last = playlist.activity
  if (last.kind === 'added' && Date.now() - last.at < MERGE_ADDS_MS) {
    touch(playlist, 'added', [...last.videoIds, videoId])
  } else {
    touch(playlist, 'added', [videoId])
  }
  return true
}

export function removeVideo(playlist: Playlist, videoId: string): boolean {
  if (!playlist.videoIds.includes(videoId)) return false
  playlist.videoIds = playlist.videoIds.filter((id) => id !== videoId)
  if (playlist.activity.kind === 'added' && playlist.activity.videoIds.includes(videoId)) {
    let left = playlist.activity.videoIds.filter((id) => id !== videoId)
    if (left.length > 0) {
      playlist.activity = { ...playlist.activity, videoIds: left }
      return true
    }
  }
  touch(playlist, 'removed')
  return true
}

export function moveVideo(playlist: Playlist, videoId: string, delta: -1 | 1): boolean {
  let from = playlist.videoIds.indexOf(videoId)
  let to = from + delta
  if (from < 0 || to < 0 || to >= playlist.videoIds.length) return false
  let ids = [...playlist.videoIds]
  ;[ids[from], ids[to]] = [ids[to], ids[from]]
  playlist.videoIds = ids
  touch(playlist, 'reordered')
  return true
}
