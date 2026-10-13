import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from '../data/catalogue.ts'
import { createPerson, resetHousehold, useEmptyHouse } from '../data/household.ts'
import { addUploadedVideo, deleteVideo, resetChannels } from '../data/library.ts'
import { getPlaylist, loadCataloguePlaylists, resetPlaylists } from '../data/playlists.ts'
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
    assert.match(html, /Everyone in the house/)
    assert.doesNotMatch(html, /Public/)
    assert.match(html, /New playlist/)
    let yours = html.indexOf('id="yours"')
    let house = html.indexOf('id="house"')
    assert.ok(yours < html.indexOf('Trips we keep rewatching') && html.indexOf('Trips we keep rewatching') < house)
    assert.equal(html.slice(house).indexOf('Trips we keep rewatching'), -1)
    assert.match(html.slice(house), /<strong>Leo<\/strong> added 2 videos/)
  })
})

describe('new playlist', () => {
  afterEach(() => resetPlaylists())

  it('asks unsigned visitors to sign in', async () => {
    let { response, html } = await get(routes.playlistNew.index.href())
    assert.equal(response.status, 401)
    assert.match(html, /Sign in to make a playlist/)
  })

  it('offers Everyone in the house and Private, and starts private', async () => {
    let { html } = await get(routes.playlistNew.index.href(), await signIn('mia'))
    assert.match(html, /Everyone in the house/)
    assert.match(html, /poster-name">Private</)
    assert.match(html, /value="private"[^>]*checked|checked[^>]*value="private"/)
    assert.doesNotMatch(html, /Public/)
  })

  it('rejects a name the owner already uses, an empty name, and a name over 60 characters', async () => {
    let cookie = await signIn('mia')
    let duplicate = await post(
      routes.playlistNew.action.href(),
      [
        ['name', 'Wind-down'],
        ['description', ''],
        ['visibility', 'private'],
      ],
      cookie,
    )
    assert.equal(duplicate.status, 400)
    assert.match(await duplicate.text(), /already have a playlist called Wind-down/)

    let empty = await post(
      routes.playlistNew.action.href(),
      [
        ['name', '   '],
        ['description', ''],
        ['visibility', 'private'],
      ],
      cookie,
    )
    assert.equal(empty.status, 400)
    assert.match(await empty.text(), /between 1 and 60/)

    let long = await post(
      routes.playlistNew.action.href(),
      [
        ['name', 'x'.repeat(61)],
        ['description', ''],
        ['visibility', 'private'],
      ],
      cookie,
    )
    assert.equal(long.status, 400)
    assert.match(await long.text(), /between 1 and 60/)
  })

  it('rejects a description over 280 characters', async () => {
    let response = await post(
      routes.playlistNew.action.href(),
      [
        ['name', 'Late night'],
        ['description', 'x'.repeat(281)],
        ['visibility', 'private'],
      ],
      await signIn('leo'),
    )
    assert.equal(response.status, 400)
    assert.match(await response.text(), /Keep the description under 280/)
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

  it('ignores a list the video is not on', async () => {
    let { html } = await get(`${routes.watch.href({ videoId: 'tahoe-day-2' })}?list=best-boss-fights`)
    assert.doesNotMatch(html, /class="wlist"/)
  })

  it('marks the playlists a video is already saved in', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'cardinal' }), await signIn('mia'))
    assert.match(html, /Saved/)
    assert.match(html, /aria-pressed="true"/)
  })
})

describe('catalogue playlists over HTTP', () => {
  const created: string[] = []

  afterEach(async () => {
    for (let id of created.splice(0)) deleteVideo(id)
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    resetPlaylists()
  })

  async function join(name: string) {
    let person = await createPerson(name, 'lantern')
    assert.ok(!('error' in person))
    let response = await router.fetch(
      new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `intent=signin&personId=${person.id}&password=lantern`,
        redirect: 'manual',
      }),
    )
    let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(header, 'Expected an lt_session cookie')
    return { cookie: header.split(';', 1)[0], person }
  }

  it('lets a catalogue Person create, save from Watch, and keep the playlist after reload', async () => {
    await useEmptyHouse()
    let { cookie, person } = await join('Sam')
    assert.notEqual(person.id, person.slug)

    let inserted = await insertUploadedVideo({
      slug: 'issue-21-http-clip',
      title: 'Kitchen window',
      channelSlug: person.slug,
      ownerId: person.id,
      durationSec: 12,
      filePath: `uploads/${person.slug}/issue-21-http-clip.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    created.push('issue-21-http-clip')
    addUploadedVideo({
      id: 'issue-21-http-clip',
      title: 'Kitchen window',
      channelId: person.slug,
      durationSec: 12,
      thumb: '',
      tags: [],
      file: `uploads/${person.slug}/issue-21-http-clip.mp4`,
      postedBy: person.id,
    })

    let createdResponse = await post(
      routes.playlistNew.action.href(),
      [
        ['name', 'Window light'],
        ['description', ''],
        ['visibility', 'private'],
      ],
      cookie,
    )
    assert.equal(createdResponse.status, 303)
    assert.equal(createdResponse.headers.get('Location'), routes.playlist.href({ playlistId: 'window-light' }))

    let added = await post(
      routes.playlistItems.href({ playlistId: 'window-light' }),
      [
        ['intent', 'add'],
        ['videoId', 'issue-21-http-clip'],
        ['async', '1'],
      ],
      cookie,
    )
    assert.equal(added.status, 204)

    let watch = await get(`${routes.watch.href({ videoId: 'issue-21-http-clip' })}?list=window-light`, cookie)
    assert.match(watch.html, /class="wlist"/)
    assert.match(watch.html, /Window light/)
    assert.match(watch.html, /You · /)

    let unsignedWatch = await get(`${routes.watch.href({ videoId: 'issue-21-http-clip' })}?list=window-light`)
    assert.doesNotMatch(unsignedWatch.html, /class="wlist"/)

    resetPlaylists()
    assert.equal(getPlaylist('window-light'), undefined)
    await loadCataloguePlaylists()

    let yours = await get(routes.playlists.href(), cookie)
    assert.match(yours.html, /Window light/)
    assert.match(yours.html, /Private/)
    let house = await get(routes.playlists.href())
    assert.doesNotMatch(house.html, /Window light/)
    let page = await get(routes.playlist.href({ playlistId: 'window-light' }), cookie)
    assert.equal(page.response.status, 200)
    assert.match(page.html, /Kitchen window/)
  })
})
