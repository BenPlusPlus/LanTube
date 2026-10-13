import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { listVisibleVideos, loadCatalogueVideos } from '../../data/catalogue.ts'
import { db } from '../../db.ts'
import { resetHousehold, useEmptyHouse } from '../../data/household.ts'
import { deleteVideo, getVideo, searchVideos } from '../../data/library.ts'
import { mediaDir } from '../../data/media.ts'
import { videos as videoRows } from '../../data/tables.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

const created: string[] = []

afterEach(() => {
  for (let id of created.splice(0)) deleteVideo(id)
  fs.rmSync(path.join(mediaDir, 'uploads'), { recursive: true, force: true })
  fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
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
    assert.doesNotMatch(html, /Public/)
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
        ['topics', 'travel'],
        ['topics', 'not-a-topic'],
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
    assert.deepEqual(video.tags.filter((tag) => tag === 'not-a-topic'), [])
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

    let tomas = await signIn('tomas')
    assert.equal((await get(watch, tomas)).response.status, 404)
    assert.equal((await get(watch)).response.status, 404)
    assert.equal((await get(poster, tomas)).response.status, 404)
    assert.equal(searchVideos('Only mine', undefined, 'tomas').length, 0)
    assert.equal(searchVideos('Only mine', undefined, 'mia').length, 1)
    assert.doesNotMatch((await get(routes.channel.href({ channelId: 'mia' }), tomas)).html, /Only mine/)
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
})
