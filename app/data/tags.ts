import { randomUUID } from 'node:crypto'

import { sql } from 'remix/data-table'

import { db } from '../db.ts'
import { hueFor } from '../ui/public/identity.ts'
import { slugify } from './household.ts'
import { tags as tagRows } from './tables.ts'

export const TAG_NAME_MAX = 40

export interface Tag {
  id: string
  slug: string
  name: string
  hue: number
}

const mockupTags: Tag[] =
  process.env.NODE_ENV === 'test'
    ? [
        { id: 'trips', slug: 'trips', name: 'Trips', hue: hueFor('Trips') },
        { id: 'kids', slug: 'kids', name: 'Kids', hue: hueFor('Kids') },
        { id: 'family', slug: 'family', name: 'Family', hue: hueFor('Family') },
        { id: 'cooking', slug: 'cooking', name: 'Cooking', hue: hueFor('Cooking') },
        { id: 'projects', slug: 'projects', name: 'Projects', hue: hueFor('Projects') },
        { id: 'nature', slug: 'nature', name: 'Nature', hue: hueFor('Nature') },
        { id: 'music', slug: 'music', name: 'Music', hue: hueFor('Music') },
        { id: 'sports', slug: 'sports', name: 'Sports', hue: hueFor('Sports') },
        { id: 'games', slug: 'games', name: 'Games', hue: hueFor('Games') },
        { id: 'home-movies', slug: 'home-movies', name: 'Home movies', hue: hueFor('Home movies') },
      ]
    : []

let catalogueTags: Tag[] = []

function tagFromRow(row: { id: string; slug: string; name: string; hue: number }): Tag {
  return { id: row.id, slug: row.slug, name: row.name, hue: row.hue }
}

function remember(tag: Tag) {
  let index = catalogueTags.findIndex((entry) => entry.id === tag.id)
  if (index === -1) catalogueTags.push(tag)
  else catalogueTags[index] = tag
}

export function listTags(): Tag[] {
  let bySlug = new Map<string, Tag>()
  for (let tag of mockupTags) bySlug.set(tag.slug, tag)
  for (let tag of catalogueTags) bySlug.set(tag.slug, tag)
  return [...bySlug.values()]
}

export function getTag(slug: string | null | undefined): Tag | undefined {
  if (!slug) return undefined
  return catalogueTags.find((tag) => tag.slug === slug) ?? mockupTags.find((tag) => tag.slug === slug)
}

export function resetCatalogueTags() {
  catalogueTags = []
}

/** Split on commas, trim, drop empty tokens, reject over-long names, keep the first spelling. */
export function parseTagNames(raw: string | string[]): { names: string[] } | { error: string } {
  let tokens = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\s+/g, ' '))
    .filter((value) => value.length > 0)

  for (let name of tokens) {
    if (name.length > TAG_NAME_MAX) {
      return { error: `Keep each Tag between 1 and ${TAG_NAME_MAX} characters.` }
    }
  }

  let seen = new Set<string>()
  let names: string[] = []
  for (let name of tokens) {
    let key = name.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return { names }
}

function sameName(left: string, right: string) {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
}

export async function loadCatalogueTags() {
  let rows = await db.findMany(tagRows)
  catalogueTags = rows.map(tagFromRow)
}

/** First spelling wins. Unused rows stay in the catalogue. */
export async function findOrCreateTags(names: string[]): Promise<Tag[]> {
  let created: Tag[] = []
  for (let name of names) {
    created.push(await findOrCreateTag(name))
  }
  return created
}

async function findOrCreateTag(name: string): Promise<Tag> {
  let existing = catalogueTags.find((tag) => sameName(tag.name, name))
  if (existing) return existing

  return db.transaction(async (tx) => {
    await tx.exec(sql`lock table tags in share row exclusive mode`)
    let rows = await tx.findMany(tagRows)
    let match = rows.find((row) => sameName(row.name, name))
    if (match) {
      let tag = tagFromRow(match)
      remember(tag)
      return tag
    }

    let taken = new Set(rows.map((row) => row.slug))
    for (let tag of catalogueTags) taken.add(tag.slug)
    let base = slugify(name, 'tag').slice(0, 60).replace(/-+$/, '') || 'tag'
    let slug = base
    let n = 2
    while (taken.has(slug)) {
      slug = `${base}-${n}`
      n++
    }

    let tag: Tag = { id: randomUUID(), slug, name, hue: hueFor(name) }
    await tx.create(tagRows, {
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      hue: tag.hue,
    })
    remember(tag)
    return tag
  })
}

export function tagsInUse(videos: { tags: string[] }[]): Tag[] {
  let slugs = new Set<string>()
  for (let video of videos) {
    for (let slug of video.tags) slugs.add(slug)
  }
  return [...slugs]
    .map((slug) => getTag(slug) ?? { id: slug, slug, name: slug, hue: 0 })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
