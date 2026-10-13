import { randomUUID } from 'node:crypto'

import { db } from '../db.ts'
import { canWatch, getVideo, videos as memoryVideos, type Video } from './library.ts'
import { loadCatalogueTags } from './tags.ts'
import { channels, videoAudience, videoTags, videos, tags as tagRows } from './tables.ts'

type VideoRow = {
  id: string
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

function videoFromRow(
  row: VideoRow,
  channelById: Map<string, ChannelRow>,
  tagSlugs: string[],
  audienceIds: string[],
): Video {
  let published = publishedMs(row.published_at)
  let isPrivate = row.visibility === 'private'
  return Object.defineProperty(
    {
      id: row.slug,
      title: row.title,
      channelId: channelById.get(row.channel_id)?.slug ?? row.channel_id,
      durationSec: row.duration_sec ?? 0,
      addedDaysAgo: 0,
      thumb: row.poster_path ?? '',
      tags: tagSlugs,
      plays: row.plays,
      file: row.file_path,
      postedBy: row.owner_id ?? undefined,
      private: isPrivate ? true : undefined,
      audience: isPrivate ? audienceIds : undefined,
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

async function tagsByVideoId() {
  let joins = await db.findMany(videoTags)
  let tagById = new Map((await db.findMany(tagRows)).map((row) => [row.id, row.slug]))
  let slugs = new Map<string, string[]>()
  for (let join of joins) {
    let slug = tagById.get(join.tag_id)
    if (!slug) continue
    let list = slugs.get(join.video_id)
    if (list) list.push(slug)
    else slugs.set(join.video_id, [slug])
  }
  return slugs
}

async function audienceByVideoId() {
  let joins = await db.findMany(videoAudience)
  let ids = new Map<string, string[]>()
  for (let join of joins) {
    let list = ids.get(join.video_id)
    if (list) list.push(join.person_id)
    else ids.set(join.video_id, [join.person_id])
  }
  return ids
}

async function videosFromRows(rows: VideoRow[]) {
  let channelById = await channelMap()
  let tagSlugs = await tagsByVideoId()
  let audienceIds = await audienceByVideoId()
  return rows.map((row) =>
    videoFromRow(row, channelById, tagSlugs.get(row.id) ?? [], audienceIds.get(row.id) ?? []),
  )
}

export async function listVisibleVideos(viewerId?: string | null): Promise<Video[]> {
  let rows = await videosFromRows(await db.findMany(videos))
  return rows.filter((video) => canWatch(video, viewerId))
}

export async function videoSlugTaken(slug: string) {
  return (await db.findOne(videos, { where: { slug } })) != null
}

/** Remember catalogue Videos in the in-memory library so Watch and channels work after Host start. */
export async function loadCatalogueVideos() {
  await loadCatalogueTags()
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
  tagIds?: string[]
  audienceIds?: string[]
}): Promise<{ id: string; slug: string } | null> {
  let channel = await db.findOne(channels, { where: { slug: input.channelSlug } })
  if (!channel) return null
  let id = randomUUID()
  let audienceIds = input.visibility === 'private' ? (input.audienceIds ?? []) : []
  await db.transaction(async (tx) => {
    await tx.create(videos, {
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
    if (input.tagIds?.length) {
      await tx.createMany(
        videoTags,
        input.tagIds.map((tagId) => ({ video_id: id, tag_id: tagId })),
      )
    }
    if (audienceIds.length) {
      await tx.createMany(
        videoAudience,
        audienceIds.map((personId) => ({ video_id: id, person_id: personId })),
      )
    }
  })
  return { id, slug: input.slug }
}

export async function saveUploadedVideo(input: {
  slug: string
  title: string
  visibility: 'house' | 'private'
  audienceIds: string[]
  tagIds: string[]
}): Promise<boolean> {
  let row = await db.findOne(videos, { where: { slug: input.slug } })
  if (!row) return false
  let named = input.visibility === 'private' ? input.audienceIds : []
  await db.transaction(async (tx) => {
    await tx.update(videos, row.id, { title: input.title, visibility: input.visibility })
    await tx.deleteMany(videoTags, { where: { video_id: row.id } })
    if (input.tagIds.length) {
      await tx.createMany(
        videoTags,
        input.tagIds.map((tagId) => ({ video_id: row.id, tag_id: tagId })),
      )
    }
    await tx.deleteMany(videoAudience, { where: { video_id: row.id } })
    if (named.length) {
      await tx.createMany(
        videoAudience,
        named.map((personId) => ({ video_id: row.id, person_id: personId })),
      )
    }
  })
  return true
}
