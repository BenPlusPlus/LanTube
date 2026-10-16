import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { getPerson, resetHousehold, useEmptyHouse, verifyPassword } from '../../data/household.ts'
import { clearFolderChannels, deleteVideo, getChannel, getVideo, resetChannels, videos } from '../../data/library.ts'
import { mediaDir } from '../../data/media.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { sessionCookie, sessionStorage } from '../../session.ts'

const scanDirName = 'cabin-tapes'
const scanDir = path.join(mediaDir, scanDirName)
const scanFile = path.join(scanDir, 'cabin-weekend.mp4')
const nestedFile = path.join(scanDir, 'more', 'lake.mp4')
const fixtureMp4 = path.join(mediaDir, 'tahoe-day-2.mp4')

async function seedScanDir() {
  await fsp.mkdir(path.join(scanDir, 'more'), { recursive: true })
  await fsp.copyFile(fixtureMp4, scanFile)
  await fsp.copyFile(fixtureMp4, nestedFile)
}

async function wipeScanDir() {
  await fsp.rm(scanDir, { recursive: true, force: true })
}

function forgetIndexed() {
  for (let video of [...videos]) {
    if (video.channelId === 'cabin-tapes') deleteVideo(video.id)
  }
  resetChannels()
}

async function get(path: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      redirect: 'manual',
      ...(cookie ? { headers: { Cookie: cookie } } : undefined),
    }),
  )
  return { response, html: await response.text() }
}

function cookieFrom(response: Response) {
  let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
  assert.ok(header, 'Expected an lt_session cookie')
  return header.split(';', 1)[0]
}

async function sessionFrom(response: Response) {
  let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
  assert.ok(header, 'Expected an lt_session cookie')
  let parsed = await sessionCookie.parse(header.split(';', 1)[0])
  assert.ok(parsed, 'Expected a signed lt_session value')
  let wrapped: unknown
  try {
    wrapped = JSON.parse(parsed)
  } catch {
    wrapped = null
  }
  let value =
    typeof wrapped === 'object' && wrapped !== null && 'value' in wrapped && typeof wrapped.value === 'string'
      ? wrapped.value
      : parsed
  return sessionStorage.read(value)
}

function postSignin(body: string) {
  return router.fetch(
    new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual',
    }),
  )
}

function postHouse(fields: [string, string][], cookie?: string) {
  let body = new FormData()
  for (let [key, value] of fields) body.append(key, value)
  return router.fetch(
    new Request(new URL(routes.house.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : undefined,
      body,
      redirect: 'manual',
    }),
  )
}

async function occupied() {
  await useEmptyHouse()
  let first = await postSignin('intent=join&name=Sam&password=lantern&confirm=lantern')
  let later = await postSignin('intent=join&name=Alex&password=lantern&confirm=lantern')
  assert.equal(first.status, 303)
  assert.equal(later.status, 303)
  let samId = (await sessionFrom(first)).get('personId') as string
  let alexId = (await sessionFrom(later)).get('personId') as string
  return { first, later, samId, alexId, admin: cookieFrom(first), member: cookieFrom(later) }
}

describe('house people', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  it('redirects a signed-out POST to sign-in', async () => {
    let response = await postHouse([['personId', 'nobody']])
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.signin.index.href())
  })

  it('forbids a POST from a Person who is not an Admin', async () => {
    let { samId, member } = await occupied()
    let response = await postHouse(
      [
        ['personId', samId],
        ['admin', 'on'],
      ],
      member,
    )
    let html = await response.text()
    assert.equal(response.status, 403)
    assert.match(html, /You need to be an Admin/)
    assert.equal(getPerson(samId)?.isAdmin, true)
  })

  it('lists every Person with Admin and Parent checkboxes, a password field on others, and no Remove', async () => {
    let { samId, alexId, admin } = await occupied()
    let { response, html } = await get(routes.house.index.href(), admin)

    assert.equal(response.status, 200)
    assert.match(html, /Sam/)
    assert.match(html, /Alex/)
    assert.match(html, new RegExp(`id="house-admin-${samId}"`))
    assert.match(html, new RegExp(`id="house-parent-${samId}"`))
    assert.match(html, new RegExp(`id="house-admin-${alexId}"`))
    assert.match(html, new RegExp(`id="house-parent-${alexId}"`))
    assert.match(html, new RegExp(`id="house-admin-${samId}"[^>]*disabled|disabled[^>]*id="house-admin-${samId}"`))
    assert.doesNotMatch(html, new RegExp(`id="house-password-${samId}"`))
    assert.match(html, new RegExp(`id="house-password-${alexId}"`))
    assert.doesNotMatch(html, /Remove/)
  })

  it('lets an Admin grant and revoke Admin and Parent on another Person', async () => {
    let { alexId, admin } = await occupied()

    let granted = await postHouse(
      [
        ['personId', alexId],
        ['admin', 'on'],
        ['parent', 'on'],
      ],
      admin,
    )
    assert.equal(granted.status, 303)
    assert.equal(granted.headers.get('Location'), routes.house.index.href())
    assert.equal(getPerson(alexId)?.isAdmin, true)
    assert.equal(getPerson(alexId)?.isParent, true)

    let page = await get(routes.house.index.href(), admin)
    assert.match(
      page.html,
      new RegExp(`id="house-admin-${alexId}"[^>]*checked|checked[^>]*id="house-admin-${alexId}"`),
    )
    assert.match(
      page.html,
      new RegExp(`id="house-parent-${alexId}"[^>]*checked|checked[^>]*id="house-parent-${alexId}"`),
    )
    assert.doesNotMatch(
      page.html,
      new RegExp(`id="house-admin-${alexId}"[^>]*disabled|disabled[^>]*id="house-admin-${alexId}"`),
    )

    let revoked = await postHouse([['personId', alexId]], admin)
    assert.equal(revoked.status, 303)
    assert.equal(getPerson(alexId)?.isAdmin, false)
    assert.equal(getPerson(alexId)?.isParent, false)
  })

  it('rejects a POST that would revoke the last Admin, and leaves the control disabled', async () => {
    let { samId, admin } = await occupied()

    let response = await postHouse([['personId', samId]], admin)
    let html = await response.text()
    assert.equal(response.status, 400)
    assert.match(html, /role="alert"/)
    assert.match(html, /The house needs at least one Admin/)
    assert.equal(getPerson(samId)?.isAdmin, true)
    assert.match(html, new RegExp(`id="house-admin-${samId}"[^>]*disabled|disabled[^>]*id="house-admin-${samId}"`))
    assert.match(html, new RegExp(`id="house-admin-${samId}"[^>]*checked|checked[^>]*id="house-admin-${samId}"`))
  })

  it('lets an Admin set a password for someone else, who can then sign in with it', async () => {
    let { alexId, admin } = await occupied()

    let set = await postHouse(
      [
        ['intent', 'password'],
        ['personId', alexId],
        ['password', 'torch'],
      ],
      admin,
    )
    assert.equal(set.status, 303)
    assert.equal(set.headers.get('Location'), routes.house.index.href())
    assert.equal(verifyPassword(alexId, 'torch'), true)
    assert.equal(verifyPassword(alexId, 'lantern'), false)

    let login = await postSignin(`intent=signin&personId=${alexId}&password=torch`)
    assert.equal(login.status, 303)
    assert.equal(login.headers.get('Location'), routes.home.href())

    let rejected = await postSignin(`intent=signin&personId=${alexId}&password=lantern`)
    assert.equal(rejected.status, 400)
  })
})

describe('house branding', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  it('lets an Admin set the site name people see in the top bar and on sign-in', async () => {
    let { admin } = await occupied()
    let page = await get(routes.house.index.href(), admin)
    assert.equal(page.response.status, 200)
    assert.match(page.html, /id="house-brand-name"/)
    assert.match(page.html, /<span class="brand-name">LanTube<\/span>/)

    let saved = await postHouse(
      [
        ['intent', 'brand'],
        ['brand', '  Metro Tube  '],
      ],
      admin,
    )
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), routes.house.index.href())

    let house = await get(routes.house.index.href(), admin)
    assert.match(house.html, /<title>House · Metro Tube<\/title>/)
    assert.match(house.html, /<span class="brand-name">Metro Tube<\/span>/)
    assert.match(house.html, /aria-label="Metro Tube home"/)
    assert.match(house.html, /id="house-brand-name"[^>]*value="Metro Tube"|value="Metro Tube"[^>]*id="house-brand-name"/)

    let signin = await get(routes.signin.index.href())
    assert.match(signin.html, /Who’s using Metro Tube\?/)
    assert.match(signin.html, /<span class="brand-name">Metro Tube<\/span>/)
  })

  it('rejects a blank site name and keeps LanTube', async () => {
    let { admin } = await occupied()
    let response = await postHouse(
      [
        ['intent', 'brand'],
        ['brand', '   '],
      ],
      admin,
    )
    let html = await response.text()
    assert.equal(response.status, 400)
    assert.match(html, /role="alert"/)
    assert.match(html, /Give the site a name between 1 and 40 characters/)
    assert.match(html, /<span class="brand-name">LanTube<\/span>/)
  })
})

describe('house folders', () => {
  afterEach(async () => {
    forgetIndexed()
    await wipeScanDir()
    await useEmptyHouse()
    resetHousehold()
  })

  it('lets an Admin attach a Folder under the Media share, scan it, and anyone on the LAN can watch', async () => {
    await seedScanDir()
    let { admin } = await occupied()
    clearFolderChannels()

    let attached = await postHouse(
      [
        ['intent', 'attach'],
        ['path', scanDirName],
        ['name', 'Cabin tapes'],
      ],
      admin,
    )
    assert.equal(attached.status, 303)
    assert.equal(attached.headers.get('Location'), routes.house.index.href())

    let house = await get(routes.house.index.href(), admin)
    assert.equal(house.response.status, 200)
    assert.match(house.html, /Cabin tapes/)
    assert.match(house.html, /cabin-tapes/)
    assert.match(house.html, />Scan now</)
    assert.match(house.html, />Detach</)
    assert.doesNotMatch(house.html, /No folders attached yet/)

    let scanned = await postHouse(
      [
        ['intent', 'scan'],
        ['folderId', 'cabin-tapes'],
      ],
      admin,
    )
    assert.equal(scanned.status, 303)

    let folder = getChannel('cabin-tapes')
    assert.ok(folder)
    assert.equal(folder.kind, 'folder')
    assert.equal(folder.path, 'cabin-tapes')
    let weekend = getVideo('cabin-weekend')
    assert.ok(weekend)
    assert.equal(weekend.title, 'cabin-weekend')
    assert.equal(weekend.channelId, 'cabin-tapes')
    assert.equal(weekend.postedBy, undefined)
    assert.equal(weekend.private, undefined)
    assert.deepEqual(weekend.tags, [])
    assert.equal(weekend.file, 'cabin-tapes/cabin-weekend.mp4')
    let lake = getVideo('lake')
    assert.ok(lake)
    assert.equal(lake.file, 'cabin-tapes/more/lake.mp4')

    let home = await get(routes.home.href())
    assert.equal(home.response.status, 200)
    assert.match(home.html, /cabin-weekend/)
    assert.match(home.html, /lake/)

    let channels = await get(routes.channels.href())
    assert.match(channels.html, /Cabin tapes/)
    assert.match(channels.html, /<h2[^>]*>Folders<\/h2>/)

    let channel = await get(routes.channel.href({ channelId: 'cabin-tapes' }))
    assert.equal(channel.response.status, 200)
    assert.match(channel.html, /<h1 class="chhead-name">Cabin tapes<\/h1>/)
    assert.match(channel.html, /cabin-weekend/)

    let watch = await get(routes.watch.href({ videoId: 'cabin-weekend' }))
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /cabin-weekend/)
    assert.match(watch.html, /Indexed from cabin-tapes/)

    let media = await router.fetch(new Request(new URL(routes.media.href({ videoId: 'cabin-weekend' }), 'http://localhost')))
    assert.equal(media.status, 200)
    assert.match(media.headers.get('Content-Type') ?? '', /video\/mp4/)
  })

  it('forbids a Person who is not an Admin from attaching a Folder', async () => {
    await seedScanDir()
    let { member } = await occupied()
    clearFolderChannels()
    let response = await postHouse(
      [
        ['intent', 'attach'],
        ['path', scanDirName],
        ['name', 'Cabin tapes'],
      ],
      member,
    )
    let html = await response.text()
    assert.equal(response.status, 403)
    assert.match(html, /You need to be an Admin/)
    assert.equal(getChannel('cabin-tapes'), undefined)
  })

  it('rejects a path that is not under the Media share', async () => {
    let { admin } = await occupied()
    clearFolderChannels()
    let response = await postHouse(
      [
        ['intent', 'attach'],
        ['path', '..'],
        ['name', 'Outside'],
      ],
      admin,
    )
    let html = await response.text()
    assert.equal(response.status, 400)
    assert.match(html, /role="alert"/)
    assert.match(html, /That path has to sit under the Media share/)
    assert.equal(getChannel('outside'), undefined)
  })

  it('detaches a Folder from the catalogue and leaves the files on the share', async () => {
    await seedScanDir()
    let { admin } = await occupied()
    clearFolderChannels()
    assert.equal(
      (
        await postHouse(
          [
            ['intent', 'attach'],
            ['path', scanDirName],
            ['name', 'Cabin tapes'],
          ],
          admin,
        )
      ).status,
      303,
    )
    assert.equal(
      (
        await postHouse(
          [
            ['intent', 'scan'],
            ['folderId', 'cabin-tapes'],
          ],
          admin,
        )
      ).status,
      303,
    )
    assert.ok(getVideo('cabin-weekend'))

    let asked = await postHouse(
      [
        ['intent', 'detach'],
        ['folderId', 'cabin-tapes'],
      ],
      admin,
    )
    assert.equal(asked.status, 400)
    assert.match(await asked.text(), /Tick the box to confirm, then detach/)
    assert.ok(getChannel('cabin-tapes'))
    assert.ok(getVideo('cabin-weekend'))

    let detached = await postHouse(
      [
        ['intent', 'detach'],
        ['folderId', 'cabin-tapes'],
        ['confirm', '1'],
      ],
      admin,
    )
    assert.equal(detached.status, 303)
    assert.equal(getChannel('cabin-tapes'), undefined)
    assert.equal(getVideo('cabin-weekend'), undefined)
    await fsp.access(scanFile)
    await fsp.access(nestedFile)

    let home = await get(routes.home.href())
    assert.doesNotMatch(home.html, /cabin-weekend/)
    let watch = await get(routes.watch.href({ videoId: 'cabin-weekend' }))
    assert.equal(watch.response.status, 404)
  })
})
