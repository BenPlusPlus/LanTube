import { isInProgress, newestFirst, type Video } from './library.ts'

/** About two rows at five columns; one to two rows just out of sight on smaller grids. */
export const VIDEO_FEED_PAGE = 10

/** Latest on Home keeps this many before Earlier can exist. */
export const HOME_LATEST_ROW = 8

/** Earlier on Home stops here so the shelf cannot dump the whole library. */
export const HOME_EARLIER_LIMIT = 48

export function parseCount(raw: string | null | undefined, fallback = 0): number {
  if (raw == null || raw === '') return fallback
  let n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return fallback
  return n
}

export function feedPage<T>(items: readonly T[], from: number, size = VIDEO_FEED_PAGE) {
  let start = Math.max(0, from)
  let page = items.slice(start, start + size)
  let nextFrom = start + page.length
  return { page, nextFrom, hasMore: nextFrom < items.length }
}

export function splitHomeLibrary(videos: Video[], viewerId?: string) {
  let resume = newestFirst(videos.filter((video) => isInProgress(video, viewerId)))
  let shelved = new Set(resume.map((video) => video.id))
  let rest = newestFirst(videos).filter((video) => !shelved.has(video.id))
  let cut = rest.length - HOME_LATEST_ROW >= 4 ? HOME_LATEST_ROW : rest.length
  let overflow = rest.slice(cut)
  return {
    resume,
    latest: rest.slice(0, cut),
    earlier: overflow.slice(0, HOME_EARLIER_LIMIT),
    earlierTotal: overflow.length,
  }
}
