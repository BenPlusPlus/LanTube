import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { listVisibleVideos } from './catalogue.ts'
import { resetHousehold, useEmptyHouse } from './household.ts'
import { findOrCreateTags, getTag, listTags, parseTagNames, resetCatalogueTags } from './tags.ts'

describe('household Tags', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
    resetCatalogueTags()
  })

  it('creates a Tag on first use and keeps the first spelling', async () => {
    await useEmptyHouse()
    let [first] = await findOrCreateTags(['Kids'])
    let [again, extra] = await findOrCreateTags(['kids', 'KIDS'])
    assert.equal(first?.name, 'Kids')
    assert.equal(first?.slug, 'kids')
    assert.equal(again?.id, first?.id)
    assert.equal(again?.name, 'Kids')
    assert.equal(extra?.name, 'Kids')
    assert.equal(listTags().filter((tag) => tag.slug === 'kids').length, 1)
    assert.equal(getTag('kids')?.name, 'Kids')
  })

  it('keeps unused Tag rows in the catalogue', async () => {
    await useEmptyHouse()
    await findOrCreateTags(['Orphan'])
    assert.equal(getTag('orphan')?.name, 'Orphan')
    assert.ok(listTags().some((tag) => tag.name === 'Orphan'))
    let videos = await listVisibleVideos()
    assert.equal(
      videos.some((video) => video.tags.includes('orphan')),
      false,
    )
  })

  it('trims names, drops empty tokens, and rejects over-long ones', () => {
    assert.deepEqual(parseTagNames('  Kids, , trips  '), { names: ['Kids', 'trips'] })
    assert.deepEqual(parseTagNames(['Kids', 'kids', 'Trips']), { names: ['Kids', 'Trips'] })
    let tooLong = 'x'.repeat(41)
    assert.deepEqual(parseTagNames(tooLong), {
      names: [],
      leftover: tooLong,
      error: 'Keep each Tag between 1 and 40 characters.',
    })
    assert.deepEqual(parseTagNames(`Kids, ${tooLong}, trips`), {
      names: ['Kids', 'trips'],
      leftover: tooLong,
      error: 'Keep each Tag between 1 and 40 characters.',
    })
    assert.deepEqual(parseTagNames(''), { names: [] })
  })
})
