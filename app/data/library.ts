// Synthetic household library used until real indexing and uploads exist.
// Names, titles, progress and dates are illustrative; thumbnails are licensed
// Wikimedia Commons photos (see public/thumbs/CREDITS.json).

export type ChannelKind = 'person' | 'folder'

export interface Channel {
  id: string
  name: string
  kind: ChannelKind
  /** Folder path for indexed-folder channels. */
  path?: string
  /** Avatar hue (0-360) for initial-letter avatars. */
  hue: number
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
  /** Seconds watched on this device; undefined if never started. */
  progressSec?: number
}

export const channels: Channel[] = [
  { id: 'mia', name: 'Mia', kind: 'person', hue: 172 },
  { id: 'tomas', name: 'Tomás', kind: 'person', hue: 32 },
  { id: 'ruth', name: 'Ruth', kind: 'person', hue: 268 },
  { id: 'leo', name: 'Leo', kind: 'person', hue: 112 },
  { id: 'priya', name: 'Priya', kind: 'person', hue: 338 },
  { id: 'home-movies', name: 'Home Movies', kind: 'folder', path: '/media/Home Movies', hue: 214 },
]

export const videos: Video[] = [
  { id: 'tahoe-day-2', title: 'Lake Tahoe 2025, day 2: Emerald Bay at sunset', channelId: 'mia', durationSec: 1477, addedDaysAgo: 0.2, thumb: 'tahoe.jpg', tags: ['trips'], progressSec: 560 },
  { id: 'no-training-wheels', title: "Leo's first ride without training wheels", channelId: 'leo', durationSec: 134, addedDaysAgo: 0.8, thumb: 'bike.jpg', tags: ['kids'] },
  { id: 'sourdough-4', title: 'Sourdough attempt #4 (finally got an ear)', channelId: 'tomas', durationSec: 662, addedDaysAgo: 1.4, thumb: 'bread.jpg', tags: ['cooking'], progressSec: 130 },
  { id: 'u9-final', title: 'U9 soccer final, full second half', channelId: 'priya', durationSec: 1694, addedDaysAgo: 2, thumb: 'soccer.jpg', tags: ['kids', 'sports'] },
  { id: 'treehouse-3', title: 'Treehouse build, part 3: the walkway', channelId: 'leo', durationSec: 1085, addedDaysAgo: 3, thumb: 'treehouse.jpg', tags: ['projects', 'kids'] },
  { id: 'cardinal', title: 'The cardinal is back at the feeder', channelId: 'priya', durationSec: 552, addedDaysAgo: 4, thumb: 'birds.jpg', tags: ['nature'] },
  { id: 'nocturne', title: 'Chopin nocturne, first full run-through', channelId: 'tomas', durationSec: 410, addedDaysAgo: 5, thumb: 'piano.jpg', tags: ['music'], progressSec: 402 },
  { id: 'rosie-one', title: 'Rosie turns one', channelId: 'ruth', durationSec: 748, addedDaysAgo: 6, thumb: 'cake.jpg', tags: ['family'] },
  { id: 'kitchen-reveal', title: 'Kitchen remodel: the reveal', channelId: 'tomas', durationSec: 220, addedDaysAgo: 9, thumb: 'kitchen.jpg', tags: ['projects'] },
  { id: 'hilltop-camp', title: 'Hilltop camp, night one', channelId: 'mia', durationSec: 905, addedDaysAgo: 12, thumb: 'camping.jpg', tags: ['trips', 'nature'] },
  { id: 'fetch-arnside', title: 'Fetch at Arnside, low tide', channelId: 'ruth', durationSec: 318, addedDaysAgo: 16, thumb: 'dog.jpg', tags: ['family', 'nature'] },
  { id: 'christmas-2009', title: 'Christmas morning 2009 (camcorder tape 3)', channelId: 'home-movies', durationSec: 2478, addedDaysAgo: 21, thumb: 'xmas.jpg', tags: ['family', 'home-movies'], progressSec: 1790 },
]

export const topics: { id: string; label: string }[] = [
  { id: 'trips', label: 'Trips' },
  { id: 'kids', label: 'Kids' },
  { id: 'family', label: 'Family' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'projects', label: 'Projects' },
  { id: 'nature', label: 'Nature' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'home-movies', label: 'Home movies' },
]

/** A video counts as "new" when it arrived in the last three days and hasn't been started. */
export const NEW_WINDOW_DAYS = 3

export function getChannel(id: string): Channel | undefined {
  return channels.find((channel) => channel.id === id)
}

export function getVideo(id: string): Video | undefined {
  return videos.find((video) => video.id === id)
}

export function getTopic(id: string | null | undefined) {
  return topics.find((topic) => topic.id === id)
}

export function isNew(video: Video): boolean {
  return video.addedDaysAgo < NEW_WINDOW_DAYS && video.progressSec === undefined
}

export function isInProgress(video: Video): boolean {
  return video.progressSec !== undefined && video.progressSec < video.durationSec - 15
}

export function newestFirst(list: Video[]): Video[] {
  return [...list].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)
}

export function continueWatching(): Video[] {
  return newestFirst(videos.filter(isInProgress))
}

export function searchVideos(query: string, topic?: string): Video[] {
  let q = query.trim().toLocaleLowerCase()
  return newestFirst(
    videos.filter((video) => {
      if (topic && !video.tags.includes(topic)) return false
      if (!q) return true
      let channel = getChannel(video.channelId)
      return (
        video.title.toLocaleLowerCase().includes(q) ||
        (channel?.name.toLocaleLowerCase().includes(q) ?? false)
      )
    }),
  )
}

export function channelStats(channelId: string): { count: number; latest?: Video; newCount: number } {
  let own = newestFirst(videos.filter((video) => video.channelId === channelId))
  return { count: own.length, latest: own[0], newCount: own.filter(isNew).length }
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

export function formatRemaining(video: Video): string {
  let left = video.durationSec - (video.progressSec ?? 0)
  let minutes = Math.max(1, Math.round(left / 60))
  return `${minutes} min left`
}
