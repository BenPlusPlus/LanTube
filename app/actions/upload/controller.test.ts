import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { notNull } from 'remix/data-table'

import { listVisibleVideos, loadCatalogueVideos } from '../../data/catalogue.ts'
import { db } from '../../db.ts'
import { listPeople, resetHousehold, useEmptyHouse } from '../../data/household.ts'
import { canWatch, deleteVideo, getVideo, loadCatalogueChannels, resetChannels, searchVideos } from '../../data/library.ts'
import { addVideo, getPlaylist } from '../../data/playlists.ts'
import { findOrCreateTags, getTag, listTags, resetCatalogueTags } from '../../data/tags.ts'
import { mediaDir } from '../../data/media.ts'
import { tags as tagRows, videoTags, videos as videoRows } from '../../data/tables.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

const created: string[] = []

afterEach(async () => {
  for (let id of created.splice(0)) deleteVideo(id)
  fs.rmSync(path.join(mediaDir, 'uploads'), { recursive: true, force: true })
  fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  await db.deleteMany(videoTags, { where: notNull(videoTags.video_id) })
  await db.deleteMany(tagRows, { where: notNull(tagRows.id) })
  resetCatalogueTags()
})

const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 2, 0])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])

async function get(url: string, cookie?: string) {
  let response = await router.fetch(new Request(new URL(url, 'http://localhost'), cookie ? { headers: { Cookie: cookie } } : undefined))
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

async function sendFile(name: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(`${routes.uploadFile.href()}?name=${encodeURIComponent(name)}`, 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', ...(cookie ? { Cookie: cookie } : {}) },
      body: clip,
    }),
  )
  return { response, body: (await response.json()) as { id?: string; error?: string } }
}

function publish(fields: [string, string | Blob, string?][], cookie?: string) {
  let body = new FormData()
  for (let [key, value, filename] of fields) {
    if (typeof value === 'string') body.append(key, value)
    else body.append(key, value, filename)
  }
  return router.fetch(
    new Request(new URL(routes.upload.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : undefined,
      body,
      redirect: 'manual',
    }),
  )
}

function saveWatch(videoId: string, fields: [string, string][], cookie?: string) {
  let body = new FormData()
  for (let [key, value] of fields) body.append(key, value)
  return router.fetch(
    new Request(new URL(routes.watchSave.href({ videoId }), 'http://localhost'), {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : undefined,
      body,
      redirect: 'manual',
    }),
  )
}

function videoIdFrom(response: Response) {
  let location = response.headers.get('Location') ?? ''
  let id = decodeURIComponent(location.split('/').pop() ?? '')
  created.push(id)
  return id
}

describe('upload page', () => {
  it('asks visitors to sign in', async () => {
    let { response, html } = await get(routes.upload.index.href())
    assert.equal(response.status, 401)
    assert.match(html, /Sign in to upload/)
  })

  it('offers every channel the person can post to, their own first', async () => {
    let cookie = await signIn('mia')
    let { response, html } = await get(routes.upload.index.href(), cookie)
    assert.equal(response.status, 200)
    assert.match(html, /Upload a video/)
    assert.match(html, /Post to/)
    let home = html.indexOf('value="mia"')
    let twice = html.indexOf('value="twice"')
    assert.ok(home > 0 && twice > home, 'Expected Mia’s channel before Twice')
    assert.doesNotMatch(html, /value="skillet"/)
    assert.match(html, /Everyone in the house/)
    assert.match(html, /value="house"[^>]*checked|checked[^>]*value="house"/)
    assert.match(html, /poster-name">Private</)
    assert.doesNotMatch(html, /Only me/)
    assert.doesNotMatch(html, /Public/)
    assert.doesNotMatch(html, /name="audience"/)
    assert.match(html, /<legend class="field-label">Tags /)
    assert.match(html, /name="tags"/)
    assert.doesNotMatch(html, /name="topics"|Topics/)
  })

  it('starts on the channel it was opened from', async () => {
    let cookie = await signIn('mia')
    let { html } = await get(`${routes.upload.index.href()}?to=twice`, cookie)
    assert.match(html, /value="twice"[^>]*checked|checked[^>]*value="twice"/)
    assert.match(html, /On Twice/)
  })
})

describe('sending a file', () => {
  it('needs someone signed in', async () => {
    let { response } = await sendFile('clip.mp4')
    assert.equal(response.status, 401)
  })

  it('turns away files that aren’t videos', async () => {
    let cookie = await signIn('mia')
    let { response, body } = await sendFile('notes.txt', cookie)
    assert.equal(response.status, 415)
    assert.ok(body.error)
  })

  it('lets only the sender preview what they sent', async () => {
    let mia = await signIn('mia')
    let { response, body } = await sendFile('clip.mp4', mia)
    assert.equal(response.status, 201)
    let url = `${routes.uploadFile.href()}/${body.id}`
    assert.equal((await get(url, mia)).response.status, 200)
    assert.equal((await get(url, await signIn('tomas'))).response.status, 404)
  })
})

describe('publishing', () => {
  it('publishes a sent file with its details and poster', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('Lake day.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'twice'],
        ['title', '  Lake   day  '],
        ['tags', 'Kids, trips, kids'],
        ['visibility', 'house'],
        ['duration', '93.4'],
        ['poster', new Blob([jpeg], { type: 'image/jpeg' }), 'poster.jpg'],
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    let video = getVideo(videoIdFrom(response))
    assert.ok(video)
    assert.equal(video.title, 'Lake day')
    assert.equal(video.channelId, 'twice')
    assert.equal(video.postedBy, 'mia')
    assert.equal(video.durationSec, 93)
    assert.deepEqual(video.tags, ['kids', 'trips'])
    assert.equal(getTag('kids')?.name, 'Kids')
    assert.equal(video.thumb, `/poster/${video.id}`)
    assert.ok(fs.existsSync(path.join(mediaDir, video.file ?? '')))

    let poster = await router.fetch(new Request(new URL(routes.poster.href({ videoId: video.id }), 'http://localhost')))
    assert.equal(poster.status, 200)
    assert.equal(poster.headers.get('Content-Type'), 'image/jpeg')
  })

  it('takes the whole video in the form without JavaScript', async () => {
    let cookie = await signIn('tomas')
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'pancakes.mp4'],
        ['uploadId', ''],
        ['channel', 'skillet'],
        ['title', 'Pancakes'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    let video = getVideo(videoIdFrom(response))
    assert.ok(video)
    assert.equal(video.thumb, '')
  })

  it('keeps private videos to the person who posted them', async () => {
    let mia = await signIn('mia')
    let { body } = await sendFile('secret.mp4', mia)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', 'Only mine'],
        ['visibility', 'private'],
        ['poster', new Blob([jpeg], { type: 'image/jpeg' }), 'poster.jpg'],
      ],
      mia,
    )
    assert.equal(response.status, 303)
    let id = videoIdFrom(response)
    let watch = routes.watch.href({ videoId: id })
    let poster = routes.poster.href({ videoId: id })

    let own = await get(watch, mia)
    assert.equal(own.response.status, 200)
    assert.match(own.html, /Private/)
    assert.match(own.html, /name="audience"/)
    assert.match(own.html, new RegExp(`action="${routes.watchSave.href({ videoId: id })}"`))
    assert.doesNotMatch(own.html, /Only me/)
    assert.deepEqual(getVideo(id)?.audience ?? [], [])

    let tomas = await signIn('tomas')
    assert.equal((await get(watch, tomas)).response.status, 404)
    assert.equal((await get(watch)).response.status, 404)
    assert.equal((await get(poster, tomas)).response.status, 404)
    assert.equal((await get(routes.media.href({ videoId: id }), tomas)).response.status, 404)
    assert.equal(searchVideos('Only mine', undefined, 'tomas').length, 0)
    assert.equal(searchVideos('Only mine', undefined, 'mia').length, 1)
    assert.doesNotMatch((await get(routes.channel.href({ channelId: 'mia' }), tomas)).html, /Only mine/)
  })

  it('shows the Audience picker in HTML only when Private is selected', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('clip.mp4', cookie)
    let privateForm = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', '   '],
        ['visibility', 'private'],
        ['audience', 'tomas'],
        ['audience', 'mia'],
      ],
      cookie,
    )
    assert.equal(privateForm.status, 400)
    let html = await privateForm.text()
    assert.match(html, /Give the video a title/)
    assert.match(html, /poster-name">Private</)
    assert.match(html, /name="audience"/)
    assert.match(html, /value="tomas"/)
    assert.match(html, /"audienceIds":\["tomas"\]/)
    assert.doesNotMatch(html, /"audienceIds":\["tomas,/)
    assert.doesNotMatch(html, /name="audience"[^>]*value="mia"|value="mia"[^>]*name="audience"/)
    assert.doesNotMatch(html, /Only me/)

    let houseForm = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', '   '],
        ['visibility', 'house'],
        ['audience', 'tomas'],
      ],
      cookie,
    )
    assert.equal(houseForm.status, 400)
    assert.doesNotMatch(await houseForm.text(), /name="audience"/)
  })

  it('does not let a Playlist grant sight of a private Video', async () => {
    let mia = await signIn('mia')
    let { body } = await sendFile('secret.mp4', mia)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', 'Playlist secret'],
        ['visibility', 'private'],
      ],
      mia,
    )
    let id = videoIdFrom(response)
    let playlist = getPlaylist('twice-best-stages')
    assert.ok(playlist)
    addVideo(playlist, id)

    let tomas = await signIn('tomas')
    let page = await get(routes.playlist.href({ playlistId: playlist.id }), tomas)
    assert.equal(page.response.status, 200)
    assert.doesNotMatch(page.html, /Playlist secret/)
    assert.equal((await get(routes.watch.href({ videoId: id }), tomas)).response.status, 404)
  })

  it('won’t post to a channel the person can’t post on, and keeps the sent file', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('clip.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'skillet'],
        ['title', 'Wrong place'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.match(html, /Pick a channel you can post to/)
    assert.match(html, new RegExp(`name="uploadId" value="${body.id}"`))
  })

  it('asks for a title', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('clip.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', '   '],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    assert.match(await response.text(), /aria-invalid="true"[^>]*|Give the video a title/)
  })

  it('re-renders comma-separated Tags as separate names after a 400', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('clip.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', '   '],
        ['tags', 'Kids, trips'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.match(html, /Give the video a title/)
    assert.match(html, /"tags":\["Kids","trips"\]/)
    assert.doesNotMatch(html, /"tags":\["Kids, trips"\]/)
  })

  it('keeps titles to 100 characters', async () => {
    let cookie = await signIn('mia')
    let { body } = await sendFile('clip.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'mia'],
        ['title', 'x'.repeat(101)],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    assert.match(await response.text(), /Give the video a title between 1 and 100 characters/)
  })

  it('needs a video', async () => {
    let cookie = await signIn('mia')
    let response = await publish(
      [
        ['uploadId', ''],
        ['channel', 'mia'],
        ['title', 'Nothing here'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    assert.match(await response.text(), /Choose a video to upload/)
  })

  it('turns away visitors', async () => {
    let response = await publish([['title', 'Hi']])
    assert.equal(response.status, 401)
  })
})

describe('publishing a house-visible Video to the catalogue', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  async function joinHouse() {
    await useEmptyHouse()
    let response = await router.fetch(
      new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'intent=join&name=Sam&password=lantern&confirm=lantern',
        redirect: 'manual',
      }),
    )
    assert.equal(response.status, 303)
    let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(header, 'Expected an lt_session cookie')
    return header.split(';', 1)[0]
  }

  it('publishes to the Home channel so anyone on the LAN can watch', async () => {
    let cookie = await joinHouse()
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'lake-day.mp4'],
        ['uploadId', ''],
        ['channel', 'sam'],
        ['title', '  Lake   day  '],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    let slug = videoIdFrom(response)
    assert.equal(slug, 'lake-day')
    assert.equal(response.headers.get('Location'), routes.watch.href({ videoId: slug }))

    let row = await db.findOne(videoRows, { where: { slug } })
    assert.ok(row)
    assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    assert.equal(row.title, 'Lake day')
    assert.equal(row.visibility, 'house')
    assert.ok(row.file_path)
    assert.ok(fs.existsSync(path.join(mediaDir, row.file_path)))

    let listed = await listVisibleVideos()
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, slug)

    let home = await get(routes.home.href())
    assert.equal(home.response.status, 200)
    assert.match(home.html, /Latest in the house/)
    assert.match(home.html, /Lake day/)
    assert.match(home.html, new RegExp(`href="${routes.watch.href({ videoId: slug })}"`))
    assert.doesNotMatch(home.html, /No videos in the house yet/)

    let channel = await get(routes.channel.href({ channelId: 'sam' }))
    assert.equal(channel.response.status, 200)
    assert.match(channel.html, /Lake day/)

    let watch = await get(routes.watch.href({ videoId: slug }))
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /<h1[^>]*>Lake day<\/h1>/)
    assert.match(watch.html, new RegExp(`src="${routes.media.href({ videoId: slug })}"`))

    let media = await router.fetch(
      new Request(new URL(routes.media.href({ videoId: slug }), 'http://localhost'), {
        headers: { Range: 'bytes=0-9' },
      }),
    )
    assert.equal(media.status, 206)
    assert.equal(media.headers.get('Content-Type'), 'video/mp4')
    assert.equal(media.headers.get('Content-Range'), 'bytes 0-9/16')
    assert.equal((await media.arrayBuffer()).byteLength, 10)

    deleteVideo(slug)
    assert.equal(getVideo(slug), undefined)
    await loadCatalogueVideos()
    let restored = await get(routes.watch.href({ videoId: slug }))
    assert.equal(restored.response.status, 200)
    assert.match(restored.html, /<h1[^>]*>Lake day<\/h1>/)
  })

  it('publishes comma-separated Tags and keeps the first spelling', async () => {
    let cookie = await joinHouse()
    let first = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'kids-one.mp4'],
        ['channel', 'sam'],
        ['title', 'First spelling'],
        ['tags', '  Kids, trips, kids  '],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(first.status, 303)
    let firstId = videoIdFrom(first)
    assert.deepEqual(getVideo(firstId)?.tags, ['kids', 'trips'])
    assert.equal(getTag('kids')?.name, 'Kids')

    let second = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'kids-two.mp4'],
        ['channel', 'sam'],
        ['title', 'Later spelling'],
        ['tags', 'kids'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    let secondId = videoIdFrom(second)
    assert.deepEqual(getVideo(secondId)?.tags, ['kids'])
    assert.equal(getTag('kids')?.name, 'Kids')
    assert.equal(listTags().filter((tag) => tag.slug === 'kids').length, 1)

    let watch = await get(routes.watch.href({ videoId: secondId }))
    assert.match(watch.html, /aria-label="Tags"/)
    assert.match(watch.html, new RegExp(`href="${routes.home.href()}\\?tag=kids"`))
    assert.match(watch.html, />Kids</)
    assert.doesNotMatch(watch.html, />kids</)
  })

  it('lets a Video publish with zero Tags and hides Watch chips', async () => {
    let cookie = await joinHouse()
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'plain.mp4'],
        ['channel', 'sam'],
        ['title', 'No labels'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    let id = videoIdFrom(response)
    assert.deepEqual(getVideo(id)?.tags, [])
    let watch = await get(routes.watch.href({ videoId: id }))
    assert.doesNotMatch(watch.html, /aria-label="Tags"/)
  })

  it('rejects an over-long Tag name on the Tags field', async () => {
    let cookie = await joinHouse()
    let { body } = await sendFile('clip.mp4', cookie)
    let response = await publish(
      [
        ['uploadId', body.id!],
        ['channel', 'sam'],
        ['title', 'Too long'],
        ['tags', `Kids, ${'x'.repeat(41)}`],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.match(html, /Keep each Tag between 1 and 40 characters/)
    assert.match(html, /id="upload-tags"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*id="upload-tags"/)
    assert.match(html, /"tags":\["Kids"\]/)
    assert.match(html, new RegExp(`"tagDraft":"${'x'.repeat(41)}"`))
  })

  it('shows Home chips for Tags in use, filters by slug, and keeps unused Tags off Home', async () => {
    let cookie = await joinHouse()
    await findOrCreateTags(['Spare'])
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'tagged.mp4'],
        ['channel', 'sam'],
        ['title', 'Bike ride'],
        ['tags', 'Trips, Kids'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    let id = videoIdFrom(response)
    assert.ok(listTags().some((tag) => tag.name === 'Spare'))

    let home = await get(routes.home.href())
    let chips = home.html.slice(home.html.indexOf('aria-label="Tags"'), home.html.indexOf('Latest in the house'))
    assert.match(chips, />All</)
    let kids = chips.indexOf('Kids')
    let trips = chips.indexOf('Trips')
    assert.ok(kids > 0 && trips > kids, 'Expected Tags in use A–Z by name')
    assert.doesNotMatch(chips, /Spare/)
    assert.match(chips, new RegExp(`href="${routes.home.href()}\\?tag=kids"`))
    assert.match(chips, new RegExp(`href="${routes.home.href()}\\?tag=trips"`))

    let filtered = await get(`${routes.home.href()}?tag=kids`)
    assert.match(filtered.html, /Bike ride/)
    assert.match(filtered.html, /Results for|Kids/)
    assert.match(filtered.html, new RegExp(`href="${routes.watch.href({ videoId: id })}"`))
    assert.match(filtered.html, /aria-current="page"[^>]*>Kids<|>Kids<[^>]*aria-current="page"/)

    let unknown = await get(`${routes.home.href()}?tag=nope`)
    assert.match(unknown.html, /Nothing in the house matches/)
    assert.doesNotMatch(unknown.html, /No videos in the house yet/)

    let miss = await get(`${routes.home.href()}?q=zzzz`)
    assert.match(miss.html, /Nothing in the house matches “zzzz”/)
    assert.doesNotMatch(miss.html, /No videos in the house yet/)
  })

  it('restores Tags on a catalogue Video after reload', async () => {
    let cookie = await joinHouse()
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'restored.mp4'],
        ['channel', 'sam'],
        ['title', 'Restored tags'],
        ['tags', 'Garden'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    let slug = videoIdFrom(response)
    deleteVideo(slug)
    resetCatalogueTags()
    assert.equal(getVideo(slug), undefined)
    assert.equal(getTag('garden'), undefined)
    await loadCatalogueVideos()
    assert.deepEqual(getVideo(slug)?.tags, ['garden'])
    assert.equal(getTag('garden')?.name, 'Garden')
    let watch = await get(routes.watch.href({ videoId: slug }))
    assert.match(watch.html, />Garden</)
    assert.match(watch.html, new RegExp(`href="${routes.home.href()}\\?tag=garden"`))
  })
})

describe('private Video with Audience', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  async function join(name: string, parent = false) {
    let body = `intent=join&name=${encodeURIComponent(name)}&password=lantern&confirm=lantern`
    if (parent) body += '&parent=on'
    let response = await router.fetch(
      new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      }),
    )
    assert.equal(response.status, 303)
    let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(header, 'Expected an lt_session cookie')
    let person = listPeople().find((entry) => entry.name === name)
    assert.ok(person)
    return { cookie: header.split(';', 1)[0], person }
  }

  it('lets named Audience watch, 404s everyone else, and restores after reload', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie, person: owner } = await join('Sam')
    let { cookie: namedCookie, person: named } = await join('Alex')
    let { cookie: otherCookie, person: other } = await join('Riley')

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'secret.mp4'],
        ['channel', 'sam'],
        ['title', 'Backyard'],
        ['visibility', 'private'],
        ['audience', named.id],
        ['audience', owner.id],
        ['audience', 'not-a-person'],
      ],
      ownerCookie,
    )
    assert.equal(response.status, 303)
    let slug = videoIdFrom(response)
    let watch = routes.watch.href({ videoId: slug })
    let poster = routes.poster.href({ videoId: slug })
    let media = routes.media.href({ videoId: slug })

    assert.equal(canWatch(getVideo(slug)!, named.id), true)
    assert.deepEqual(getVideo(slug)?.audience, [named.id])

    let ownerWatch = await get(watch, ownerCookie)
    assert.equal(ownerWatch.response.status, 200)
    assert.match(ownerWatch.html, /Private/)
    assert.match(ownerWatch.html, /pvis vcard-private|class="pvis"/)
    assert.match(ownerWatch.html, /name="audience"/)
    assert.match(ownerWatch.html, new RegExp(`value="${named.id}"[^>]*checked|checked[^>]*value="${named.id}"`))
    assert.doesNotMatch(ownerWatch.html, /Only me|Public/)

    let namedWatch = await get(watch, namedCookie)
    assert.equal(namedWatch.response.status, 200)
    assert.match(namedWatch.html, /<h1[^>]*>Backyard<\/h1>/)
    assert.match(namedWatch.html, /Private/)
    assert.doesNotMatch(namedWatch.html, /name="audience"/)
    assert.doesNotMatch(namedWatch.html, new RegExp(`action="${routes.watchSave.href({ videoId: slug })}"`))

    assert.equal((await get(watch, otherCookie)).response.status, 404)
    assert.equal((await get(watch)).response.status, 404)
    assert.equal((await get(poster, otherCookie)).response.status, 404)
    assert.equal((await get(media, otherCookie)).response.status, 404)

    let namedHome = await get(routes.home.href(), namedCookie)
    assert.match(namedHome.html, /Backyard/)
    assert.match(namedHome.html, /pvis vcard-private/)
    assert.doesNotMatch(namedHome.html, /No videos in the house yet/)

    let otherHome = await get(routes.home.href(), otherCookie)
    assert.match(otherHome.html, /No videos in the house yet/)
    assert.doesNotMatch(otherHome.html, /Backyard/)

    let emptySearch = await get(`${routes.home.href()}?q=Backyard`, otherCookie)
    assert.match(emptySearch.html, /No videos in the house yet/)
    assert.doesNotMatch(emptySearch.html, /Nothing in the house matches/)
    assert.doesNotMatch(emptySearch.html, /Backyard/)

    let tagged = await get(`${routes.home.href()}?tag=kids`, otherCookie)
    assert.match(tagged.html, /No videos in the house yet/)

    assert.doesNotMatch((await get(routes.channel.href({ channelId: 'sam' }), otherCookie)).html, /Backyard/)
    assert.match((await get(routes.channel.href({ channelId: 'sam' }), namedCookie)).html, /Backyard/)

    let listed = await listVisibleVideos(named.id)
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, slug)
    assert.deepEqual(listed[0]?.audience, [named.id])
    assert.equal((await listVisibleVideos(other.id)).length, 0)
    assert.equal((await listVisibleVideos()).length, 0)

    deleteVideo(slug)
    assert.equal(getVideo(slug), undefined)
    await loadCatalogueVideos()
    assert.deepEqual(getVideo(slug)?.audience, [named.id])
    assert.equal((await get(watch, namedCookie)).response.status, 200)
    assert.equal((await get(watch, otherCookie)).response.status, 404)
  })

  it('lets a Parent watch a private Video they are not named on', async () => {
    await useEmptyHouse()
    let { cookie: parentCookie, person: parent } = await join('Sam', true)
    let { cookie: ownerCookie } = await join('Alex')
    assert.equal(parent.isAdmin, true)
    assert.equal(parent.isParent, true)

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'secret.mp4'],
        ['channel', 'alex'],
        ['title', 'Parent can see'],
        ['visibility', 'private'],
      ],
      ownerCookie,
    )
    let slug = videoIdFrom(response)
    let watch = await get(routes.watch.href({ videoId: slug }), parentCookie)
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /Parent can see/)
    assert.match(watch.html, /Private/)
    assert.doesNotMatch(watch.html, /name="audience"/)
    assert.match((await get(routes.home.href(), parentCookie)).html, /Parent can see/)
  })

  it('does not let an Admin who is not Parent, owner, or Audience watch', async () => {
    await useEmptyHouse()
    let { cookie: adminCookie, person: admin } = await join('Sam')
    let { cookie: ownerCookie } = await join('Alex')
    assert.equal(admin.isAdmin, true)
    assert.equal(admin.isParent, false)

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'secret.mp4'],
        ['channel', 'alex'],
        ['title', 'Admin cannot see'],
        ['visibility', 'private'],
      ],
      ownerCookie,
    )
    let slug = videoIdFrom(response)
    assert.equal((await get(routes.watch.href({ videoId: slug }), adminCookie)).response.status, 404)
    assert.doesNotMatch((await get(routes.home.href(), adminCookie)).html, /Admin cannot see/)
    assert.match((await get(routes.home.href(), adminCookie)).html, /No videos in the house yet/)
  })

  it('clears named Audience when saving as house-visible', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie } = await join('Sam')
    let { cookie: namedCookie, person: named } = await join('Alex')

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'clip.mp4'],
        ['channel', 'sam'],
        ['title', 'Now for the house'],
        ['visibility', 'private'],
        ['audience', named.id],
      ],
      ownerCookie,
    )
    let slug = videoIdFrom(response)
    let saved = await saveWatch(
      slug,
      [
        ['title', 'Now for the house'],
        ['visibility', 'house'],
        ['audience', named.id],
      ],
      ownerCookie,
    )
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), routes.watch.href({ videoId: slug }))

    let video = getVideo(slug)
    assert.equal(video?.private, undefined)
    assert.equal(video?.audience, undefined)

    let ownerWatch = await get(routes.watch.href({ videoId: slug }), ownerCookie)
    assert.equal(ownerWatch.response.status, 200)
    assert.match(ownerWatch.html, /Everyone in the house/)
    assert.match(ownerWatch.html, /value="house"[^>]*checked|checked[^>]*value="house"/)
    assert.match(ownerWatch.html, /name="audience"/)
    assert.doesNotMatch(ownerWatch.html, /Only me/)

    let unsignedHome = await get(routes.home.href())
    assert.match(unsignedHome.html, /Now for the house/)
    assert.doesNotMatch(unsignedHome.html, /No videos in the house yet/)
    assert.equal((await get(routes.watch.href({ videoId: slug }))).response.status, 200)

    let backToPrivate = await saveWatch(slug, [['title', 'Now for the house'], ['visibility', 'private']], ownerCookie)
    assert.equal(backToPrivate.status, 303)
    assert.deepEqual(getVideo(slug)?.audience ?? [], [])
    assert.equal((await get(routes.watch.href({ videoId: slug }), namedCookie)).response.status, 404)
    assert.equal((await get(routes.watch.href({ videoId: slug }))).response.status, 404)
  })

  it('lets the owner name Audience on Watch Save', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie } = await join('Sam')
    let { cookie: namedCookie, person: named } = await join('Alex')
    let { cookie: otherCookie } = await join('Riley')

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'clip.mp4'],
        ['channel', 'sam'],
        ['title', 'Later shared'],
        ['visibility', 'private'],
      ],
      ownerCookie,
    )
    let slug = videoIdFrom(response)
    assert.equal((await get(routes.watch.href({ videoId: slug }), namedCookie)).response.status, 404)

    let saved = await saveWatch(
      slug,
      [
        ['title', 'Later shared'],
        ['visibility', 'private'],
        ['audience', named.id],
      ],
      ownerCookie,
    )
    assert.equal(saved.status, 303)
    assert.deepEqual(getVideo(slug)?.audience, [named.id])
    assert.equal((await get(routes.watch.href({ videoId: slug }), namedCookie)).response.status, 200)
    assert.equal((await get(routes.watch.href({ videoId: slug }), otherCookie)).response.status, 404)
    assert.equal((await saveWatch(slug, [['title', 'Later shared'], ['visibility', 'house']], namedCookie)).status, 403)
    assert.match((await get(routes.home.href(), namedCookie)).html, /Later shared/)
  })

  it('ignores posted Audience when publishing as house-visible', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie } = await join('Sam')
    let { person: named } = await join('Alex')

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'clip.mp4'],
        ['channel', 'sam'],
        ['title', 'Open clip'],
        ['visibility', 'house'],
        ['audience', named.id],
      ],
      ownerCookie,
    )
    let slug = videoIdFrom(response)
    assert.equal(getVideo(slug)?.private, undefined)
    assert.equal(getVideo(slug)?.audience, undefined)

    let saved = await saveWatch(slug, [['title', 'Open clip'], ['visibility', 'private']], ownerCookie)
    assert.equal(saved.status, 303)
    assert.deepEqual(getVideo(slug)?.audience ?? [], [])
    assert.equal((await get(routes.watch.href({ videoId: slug }))).response.status, 404)
  })
})

describe('edit title and Tags on Watch', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
  })

  async function join(name: string) {
    let response = await router.fetch(
      new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `intent=join&name=${encodeURIComponent(name)}&password=lantern&confirm=lantern`,
        redirect: 'manual',
      }),
    )
    assert.equal(response.status, 303)
    let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(header, 'Expected an lt_session cookie')
    let person = listPeople().find((entry) => entry.name === name)
    assert.ok(person)
    return { cookie: header.split(';', 1)[0], person }
  }

  async function publishHome(cookie: string, title: string, extra: [string, string][] = []) {
    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'clip.mp4'],
        ['channel', 'sam'],
        ['title', title],
        ['visibility', 'house'],
        ...extra,
      ],
      cookie,
    )
    assert.equal(response.status, 303)
    return videoIdFrom(response)
  }

  it('lets the Video owner change title, Tags, visibility, and Audience in one Save', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie, person: owner } = await join('Sam')
    let { cookie: namedCookie, person: named } = await join('Alex')
    let slug = await publishHome(ownerCookie, 'Lake day', [['tags', 'Kids']])
    let file = getVideo(slug)?.file
    assert.ok(file)

    let saved = await saveWatch(
      slug,
      [
        ['title', '  Evening   lake  '],
        ['tags', 'Trips, Garden'],
        ['visibility', 'private'],
        ['audience', named.id],
        ['audience', owner.id],
      ],
      ownerCookie,
    )
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), routes.watch.href({ videoId: slug }))

    let video = getVideo(slug)
    assert.equal(video?.id, slug)
    assert.equal(video?.title, 'Evening lake')
    assert.equal(video?.file, file)
    assert.deepEqual(video?.tags, ['trips', 'garden'])
    assert.equal(video?.private, true)
    assert.deepEqual(video?.audience, [named.id])
    assert.equal(getTag('garden')?.name, 'Garden')

    let watch = await get(routes.watch.href({ videoId: slug }), ownerCookie)
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /name="title"[^>]*value="Evening lake"|value="Evening lake"[^>]*name="title"/)
    assert.doesNotMatch(watch.html, /<h1[^>]*>Evening lake<\/h1>/)
    assert.match(watch.html, /<legend class="field-label">Tags /)
    assert.match(watch.html, /name="tags"/)
    assert.match(watch.html, /"tags":\["Trips","Garden"\]|"tags":\["Garden","Trips"\]/)
    assert.match(watch.html, /value="private"[^>]*checked|checked[^>]*value="private"/)
    assert.match(watch.html, new RegExp(`value="${named.id}"[^>]*checked|checked[^>]*value="${named.id}"`))

    let namedWatch = await get(routes.watch.href({ videoId: slug }), namedCookie)
    assert.equal(namedWatch.response.status, 200)
    assert.match(namedWatch.html, /<h1[^>]*>Evening lake<\/h1>/)
    assert.match(namedWatch.html, /aria-label="Tags"/)
    assert.match(namedWatch.html, />Garden</)
    assert.match(namedWatch.html, />Trips</)
    assert.doesNotMatch(namedWatch.html, /name="title"/)
    assert.doesNotMatch(namedWatch.html, /name="tags"/)
    assert.doesNotMatch(namedWatch.html, new RegExp(`action="${routes.watchSave.href({ videoId: slug })}"`))

    let home = await get(routes.home.href(), namedCookie)
    let chips = home.html.slice(home.html.indexOf('aria-label="Tags"'), home.html.indexOf('Latest in the house'))
    assert.match(chips, />Garden</)
    assert.match(chips, />Trips</)
    assert.doesNotMatch(chips, /Kids/)
    assert.match(home.html, /Evening lake/)

    let listed = await listVisibleVideos(named.id)
    assert.equal(listed[0]?.id, slug)
    assert.equal(listed[0]?.title, 'Evening lake')
    assert.equal(listed[0]?.file, file)
  })

  it('keeps the slug and media file when the title changes, and allows duplicate titles', async () => {
    await useEmptyHouse()
    let { cookie } = await join('Sam')
    let first = await publishHome(cookie, 'Lake day')
    let second = await publishHome(cookie, 'Other clip')
    let firstFile = getVideo(first)?.file
    let secondFile = getVideo(second)?.file

    let saved = await saveWatch(second, [['title', 'Lake day'], ['visibility', 'house']], cookie)
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), routes.watch.href({ videoId: second }))
    assert.equal(getVideo(first)?.title, 'Lake day')
    assert.equal(getVideo(second)?.title, 'Lake day')
    assert.equal(getVideo(first)?.id, first)
    assert.equal(getVideo(second)?.id, second)
    assert.notEqual(first, second)
    assert.equal(getVideo(first)?.file, firstFile)
    assert.equal(getVideo(second)?.file, secondFile)
    assert.ok(firstFile && fs.existsSync(path.join(mediaDir, firstFile)))
    assert.ok(secondFile && fs.existsSync(path.join(mediaDir, secondFile)))

    let watch = await get(routes.watch.href({ videoId: second }), cookie)
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /name="title"[^>]*value="Lake day"|value="Lake day"[^>]*name="title"/)
  })

  it('shows the Tags field to the owner even with zero Tags, and hides viewer chips when empty', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie } = await join('Sam')
    let { cookie: otherCookie } = await join('Alex')
    let slug = await publishHome(ownerCookie, 'No labels')

    let ownerWatch = await get(routes.watch.href({ videoId: slug }), ownerCookie)
    assert.match(ownerWatch.html, /<legend class="field-label">Tags /)
    assert.match(ownerWatch.html, /name="tags"/)
    assert.doesNotMatch(ownerWatch.html, /aria-label="Tags"/)
    assert.doesNotMatch(ownerWatch.html, /<h1[^>]*>No labels<\/h1>/)

    let otherWatch = await get(routes.watch.href({ videoId: slug }), otherCookie)
    assert.match(otherWatch.html, /<h1[^>]*>No labels<\/h1>/)
    assert.doesNotMatch(otherWatch.html, /name="title"/)
    assert.doesNotMatch(otherWatch.html, /name="tags"/)
    assert.doesNotMatch(otherWatch.html, /aria-label="Tags"/)

    let unsigned = await get(routes.watch.href({ videoId: slug }))
    assert.match(unsigned.html, /<h1[^>]*>No labels<\/h1>/)
    assert.doesNotMatch(unsigned.html, /name="title"/)
    assert.doesNotMatch(unsigned.html, /name="tags"/)
  })

  it('returns inline errors for invalid title or Tags and does not persist', async () => {
    await useEmptyHouse()
    let { cookie } = await join('Sam')
    let slug = await publishHome(cookie, 'Lake day', [['tags', 'Kids']])

    let emptyTitle = await saveWatch(
      slug,
      [
        ['title', '   '],
        ['tags', 'Trips'],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(emptyTitle.status, 400)
    let emptyHtml = await emptyTitle.text()
    assert.match(emptyHtml, /Give the video a title between 1 and 100 characters/)
    assert.match(emptyHtml, /name="title"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*name="title"/)
    assert.equal(getVideo(slug)?.title, 'Lake day')
    assert.deepEqual(getVideo(slug)?.tags, ['kids'])

    let tooLong = 'x'.repeat(41)
    let badTags = await saveWatch(
      slug,
      [
        ['title', 'Evening lake'],
        ['tags', `Trips, ${tooLong}`],
        ['visibility', 'house'],
      ],
      cookie,
    )
    assert.equal(badTags.status, 400)
    let tagHtml = await badTags.text()
    assert.match(tagHtml, /Keep each Tag between 1 and 40 characters/)
    assert.match(tagHtml, /id="watch-tags"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*id="watch-tags"/)
    assert.match(tagHtml, /"tags":\["Trips"\]/)
    assert.match(tagHtml, new RegExp(`"tagDraft":"${tooLong}"`))
    assert.equal(getVideo(slug)?.title, 'Lake day')
    assert.deepEqual(getVideo(slug)?.tags, ['kids'])
  })

  it('rejects unauthorized and unsigned Watch saves', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie } = await join('Sam')
    let { cookie: otherCookie } = await join('Alex')
    let slug = await publishHome(ownerCookie, 'Lake day', [['tags', 'Kids']])

    assert.equal(
      (await saveWatch(slug, [['title', 'Stolen'], ['tags', 'Trips'], ['visibility', 'house']], otherCookie)).status,
      403,
    )
    assert.equal((await saveWatch(slug, [['title', 'Stolen'], ['visibility', 'house']])).status, 403)
    assert.equal(getVideo(slug)?.title, 'Lake day')
    assert.deepEqual(getVideo(slug)?.tags, ['kids'])

    let otherWatch = await get(routes.watch.href({ videoId: slug }), otherCookie)
    assert.match(otherWatch.html, /<h1[^>]*>Lake day<\/h1>/)
    assert.match(otherWatch.html, />Kids</)
    assert.doesNotMatch(otherWatch.html, /name="title"/)
  })
})

describe('Custom channel post and Watch edit', () => {
  afterEach(async () => {
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
  })

  async function join(name: string) {
    let response = await router.fetch(
      new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `intent=join&name=${encodeURIComponent(name)}&password=lantern&confirm=lantern`,
        redirect: 'manual',
      }),
    )
    assert.equal(response.status, 303)
    let header = response.headers.getSetCookie().find((entry) => entry.startsWith('lt_session='))
    assert.ok(header, 'Expected an lt_session cookie')
    let person = listPeople().find((entry) => entry.name === name)
    assert.ok(person)
    return { cookie: header.split(';', 1)[0], person }
  }

  function postChannel(fields: [string, string][], cookie: string) {
    let body = new FormData()
    for (let [key, value] of fields) body.append(key, value)
    return router.fetch(
      new Request(new URL(routes.channelNew.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { Cookie: cookie },
        body,
        redirect: 'manual',
      }),
    )
  }

  it('lets a Person create a Custom channel, name a Manager, and post a house-visible Video', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie, person: owner } = await join('Sam')
    let { cookie: managerCookie, person: manager } = await join('Alex')
    let { cookie: otherCookie } = await join('Riley')

    let created = await postChannel(
      [
        ['name', 'Board Games'],
        ['description', 'Catan nights.'],
        ['managers', manager.id],
      ],
      ownerCookie,
    )
    assert.equal(created.status, 303)
    assert.equal(created.headers.get('Location'), routes.channel.href({ channelId: 'board-games' }))

    resetChannels()
    assert.equal((await get(routes.channel.href({ channelId: 'board-games' }))).response.status, 404)
    await loadCatalogueChannels()

    let channel = await get(routes.channel.href({ channelId: 'board-games' }), ownerCookie)
    assert.equal(channel.response.status, 200)
    assert.match(channel.html, /Catan nights\./)
    assert.match(channel.html, /<dt>Managers<\/dt>/)
    assert.match(channel.html, /Alex/)

    let response = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'catan.mp4'],
        ['channel', 'board-games'],
        ['title', 'Catan night'],
        ['visibility', 'house'],
      ],
      ownerCookie,
    )
    assert.equal(response.status, 303)
    let slug = videoIdFrom(response)

    let home = await get(routes.home.href())
    assert.match(home.html, /Catan night/)
    assert.match(home.html, new RegExp(`href="${routes.watch.href({ videoId: slug })}"`))

    let watch = await get(routes.watch.href({ videoId: slug }))
    assert.equal(watch.response.status, 200)
    assert.match(watch.html, /<h1[^>]*>Catan night<\/h1>/)

    let onChannel = await get(routes.channel.href({ channelId: 'board-games' }))
    assert.match(onChannel.html, /Catan night/)

    let managerUpload = await get(routes.upload.index.href(), managerCookie)
    assert.match(managerUpload.html, /value="board-games"/)
    let otherUpload = await get(routes.upload.index.href(), otherCookie)
    assert.doesNotMatch(otherUpload.html, /value="board-games"/)

    let outsiderPost = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'nope.mp4'],
        ['channel', 'board-games'],
        ['title', 'Not allowed'],
        ['visibility', 'house'],
      ],
      otherCookie,
    )
    assert.equal(outsiderPost.status, 400)
    assert.match(await outsiderPost.text(), /Pick a channel you can post to/)
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'board-games' }), otherCookie)).response.status, 403)
  })

  it('lets owner and Managers see private Videos and edit them; Video owner lasts after removal', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie, person: owner } = await join('Sam')
    let { cookie: managerCookie, person: manager } = await join('Alex')
    let { cookie: otherCookie } = await join('Riley')

    assert.equal(
      (
        await postChannel(
          [
            ['name', 'Board Games'],
            ['managers', manager.id],
          ],
          ownerCookie,
        )
      ).status,
      303,
    )

    let ownerClip = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'owners.mp4'],
        ['channel', 'board-games'],
        ['title', 'Owner private'],
        ['visibility', 'private'],
      ],
      ownerCookie,
    )
    let ownerSlug = videoIdFrom(ownerClip)
    let managerClip = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'managers.mp4'],
        ['channel', 'board-games'],
        ['title', 'Manager private'],
        ['visibility', 'private'],
      ],
      managerCookie,
    )
    let managerSlug = videoIdFrom(managerClip)

    assert.equal((await get(routes.watch.href({ videoId: ownerSlug }), managerCookie)).response.status, 200)
    assert.equal((await get(routes.watch.href({ videoId: managerSlug }), ownerCookie)).response.status, 200)
    assert.equal((await get(routes.watch.href({ videoId: ownerSlug }), otherCookie)).response.status, 404)

    let managerWatch = await get(routes.watch.href({ videoId: ownerSlug }), managerCookie)
    assert.match(managerWatch.html, new RegExp(`action="${routes.watchSave.href({ videoId: ownerSlug })}"`))
    assert.match(managerWatch.html, /poster-role">Owner</)
    assert.doesNotMatch(managerWatch.html, /You · owner/)

    let saved = await saveWatch(
      ownerSlug,
      [
        ['title', 'Owner private retitled'],
        ['tags', 'Games'],
        ['visibility', 'private'],
        ['audience', owner.id],
        ['audience', manager.id],
      ],
      managerCookie,
    )
    assert.equal(saved.status, 303)
    assert.equal(getVideo(ownerSlug)?.title, 'Owner private retitled')
    assert.deepEqual(getVideo(ownerSlug)?.tags, ['games'])
    assert.deepEqual(getVideo(ownerSlug)?.audience, [manager.id])

    let clearedAudience = await saveWatch(
      ownerSlug,
      [
        ['title', 'Owner private retitled'],
        ['tags', 'Games'],
        ['visibility', 'private'],
      ],
      managerCookie,
    )
    assert.equal(clearedAudience.status, 303)
    assert.deepEqual(getVideo(ownerSlug)?.audience ?? [], [])

    let removed = await router.fetch(
      new Request(new URL(routes.channelEdit.action.href({ channelId: 'board-games' }), 'http://localhost'), {
        method: 'POST',
        headers: { Cookie: ownerCookie },
        body: (() => {
          let body = new FormData()
          body.append('name', 'Board Games')
          body.append('description', '')
          return body
        })(),
        redirect: 'manual',
      }),
    )
    assert.equal(removed.status, 303)

    assert.equal((await get(routes.watch.href({ videoId: managerSlug }), managerCookie)).response.status, 200)
    assert.equal((await get(routes.watch.href({ videoId: ownerSlug }), managerCookie)).response.status, 404)
    assert.match(
      (await get(routes.watch.href({ videoId: managerSlug }), managerCookie)).html,
      new RegExp(`action="${routes.watchSave.href({ videoId: managerSlug })}"`),
    )
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'board-games' }), managerCookie)).response.status, 403)
    assert.equal(
      (await saveWatch(managerSlug, [['title', 'Still mine'], ['visibility', 'private']], managerCookie)).status,
      303,
    )
    assert.equal(getVideo(managerSlug)?.title, 'Still mine')
    assert.equal((await saveWatch(ownerSlug, [['title', 'Stolen'], ['visibility', 'house']], managerCookie)).status, 404)
  })
})
