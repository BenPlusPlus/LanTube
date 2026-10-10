import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { resetHousehold } from '../../data/household.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

async function get(path: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(path, 'http://localhost'), cookie ? { headers: { Cookie: cookie } } : undefined),
  )
  return { response, html: await response.text() }
}

function cookieFrom(response: Response) {
  let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
  assert.ok(header, 'Expected an lt_session cookie')
  return header.split(';', 1)[0]
}

async function postSignin(body: string, cookie?: string) {
  return router.fetch(
    new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
      redirect: 'manual',
    }),
  )
}

describe('sign in', () => {
  it('renders the household roster', async () => {
    let { response, html } = await get(routes.signin.index.href())

    assert.equal(response.status, 200)
    assert.match(html, /Who’s using LanTube/)
    assert.match(html, /Mia/)
    assert.match(html, /I’m new in the house/)
    assert.match(html, />Sign in</)
  })

  it('opens the password field on the chosen person', async () => {
    let { html } = await get(`${routes.signin.index.href()}?person=mia`)

    assert.match(html, /id="signin-password"/)
    assert.match(html, /name="personId"[^>]*value="mia"|value="mia"[^>]*name="personId"/)
    assert.match(html, /Sign in<\/button>/)
  })

  it('rejects a wrong password on the same card', async () => {
    let response = await postSignin('intent=signin&personId=mia&password=nope')
    let html = await response.text()

    assert.equal(response.status, 400)
    assert.match(html, /That password doesn’t match this person/)
    assert.match(html, /id="signin-password"/)
  })

  it('signs in and shows the person in the header', async () => {
    let login = await postSignin('intent=signin&personId=mia&password=house')
    assert.equal(login.status, 303)
    assert.equal(login.headers.get('Location'), routes.home.href())

    let cookie = cookieFrom(login)
    let { html } = await get(routes.home.href(), cookie)

    assert.match(html, /account-name">Mia</)
    assert.doesNotMatch(html, /signin-btn/)
  })

  it('lets a new person join and appear in the header', async () => {
    resetHousehold()
    let join = await postSignin('intent=join&name=Sam&password=lantern&confirm=lantern')
    assert.equal(join.status, 303)

    let cookie = cookieFrom(join)
    let { html } = await get(routes.home.href(), cookie)
    assert.match(html, /account-name">Sam</)

    resetHousehold()
  })

  it('signs out and restores the Sign in button', async () => {
    let login = await postSignin('intent=signin&personId=mia&password=house')
    let cookie = cookieFrom(login)

    let out = await router.fetch(
      new Request(new URL(routes.signout.href(), 'http://localhost'), {
        method: 'POST',
        headers: { Cookie: cookie },
        redirect: 'manual',
      }),
    )
    assert.equal(out.status, 303)

    let { html } = await get(routes.home.href(), cookieFrom(out))
    assert.match(html, /signin-btn/)
    assert.doesNotMatch(html, /account-name/)
  })
})

describe('header when unsigned', () => {
  it('offers Sign in next to Upload', async () => {
    let { html } = await get(routes.home.href())
    assert.match(html, /signin-btn/)
    assert.match(html, /Sign in/)
    assert.match(html, /Upload/)
  })
})
