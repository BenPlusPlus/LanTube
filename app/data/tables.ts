import { column as c, table } from 'remix/data-table'

export const people = table({
  name: 'people',
  columns: {
    id: c.uuid().primaryKey(),
    slug: c.text().notNull().unique(),
    name: c.text().notNull(),
    hue: c.integer().notNull(),
    photo_path: c.text().nullable(),
    password_hash: c.text().notNull(),
    is_admin: c.boolean().notNull().default(false),
    is_parent: c.boolean().notNull().default(false),
    removed_at: c.timestamp({ withTimezone: true }).nullable(),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const channels = table({
  name: 'channels',
  columns: {
    id: c.uuid().primaryKey(),
    slug: c.text().notNull().unique(),
    name: c.text().notNull(),
    kind: c.text().notNull(),
    path: c.text().nullable(),
    hue: c.integer().notNull(),
    photo_path: c.text().nullable(),
    owner_id: c.uuid().nullable(),
    description: c.text().nullable(),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const videos = table({
  name: 'videos',
  columns: {
    id: c.uuid().primaryKey(),
    slug: c.text().notNull().unique(),
    title: c.text().notNull(),
    channel_id: c.uuid().notNull(),
    duration_sec: c.integer().nullable(),
    published_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
    poster_path: c.text().nullable(),
    plays: c.integer().notNull().default(0),
    file_path: c.text().notNull(),
    owner_id: c.uuid().nullable(),
    visibility: c.text().notNull().default('house'),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const tags = table({
  name: 'tags',
  columns: {
    id: c.uuid().primaryKey(),
    slug: c.text().notNull().unique(),
    name: c.text().notNull(),
    hue: c.integer().notNull(),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const videoTags = table({
  name: 'video_tags',
  primaryKey: ['video_id', 'tag_id'],
  columns: {
    video_id: c.uuid().notNull(),
    tag_id: c.uuid().notNull(),
  },
})
