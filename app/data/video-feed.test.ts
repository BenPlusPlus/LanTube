import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { recordProgress, resetProgress, type Video } from './library.ts'
import {
  feedPage,
  HOME_EARLIER_LIMIT,
  HOME_LATEST_ROW,
  parseCount,
  splitHomeLibrary,
  VIDEO_FEED_PAGE,
} from './video-feed.ts'

function clip(id: string, days: number): Video {
  return {
    id,
    title: id,
    channelId: 'mia',
    durationSec: 120,
    addedDaysAgo: days,
    thumb: '',
    tags: [],
    plays: 0,
  }
}

function house(count: number) {
  return Array.from({ length: count }, (_, i) => clip(`v${i}`, i))
}

afterEach(() => resetProgress())

describe('parseCount', () => {
  it('uses the fallback for missing or invalid values', () => {
    assert.equal(parseCount(null, 7), 7)
    assert.equal(parseCount('', 7), 7)
    assert.equal(parseCount('nope', 7), 7)
    assert.equal(parseCount('-1', 7), 7)
    assert.equal(parseCount('1.5', 7), 7)
  })

  it('accepts a whole number of zero or more', () => {
    assert.equal(parseCount('0'), 0)
    assert.equal(parseCount('12'), 12)
  })
})

describe('feedPage', () => {
  it('returns one page and whether more remain', () => {
    let items = house(25)
    let first = feedPage(items, 0)
    assert.equal(first.page.length, VIDEO_FEED_PAGE)
    assert.equal(first.page[0]?.id, 'v0')
    assert.equal(first.nextFrom, VIDEO_FEED_PAGE)
    assert.equal(first.hasMore, true)

    let last = feedPage(items, 20)
    assert.deepEqual(
      last.page.map((video) => video.id),
      ['v20', 'v21', 'v22', 'v23', 'v24'],
    )
    assert.equal(last.nextFrom, 25)
    assert.equal(last.hasMore, false)
  })
})

describe('splitHomeLibrary', () => {
  it('keeps a short house in Latest and does not open Earlier', () => {
    let shelves = splitHomeLibrary(house(11))
    assert.equal(shelves.resume.length, 0)
    assert.equal(shelves.latest.length, 11)
    assert.equal(shelves.earlier.length, 0)
    assert.equal(shelves.earlierTotal, 0)
  })

  it('moves overflow into Earlier once Latest can leave a full row behind', () => {
    let shelves = splitHomeLibrary(house(12))
    assert.equal(shelves.latest.length, HOME_LATEST_ROW)
    assert.equal(shelves.latest[0]?.id, 'v0')
    assert.equal(shelves.earlier.length, 4)
    assert.equal(shelves.earlier[0]?.id, 'v8')
    assert.equal(shelves.earlierTotal, 4)
  })

  it('caps Earlier so Home cannot list the whole library', () => {
    let shelves = splitHomeLibrary(house(HOME_LATEST_ROW + HOME_EARLIER_LIMIT + 4))
    assert.equal(shelves.latest.length, HOME_LATEST_ROW)
    assert.equal(shelves.earlier.length, HOME_EARLIER_LIMIT)
    assert.equal(shelves.earlierTotal, HOME_EARLIER_LIMIT + 4)
    assert.equal(shelves.earlier[0]?.id, `v${HOME_LATEST_ROW}`)
    assert.equal(shelves.earlier.at(-1)?.id, `v${HOME_LATEST_ROW + HOME_EARLIER_LIMIT - 1}`)
  })

  it('keeps in-progress videos on Continue watching and out of Latest', () => {
    let videos = house(13)
    recordProgress(videos[1], 'mia', 40)
    let shelves = splitHomeLibrary(videos, 'mia')
    assert.deepEqual(
      shelves.resume.map((video) => video.id),
      ['v1'],
    )
    assert.equal(
      shelves.latest.some((video) => video.id === 'v1'),
      false,
    )
    assert.equal(shelves.latest.length, HOME_LATEST_ROW)
    assert.equal(shelves.earlier.length, 4)
  })
})
