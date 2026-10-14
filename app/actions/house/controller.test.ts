import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { getPerson, resetHousehold, useEmptyHouse, verifyPassword } from '../../data/household.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { sessionCookie, sessionStorage } from '../../session.ts'

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

describe('house people', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

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
