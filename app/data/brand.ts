import { db } from '../db.ts'
import { houseSettings } from './tables.ts'

export const DEFAULT_BRAND = 'LanTube'
export const BRAND_NAME_MAX = 40
export const brandLimits = { name: BRAND_NAME_MAX } as const

const HOUSE_ID = 'house'

let current = DEFAULT_BRAND
let unsignedWatch = true

export function brandName(): string {
  return current
}

/** Anyone on the LAN can play house-visible Videos without signing in. Default on. */
export function unsignedWatchAllowed(): boolean {
  return unsignedWatch
}

export function resetHouseSettings() {
  current = DEFAULT_BRAND
  unsignedWatch = true
}

export async function loadHouseSettings() {
  let row = await db.find(houseSettings, HOUSE_ID)
  current = row?.brand_name ? row.brand_name : DEFAULT_BRAND
  unsignedWatch = row?.unsigned_watch !== false
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
  else await db.create(houseSettings, { id: HOUSE_ID, brand_name: trimmed, unsigned_watch: unsignedWatch })
  current = trimmed
  return true
}

export async function setUnsignedWatch(allowed: boolean) {
  let row = await db.find(houseSettings, HOUSE_ID)
  if (row) await db.update(houseSettings, HOUSE_ID, { unsigned_watch: allowed })
  else await db.create(houseSettings, { id: HOUSE_ID, brand_name: current, unsigned_watch: allowed })
  unsignedWatch = allowed
}

/** Tests restore the default site name and unsigned-watch setting. */
export async function restoreDefaultBrand() {
  current = DEFAULT_BRAND
  unsignedWatch = true
  let row = await db.find(houseSettings, HOUSE_ID)
  if (row) await db.update(houseSettings, HOUSE_ID, { brand_name: DEFAULT_BRAND, unsigned_watch: true })
  else await db.create(houseSettings, { id: HOUSE_ID, brand_name: DEFAULT_BRAND, unsigned_watch: true })
}
