import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import {
  formatRange,
  recordWatchProgress,
  recordWatchStart,
  resetHistory,
  sittingLabel,
  sittingsFor,
} from './history.ts'
import { getVideo, progressOf } from './library.ts'

const MIN = 60_000

function at(dayOffset: number, hour: number, minute = 0) {
  let date = new Date(2026, 4, 20 + dayOffset, hour, minute)
  return date.getTime()
}

describe('watch history', () => {
  afterEach(() => resetHistory())

  it('counts played time but not seeks', () => {
    let video = getVideo('treehouse-3')!
    let start = Date.now()
    recordWatchStart('priya', video, start)
    recordWatchProgress('priya', video, 15, undefined, start + 15_000)
    recordWatchProgress('priya', video, 600, undefined, start + 16_000)
    recordWatchProgress('priya', video, 615, undefined, start + 31_000)

    let row = sittingsFor('priya', '', start + 40_000)[0].rows.find((entry) => entry.video.id === 'treehouse-3')!
    assert.equal(row.watchedSec, 30)
    assert.equal(row.resumeAt, 615)
    assert.equal(progressOf(video, 'priya'), 615)
    assert.equal(progressOf(video, 'ruth'), undefined)
  })

  it('offers a fresh start when no position is saved, never a third status', () => {
    let video = getVideo('treehouse-3')!
    let start = Date.now()
    recordWatchStart('priya', video, start)
    recordWatchProgress('priya', video, 30, undefined, start + 30_000)
    recordWatchProgress('priya', video, 2, undefined, start + 31_000)

    let row = sittingsFor('priya', '', start + 40_000)[0].rows.find((entry) => entry.video.id === 'treehouse-3')!
    assert.equal(row.resumeAt, 0)
    assert.equal(row.finished, false)
  })

  it('splits sittings on a long pause and keeps each video in its latest sitting', () => {
    let tahoe = getVideo('tahoe-day-2')!
    let bike = getVideo('no-training-wheels')!
    let start = Date.now() + 60 * MIN
    let watch = (video: typeof tahoe, from: number, secs: number) => {
      recordWatchStart('priya', video, from)
      for (let t = 10; t <= secs; t += 10) recordWatchProgress('priya', video, t, undefined, from + t * 1000)
    }
    watch(tahoe, start, 60)
    watch(bike, start + 2 * MIN, 60)
    watch(tahoe, start + 120 * MIN, 30)

    let [latest, earlier] = sittingsFor('priya', '', start + 130 * MIN)
    assert.deepEqual(latest.rows.map((row) => row.video.id), ['tahoe-day-2'])
    assert.deepEqual(earlier.rows.map((row) => row.video.id), ['no-training-wheels'])
  })

  it('labels sittings the way people talk about them', () => {
    let now = at(0, 15)
    assert.equal(sittingLabel(at(0, 9), now), 'This morning')
    assert.equal(sittingLabel(at(0, 22), at(0, 23)), 'Tonight')
    assert.equal(sittingLabel(at(-1, 21, 30), now), 'Last night')
    assert.equal(sittingLabel(at(0, 1), now), 'Last night')
    assert.equal(sittingLabel(at(-1, 8), now), 'Yesterday morning')
    assert.match(sittingLabel(at(-3, 18), now), /^[A-Z][a-z]+day evening$/)
    assert.match(sittingLabel(at(-10, 10), now), /^[A-Z][a-z]+day morning, May 10$/)
  })

  it('formats time ranges compactly', () => {
    assert.equal(formatRange(at(0, 20, 40), at(0, 22, 5)), '8:40–10:05 pm')
    assert.equal(formatRange(at(0, 11, 40), at(0, 12, 15)), '11:40 am–12:15 pm')
    assert.equal(formatRange(at(0, 21, 52), at(0, 21, 52)), '9:52 pm')
  })
})
