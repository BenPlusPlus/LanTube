import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import {
  brandName,
  brandLimits,
  loadHouseSettings,
  resetHouseSettings,
  setBrandName,
  setUnsignedWatch,
  unsignedWatchAllowed,
} from './brand.ts'
import { resetHousehold, useEmptyHouse } from './household.ts'

afterEach(async () => {
  await useEmptyHouse()
  resetHousehold()
})

describe('house site name', () => {
  it('starts as LanTube and shows a saved name after reload', async () => {
    assert.equal(brandName(), 'LanTube')

    let saved = await setBrandName('  Metro   Tube  ')
    assert.equal(saved, true)
    assert.equal(brandName(), 'Metro Tube')

    resetHouseSettings()
    assert.equal(brandName(), 'LanTube')
    await loadHouseSettings()
    assert.equal(brandName(), 'Metro Tube')
  })

  it('rejects a blank or overlong name and leaves the current name', async () => {
    await setBrandName('Metro Tube')

    let empty = await setBrandName('   ')
    assert.deepEqual(empty, { error: `Give the site a name between 1 and ${brandLimits.name} characters.` })
    assert.equal(brandName(), 'Metro Tube')

    let tooLong = await setBrandName('x'.repeat(brandLimits.name + 1))
    assert.deepEqual(tooLong, { error: `Give the site a name between 1 and ${brandLimits.name} characters.` })
    assert.equal(brandName(), 'Metro Tube')
  })
})

describe('unsigned watch', () => {
  it('starts on and stays off after a Host reload', async () => {
    assert.equal(unsignedWatchAllowed(), true)

    await setUnsignedWatch(false)
    assert.equal(unsignedWatchAllowed(), false)

    resetHouseSettings()
    assert.equal(unsignedWatchAllowed(), true)
    await loadHouseSettings()
    assert.equal(unsignedWatchAllowed(), false)
  })
})
