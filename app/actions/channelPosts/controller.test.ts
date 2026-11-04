import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { listPeople, removePerson, resetHousehold, updatePersonRoles, useEmptyHouse } from '../../data/household.ts'
import { resetChannels } from '../../data/library.ts'
import { mediaDir } from '../../data/media.ts'
import { loadCataloguePosts, resetPosts } from '../../data/posts.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])

type Field = [string, string] | [string, Blob, string]

async function get(href: string, cookie?: string) {
  let response = await router.fetch(new Request(new URL(href, 'http://localhost'), cookie ? { headers: { Cookie: cookie } } : undefined))
  return { response, html: await response.text() }
}

function send(href: string, fields: Field[], cookie?: string) {
  let body = new FormData()
  for (let [key, value, filename] of fields) {
    if (value instanceof Blob) body.append(key, value, filename)
    else body.append(key, value)
  }
  return router.fetch(
    new Request(new URL(href, 'http://localhost'), { method: 'POST', headers: cookie ? { Cookie: cookie } : undefined, body, redirect: 'manual' }),
  )
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

async function join(name: string) {
  let response = await router.fetch(
    new Request(new URL(routes.signin.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `intent=join&name=${encodeURIComponent(name)}&password=house-password&confirm=house-password`,
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

function picture(name = 'pic.jpg'): Field {
  return ['pictures', new Blob([jpeg], { type: 'image/jpeg' }), name]
}

/** Posts and returns the new Post's id from the redirect. */
async function write(channelId: string, cookie: string, fields: Field[]) {
  let response = await send(routes.channelPosts.action.href({ channelId }), fields, cookie)
  assert.equal(response.status, 303)
  let location = response.headers.get('Location') ?? ''
  assert.ok(location.startsWith(`${routes.channelPosts.index.href({ channelId })}#post-`), location)
  return location.split('#post-')[1]
}

const postsHref = (channelId: string) => routes.channelPosts.index.href({ channelId })
const deleteHref = (channelId: string, postId: string) => routes.channelPostDelete.href({ channelId, postId })
const pictureHref = (channelId: string, postId: string, n = '1') => routes.postPicture.href({ channelId, postId, n })

afterEach(async () => {
  fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  await useEmptyHouse()
  resetHousehold()
  resetChannels()
})

describe('channel posts', () => {
  it('gives Home and Custom channels a Posts tab, but not Folder channels', async () => {
    let custom = await get(routes.channel.href({ channelId: 'twice' }))
    assert.match(custom.html, /class="chtabs"/)
    assert.match(custom.html, /aria-current="page"[^>]*>Videos</)
    assert.match((await get(routes.channel.href({ channelId: 'leo' }))).html, /class="chtabs"/)

    let folder = await get(routes.channel.href({ channelId: 'home-movies' }))
    assert.doesNotMatch(folder.html, /chtabs/)
    assert.equal((await get(postsHref('home-movies'))).response.status, 404)
  })

  it('lets a Manager post text with pictures, newest first, and serves the pictures', async () => {
    let priya = await signIn('priya')
    let empty = await get(postsHref('twice'), priya)
    assert.match(empty.html, /aria-current="page"[^>]*>Posts</)
    assert.match(empty.html, /class="pcompose"/)
    assert.match(empty.html, /Nothing posted yet/)

    let first = await write('twice', priya, [['body', 'First news']])
    let second = await write('twice', priya, [['body', 'Tour dates\nare out'], picture('a.jpg'), picture('b.jpg')])

    let { html } = await get(postsHref('twice'))
    assert.ok(html.indexOf(`id="post-${second}"`) < html.indexOf(`id="post-${first}"`), 'newest first')
    assert.match(html, /Tour dates\nare out/)
    assert.match(html, /class="post-pics post-pics-2"/)
    assert.doesNotMatch(html, /class="pcompose"/, 'readers get no composer')

    let pic = await router.fetch(new Request(new URL(pictureHref('twice', second, '2'), 'http://localhost')))
    assert.equal(pic.status, 200)
    assert.equal(pic.headers.get('Content-Type'), 'image/jpeg')
    assert.equal((await get(pictureHref('twice', second, '3'))).response.status, 404)
    assert.equal((await get(pictureHref('twice', first))).response.status, 404)
    assert.equal((await get(pictureHref('skillet', second))).response.status, 404, 'a post belongs to one channel')
  })

  it('only lets the people who run a channel post', async () => {
    assert.equal((await send(routes.channelPosts.action.href({ channelId: 'twice' }), [['body', 'Hi']])).status, 401)
    let leo = await signIn('leo')
    assert.equal((await send(routes.channelPosts.action.href({ channelId: 'twice' }), [['body', 'Hi']], leo)).status, 403)
    assert.equal((await send(routes.channelPosts.action.href({ channelId: 'mia' }), [['body', 'Hi']], leo)).status, 403)
    assert.equal(typeof (await write('leo', leo, [['body', 'My own Home']])), 'string')
  })

  it('needs text, at most four pictures, and real images', async () => {
    let mia = await signIn('mia')
    let action = routes.channelPosts.action.href({ channelId: 'twice' })

    let blank = await send(action, [['body', '   '], picture()], mia)
    assert.equal(blank.status, 400)
    assert.match(await blank.text(), /Write something to post\./)

    let five = await send(action, [['body', 'Lots'], picture(), picture(), picture(), picture(), picture()], mia)
    assert.equal(five.status, 400)
    assert.match(await five.text(), /Pick up to 4 pictures\./)

    let notImage = await send(action, [['body', 'Sneaky'], ['pictures', new Blob(['hello'], { type: 'image/jpeg' }), 'fake.jpg']], mia)
    assert.equal(notImage.status, 400)
    let html = await notImage.text()
    assert.match(html, /JPEG, PNG, WebP, or GIF/)
    assert.match(html, />Sneaky<\/textarea>/, 'keeps what was written')

    assert.doesNotMatch((await get(postsHref('twice'))).html, /class="post"/)
  })

  it('lets the author, the Channel owner, and Managers delete after confirming', async () => {
    let mia = await signIn('mia')
    let priya = await signIn('priya')
    let leo = await signIn('leo')
    let byOwner = await write('twice', mia, [['body', 'From Mia'], picture()])
    let byManager = await write('twice', priya, [['body', 'From Priya']])
    assert.match((await get(postsHref('twice'), priya)).html, /class="post-delete"/)
    assert.doesNotMatch((await get(postsHref('twice'), leo)).html, /class="post-delete"/)

    assert.equal((await send(deleteHref('twice', byOwner), [['confirm', '1']], leo)).status, 403)

    let unconfirmed = await send(deleteHref('twice', byOwner), [], priya)
    assert.equal(unconfirmed.status, 400)
    assert.match(await unconfirmed.text(), /<details[^>]*\bopen\b[^>]*class="post-delete">[\s\S]*Tick the box to confirm/)

    let pictureFile = path.join(mediaDir, '.lantube', 'posts', byOwner)
    assert.equal(fs.existsSync(pictureFile), true)
    let deleted = await send(deleteHref('twice', byOwner), [['confirm', '1']], priya)
    assert.equal(deleted.status, 303)
    assert.equal(deleted.headers.get('Location'), postsHref('twice'))
    assert.equal(fs.existsSync(pictureFile), false)

    assert.equal((await send(deleteHref('twice', byManager), [['confirm', '1']], mia)).status, 303)
    assert.doesNotMatch((await get(postsHref('twice'))).html, /class="post"/)
    assert.equal((await send(deleteHref('twice', byManager), [['confirm', '1']], mia)).status, 404)
  })

  it('keeps Private posts to the owner, Managers, and the Audience', async () => {
    let mia = await signIn('mia')
    let edit = await get(routes.channelEdit.index.href({ channelId: 'twice' }), mia)
    assert.match(edit.html, /id="posts-visibility"/)
    let postId = await write('twice', mia, [['body', 'Secret setlist'], picture()])

    let saved = await send(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [['name', 'Twice'], ['description', ''], ['managers', 'priya'], ['postsVisibility', 'private'], ['postsAudience', 'ruth']],
      mia,
    )
    assert.equal(saved.status, 303)

    let leo = await signIn('leo')
    let outside = await get(routes.channel.href({ channelId: 'twice' }), leo)
    assert.equal(outside.response.status, 200)
    assert.doesNotMatch(outside.html, /chtabs/)
    assert.equal((await get(postsHref('twice'), leo)).response.status, 404)
    assert.equal((await get(postsHref('twice'))).response.status, 404)
    assert.equal((await get(pictureHref('twice', postId), leo)).response.status, 404)
    assert.equal((await send(deleteHref('twice', postId), [['confirm', '1']], leo)).status, 404)

    let ruth = await get(postsHref('twice'), await signIn('ruth'))
    assert.equal(ruth.response.status, 200)
    assert.match(ruth.html, /Secret setlist/)
    assert.match(ruth.html, /Only some people in the house can see posts here\./)

    let manager = await get(postsHref('twice'), await signIn('priya'))
    assert.match(manager.html, /The owner, Managers, Ruth and Parents can see posts here\./)
  })

  it('lets a Home channel’s person set visibility on its settings page, and Parents always see', async () => {
    await useEmptyHouse()
    let { cookie: samCookie, person: sam } = await join('Sam')
    let { cookie: alexCookie, person: alex } = await join('Alex')
    let { cookie: beaCookie, person: bea } = await join('Bea')
    let postId = await write('alex', alexCookie, [['body', 'Alex’s first post'], picture()])

    assert.equal((await get(routes.channelSettings.index.href({ channelId: 'alex' }), samCookie)).response.status, 404)
    let settings = await get(routes.channelSettings.index.href({ channelId: 'alex' }), alexCookie)
    assert.equal(settings.response.status, 200)
    assert.match(settings.html, /Who can see posts/)
    let custom = await get(routes.channelSettings.index.href({ channelId: 'twice' }), alexCookie)
    assert.equal(custom.response.status, 303)

    let saved = await send(routes.channelSettings.action.href({ channelId: 'alex' }), [['postsVisibility', 'private']], alexCookie)
    assert.equal(saved.status, 303)
    assert.equal((await get(postsHref('alex'), samCookie)).response.status, 404, 'Admin is not Parent')
    assert.equal((await get(postsHref('alex'), beaCookie)).response.status, 404)

    let promoted = await updatePersonRoles(sam.id, bea.id, { isAdmin: false, isParent: true })
    assert.ok(!('error' in promoted))
    assert.equal((await get(postsHref('alex'), beaCookie)).response.status, 200)

    resetPosts()
    assert.equal((await get(postsHref('alex'), samCookie)).response.status, 200, 'memory alone forgets')
    await loadCataloguePosts()
    assert.equal((await get(postsHref('alex'), samCookie)).response.status, 404, 'privacy comes back from the catalogue')
    assert.match((await get(postsHref('alex'), alexCookie)).html, new RegExp(`id="post-${postId}"[\\s\\S]*Alex’s first post`))

    assert.equal(await removePerson(sam.id, alex.id), true)
    let frozen = await get(routes.channel.href({ channelId: 'alex' }), samCookie)
    assert.doesNotMatch(frozen.html, /chtabs/)
    assert.match(frozen.html, /and its posts go/)
    let pictureDir = path.join(mediaDir, '.lantube', 'posts', postId)
    assert.equal(fs.existsSync(pictureDir), true)
    assert.equal((await send(routes.channelDelete.href({ channelId: 'alex' }), [['confirm', '1']], samCookie)).status, 303)
    assert.equal(fs.existsSync(pictureDir), false)
  })
})
