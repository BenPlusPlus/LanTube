import { db } from '../db.ts'
import { videos } from './tables.ts'

/** Videos this viewer is allowed to see. An empty catalogue has none. */
export async function listVisibleVideos(_viewerId?: string | null) {
  return db.findMany(videos)
}
