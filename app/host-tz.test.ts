import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { applyHostTimeZone, detectHostTimeZone, zoneNameFromLocaltimeTarget } from './host-tz.ts'

let tmp = ''

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
  tmp = ''
})

function scratch() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lantube-tz-'))
  return tmp
}

describe('host timezone', () => {
  it('uses TZ from the environment when it is already set', () => {
    let root = scratch()
    fs.writeFileSync(path.join(root, 'timezone'), 'America/Denver\n')
    assert.equal(
      detectHostTimeZone({
        env: { TZ: 'Pacific/Auckland' },
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'localtime'),
      }),
      'Pacific/Auckland',
    )
  })

  it('reads the Host /etc/timezone file when TZ is unset', () => {
    let root = scratch()
    fs.writeFileSync(path.join(root, 'timezone'), 'America/Denver\n')
    assert.equal(
      detectHostTimeZone({
        env: {},
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'missing-localtime'),
      }),
      'America/Denver',
    )
  })

  it('reads the IANA name from a zoneinfo localtime target', () => {
    assert.equal(zoneNameFromLocaltimeTarget('/usr/share/zoneinfo/Asia/Tokyo'), 'Asia/Tokyo')
    assert.equal(zoneNameFromLocaltimeTarget('../usr/share/zoneinfo/America/Denver'), 'America/Denver')
    assert.equal(zoneNameFromLocaltimeTarget('/etc/localtime'), undefined)
  })

  it('returns nothing when the Host has no zone files', () => {
    let root = scratch()
    assert.equal(
      detectHostTimeZone({
        env: {},
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'localtime'),
      }),
      undefined,
    )
  })

  it('does not guess a name when localtime is a regular file', () => {
    let root = scratch()
    fs.writeFileSync(path.join(root, 'localtime'), 'tzif-bytes')
    assert.equal(
      detectHostTimeZone({
        env: {},
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'localtime'),
      }),
      undefined,
    )
  })

  it('sets TZ on the process env from the Host timezone file', () => {
    let root = scratch()
    fs.writeFileSync(path.join(root, 'timezone'), 'Europe/Berlin\n')
    let env: Record<string, string | undefined> = {}
    assert.equal(
      applyHostTimeZone({
        env,
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'localtime'),
      }),
      'Europe/Berlin',
    )
    assert.equal(env.TZ, 'Europe/Berlin')
  })

  it('leaves an existing TZ alone', () => {
    let root = scratch()
    fs.writeFileSync(path.join(root, 'timezone'), 'America/Denver\n')
    let env: Record<string, string | undefined> = { TZ: 'UTC' }
    assert.equal(
      applyHostTimeZone({
        env,
        timezoneFile: path.join(root, 'timezone'),
        localtimePath: path.join(root, 'localtime'),
      }),
      'UTC',
    )
    assert.equal(env.TZ, 'UTC')
  })
})
