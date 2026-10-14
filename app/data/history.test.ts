import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from './catalogue.ts'
import {
  formatRange,
  loadCatalogueHistory,
  recordWatchProgress,
  recordWatchStart,
  resetHistory,
  sittingLabel,
  sittingsFor,
} from './history.ts'
import { createPerson, resetHousehold, useEmptyHouse, type Person } from './household.ts'
import {
  addUploadedVideo,
  continueWatching,
  deleteVideo,
  getVideo,
  isInProgress,
  progressOf,
  resetChannels,
} from './library.ts'

const MIN = 60_000

function at(dayOffset: number, hour: number, minute = 0) {
  let date = new Date(2026, 4, 20 + dayOffset, hour, minute)
  return date.getTime()
}

describe('watch history', () => {
  afterEach(() => resetHistory())

  it('counts played time but not seeks', async () => {
    let video = getVideo('treehouse-3')!
    let start = Date.now()
    await recordWatchStart('priya', video, start)
    await recordWatchProgress('priya', video, 15, undefined, start + 15_000)
    await recordWatchProgress('priya', video, 600, undefined, start + 16_000)
    await recordWatchProgress('priya', video, 615, undefined, start + 31_000)

    let row = sittingsFor('priya', '', start + 40_000)[0].rows.find((entry) => entry.video.id === 'treehouse-3')!
    assert.equal(row.watchedSec, 30)
    assert.equal(row.resumeAt, 615)
    assert.equal(progressOf(video, 'priya'), 615)
    assert.equal(progressOf(video, 'ruth'), undefined)
  })

  it('offers a fresh start when no position is saved, never a third status', async () => {
    let video = getVideo('treehouse-3')!
    let start = Date.now()
    await recordWatchStart('priya', video, start)
    await recordWatchProgress('priya', video, 30, undefined, start + 30_000)
    await recordWatchProgress('priya', video, 2, undefined, start + 31_000)

    let row = sittingsFor('priya', '', start + 40_000)[0].rows.find((entry) => entry.video.id === 'treehouse-3')!
    assert.equal(row.resumeAt, 0)
    assert.equal(row.finished, false)
  })

  it('splits sittings on a long pause and keeps each video in its latest sitting', async () => {
    let tahoe = getVideo('tahoe-day-2')!
    let bike = getVideo('no-training-wheels')!
    let start = Date.now() + 60 * MIN
    let watch = async (video: typeof tahoe, from: number, secs: number) => {
      await recordWatchStart('priya', video, from)
      for (let t = 10; t <= secs; t += 10) await recordWatchProgress('priya', video, t, undefined, from + t * 1000)
    }
    await watch(tahoe, start, 60)
    await watch(bike, start + 2 * MIN, 60)
    await watch(tahoe, start + 120 * MIN, 30)

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

const created: string[] = []

async function join(name: string) {
  let person = await createPerson(name, 'lantern')
  assert.ok(!('error' in person))
  assert.notEqual(person.id, person.slug)
  return person
}

async function clipFor(person: Person, slug: string, durationSec = 120) {
  created.push(slug)
  let inserted = await insertUploadedVideo({
    slug,
    title: slug,
    channelSlug: person.slug,
    ownerId: person.id,
    durationSec,
    filePath: `uploads/${person.slug}/${slug}.mp4`,
    posterPath: null,
    visibility: 'house',
  })
  assert.ok(inserted)
  return addUploadedVideo({
    id: slug,
    title: slug,
    channelId: person.slug,
    durationSec,
    thumb: '',
    tags: [],
    file: `uploads/${person.slug}/${slug}.mp4`,
    postedBy: person.id,
  })
}

describe('catalogue watch history', () => {
  afterEach(async () => {
    for (let id of created.splice(0)) deleteVideo(id)
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    resetHistory()
  })

  it('keeps a catalogue Person’s sitting and resume point after reload', async () => {
    await useEmptyHouse()
    let person = await join('Sam')
    let video = await clipFor(person, 'issue-23-lake')
    let start = Date.now()
    await recordWatchStart(person.id, video, start)
    await recordWatchProgress(person.id, video, 40, undefined, start + 40_000)

    let sitting = sittingsFor(person.id, '', start + 40_000)[0]
    assert.ok(sitting)
    assert.equal(sitting.rows[0]?.video.id, 'issue-23-lake')
    assert.equal(sitting.rows[0]?.resumeAt, 40)
    assert.equal(sitting.rows[0]?.watchedSec, 40)
    assert.equal(progressOf(video, person.id), 40)
    assert.equal(isInProgress(video, person.id), true)
    assert.ok(continueWatching(person.id).some((entry) => entry.id === video.id))

    resetHistory()
    assert.equal(sittingsFor(person.id).length, 0)
    assert.equal(progressOf(video, person.id), undefined)

    await loadCatalogueHistory()
    let restored = sittingsFor(person.id, '', start + 40_000)[0]
    assert.ok(restored)
    assert.equal(restored.rows[0]?.video.id, 'issue-23-lake')
    assert.equal(restored.rows[0]?.resumeAt, 40)
    assert.equal(restored.rows[0]?.watchedSec, 40)
    assert.equal(progressOf(video, person.id), 40)
    assert.equal(isInProgress(video, person.id), true)
    assert.ok(continueWatching(person.id).some((entry) => entry.id === video.id))
  })

  it('does not persist a mockup Person’s watches', async () => {
    let video = getVideo('cardinal')!
    let start = Date.now()
    await recordWatchStart('mia', video, start)
    await recordWatchProgress('mia', video, 30, undefined, start + 30_000)
    assert.ok(sittingsFor('mia', '', start + 30_000).some((sitting) => sitting.rows.some((row) => row.video.id === 'cardinal')))

    resetHistory()
    await loadCatalogueHistory()
    assert.equal(
      sittingsFor('mia').some((sitting) => sitting.rows.some((row) => row.video.id === 'cardinal')),
      false,
    )
  })

  it('keeps both Videos when two watches overlap', async () => {
    await useEmptyHouse()
    let person = await join('Sam')
    let lake = await clipFor(person, 'issue-23-overlap-a')
    let trail = await clipFor(person, 'issue-23-overlap-b')
    let start = Date.now()
    await Promise.all([
      (async () => {
        await recordWatchStart(person.id, lake, start)
        await recordWatchProgress(person.id, lake, 30, undefined, start + 30_000)
      })(),
      (async () => {
        await recordWatchStart(person.id, trail, start)
        await recordWatchProgress(person.id, trail, 30, undefined, start + 30_000)
      })(),
    ])

    resetHistory()
    await loadCatalogueHistory()
    let ids = sittingsFor(person.id, '', start + 30_000).flatMap((sitting) => sitting.rows.map((row) => row.video.id)).sort()
    assert.deepEqual(ids, ['issue-23-overlap-a', 'issue-23-overlap-b'])
    assert.equal(progressOf(lake, person.id), 30)
    assert.equal(progressOf(trail, person.id), 30)
  })

  it('keeps History on the Person who watched', async () => {
    await useEmptyHouse()
    let sam = await join('Sam')
    let alex = await join('Alex')
    let video = await clipFor(sam, 'issue-23-own')
    let start = Date.now()
    await recordWatchStart(sam.id, video, start)
    await recordWatchProgress(sam.id, video, 40, undefined, start + 40_000)

    assert.equal(sittingsFor(alex.id).length, 0)
    assert.equal(progressOf(video, alex.id), undefined)

    resetHistory()
    await loadCatalogueHistory()
    assert.equal(sittingsFor(alex.id).length, 0)
    assert.equal(progressOf(video, alex.id), undefined)
    assert.equal(sittingsFor(sam.id, '', start + 40_000)[0]?.rows[0]?.video.id, 'issue-23-own')
  })
})
