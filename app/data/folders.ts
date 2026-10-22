import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import {
  deleteCatalogueFolder,
  deleteCatalogueVideo,
  folderPathTaken,
  insertFolderChannel,
  insertIndexedVideo,
  uniqueVideoSlug,
} from './catalogue.ts'
import { hueFor, slugify } from './household.ts'
import {
  addUploadedVideo,
  channelLimits,
  deleteVideo,
  dropFolderChannel,
  getChannel,
  getChannels,
  rememberFolder,
  videos,
  type Channel,
} from './library.ts'
import { mediaDir, videoExtensions } from './media.ts'
import { forgetDeletedVideo } from './assignments.ts'
import { dropFromPlaylists } from './playlists.ts'

export type FolderField = 'path' | 'name' | 'detach'
export type FolderResult = Channel | { error: string; field: FolderField }

function insideMedia(absolute: string) {
  let root = path.resolve(mediaDir)
  let resolved = path.resolve(absolute)
  let rel = path.relative(root, resolved)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function posixRelative(absolute: string) {
  let rel = path.relative(path.resolve(mediaDir), absolute)
  if (rel === '') return '.'
  return rel.split(path.sep).join('/')
}

export function resolveFolderPath(input: string): { relative: string; absolute: string } | { error: string; field: 'path' } {
  let trimmed = input.trim()
  if (!trimmed) return { error: 'Give the folder a path under the Media share.', field: 'path' }
  let absolute = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(mediaDir, trimmed)
  if (!insideMedia(absolute)) return { error: 'That path has to sit under the Media share.', field: 'path' }
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolute)
  } catch {
    return { error: 'LanTube can’t find that folder on the Media share.', field: 'path' }
  }
  if (!stat.isDirectory()) return { error: 'That path isn’t a folder on the Media share.', field: 'path' }
  let relative = posixRelative(absolute)
  if (relative === '.') return { error: 'That path has to sit under the Media share.', field: 'path' }
  return { relative, absolute }
}

function uniqueFolderSlug(name: string) {
  let base = slugify(name, 'folder')
  let id = base
  let n = 2
  while (getChannel(id) || id === 'new') {
    id = `${base}-${n}`
    n++
  }
  return id
}

export async function attachFolder(input: { path: string; name: string }): Promise<FolderResult> {
  let resolved = resolveFolderPath(input.path)
  if ('error' in resolved) return resolved

  let name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) name = path.basename(resolved.absolute)
  if (name.length < 1 || name.length > channelLimits.name) {
    return { error: `Give the folder a name between 1 and ${channelLimits.name} characters.`, field: 'name' }
  }
  let taken = getChannels().find(
    (channel) => channel.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (taken) {
    return {
      error:
        taken.kind === 'person'
          ? `${taken.name} is already someone’s home channel. Pick another name.`
          : `There’s already a channel called ${taken.name}.`,
      field: 'name',
    }
  }
  if (
    getChannels().some((channel) => channel.kind === 'folder' && channel.path === resolved.relative) ||
    (await folderPathTaken(resolved.relative))
  ) {
    return { error: 'That folder is already attached.', field: 'path' }
  }

  let channel: Channel = {
    id: uniqueFolderSlug(name),
    name,
    kind: 'folder',
    path: resolved.relative,
    hue: hueFor(name),
  }
  let saved = await insertFolderChannel({
    slug: channel.id,
    name: channel.name,
    path: resolved.relative,
    hue: channel.hue,
  })
  if (!saved) return { error: 'There’s already a channel called that.', field: 'name' }
  rememberFolder(channel)
  return channel
}

async function listVideoFiles(root: string): Promise<string[]> {
  let found: string[] = []
  async function walk(dir: string) {
    let entries = await fsp.readdir(dir, { withFileTypes: true })
    for (let entry of entries) {
      if (entry.name === '.lantube') continue
      let full = path.join(dir, entry.name)
      if (!insideMedia(full)) continue
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && videoExtensions.includes(path.extname(entry.name).toLowerCase())) found.push(full)
    }
  }
  await walk(root)
  return found
}

function alreadyIndexed(filePath: string) {
  return videos.some((video) => video.file === filePath)
}

export async function scanFolder(channel: Channel) {
  if (channel.kind !== 'folder' || !channel.path) return
  let absolute = path.resolve(mediaDir, channel.path)
  if (!insideMedia(absolute)) return
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolute)
  } catch {
    return
  }
  if (!stat.isDirectory()) return

  let present = new Set<string>()
  for (let file of await listVideoFiles(absolute)) {
    let relative = posixRelative(file)
    present.add(relative)
    if (alreadyIndexed(relative)) continue
    let title = path.parse(file).name || 'video'
    let slug = await uniqueVideoSlug(title)
    let saved = await insertIndexedVideo({
      slug,
      title,
      channelSlug: channel.id,
      filePath: relative,
    })
    if (!saved) continue
    addUploadedVideo({
      id: slug,
      title,
      channelId: channel.id,
      durationSec: 0,
      thumb: '',
      tags: [],
      file: relative,
    })
  }
  for (let video of videos.filter((entry) => entry.channelId === channel.id)) {
    if (video.file && present.has(video.file)) continue
    await dropIndexedVideo(video.id)
  }
}

export async function dropIndexedVideo(id: string) {
  let video = videos.find((entry) => entry.id === id)
  if (!video) return false
  let channel = getChannel(video.channelId)
  if (!channel || channel.kind !== 'folder') return false
  await deleteCatalogueVideo(video.id)
  deleteVideo(video.id)
  dropFromPlaylists(video.id)
  forgetDeletedVideo(video.id)
  return true
}

export async function scanAttachedFolders() {
  for (let channel of getChannels().filter((entry) => entry.kind === 'folder')) {
    await scanFolder(channel)
  }
}

export async function detachFolder(id: string) {
  let channel = getChannel(id)
  if (!channel || channel.kind !== 'folder') return false
  let onChannel = videos.filter((video) => video.channelId === channel.id)
  await deleteCatalogueFolder(channel.id)
  for (let video of onChannel) {
    deleteVideo(video.id)
    dropFromPlaylists(video.id)
    forgetDeletedVideo(video.id)
  }
  dropFolderChannel(channel.id)
  return true
}
