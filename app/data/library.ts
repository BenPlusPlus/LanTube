// Synthetic household library used until real indexing and uploads exist.
// Names, titles, progress and dates are illustrative; thumbnails are licensed
// Wikimedia Commons photos (see public/thumbs/CREDITS.json).

import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import type { VideoChapter } from '../ui/public/chapter-list.ts'
import { hueFor, isAdmin, isParent, listPeople, getPerson as getHouseholdPerson, slugify, type Person } from './household.ts'
import { channelManagers, channels, people } from './tables.ts'

export type { VideoChapter } from '../ui/public/chapter-list.ts'

/** `person`: everyone's home channel. `custom`: a named channel someone runs. `folder`: an indexed share. */
export type ChannelKind = 'person' | 'custom' | 'folder'

export interface Channel {
  id: string
  name: string
  kind: ChannelKind
  /** Folder path for indexed-folder channels. */
  path?: string
  /** Avatar hue (0-360) for initial-letter avatars. */
  hue: number
  /** Optional local photo data URL. */
  photo?: string
  /** Custom channels: the person who runs it. */
  ownerId?: string
  /** Custom channels: everyone else the owner names as a Manager. The owner is not a Manager. */
  managerIds?: string[]
  description?: string
}

export interface Video {
  id: string
  title: string
  channelId: string
  durationSec: number
  /** Days before "now" the video was added. */
  addedDaysAgo: number
  thumb: string
  tags: string[]
  /** Times anyone in the house has started this video. */
  plays: number
  /** File path relative to the media folder; defaults to `<id>.mp4`. */
  file?: string
  /** The person who posted it. Set on custom-channel videos and on every upload. */
  postedBy?: string
  private?: boolean
  /** Empty is allowed: private with nobody extra named. */
  audience?: string[]
  /** Relative Media-share path of the one .vtt on this Video, if any. */
  captions?: string
  /** Titled spans embedded in the file; empty means the seek bar stays plain. */
  chapters?: VideoChapter[]
}

/** A private Video exists for its Video owner, named Audience, any Parent, and — on a Custom channel — the Channel owner and Managers. */
export function canWatch(video: Video, viewerId: string | undefined | null): boolean {
  if (!video.private) return true
  if (viewerId == null) return false
  if (video.postedBy === viewerId) return true
  if (video.audience?.includes(viewerId)) return true
  if (isParent(viewerId)) return true
  let channel = getChannel(video.channelId)
  return channel?.kind === 'custom' && canPost(channel, viewerId)
}

/** Title, Tags, visibility, and Audience: Video owner, and on a Custom channel the Channel owner and Managers. */
export function canEditVideo(video: Video, personId: string | undefined | null): boolean {
  if (!personId) return false
  let channel = getChannel(video.channelId)
  if (!channel || channel.kind === 'folder') return false
  if (video.postedBy === personId) return true
  return channel.kind === 'custom' && canPost(channel, personId)
}

/** Uploaded: same as `canEditVideo`. Folder: Admin only. */
export function canEditVideoTitle(video: Video, personId: string | undefined | null): boolean {
  let channel = getChannel(video.channelId)
  if (channel?.kind === 'folder') return isAdmin(personId)
  return canEditVideo(video, personId)
}

/** Uploaded: same as `canEditVideo`. Folder: any signed-in Person. */
export function canEditVideoTags(video: Video, personId: string | undefined | null): boolean {
  if (!personId) return false
  let channel = getChannel(video.channelId)
  if (channel?.kind === 'folder') return true
  return canEditVideo(video, personId)
}

/** An indexed Folder Video: Admin only. The file on the Media share stays. */
export function canDropFolderVideo(video: Video, personId: string | undefined | null): boolean {
  let channel = getChannel(video.channelId)
  return channel?.kind === 'folder' && isAdmin(personId)
}

/** An uploaded Video: its Video owner, and on a Custom channel also the Channel owner and Managers. */
export function canDeleteVideo(video: Video, personId: string | undefined | null): boolean {
  if (!personId) return false
  let channel = getChannel(video.channelId)
  if (!channel || channel.kind === 'folder') return false
  if (video.postedBy === personId) return true
  return channel.kind === 'custom' && canPost(channel, personId)
}

/** Drops the owner and anyone who is not a Person in the house. */
export function namedAudience(ownerId: string, ids: Iterable<string>): string[] {
  let known = new Set(listPeople().map((person) => person.id))
  return [...new Set(ids)].filter((id) => id !== ownerId && known.has(id))
}

/** Seeded thumbs live in public/thumbs; uploads carry their own path; some videos have none yet. */
export function thumbUrl(video: Pick<Video, 'thumb'>): string | null {
  if (!video.thumb) return null
  return video.thumb.startsWith('/') ? video.thumb : `/thumbs/${video.thumb}`
}

/** Every video this viewer is allowed to see. */
export function visibleVideos(viewerId?: string | null): Video[] {
  return videos.filter((video) => canWatch(video, viewerId))
}

/** Adds a freshly uploaded video; its age counts up from now. */
export function addUploadedVideo(video: Omit<Video, 'addedDaysAgo' | 'plays'>, addedAt = Date.now()): Video {
  let added = Object.defineProperty({ ...video, plays: 0 } as Video, 'addedDaysAgo', {
    get: () => Math.max(0, (Date.now() - addedAt) / 86_400_000),
    enumerable: true,
  })
  videos.push(added)
  return added
}

export function deleteVideo(id: string) {
  let index = videos.findIndex((video) => video.id === id)
  if (index !== -1) videos.splice(index, 1)
  for (let own of progressByPerson.values()) own.delete(id)
}

function personChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

function seedFolderChannels(): Channel[] {
  return [{ id: 'home-movies', name: 'Home Movies', kind: 'folder', path: '/media/Home Movies', hue: 214 }]
}

let folderChannels: Channel[] = process.env.NODE_ENV === 'test' ? seedFolderChannels() : []

function seedCustomChannels(): Channel[] {
  return [
    {
      id: 'twice',
      name: 'Twice',
      kind: 'custom',
      hue: 326,
      ownerId: 'mia',
      managerIds: ['priya'],
      description: 'Concert clips, dance practice, and every comeback stage we can catch.',
    },
    {
      id: 'skillet',
      name: 'Skillet',
      kind: 'custom',
      hue: 14,
      ownerId: 'tomas',
      managerIds: [],
      description: 'Live footage and garage covers. Turn it up.',
    },
    {
      id: 'video-games',
      name: 'Video Games',
      kind: 'custom',
      hue: 196,
      ownerId: 'leo',
      managerIds: ['mia', 'tomas'],
      description: 'Boss fights, family cups, and the occasional rage quit.',
    },
  ]
}

let customChannels: Channel[] = process.env.NODE_ENV === 'test' ? seedCustomChannels() : []
let frozenHomeChannels: Channel[] = []
/** Removed People whose Frozen Home was deleted; used to name Videos they posted elsewhere. */
let forgottenPosters: Channel[] = []

export function getChannels(): Channel[] {
  return [...listPeople().map(personChannel), ...frozenHomeChannels, ...customChannels, ...folderChannels]
}

const mockupVideos: Video[] = [
  { id: 'tahoe-day-2', title: 'Lake Tahoe 2025, day 2: Emerald Bay at sunset', channelId: 'mia', durationSec: 1477, addedDaysAgo: 0.2, thumb: 'tahoe.jpg', tags: ['trips'], plays: 3 },
  { id: 'no-training-wheels', title: "Leo's first ride without training wheels", channelId: 'leo', durationSec: 134, addedDaysAgo: 0.8, thumb: 'bike.jpg', tags: ['kids'], plays: 9 },
  { id: 'sourdough-4', title: 'Sourdough attempt #4 (finally got an ear)', channelId: 'tomas', durationSec: 662, addedDaysAgo: 1.4, thumb: 'bread.jpg', tags: ['cooking'], plays: 4 },
  { id: 'u9-final', title: 'U9 soccer final, full second half', channelId: 'priya', durationSec: 1694, addedDaysAgo: 2, thumb: 'soccer.jpg', tags: ['kids', 'sports'], plays: 6 },
  { id: 'treehouse-3', title: 'Treehouse build, part 3: the walkway', channelId: 'leo', durationSec: 1085, addedDaysAgo: 3, thumb: 'treehouse.jpg', tags: ['projects', 'kids'], plays: 7 },
  { id: 'cardinal', title: 'The cardinal is back at the feeder', channelId: 'priya', durationSec: 552, addedDaysAgo: 4, thumb: 'birds.jpg', tags: ['nature'], plays: 5 },
  { id: 'nocturne', title: 'Chopin nocturne, first full run-through', channelId: 'tomas', durationSec: 410, addedDaysAgo: 5, thumb: 'piano.jpg', tags: ['music'], plays: 11 },
  { id: 'rosie-one', title: 'Rosie turns one', channelId: 'ruth', durationSec: 748, addedDaysAgo: 6, thumb: 'cake.jpg', tags: ['family'], plays: 23 },
  { id: 'kitchen-reveal', title: 'Kitchen remodel: the reveal', channelId: 'tomas', durationSec: 220, addedDaysAgo: 9, thumb: 'kitchen.jpg', tags: ['projects'], plays: 8 },
  { id: 'hilltop-camp', title: 'Hilltop camp, night one', channelId: 'mia', durationSec: 905, addedDaysAgo: 12, thumb: 'camping.jpg', tags: ['trips', 'nature'], plays: 6 },
  { id: 'fetch-arnside', title: 'Fetch at Arnside, low tide', channelId: 'ruth', durationSec: 318, addedDaysAgo: 16, thumb: 'dog.jpg', tags: ['family', 'nature'], plays: 14 },
  { id: 'christmas-2009', title: 'Christmas morning 2009 (camcorder tape 3)', channelId: 'home-movies', durationSec: 2478, addedDaysAgo: 21, thumb: 'xmas.jpg', tags: ['family', 'home-movies'], plays: 31, file: 'Home Movies/christmas-2009.mp4' },
  { id: 'twice-oakland', title: 'Twice in Oakland: the encore from section 104', channelId: 'twice', postedBy: 'mia', durationSec: 512, addedDaysAgo: 0.4, thumb: 'twice-concert.jpg', tags: ['music'], plays: 4 },
  { id: 'dance-week-2', title: 'Learning the chorus choreo, week 2', channelId: 'twice', postedBy: 'priya', durationSec: 236, addedDaysAgo: 8, thumb: 'dance-practice.jpg', tags: ['music'], plays: 6 },
  { id: 'skillet-pit', title: 'Skillet live at the county fair, from the pit', channelId: 'skillet', postedBy: 'tomas', durationSec: 1312, addedDaysAgo: 10, thumb: 'rock-pit.jpg', tags: ['music'], plays: 5 },
  { id: 'garage-drums', title: 'Drum cover in the garage, take 7', channelId: 'skillet', postedBy: 'tomas', durationSec: 268, addedDaysAgo: 19, thumb: 'drum-cover.jpg', tags: ['music'], plays: 3 },
  { id: 'family-cup', title: 'Family cup, 150cc: Grandma wins again', channelId: 'video-games', postedBy: 'leo', durationSec: 1046, addedDaysAgo: 1.1, thumb: 'mario-kart.jpg', tags: ['games', 'family'], plays: 12 },
  { id: 'boss-attempt-14', title: 'Boss fight, attempt 14 (I finally got him)', channelId: 'video-games', postedBy: 'leo', durationSec: 731, addedDaysAgo: 4, thumb: 'boss-fight.jpg', tags: ['games'], plays: 8 },
  { id: 'first-place', title: 'First place out of 99, with commentary', channelId: 'video-games', postedBy: 'mia', durationSec: 389, addedDaysAgo: 13, thumb: 'tetris-win.jpg', tags: ['games'], plays: 2 },
]

export const videos: Video[] = process.env.NODE_ENV === 'test' ? mockupVideos : []

/** A video counts as "new" when it arrived in the last three days and hasn't been started. */
export const NEW_WINDOW_DAYS = 3

export function getChannel(id: string): Channel | undefined {
  let person = getHouseholdPerson(id)
  if (person) return personChannel(person)
  let frozen = frozenHomeChannels.find((channel) => channel.id === id || channel.ownerId === id)
  if (frozen) return frozen
  return customChannels.find((channel) => channel.id === id) ?? folderChannels.find((channel) => channel.id === id)
}

/** Channel page identity, plus Removed People whose Frozen Home is gone. */
export function posterChannel(id: string): Channel | undefined {
  return getChannel(id) ?? forgottenPosters.find((channel) => channel.id === id || channel.ownerId === id)
}

/** Custom channels this person runs or may post to, in the order they were made. Accepts a Person id or slug. */
export function channelsFor(personId: string): { runs: Channel[]; postsTo: Channel[] } {
  let id = getHouseholdPerson(personId)?.id ?? personId
  return {
    runs: customChannels.filter((channel) => channel.ownerId === id),
    postsTo: customChannels.filter((channel) => channel.managerIds?.includes(id)),
  }
}

/** Only the Channel owner may delete a Custom channel. Home channels are not deleted this way. */
export function canDeleteCustomChannel(channel: Channel, personId: string | undefined | null): boolean {
  return channel.kind === 'custom' && personId != null && channel.ownerId === personId
}

/** Frozen Home: the Person is gone; the channel remains until an Admin deletes it. */
export function isFrozenHome(channel: Channel): boolean {
  return channel.kind === 'person' && getHouseholdPerson(channel.id) == null
}

/** An Admin may delete a Custom channel, or a Frozen Home channel, from the channel page. */
export function canAdminDeleteChannel(channel: Channel, personId: string | undefined | null): boolean {
  return isAdmin(personId) && (channel.kind === 'custom' || isFrozenHome(channel))
}

export function canPost(channel: Channel, personId: string | undefined): boolean {
  if (!personId) return false
  if (channel.kind === 'person') {
    let person = getHouseholdPerson(personId)
    return person != null && channel.id === person.slug
  }
  if (channel.kind === 'custom') return channel.ownerId === personId || (channel.managerIds?.includes(personId) ?? false)
  return false
}

/** Channels with the most recent upload first; empty channels last, newest-made first. */
export function byLatestActivity(list: Channel[]): Channel[] {
  let latest = (channel: Channel) => channelStats(channel.id).latest?.addedDaysAgo ?? Number.POSITIVE_INFINITY
  return [...list].sort((a, b) => latest(a) - latest(b))
}

export interface ChannelInput {
  name: string
  description: string
  managerIds: string[]
  photo?: string
}

const NAME_MAX = 40
const DESCRIPTION_MAX = 280

function cleanInput(input: ChannelInput, ownerId: string, editingId?: string): ChannelInput | { error: string; field: 'name' | 'description' } {
  let name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > NAME_MAX) {
    return { error: `Give the channel a name between 1 and ${NAME_MAX} characters.`, field: 'name' }
  }
  let taken = getChannels().find(
    (channel) => channel.id !== editingId && channel.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (taken) {
    return {
      error: taken.kind === 'person' ? `${taken.name} is already someone’s home channel. Pick another name.` : `There’s already a channel called ${taken.name}.`,
      field: 'name',
    }
  }
  let description = input.description.trim()
  if (description.length > DESCRIPTION_MAX) {
    return { error: `Keep the description under ${DESCRIPTION_MAX} characters.`, field: 'description' }
  }
  let known = new Set(listPeople().map((person) => person.id))
  let managerIds = [...new Set(input.managerIds)].filter((id) => id !== ownerId && known.has(id))
  return { name, description, managerIds, photo: input.photo }
}

async function persistCustomChannel(channel: Channel) {
  if (!channel.ownerId) return
  let cataloguePeople = await db.findMany(people)
  let known = new Set(cataloguePeople.filter((row) => row.removed_at == null).map((row) => row.id))
  if (!known.has(channel.ownerId)) return
  let row = await db.findOne(channels, { where: { slug: channel.id } })
  if (row && row.kind !== 'custom') return
  let managerIds = (channel.managerIds ?? []).filter((id) => known.has(id))
  await db.transaction(async (tx) => {
    let channelId = row?.id ?? randomUUID()
    if (row) {
      await tx.update(channels, row.id, {
        name: channel.name,
        description: channel.description ?? null,
        photo_path: channel.photo ?? null,
        hue: channel.hue,
      })
      await tx.deleteMany(channelManagers, { where: { channel_id: row.id } })
    } else {
      await tx.create(channels, {
        id: channelId,
        slug: channel.id,
        name: channel.name,
        kind: 'custom',
        hue: channel.hue,
        photo_path: channel.photo ?? null,
        owner_id: channel.ownerId,
        description: channel.description ?? null,
      })
    }
    if (managerIds.length) {
      await tx.createMany(
        channelManagers,
        managerIds.map((person_id) => ({ channel_id: channelId, person_id })),
      )
    }
  })
}

export async function createChannel(ownerId: string, input: ChannelInput): Promise<Channel | { error: string; field: 'name' | 'description' }> {
  let clean = cleanInput(input, ownerId)
  if ('error' in clean) return clean

  let base = slugify(clean.name, 'channel')
  let id = base
  let n = 2
  while (getChannel(id) || id === 'new') {
    id = `${base}-${n}`
    n++
  }

  let channel: Channel = {
    id,
    name: clean.name,
    kind: 'custom',
    hue: hueFor(clean.name),
    ownerId,
    managerIds: clean.managerIds,
    description: clean.description || undefined,
    photo: clean.photo,
  }
  await persistCustomChannel(channel)
  customChannels.push(channel)
  return channel
}

/** The URL stays put. */
export async function updateChannel(channel: Channel, input: ChannelInput & { removePhoto?: boolean }): Promise<Channel | { error: string; field: 'name' | 'description' }> {
  let clean = cleanInput(input, channel.ownerId!, channel.id)
  if ('error' in clean) return clean
  let next: Channel = {
    ...channel,
    name: clean.name,
    description: clean.description || undefined,
    managerIds: clean.managerIds,
    photo: clean.photo ? clean.photo : input.removePhoto ? undefined : channel.photo,
  }
  await persistCustomChannel(next)
  channel.name = next.name
  channel.description = next.description
  channel.managerIds = next.managerIds
  channel.photo = next.photo
  let { dropImpossibleAssignments } = await import('./assignments.ts')
  await dropImpossibleAssignments()
  return channel
}

export async function loadCatalogueChannels() {
  let rows = await db.findMany(channels)
  let joins = await db.findMany(channelManagers)
  let managersByChannel = new Map<string, string[]>()
  for (let join of joins) {
    let list = managersByChannel.get(join.channel_id)
    if (list) list.push(join.person_id)
    else managersByChannel.set(join.channel_id, [join.person_id])
  }
  let present = new Set([...customChannels, ...folderChannels, ...frozenHomeChannels].map((channel) => channel.id))
  for (let row of rows) {
    if (present.has(row.slug)) continue
    if (row.kind === 'person') {
      if (getHouseholdPerson(row.slug) || (row.owner_id && getHouseholdPerson(row.owner_id))) continue
      frozenHomeChannels.push({
        id: row.slug,
        name: row.name,
        kind: 'person',
        hue: row.hue,
        photo: row.photo_path ?? undefined,
        ownerId: row.owner_id ?? undefined,
      })
      present.add(row.slug)
    } else if (row.kind === 'custom') {
      customChannels.push({
        id: row.slug,
        name: row.name,
        kind: 'custom',
        hue: row.hue,
        ownerId: row.owner_id ?? undefined,
        managerIds: managersByChannel.get(row.id) ?? [],
        description: row.description ?? undefined,
        photo: row.photo_path ?? undefined,
      })
      present.add(row.slug)
    } else if (row.kind === 'folder') {
      folderChannels.push({
        id: row.slug,
        name: row.name,
        kind: 'folder',
        path: row.path ?? undefined,
        hue: row.hue,
        photo: row.photo_path ?? undefined,
      })
      present.add(row.slug)
    }
  }
  let frozenOwners = new Set(
    frozenHomeChannels.map((channel) => channel.ownerId).filter((id): id is string => id != null),
  )
  let personRows = await db.findMany(people)
  for (let row of personRows) {
    if (row.removed_at == null) continue
    if (frozenOwners.has(row.id) || frozenHomeChannels.some((channel) => channel.id === row.slug)) continue
    if (forgottenPosters.some((channel) => channel.id === row.id)) continue
    forgottenPosters.push({
      id: row.id,
      name: row.name,
      kind: 'person',
      hue: row.hue,
      photo: row.photo_path ?? undefined,
      ownerId: row.id,
    })
  }
}

export function rememberFolder(channel: Channel) {
  if (!folderChannels.some((entry) => entry.id === channel.id)) folderChannels.push(channel)
}

export function dropFolderChannel(id: string) {
  folderChannels = folderChannels.filter((channel) => channel.id !== id)
}

export function clearFolderChannels() {
  folderChannels = []
}

export function resetChannels() {
  customChannels = process.env.NODE_ENV === 'test' ? seedCustomChannels() : []
  folderChannels = process.env.NODE_ENV === 'test' ? seedFolderChannels() : []
  frozenHomeChannels = []
  forgottenPosters = []
}

/** Home channel stays Frozen; Custom channels pass to the Admin who removed the Person. */
export function forgetRemovedPerson(person: Person, newOwnerId: string) {
  if (!frozenHomeChannels.some((channel) => channel.id === person.slug)) {
    frozenHomeChannels.push({
      id: person.slug,
      name: person.name,
      kind: 'person',
      hue: person.hue,
      photo: person.photo,
      ownerId: person.id,
    })
  }
  for (let channel of customChannels) {
    if (channel.ownerId === person.id) {
      channel.ownerId = newOwnerId
      channel.managerIds = (channel.managerIds ?? []).filter((id) => id !== person.id && id !== newOwnerId)
    } else {
      channel.managerIds = (channel.managerIds ?? []).filter((id) => id !== person.id)
    }
  }
  for (let video of videos) {
    if (video.audience?.includes(person.id)) {
      video.audience = video.audience.filter((id) => id !== person.id)
    }
  }
  progressByPerson.delete(person.id)
}

export function dropCustomChannel(id: string) {
  customChannels = customChannels.filter((channel) => channel.id !== id)
}

export function dropFrozenHomeChannel(slug: string) {
  let frozen = frozenHomeChannels.find((channel) => channel.id === slug)
  frozenHomeChannels = frozenHomeChannels.filter((channel) => channel.id !== slug)
  if (!frozen?.ownerId) return
  if (forgottenPosters.some((channel) => channel.id === frozen.ownerId)) return
  forgottenPosters.push({
    id: frozen.ownerId,
    name: frozen.name,
    kind: 'person',
    hue: frozen.hue,
    photo: frozen.photo,
    ownerId: frozen.ownerId,
  })
}

export const channelLimits = { name: NAME_MAX, description: DESCRIPTION_MAX } as const

export function getVideo(id: string): Video | undefined {
  return videos.find((video) => video.id === id)
}

// Where each person stopped in each video: personId -> videoId -> seconds.
// Watching unsigned is not recorded, so a viewer without an id has no progress.
const progressByPerson = new Map<string, Map<string, number>>()

export function progressOf(video: Video, viewerId: string | undefined): number | undefined {
  return viewerId ? progressByPerson.get(viewerId)?.get(video.id) : undefined
}

/** How far through the video this viewer is, 0-100, or null if they never started it. */
export function progressPercent(video: Video, viewerId: string | undefined): number | null {
  let at = progressOf(video, viewerId)
  return at === undefined ? null : Math.min(100, (at / video.durationSec) * 100)
}

export function resetProgress() {
  progressByPerson.clear()
}

export function isNew(video: Video, viewerId?: string): boolean {
  return video.addedDaysAgo < NEW_WINDOW_DAYS && progressOf(video, viewerId) === undefined
}

export function isInProgress(video: Video, viewerId?: string): boolean {
  let at = progressOf(video, viewerId)
  return at !== undefined && at < video.durationSec - 15
}

export function newestFirst(list: Video[]): Video[] {
  return [...list].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)
}

export function continueWatching(viewerId?: string): Video[] {
  return newestFirst(visibleVideos(viewerId).filter((video) => isInProgress(video, viewerId)))
}

export function searchVideos(query: string, tag?: string, viewerId?: string, list?: Video[]): Video[] {
  let q = query.trim().toLocaleLowerCase()
  return newestFirst(
    (list ?? visibleVideos(viewerId)).filter((video) => {
      if (tag && !video.tags.includes(tag)) return false
      if (!q) return true
      let channel = getChannel(video.channelId)
      return (
        video.title.toLocaleLowerCase().includes(q) ||
        (channel?.name.toLocaleLowerCase().includes(q) ?? false)
      )
    }),
  )
}

export function channelStats(channelId: string, viewerId?: string): { count: number; latest?: Video; newCount: number; plays: number } {
  let own = newestFirst(visibleVideos(viewerId).filter((video) => video.channelId === channelId))
  return {
    count: own.length,
    latest: own[0],
    newCount: own.filter((video) => isNew(video, viewerId)).length,
    plays: own.reduce((sum, video) => sum + video.plays, 0),
  }
}

export type ChannelSort = 'latest' | 'popular' | 'oldest'

export function channelVideos(channelId: string, sort: ChannelSort = 'latest', viewerId?: string): Video[] {
  let own = newestFirst(visibleVideos(viewerId).filter((video) => video.channelId === channelId))
  if (sort === 'oldest') return own.reverse()
  if (sort === 'popular') return own.sort((a, b) => b.plays - a.plays)
  return own
}

export function formatDuration(totalSec: number): string {
  let h = Math.floor(totalSec / 3600)
  let m = Math.floor((totalSec % 3600) / 60)
  let s = Math.floor(totalSec % 60)
  let ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function formatAdded(daysAgo: number): string {
  let hours = Math.round(daysAgo * 24)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  let days = Math.floor(daysAgo)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  let weeks = Math.floor(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`
}

export function formatRemaining(video: Video, viewerId?: string): string {
  let left = video.durationSec - (progressOf(video, viewerId) ?? 0)
  let minutes = Math.max(1, Math.round(left / 60))
  return `${minutes} min left`
}

export function formatPlays(plays: number): string {
  if (plays === 0) return 'No plays yet'
  return `${plays.toLocaleString('en-US')} play${plays === 1 ? '' : 's'}`
}

export function publishedAt(video: Video, now = Date.now()): Date {
  return new Date(now - video.addedDaysAgo * 86_400_000)
}

/**
 * Videos sharing the most tags come first (newest breaks ties), then more from the
 * same channel, then the rest of the house, newest first.
 */
export function relatedVideos(video: Video, limit = 12, viewerId?: string): Video[] {
  let others = newestFirst(
    visibleVideos(viewerId).filter((other) => other.id !== video.id && getChannel(other.channelId)),
  )
  let shared = (other: Video) => other.tags.filter((tag) => video.tags.includes(tag)).length
  let tagged = others.filter((other) => shared(other) > 0).sort((a, b) => shared(b) - shared(a))
  let picked = new Set(tagged.map((other) => other.id))
  let sameChannel = others.filter((other) => !picked.has(other.id) && other.channelId === video.channelId)
  for (let other of sameChannel) picked.add(other.id)
  let rest = others.filter((other) => !picked.has(other.id))
  return [...tagged, ...sameChannel, ...rest].slice(0, limit)
}

export function recordPlay(video: Video): number {
  video.plays += 1
  return video.plays
}

/** Store where this person stopped. `fileDurationSec` is the real file's length, which wins over the catalogue. */
export function recordProgress(video: Video, personId: string, positionSec: number, fileDurationSec?: number) {
  if (fileDurationSec !== undefined) video.durationSec = Math.round(fileDurationSec)
  let clamped = Math.min(Math.max(positionSec, 0), video.durationSec)
  let own = progressByPerson.get(personId) ?? new Map<string, number>()
  progressByPerson.set(personId, own)
  if (clamped < 5) own.delete(video.id)
  else own.set(video.id, Math.round(clamped))
}
