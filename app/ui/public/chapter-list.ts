export interface VideoChapter {
  startSec: number
  title: string
}

const TITLE_MAX = 80

/** Keep a seek-bar chapter list: two or more titled starts, in order, at or after 0. */
export function normalizeChapters(raw: { startSec: number; title: string }[]): VideoChapter[] {
  let cleaned: VideoChapter[] = []
  for (let entry of raw) {
    if (!Number.isFinite(entry.startSec) || entry.startSec < 0) continue
    let startSec = Math.round(entry.startSec * 1000) / 1000
    let title = entry.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX)
    if (cleaned.some((prior) => Math.abs(prior.startSec - startSec) < 0.05)) continue
    cleaned.push({ startSec, title })
  }
  cleaned.sort((a, b) => a.startSec - b.startSec)
  if (cleaned.length && cleaned[0].startSec < 0.5) cleaned[0] = { ...cleaned[0], startSec: 0 }
  cleaned.forEach((entry, i) => {
    if (!entry.title) entry.title = `Chapter ${i + 1}`
  })
  return cleaned.length >= 2 ? cleaned : []
}

export function chaptersFromJson(value: unknown): VideoChapter[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return normalizeChapters(
    value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      let start = (entry as { startSec?: unknown }).startSec
      let title = (entry as { title?: unknown }).title
      if (typeof start !== 'number' || typeof title !== 'string') return []
      return [{ startSec: start, title }]
    }),
  )
}

export function chaptersToJson(chapters: VideoChapter[]): string | null {
  return chapters.length >= 2 ? JSON.stringify(chapters) : null
}

/** Chapter at this playhead, if the Video has a chapter list. */
export function chapterAt(chapters: VideoChapter[], time: number, durationSec: number): VideoChapter | undefined {
  if (chapters.length < 2) return undefined
  let t = Math.max(0, time)
  let found = chapters[0]
  for (let chapter of chapters) {
    if (chapter.startSec - 0.01 > t) break
    found = chapter
  }
  if (durationSec > 0 && t > durationSec) return chapters[chapters.length - 1]
  return found
}

export interface ChapterSpan {
  startSec: number
  endSec: number
  title: string
}

/** Adjacent spans that fill the seek bar, last one running to duration. */
export function chapterSpans(chapters: VideoChapter[], durationSec: number): ChapterSpan[] {
  if (chapters.length < 2) return []
  let end = durationSec > 0 ? durationSec : chapters[chapters.length - 1].startSec + 1
  return chapters.map((chapter, i) => ({
    startSec: chapter.startSec,
    endSec: i + 1 < chapters.length ? chapters[i + 1].startSec : Math.max(end, chapter.startSec),
    title: chapter.title,
  }))
}
