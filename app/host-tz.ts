import { lstatSync, readFileSync, readlinkSync } from 'node:fs'

const DEFAULT_TIMEZONE_FILE = '/etc/timezone'
const DEFAULT_LOCALTIME = '/etc/localtime'
const ZONEINFO_MARKER = 'zoneinfo/'
const ZONE_NAME = /^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)*$/

export interface HostTimeZoneInput {
  env?: NodeJS.ProcessEnv
  timezoneFile?: string
  localtimePath?: string
}

/** IANA name from TZ, `/etc/timezone`, or an `/etc/localtime` zoneinfo symlink. */
export function detectHostTimeZone(input: HostTimeZoneInput = {}): string | undefined {
  let env = input.env ?? process.env
  let fromEnv = env.TZ?.trim()
  if (fromEnv) return fromEnv

  let named = zoneFromFile(input.timezoneFile ?? DEFAULT_TIMEZONE_FILE)
  if (named) return named

  return zoneFromLocaltime(input.localtimePath ?? DEFAULT_LOCALTIME)
}

/** `../usr/share/zoneinfo/America/Denver` → `America/Denver`. */
export function zoneNameFromLocaltimeTarget(target: string): string | undefined {
  let normalized = target.replaceAll('\\', '/')
  let at = normalized.lastIndexOf(ZONEINFO_MARKER)
  if (at < 0) return undefined
  return validZone(normalized.slice(at + ZONEINFO_MARKER.length))
}

/** Sets `env.TZ` from the Host zone when it is not already set. */
export function applyHostTimeZone(input: HostTimeZoneInput = {}): string | undefined {
  let env = input.env ?? process.env
  let tz = detectHostTimeZone({ ...input, env })
  if (tz) env.TZ = tz
  return tz
}

function zoneFromFile(file: string): string | undefined {
  try {
    return validZone(readFileSync(file, 'utf8').trim())
  } catch {
    return undefined
  }
}

function zoneFromLocaltime(file: string): string | undefined {
  try {
    if (!lstatSync(file).isSymbolicLink()) return undefined
    return zoneNameFromLocaltimeTarget(readlinkSync(file))
  } catch {
    return undefined
  }
}

function validZone(name: string): string | undefined {
  if (!name || name.includes('..')) return undefined
  if (!ZONE_NAME.test(name)) return undefined
  return name
}
