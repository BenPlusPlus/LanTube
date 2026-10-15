import { db } from '../db.ts'
import { houseSettings } from './tables.ts'

export const DEFAULT_BRAND = 'LanTube'
export const BRAND_NAME_MAX = 40
export const brandLimits = { name: BRAND_NAME_MAX } as const

const HOUSE_ID = 'house'

let current = DEFAULT_BRAND

export function brandName(): string {
  return current
}

export function resetHouseSettings() {
  current = DEFAULT_BRAND
}

export async function loadHouseSettings() {
  let row = await db.find(houseSettings, HOUSE_ID)
  current = row?.brand_name ? row.brand_name : DEFAULT_BRAND
}

function cleanBrand(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export async function setBrandName(name: string): Promise<true | { error: string }> {
  let trimmed = cleanBrand(name)
  if (trimmed.length < 1 || trimmed.length > BRAND_NAME_MAX) {
    return { error: `Give the site a name between 1 and ${BRAND_NAME_MAX} characters.` }
  }

  let row = await db.find(houseSettings, HOUSE_ID)
  if (row) await db.update(houseSettings, HOUSE_ID, { brand_name: trimmed })
  else await db.create(houseSettings, { id: HOUSE_ID, brand_name: trimmed })
  current = trimmed
  return true
}

/** Tests restore the default site name in the catalogue and in memory. */
export async function restoreDefaultBrand() {
  current = DEFAULT_BRAND
  let row = await db.find(houseSettings, HOUSE_ID)
  if (row) await db.update(houseSettings, HOUSE_ID, { brand_name: DEFAULT_BRAND })
  else await db.create(houseSettings, { id: HOUSE_ID, brand_name: DEFAULT_BRAND })
}
