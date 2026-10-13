import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import { getVideo, videos as memoryVideos, type Video } from './library.ts'
import { channels, videos } from './tables.ts'

type VideoRow = {
  slug: string
  title: string
  channel_id: string
  duration_sec: number | null
  published_at: unknown
  poster_path: string | null
  plays: number
  file_path: string
  owner_id: string | null
  visibility: string
}

type ChannelRow = { id: string; slug: string }

function publishedMs(at: unknown) {
  if (at instanceof Date) return at.getTime()
  if (typeof at === 'number' && Number.isFinite(at)) return at
  if (typeof at === 'string') {
    let ms = Date.parse(at)
    if (Number.isFinite(ms)) return ms
  }
  return Date.now()
}

function videoFromRow(row: VideoRow, channelById: Map<string, ChannelRow>): Video {
  let published = publishedMs(row.published_at)
  return Object.defineProperty(
    {
      id: row.slug,
      title: row.title,
      channelId: channelById.get(row.channel_id)?.slug ?? row.channel_id,
      durationSec: row.duration_sec ?? 0,
      addedDaysAgo: 0,
      thumb: row.poster_path ?? '',
      tags: [],
      plays: row.plays,
      file: row.file_path,
      postedBy: row.owner_id ?? undefined,
      private: row.visibility === 'private' ? true : undefined,
    } as Video,
    'addedDaysAgo',
    {
      get: () => Math.max(0, (Date.now() - published) / 86_400_000),
      enumerable: true,
    },
  )
}

async function channelMap() {
  let rows = await db.findMany(channels)
  return new Map(rows.map((row) => [row.id, row]))
}

async function videosFromRows(rows: VideoRow[]) {
  let channelById = await channelMap()
  return rows.map((row) => videoFromRow(row, channelById))
}

/** House-visible Videos. Private entitlement waits for a later slice. */
export async function listVisibleVideos(_viewerId?: string | null): Promise<Video[]> {
  let rows = await db.findMany(videos, { where: { visibility: 'house' } })
  return videosFromRows(rows)
}

export async function videoSlugTaken(slug: string) {
  return (await db.findOne(videos, { where: { slug } })) != null
}

/** Remember catalogue Videos in the in-memory library so Watch and channels work after Host start. */
export async function loadCatalogueVideos() {
  let loaded = await videosFromRows(await db.findMany(videos))
  for (let video of loaded) {
    if (!getVideo(video.id)) memoryVideos.push(video)
  }
}

export async function insertUploadedVideo(input: {
  slug: string
  title: string
  channelSlug: string
  ownerId: string
  durationSec: number
  filePath: string
  posterPath: string | null
  visibility: 'house' | 'private'
}): Promise<{ id: string; slug: string } | null> {
  let channel = await db.findOne(channels, { where: { slug: input.channelSlug } })
  if (!channel) return null
  let id = randomUUID()
  await db.create(videos, {
    id,
    slug: input.slug,
    title: input.title,
    channel_id: channel.id,
    duration_sec: input.durationSec || null,
    poster_path: input.posterPath,
    plays: 0,
    file_path: input.filePath,
    owner_id: input.ownerId,
    visibility: input.visibility,
  })
  return { id, slug: input.slug }
}
