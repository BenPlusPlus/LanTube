import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { getPerson, resetHousehold, useEmptyHouse } from '../../data/household.ts'
import { getChannel } from '../../data/library.ts'
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

describe('first-run sign in', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  it('uses the Start this house frame with the join card open', async () => {
    await useEmptyHouse()
    let { response, html } = await get(routes.signin.index.href())

    assert.equal(response.status, 200)
    assert.match(html, /<title>Start this house/)
    assert.match(html, /id="who-title"[^>]*>Start this house</)
    assert.match(
      html,
      /You’re the first Person\. You’ll run LanTube for the house\. Other people on this network can join later\./,
    )
    assert.match(html, /I’m new in the house/)
    assert.match(html, /name="intent"[^>]*value="join"|value="join"[^>]*name="intent"/)
    assert.match(html, />Create my channel</)
    assert.doesNotMatch(html, /Who’s using LanTube/)
  })

  it('offers an unchecked Parent checkbox after the Admin note', async () => {
    await useEmptyHouse()
    let { html } = await get(routes.signin.index.href())

    assert.match(html, /You’ll be an Admin: attach folders, name Parents, and add other Admins\./)
    assert.match(html, /id="join-parent"/)
    assert.match(html, /See private videos and playlists, and the History of people who aren’t Parents\./)
    assert.doesNotMatch(html, /id="join-parent"[^>]*checked/)
  })

  it('creates the first Person as Admin and lands on House', async () => {
    await useEmptyHouse()
    let join = await postSignin('intent=join&name=Sam&password=lantern&confirm=lantern')

    assert.equal(join.status, 303)
    assert.equal(join.headers.get('Location'), routes.house.href())

    let setCookie = join.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(setCookie)
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Lax/i)
    assert.match(setCookie, /Max-Age=34560000/)
    assert.doesNotMatch(setCookie, /Secure/i)

    let session = await sessionFrom(join)
    let personId = session.get('personId')
    assert.equal(typeof personId, 'string')
    assert.match(personId as string, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    assert.equal(session.data[0].password, undefined)
    assert.deepEqual(Object.keys(session.data[0]).sort(), ['personId'])

    let person = getPerson(personId as string)
    assert.ok(person)
    assert.equal(person.name, 'Sam')
    assert.equal(person.slug, 'sam')
    assert.equal(person.isAdmin, true)
    assert.equal(person.isParent, false)
    assert.ok(!('password' in person))
    assert.ok(!('passwordHash' in person))

    let home = getChannel('sam')
    assert.ok(home)
    assert.equal(home.kind, 'person')
    assert.equal(home.name, 'Sam')

    let cookie = cookieFrom(join)
    let { response, html } = await get(routes.house.href(), cookie)
    assert.equal(response.status, 200)
    assert.match(html, /<title>House/)
    assert.match(html, /<h1 class="page-title">House<\/h1>/)
    assert.match(html, /account-name">Sam</)
    assert.match(html, /Index a folder on the Media share\. Those videos show on Home as house-visible\./)
    assert.match(html, /href="\/house"/)
    assert.match(html, /class="account-menu-item"[^>]*>House</)
  })

  it('lets the first Person take Parent on join', async () => {
    await useEmptyHouse()
    let join = await postSignin('intent=join&name=Sam&password=lantern&confirm=lantern&parent=on')
    let session = await sessionFrom(join)
    let person = getPerson(session.get('personId') as string)
    assert.equal(person?.isAdmin, true)
    assert.equal(person?.isParent, true)

    let { html } = await get(routes.house.href(), cookieFrom(join))
    assert.match(html, /Parent/)
  })
})

describe('house', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  it('redirects signed-out visitors to sign-in', async () => {
    let { response } = await get(routes.house.href())
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.signin.index.href())
  })

  it('forbids a Person who is not an Admin', async () => {
    await useEmptyHouse()
    let first = await postSignin('intent=join&name=Sam&password=lantern&confirm=lantern')
    assert.equal(first.status, 303)
    let later = await postSignin('intent=join&name=Alex&password=lantern&confirm=lantern')
    assert.equal(later.status, 303)
    assert.equal(later.headers.get('Location'), routes.home.href())

    let { response, html } = await get(routes.house.href(), cookieFrom(later))
    assert.equal(response.status, 403)
    assert.match(html, /Admin/)
    assert.doesNotMatch(html, /class="account-menu-item"[^>]*>House</)
  })
})

describe('occupied house', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  async function joinFirst() {
    await useEmptyHouse()
    return postSignin('intent=join&name=Sam&password=lantern&confirm=lantern')
  }

  it('shows the who-grid and a collapsed join card with no Admin note or Parent checkbox', async () => {
    await joinFirst()
    let { response, html } = await get(routes.signin.index.href())

    assert.equal(response.status, 200)
    assert.match(html, /<title>Sign in/)
    assert.match(html, /id="who-title"[^>]*>Who’s using LanTube\?</)
    assert.match(html, /Sam/)
    assert.match(html, /I’m new in the house/)
    assert.match(html, /class="who-pick who-pick-new"/)
    assert.doesNotMatch(html, /Start this house/)
    assert.doesNotMatch(html, /You’ll be an Admin/)
    assert.doesNotMatch(html, /id="join-parent"/)
    assert.doesNotMatch(html, /name="intent"[^>]*value="join"|value="join"[^>]*name="intent"/)
  })

  it('opens the join card without Admin or Parent when someone is already in the house', async () => {
    await joinFirst()
    let { html } = await get(`${routes.signin.index.href()}?join=1`)

    assert.match(html, /I’m new in the house/)
    assert.match(html, /name="intent"[^>]*value="join"|value="join"[^>]*name="intent"/)
    assert.match(html, />Create my channel</)
    assert.doesNotMatch(html, /You’ll be an Admin/)
    assert.doesNotMatch(html, /id="join-parent"/)
  })

  it('creates a later Person with neither role and lands on Home', async () => {
    await joinFirst()
    let later = await postSignin('intent=join&name=Alex&password=lantern&confirm=lantern&parent=on')

    assert.equal(later.status, 303)
    assert.equal(later.headers.get('Location'), routes.home.href())

    let session = await sessionFrom(later)
    let person = getPerson(session.get('personId') as string)
    assert.ok(person)
    assert.equal(person.name, 'Alex')
    assert.equal(person.isAdmin, false)
    assert.equal(person.isParent, false)

    let { response, html } = await get(routes.home.href(), cookieFrom(later))
    assert.equal(response.status, 200)
    assert.match(html, /<title>Home/)
    assert.match(html, /account-name">Alex</)
    assert.doesNotMatch(html, /class="account-menu-item"[^>]*>House</)
  })

  it('signs in with the correct password against the stored hash', async () => {
    let first = await joinFirst()
    let personId = (await sessionFrom(first)).get('personId') as string

    let login = await postSignin(`intent=signin&personId=${encodeURIComponent(personId)}&password=lantern`)
    assert.equal(login.status, 303)
    assert.equal(login.headers.get('Location'), routes.home.href())

    let { html } = await get(routes.home.href(), cookieFrom(login))
    assert.match(html, /account-name">Sam</)
    assert.doesNotMatch(html, /signin-btn/)
  })

  it('stays on sign-in with an error when the password is wrong', async () => {
    let first = await joinFirst()
    let personId = (await sessionFrom(first)).get('personId') as string

    let response = await postSignin(`intent=signin&personId=${encodeURIComponent(personId)}&password=nope`)
    let html = await response.text()

    assert.equal(response.status, 400)
    assert.match(html, /That password doesn’t match this person/)
    assert.match(html, /id="signin-password"/)
    assert.match(html, new RegExp(`value="${personId}"`))
  })

  it('signs out and restores unsigned chrome', async () => {
    let first = await joinFirst()
    let cookie = cookieFrom(first)

    let out = await router.fetch(
      new Request(new URL(routes.signout.href(), 'http://localhost'), {
        method: 'POST',
        headers: { Cookie: cookie },
        redirect: 'manual',
      }),
    )
    assert.equal(out.status, 303)
    assert.equal(out.headers.get('Location'), routes.home.href())

    let { html } = await get(routes.home.href(), cookieFrom(out))
    assert.match(html, /signin-btn/)
    assert.doesNotMatch(html, /account-name/)
  })

  it('shows Admin empty Home copy with a House link and Upload', async () => {
    let first = await joinFirst()
    let { html } = await get(routes.home.href(), cookieFrom(first))

    assert.match(html, /<title>Home/)
    assert.match(html, /<h2 id="empty-title">No videos in the house yet<\/h2>/)
    assert.match(
      html,
      /Index a folder on <a [^>]*href="\/house"[^>]*>House<\/a>, or upload a video\. House-visible videos show here for everyone on this network\./,
    )
    assert.match(html, /class="btn btn-primary"[^>]*>[\s\S]*Upload a video/)
    assert.match(html, /class="account-menu-item"[^>]*>House</)
  })

  it('shows signed-in empty Home copy with Upload and no House link', async () => {
    await joinFirst()
    let later = await postSignin('intent=join&name=Alex&password=lantern&confirm=lantern')
    let { html } = await get(routes.home.href(), cookieFrom(later))

    assert.match(html, /<title>Home/)
    assert.match(html, /<h2 id="empty-title">No videos in the house yet<\/h2>/)
    assert.match(
      html,
      /Upload a video and everyone on this network can watch it here\. An Admin can also index a folder on the Media share\./,
    )
    assert.match(html, /class="btn btn-primary"[^>]*>[\s\S]*Upload a video/)
    assert.doesNotMatch(html, /href="\/house"/)
    assert.doesNotMatch(html, /class="account-menu-item"[^>]*>House</)
  })

  it('shows unsigned empty Home copy when People exist and there are no Videos', async () => {
    await joinFirst()
    let { html } = await get(routes.home.href())

    assert.match(html, /<title>Home/)
    assert.match(html, /<h2 id="empty-title">No videos in the house yet<\/h2>/)
    assert.match(
      html,
      /People in the house can upload, or an Admin can index a folder\. Anyone on this network can watch once something is here\./,
    )
    assert.doesNotMatch(html, /Upload a video/)
    assert.match(html, /signin-btn/)
  })
})
