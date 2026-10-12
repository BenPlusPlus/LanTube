import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { resetPlaylists } from '../data/playlists.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

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

function order(html: string, names: string[]) {
  return names.map((name) => html.indexOf(`>${name}</a>`))
}

describe('playlists directory', () => {
  afterEach(() => resetPlaylists())

  it('shows only public playlists to someone not signed in, most recently changed first', async () => {
    let { response, html } = await get(routes.playlists.href())

    assert.equal(response.status, 200)
    assert.doesNotMatch(html, /<h2[^>]*>Yours<\/h2>/)
    assert.match(html, /<h2[^>]*>From the house<\/h2>/)
    assert.doesNotMatch(html, /For Rosie’s birthday/)
    assert.doesNotMatch(html, /Practice tapes/)
    assert.doesNotMatch(html, /New playlist/)
    let [mia, leo, tomas] = order(html, ['Trips we keep rewatching', 'Best boss fights', 'Sunday cooking'])
    assert.ok(mia > 0 && mia < leo && leo < tomas, 'Expected newest activity first')
  })

  it('puts your own playlists first, private included, and leaves them out of the house list', async () => {
    let cookie = await signIn('mia')
    let { html } = await get(routes.playlists.href(), cookie)

    assert.match(html, /<h2[^>]*>Yours<\/h2>/)
    assert.match(html, /For Rosie’s birthday/)
    assert.match(html, /Private/)
    assert.match(html, /New playlist/)
    let yours = html.indexOf('id="yours"')
    let house = html.indexOf('id="house"')
    assert.ok(yours < html.indexOf('Trips we keep rewatching') && html.indexOf('Trips we keep rewatching') < house)
    assert.equal(html.slice(house).indexOf('Trips we keep rewatching'), -1)
    assert.match(html.slice(house), /<strong>Leo<\/strong> added 2 videos/)
  })
})

describe('playlist page', () => {
  afterEach(() => resetPlaylists())

  it('hides a private playlist from everyone but its owner', async () => {
    let path = routes.playlist.href({ playlistId: 'for-rosies-birthday' })
    assert.equal((await get(path)).response.status, 404)
    assert.equal((await get(path, await signIn('ruth'))).response.status, 404)
    let { response, html } = await get(path, await signIn('mia'))
    assert.equal(response.status, 200)
    assert.match(html, /Play all/)
    assert.match(html, /Remove from playlist/)
  })

  it('offers no editing to people who don’t own it', async () => {
    let { html } = await get(routes.playlist.href({ playlistId: 'best-boss-fights' }), await signIn('mia'))
    assert.doesNotMatch(html, /Remove from playlist/)
    assert.doesNotMatch(html, />\s*Edit\s*</)
  })
})

describe('changing playlists', () => {
  afterEach(() => resetPlaylists())

  it('creates a playlist that starts with the video it was made from', async () => {
    let cookie = await signIn('leo')
    let response = await post(
      routes.playlistNew.action.href(),
      [
        ['name', 'Bike tricks'],
        ['description', ''],
        ['visibility', 'public'],
        ['video', 'no-training-wheels'],
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.watch.href({ videoId: 'no-training-wheels' }))

    let { html } = await get(routes.playlist.href({ playlistId: 'bike-tricks' }), cookie)
    assert.match(html, /first ride without training wheels/)
  })

  it('adds, moves, and removes videos for the owner only', async () => {
    let path = routes.playlistItems.href({ playlistId: 'wind-down' })
    let mia = await signIn('mia')

    let added = await post(path, [['intent', 'add'], ['videoId', 'rosie-one'], ['async', '1']], mia)
    assert.equal(added.status, 204)

    let moved = await post(path, [['intent', 'up'], ['videoId', 'rosie-one'], ['returnTo', '//evil.example']], mia)
    assert.equal(moved.status, 303)
    assert.equal(moved.headers.get('Location'), routes.playlist.href({ playlistId: 'wind-down' }))

    let { html } = await get(routes.playlist.href({ playlistId: 'wind-down' }), mia)
    assert.ok(html.indexOf('Rosie turns one') < html.indexOf('Hilltop camp, night one'))

    let removed = await post(path, [['intent', 'remove'], ['videoId', 'rosie-one'], ['async', '1']], mia)
    assert.equal(removed.status, 204)
    assert.doesNotMatch((await get(routes.playlist.href({ playlistId: 'wind-down' }), mia)).html, /Rosie turns one/)

    let leo = await signIn('leo')
    let publicPath = routes.playlistItems.href({ playlistId: 'trips-we-rewatch' })
    assert.equal((await post(publicPath, [['intent', 'add'], ['videoId', 'rosie-one'], ['async', '1']], leo)).status, 403)
    assert.equal((await post(path, [['intent', 'add'], ['videoId', 'rosie-one'], ['async', '1']], leo)).status, 404)
    assert.equal((await post(publicPath, [['intent', 'add'], ['videoId', 'rosie-one'], ['async', '1']])).status, 401)
  })

  it('moves a playlist to the top of the house list when it changes', async () => {
    await post(
      routes.playlistItems.href({ playlistId: 'treehouse-build' }),
      [['intent', 'add'], ['videoId', 'family-cup'], ['async', '1']],
      await signIn('leo'),
    )
    let { html } = await get(routes.playlists.href())
    let [treehouse, trips] = order(html, ['Treehouse build', 'Trips we keep rewatching'])
    assert.ok(treehouse > 0 && treehouse < trips)
    assert.match(html, /<strong>Leo<\/strong> added a video/)
  })

  it('counts making a playlist private as a change', async () => {
    let cookie = await signIn('mia')
    let path = routes.playlistEdit.action.href({ playlistId: 'twice-best-stages' })
    let saved = await post(path, [['name', 'Twice, best stages'], ['description', ''], ['visibility', 'private']], cookie)
    assert.equal(saved.status, 303)
    let { html } = await get(routes.playlists.href(), cookie)
    let [twice, trips] = order(html, ['Twice, best stages', 'Trips we keep rewatching'])
    assert.ok(twice > 0 && twice < trips)
    assert.doesNotMatch((await get(routes.playlists.href(), await signIn('leo'))).html, /Twice, best stages/)
  })

  it('deletes only after the box is ticked', async () => {
    let cookie = await signIn('mia')
    let path = routes.playlistEdit.action.href({ playlistId: 'wind-down' })
    assert.equal((await post(path, [['intent', 'delete']], cookie)).status, 400)
    let deleted = await post(path, [['intent', 'delete'], ['confirm', '1']], cookie)
    assert.equal(deleted.status, 303)
    assert.equal((await get(routes.playlist.href({ playlistId: 'wind-down' }), cookie)).response.status, 404)
  })
})

describe('watching from a playlist', () => {
  afterEach(() => resetPlaylists())

  it('shows the playlist panel with the way to the next video', async () => {
    let { html } = await get(`${routes.watch.href({ videoId: 'fetch-arnside' })}?list=trips-we-rewatch`)
    assert.match(html, /class="wlist"/)
    assert.match(html, /2 \/ 4/)
    assert.match(html, /aria-label="Next: The cardinal is back at the feeder"/)
  })

  it('ignores a private list you can’t see', async () => {
    let { html } = await get(`${routes.watch.href({ videoId: 'nocturne' })}?list=wind-down`)
    assert.doesNotMatch(html, /class="wlist"/)
  })

  it('marks the playlists a video is already saved in', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'cardinal' }), await signIn('mia'))
    assert.match(html, /Saved/)
    assert.match(html, /aria-pressed="true"/)
  })
})
