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
    captions_path: c.text().nullable(),
    chapters_json: c.text().nullable(),
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

export const videoAudience = table({
  name: 'video_audience',
  primaryKey: ['video_id', 'person_id'],
  columns: {
    video_id: c.uuid().notNull(),
    person_id: c.uuid().notNull(),
  },
})

export const channelManagers = table({
  name: 'channel_managers',
  primaryKey: ['channel_id', 'person_id'],
  columns: {
    channel_id: c.uuid().notNull(),
    person_id: c.uuid().notNull(),
  },
})

export const playlists = table({
  name: 'playlists',
  columns: {
    id: c.uuid().primaryKey(),
    slug: c.text().notNull().unique(),
    name: c.text().notNull(),
    owner_id: c.uuid().notNull(),
    visibility: c.text().notNull(),
    description: c.text().nullable(),
    activity_kind: c.text().notNull(),
    activity_at: c.timestamp({ withTimezone: true }).notNull(),
    activity_video_ids: c.text().notNull().default(''),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const playlistVideos = table({
  name: 'playlist_videos',
  primaryKey: ['playlist_id', 'video_id'],
  columns: {
    playlist_id: c.uuid().notNull(),
    video_id: c.uuid().notNull(),
    position: c.integer().notNull(),
  },
})

export const playlistAudience = table({
  name: 'playlist_audience',
  primaryKey: ['playlist_id', 'person_id'],
  columns: {
    playlist_id: c.uuid().notNull(),
    person_id: c.uuid().notNull(),
  },
})

export const watchSessions = table({
  name: 'watch_sessions',
  columns: {
    id: c.uuid().primaryKey(),
    person_id: c.uuid().notNull(),
    video_id: c.uuid().notNull(),
    started_at: c.timestamp({ withTimezone: true }).notNull(),
    ended_at: c.timestamp({ withTimezone: true }).notNull(),
    last_t: c.integer().notNull(),
    watched_sec: c.integer().notNull(),
  },
})

export const watchProgress = table({
  name: 'watch_progress',
  primaryKey: ['person_id', 'video_id'],
  columns: {
    person_id: c.uuid().notNull(),
    video_id: c.uuid().notNull(),
    position_sec: c.integer().notNull(),
  },
})

export const watchLimits = table({
  name: 'watch_limits',
  primaryKey: ['person_id'],
  columns: {
    person_id: c.uuid().notNull(),
    daily_min: c.integer().notNull(),
  },
})

export const watchExtensions = table({
  name: 'watch_extensions',
  columns: {
    id: c.uuid().primaryKey(),
    person_id: c.uuid().notNull(),
    /** The watch day it belongs to, "2026-05-20"; days start at 5 am host time. */
    day: c.text().notNull(),
    minutes: c.integer().notNull(),
    granted_by: c.uuid().nullable(),
    created_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
})

export const houseSettings = table({
  name: 'house_settings',
  columns: {
    id: c.text().primaryKey(),
    brand_name: c.text().notNull(),
    unsigned_watch: c.boolean().notNull().default(true),
  },
})

export const assignments = table({
  name: 'assignments',
  primaryKey: ['person_id', 'video_id'],
  columns: {
    person_id: c.uuid().notNull(),
    video_id: c.uuid().notNull(),
    assigned_by: c.uuid().nullable(),
    assigned_at: c.timestamp({ withTimezone: true }).notNull().defaultNow(),
    high_water_sec: c.integer().notNull().default(0),
  },
})
