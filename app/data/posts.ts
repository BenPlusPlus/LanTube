import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { db } from '../db.ts'
import { getPerson as getHouseholdPerson, isParent, listPeople } from './household.ts'
import { canPost, isFrozenHome, namedAudience, type Channel } from './library.ts'
import { mediaDir } from './media.ts'
import { channelPostAudience, channels, people, posts as postRows } from './tables.ts'

/** One picture on a Post, kept under the Media share's `.lantube/posts/<post id>/`. */
export interface PostPicture {
  /** Relative to the Media share. */
  file: string
  type: string
  width?: number
  height?: number
}

/** A short note on a Home or Custom channel. Not editable; the author, Channel owner, or a Manager may delete it. */
export interface Post {
  id: string
  /** Channel slug. */
  channelId: string
  authorId: string
  body: string
  pictures: PostPicture[]
  /** Milliseconds since the epoch. */
  createdAt: number
}

/** Who can see a channel's Posts. Set once per channel, never per Post. */
export interface PostSettings {
  private: boolean
  /** Named People beyond the Channel owner, Managers, and Parents. Empty is allowed. */
  audience: string[]
}

const BODY_MAX = 2000
const PICTURES_MAX = 4
const MB = 1024 ** 2
const PICTURE_BYTES_MAX = 10 * MB

export const postLimits = {
  body: BODY_MAX,
  pictures: PICTURES_MAX,
  pictureBytes: PICTURE_BYTES_MAX,
  /** The whole form: four pictures at the cap, plus the text. */
  formBytes: PICTURES_MAX * PICTURE_BYTES_MAX + MB,
} as const

/** How many Posts the Posts tab shows before "Show older posts". */
export const POSTS_PAGE = 20

const postsRoot = path.join(mediaDir, '.lantube', 'posts')

let allPosts: Post[] = []
let settingsByChannel = new Map<string, PostSettings>()

/** Home and Custom channels carry Posts. Folders and Frozen Homes do not. */
export function hasPosts(channel: Channel): boolean {
  if (channel.kind === 'custom') return true
  return channel.kind === 'person' && !isFrozenHome(channel)
}

export function postSettings(channelId: string): PostSettings {
  return settingsByChannel.get(channelId) ?? { private: false, audience: [] }
}

/** The person whose Home this is, or the Custom channel's owner. Never in an Audience list. */
function channelOwnerId(channel: Channel): string | undefined {
  if (channel.kind === 'person') return getHouseholdPerson(channel.id)?.id
  return channel.ownerId
}

/**
 * The Private rule, applied to a whole channel's Posts: the Channel owner, Managers, the named Audience, and any Parent.
 * For anyone else a private Posts tab does not exist.
 */
export function canSeePosts(channel: Channel, viewerId: string | undefined | null): boolean {
  if (!hasPosts(channel)) return false
  let settings = postSettings(channel.id)
  if (!settings.private) return true
  if (viewerId == null) return false
  if (canPost(channel, viewerId)) return true
  if (settings.audience.includes(viewerId)) return true
  return isParent(viewerId)
}

/** Write a Post: the Home's person, or a Custom channel's owner and Managers. */
export function canWritePost(channel: Channel, personId: string | undefined | null): boolean {
  return personId != null && hasPosts(channel) && canPost(channel, personId)
}

/** Who sees Posts is the same group who may write them. */
export const canSetPostVisibility = canWritePost

/** The author, the Channel owner, or a Manager. Admins act only by deleting a whole Frozen Home. */
export function canDeletePost(post: Post, channel: Channel, personId: string | undefined | null): boolean {
  if (personId == null || !canSeePosts(channel, personId)) return false
  return post.authorId === personId || canPost(channel, personId)
}

/** Newest first. */
export function channelPosts(channelId: string): Post[] {
  return allPosts.filter((post) => post.channelId === channelId).sort((a, b) => b.createdAt - a.createdAt)
}

export function getPost(id: string): Post | undefined {
  return allPosts.find((post) => post.id === id)
}

/** The picture's bytes on the Media share, if it is still there. Never a path outside `.lantube/posts`. */
export function picturePathFor(picture: PostPicture): string | null {
  let absolute = path.resolve(mediaDir, picture.file)
  let root = path.resolve(postsRoot)
  if (!absolute.startsWith(root + path.sep)) return null
  return fs.existsSync(absolute) ? absolute : null
}

type Sniffed = { type: string; ext: string; width?: number; height?: number }

function u16be(bytes: Uint8Array, at: number) {
  return (bytes[at] << 8) | bytes[at + 1]
}

function u16le(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8)
}

function u24le(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
}

function u32be(bytes: Uint8Array, at: number) {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at++
      continue
    }
    let marker = bytes[at + 1]
    if (marker === 0xff) {
      at++
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2
      continue
    }
    let length = u16be(bytes, at + 2)
    let isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) return { height: u16be(bytes, at + 5), width: u16be(bytes, at + 7) }
    at += 2 + length
  }
  return undefined
}

/** Reads the type from the bytes, never the name, and the pixel size when the header carries it. */
export function sniffPicture(bytes: Uint8Array): Sniffed | null {
  let ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image/jpeg', ext: '.jpg', ...jpegSize(bytes) }
  }
  if (bytes.length > 24 && ascii(0, 8) === '\x89PNG\r\n\x1a\n') {
    return { type: 'image/png', ext: '.png', width: u32be(bytes, 16), height: u32be(bytes, 20) }
  }
  if (bytes.length > 10 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) {
    return { type: 'image/gif', ext: '.gif', width: u16le(bytes, 6), height: u16le(bytes, 8) }
  }
  if (bytes.length > 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    let chunk = ascii(12, 16)
    if (chunk === 'VP8X') return { type: 'image/webp', ext: '.webp', width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 }
    if (chunk === 'VP8L') {
      let bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
      return { type: 'image/webp', ext: '.webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8 ') return { type: 'image/webp', ext: '.webp', width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff }
    return { type: 'image/webp', ext: '.webp' }
  }
  return null
}

export type PostField = 'body' | 'pictures'

export interface PostInput {
  body: string
  pictures: Blob[]
}

/** Keeps line breaks, trims the ends, and drops control characters other than newlines and tabs. */
function cleanBody(body: string): string {
  return body
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function catalogueChannelId(slug: string): Promise<string | null> {
  let row = await db.findOne(channels, { where: { slug } })
  return row && row.kind !== 'folder' ? row.id : null
}

async function isCataloguePerson(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false
  let row = await db.find(people, id)
  return row != null && row.removed_at == null
}

export async function createPost(channel: Channel, authorId: string, input: PostInput): Promise<{ post: Post } | { error: string; field: PostField }> {
  if (!canWritePost(channel, authorId)) return { error: 'Only the people who run this channel can post here.', field: 'body' }

  let body = cleanBody(input.body)
  if (body.length < 1) return { error: 'Write something to post.', field: 'body' }
  if (body.length > BODY_MAX) return { error: `Keep a post under ${BODY_MAX.toLocaleString('en-US')} characters.`, field: 'body' }

  let chosen = input.pictures.filter((file) => file.size > 0)
  if (chosen.length > PICTURES_MAX) return { error: `Pick up to ${PICTURES_MAX} pictures.`, field: 'pictures' }
  let read: { bytes: Uint8Array; sniffed: Sniffed }[] = []
  for (let file of chosen) {
    if (file.size > PICTURE_BYTES_MAX) return { error: 'One of those pictures is over 10 MB. Pick a smaller one.', field: 'pictures' }
    let bytes = new Uint8Array(await file.arrayBuffer())
    let sniffed = sniffPicture(bytes)
    if (!sniffed) return { error: 'Pictures can be JPEG, PNG, WebP, or GIF.', field: 'pictures' }
    read.push({ bytes, sniffed })
  }

  let id = randomUUID()
  let pictures: PostPicture[] = []
  if (read.length) {
    let dir = path.join(postsRoot, id)
    await fsp.mkdir(dir, { recursive: true })
    for (let [index, { bytes, sniffed }] of read.entries()) {
      let name = `${index + 1}${sniffed.ext}`
      await fsp.writeFile(path.join(dir, name), bytes, { flag: 'wx' })
      pictures.push({
        file: path.posix.join('.lantube', 'posts', id, name),
        type: sniffed.type,
        width: sniffed.width || undefined,
        height: sniffed.height || undefined,
      })
    }
  }

  let post: Post = { id, channelId: channel.id, authorId, body, pictures, createdAt: Date.now() }
  let channelRowId = await catalogueChannelId(channel.id)
  if (channelRowId && (await isCataloguePerson(authorId))) {
    await db.create(postRows, {
      id,
      channel_id: channelRowId,
      author_id: authorId,
      body,
      pictures_json: JSON.stringify(pictures),
      created_at: new Date(post.createdAt),
    })
  }
  allPosts.push(post)
  return { post }
}

async function unlinkPictures(post: Post) {
  if (post.pictures.length === 0) return
  await fsp.rm(path.join(postsRoot, post.id), { recursive: true, force: true })
}

/** Catalogue row, then the pictures LanTube wrote, then memory. */
export async function deletePost(post: Post) {
  await db.deleteMany(postRows, { where: { id: post.id } })
  await unlinkPictures(post)
  allPosts = allPosts.filter((entry) => entry.id !== post.id)
}

/** A channel is going away: its Posts' pictures leave the Media share. The catalogue rows cascade with the channel. */
export async function forgetChannelPosts(channelId: string) {
  for (let post of allPosts.filter((entry) => entry.channelId === channelId)) await unlinkPictures(post)
  allPosts = allPosts.filter((post) => post.channelId !== channelId)
  settingsByChannel.delete(channelId)
}

/** Saves who can see a channel's Posts. The Channel owner is never named; they always see them. */
export async function savePostSettings(channel: Channel, input: { private: boolean; audienceIds: string[] }): Promise<PostSettings> {
  let ownerId = channelOwnerId(channel) ?? ''
  let settings: PostSettings = input.private ? { private: true, audience: namedAudience(ownerId, input.audienceIds) } : { private: false, audience: [] }
  let row = await db.findOne(channels, { where: { slug: channel.id } })
  if (row && row.kind !== 'folder') {
    let live = new Set((await db.findMany(people)).filter((person) => person.removed_at == null).map((person) => person.id))
    let audience = settings.audience.filter((id) => live.has(id))
    await db.transaction(async (tx) => {
      await tx.update(channels, row.id, { posts_visibility: settings.private ? 'private' : 'house' })
      await tx.deleteMany(channelPostAudience, { where: { channel_id: row.id } })
      if (audience.length) {
        await tx.createMany(
          channelPostAudience,
          audience.map((person_id) => ({ channel_id: row.id, person_id })),
        )
      }
    })
  }
  settingsByChannel.set(channel.id, settings)
  return settings
}

function createdMs(at: unknown): number {
  if (at instanceof Date) return at.getTime()
  if (typeof at === 'string' || typeof at === 'number') {
    let ms = new Date(at).getTime()
    if (Number.isFinite(ms)) return ms
  }
  return Date.now()
}

function picturesFromJson(json: string): PostPicture[] {
  try {
    let parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is PostPicture => entry && typeof entry.file === 'string' && typeof entry.type === 'string')
      .slice(0, PICTURES_MAX)
  } catch {
    return []
  }
}

/** Host start: every channel's Post settings and Posts. */
export async function loadCataloguePosts() {
  let channelRows = await db.findMany(channels)
  let slugById = new Map(channelRows.map((row) => [row.id, row.slug]))
  let audienceRows = await db.findMany(channelPostAudience)
  let audienceByChannel = new Map<string, string[]>()
  for (let row of audienceRows) {
    let list = audienceByChannel.get(row.channel_id)
    if (list) list.push(row.person_id)
    else audienceByChannel.set(row.channel_id, [row.person_id])
  }
  for (let row of channelRows) {
    if (row.posts_visibility !== 'private') continue
    settingsByChannel.set(row.slug, { private: true, audience: audienceByChannel.get(row.id) ?? [] })
  }
  let known = new Set(allPosts.map((post) => post.id))
  for (let row of await db.findMany(postRows)) {
    let slug = slugById.get(row.channel_id)
    if (!slug || known.has(row.id)) continue
    allPosts.push({
      id: row.id,
      channelId: slug,
      authorId: row.author_id ?? '',
      body: row.body,
      pictures: picturesFromJson(row.pictures_json),
      createdAt: createdMs(row.created_at),
    })
  }
}

/** A removed Person leaves every Posts Audience. Their Posts stay, under their name. */
export function forgetRemovedPerson(personId: string) {
  for (let settings of settingsByChannel.values()) {
    settings.audience = settings.audience.filter((id) => id !== personId)
  }
}

/** Tests: no Posts, every channel house-visible. */
export function resetPosts() {
  allPosts = []
  settingsByChannel = new Map()
}

/** Names for the visibility line: who besides the Channel owner and Managers can see private Posts. */
export function audienceNames(channelId: string): string[] {
  let ids = new Set(postSettings(channelId).audience)
  return listPeople()
    .filter((person) => ids.has(person.id))
    .map((person) => person.name)
}
