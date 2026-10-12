import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { resetChannels } from '../../data/library.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

async function get(path: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(path, 'http://localhost'), cookie ? { headers: { Cookie: cookie } } : undefined),
  )
  return { response, html: await response.text() }
}

async function signIn(personId: string) {
  let response = await router.fetch(
    new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `intent=signin&personId=${personId}&password=house`,
      redirect: 'manual',
    }),
  )
  let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
  assert.ok(header, 'Expected an lt_session cookie')
  return header.split(';', 1)[0]
}

function post(path: string, fields: [string, string][], cookie?: string) {
  let body = new FormData()
  for (let [key, value] of fields) body.append(key, value)
  return router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : undefined,
      body,
      redirect: 'manual',
    }),
  )
}

describe('channels directory', () => {
  it('lists people, custom channels, and folders', async () => {
    let { response, html } = await get(routes.channels.href())

    assert.equal(response.status, 200)
    assert.match(html, /<h2[^>]*>People<\/h2>/)
    assert.match(html, /<h2[^>]*>More channels<\/h2>/)
    assert.match(html, />Twice<\/a>/)
    assert.match(html, />Skillet<\/a>/)
    assert.match(html, />Video Games<\/a>/)
    assert.match(html, /Run by Mia/)
    assert.match(html, /New channel/)
  })
})

describe('channel page', () => {
  it('shows who runs a custom channel', async () => {
    let { response, html } = await get(routes.channel.href({ channelId: 'twice' }))

    assert.equal(response.status, 200)
    assert.match(html, /<h1 class="chhead-name">Twice<\/h1>/)
    assert.match(html, /<dt>Run by<\/dt>/)
    assert.match(html, /<dt>Also posting<\/dt>/)
    assert.doesNotMatch(html, /Edit channel/)
  })

  it('sorts by plays', async () => {
    let { html } = await get(`${routes.channel.href({ channelId: 'video-games' })}?sort=popular`)

    assert.match(html, /aria-current="page"[^>]*>Most played/)
  })

  it('offers editing only to the owner', async () => {
    let { html } = await get(routes.channel.href({ channelId: 'twice' }), await signIn('mia'))
    assert.match(html, /Edit channel/)
  })

  it('404s unknown channels', async () => {
    let { response } = await get(routes.channel.href({ channelId: 'nope' }))
    assert.equal(response.status, 404)
  })
})

describe('new channel', () => {
  it('asks unsigned visitors to sign in', async () => {
    let { response, html } = await get(routes.channelNew.index.href())

    assert.equal(response.status, 200)
    assert.match(html, /Sign in to start a channel/)
  })

  it('creates a channel and redirects to it', async () => {
    let cookie = await signIn('leo')
    let response = await post(
      routes.channelNew.action.href(),
      [
        ['name', 'Board Games'],
        ['description', 'Catan nights.'],
        ['posters', 'priya'],
      ],
      cookie,
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.channel.href({ channelId: 'board-games' }))

    let { html } = await get(routes.channel.href({ channelId: 'board-games' }), cookie)
    assert.match(html, /Catan nights\./)
    assert.match(html, /Edit channel/)
    resetChannels()
  })

  it('rejects a name already in use', async () => {
    let response = await post(routes.channelNew.action.href(), [['name', 'twice']], await signIn('leo'))

    assert.equal(response.status, 400)
    assert.match(await response.text(), /aria-invalid="true"/)
    resetChannels()
  })
})

describe('edit channel', () => {
  it('forbids people who don’t own it', async () => {
    let { response, html } = await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('leo'))

    assert.equal(response.status, 403)
    assert.match(html, /Only Mia can edit Twice/)
  })

  it('saves the owner’s changes', async () => {
    let cookie = await signIn('mia')
    let response = await post(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [
        ['name', 'TWICE'],
        ['description', 'Once forever.'],
      ],
      cookie,
    )

    assert.equal(response.status, 303)
    let { html } = await get(routes.channel.href({ channelId: 'twice' }))
    assert.match(html, /<h1 class="chhead-name">TWICE<\/h1>/)
    assert.doesNotMatch(html, /<dt>Also posting<\/dt>/)
    resetChannels()
  })

  it('404s for people and folders', async () => {
    let { response } = await get(routes.channelEdit.index.href({ channelId: 'mia' }), await signIn('mia'))
    assert.equal(response.status, 404)
  })
})
