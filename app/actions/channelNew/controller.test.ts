import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { getPerson, listPeople, removePerson, resetHousehold, useEmptyHouse } from '../../data/household.ts'
import { deleteVideo, getVideo, resetChannels } from '../../data/library.ts'
import { mediaDir } from '../../data/media.ts'
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
    assert.match(html, /Managers Priya/)
    assert.doesNotMatch(html, /Also posting|who can post|with Priya/)
    assert.match(html, /New channel/)
  })
})

describe('channel page', () => {
  it('shows who runs a custom channel', async () => {
    let { response, html } = await get(routes.channel.href({ channelId: 'twice' }))

    assert.equal(response.status, 200)
    assert.match(html, /<h1 class="chhead-name">Twice<\/h1>/)
    assert.match(html, /<dt>Run by<\/dt>/)
    assert.match(html, /<dt>Managers<\/dt>/)
    assert.match(html, /Priya/)
    assert.doesNotMatch(html, /Also posting|Who can post|posters/)
    assert.doesNotMatch(html, /Edit channel/)
  })

  it('sorts by plays', async () => {
    let { html } = await get(`${routes.channel.href({ channelId: 'video-games' })}?sort=popular`)

    assert.match(html, /aria-current="page"[^>]*>Most played/)
  })

  it('offers editing to the Channel owner and Managers', async () => {
    let owner = await get(routes.channel.href({ channelId: 'twice' }), await signIn('mia'))
    assert.match(owner.html, /Edit channel/)
    let manager = await get(routes.channel.href({ channelId: 'twice' }), await signIn('priya'))
    assert.match(manager.html, /Edit channel/)
    let outsider = await get(routes.channel.href({ channelId: 'twice' }), await signIn('leo'))
    assert.doesNotMatch(outsider.html, /Edit channel/)
  })

  it('404s unknown channels', async () => {
    let { response } = await get(routes.channel.href({ channelId: 'nope' }))
    assert.equal(response.status, 404)
  })

  it('shows a confirm delete zone on a Custom channel only to an Admin', async () => {
    let tomas = getPerson('tomas')!
    tomas.isAdmin = true
    try {
      let cookie = await signIn('tomas')
      let admin = await get(routes.channel.href({ channelId: 'twice' }), cookie)
      assert.match(admin.html, /Delete this channel/)
      assert.match(admin.html, /name="confirm"/)
      assert.match(admin.html, new RegExp(`action="${routes.channelDelete.href({ channelId: 'twice' })}"`))

      let home = await get(routes.channel.href({ channelId: 'mia' }), cookie)
      assert.doesNotMatch(home.html, /Delete this channel/)
    } finally {
      delete tomas.isAdmin
    }

    let owner = await get(routes.channel.href({ channelId: 'twice' }), await signIn('mia'))
    assert.doesNotMatch(owner.html, /Delete this channel/)
    assert.doesNotMatch(owner.html, new RegExp(`action="${routes.channelDelete.href({ channelId: 'twice' })}"`))

    let manager = await get(routes.channel.href({ channelId: 'twice' }), await signIn('priya'))
    assert.doesNotMatch(manager.html, /Delete this channel/)

    let unsigned = await get(routes.channel.href({ channelId: 'twice' }))
    assert.doesNotMatch(unsigned.html, /Delete this channel/)
  })
})

describe('admin delete Custom channel', () => {
  it('asks to tick confirm and keeps the channel', async () => {
    let tomas = getPerson('tomas')!
    tomas.isAdmin = true
    try {
      let denied = await post(routes.channelDelete.href({ channelId: 'twice' }), [], await signIn('tomas'))
      assert.equal(denied.status, 400)
      assert.match(await denied.text(), /Tick the box to confirm, then delete/)
      assert.equal((await get(routes.channel.href({ channelId: 'twice' }))).response.status, 200)
    } finally {
      delete tomas.isAdmin
    }
  })

  it('forbids people who are not Admins', async () => {
    let denied = await post(
      routes.channelDelete.href({ channelId: 'twice' }),
      [['confirm', '1']],
      await signIn('mia'),
    )
    assert.equal(denied.status, 403)
    assert.equal((await get(routes.channel.href({ channelId: 'twice' }))).response.status, 200)
    assert.equal((await post(routes.channelDelete.href({ channelId: 'twice' }), [['confirm', '1']])).status, 403)
  })

  it('does not delete a Home channel', async () => {
    let tomas = getPerson('tomas')!
    tomas.isAdmin = true
    try {
      let denied = await post(
        routes.channelDelete.href({ channelId: 'mia' }),
        [['confirm', '1']],
        await signIn('tomas'),
      )
      assert.equal(denied.status, 403)
      assert.equal((await get(routes.channel.href({ channelId: 'mia' }))).response.status, 200)
    } finally {
      delete tomas.isAdmin
    }
  })

  describe('catalogue Custom channel', () => {
    const created: string[] = []
    const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 2, 0])
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])

    afterEach(async () => {
      for (let id of created.splice(0)) deleteVideo(id)
      fs.rmSync(path.join(mediaDir, 'uploads'), { recursive: true, force: true })
      fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
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

    it('deletes the channel and its uploads, then redirects to /channels', async () => {
      await useEmptyHouse()
      let { cookie: adminCookie } = await join('Sam')
      let { cookie: ownerCookie } = await join('Alex')
      assert.equal(
        (
          await post(
            routes.channelNew.action.href(),
            [['name', 'Board Games']],
            ownerCookie,
          )
        ).status,
        303,
      )

      let body = new FormData()
      body.append('video', new Blob([clip], { type: 'video/mp4' }), 'catan.mp4')
      body.append('channel', 'board-games')
      body.append('title', 'Catan night')
      body.append('visibility', 'house')
      body.append('poster', new Blob([jpeg], { type: 'image/jpeg' }), 'poster.jpg')
      let published = await router.fetch(
        new Request(new URL(routes.upload.action.href(), 'http://localhost'), {
          method: 'POST',
          headers: { Cookie: ownerCookie },
          body,
          redirect: 'manual',
        }),
      )
      assert.equal(published.status, 303)
      let slug = decodeURIComponent((published.headers.get('Location') ?? '').split('/').pop() ?? '')
      created.push(slug)
      let video = getVideo(slug)
      assert.ok(video?.file)
      let file = path.join(mediaDir, video.file)
      let poster = path.join(mediaDir, '.lantube', 'posters', `${slug}.jpg`)
      assert.equal(fs.existsSync(file), true)
      assert.equal(fs.existsSync(poster), true)

      let page = await get(routes.channel.href({ channelId: 'board-games' }), adminCookie)
      assert.match(page.html, /Delete this channel/)
      assert.match(page.html, new RegExp(`action="${routes.channelDelete.href({ channelId: 'board-games' })}"`))

      let ownerPage = await get(routes.channel.href({ channelId: 'board-games' }), ownerCookie)
      assert.doesNotMatch(ownerPage.html, /Delete this channel/)

      let deleted = await post(
        routes.channelDelete.href({ channelId: 'board-games' }),
        [['confirm', '1']],
        adminCookie,
      )
      assert.equal(deleted.status, 303)
      assert.equal(deleted.headers.get('Location'), routes.channels.href())
      assert.equal((await get(routes.channel.href({ channelId: 'board-games' }))).response.status, 404)
      assert.equal((await get(routes.watch.href({ videoId: slug }))).response.status, 404)
      assert.equal(getVideo(slug), undefined)
      assert.equal(fs.existsSync(file), false)
      assert.equal(fs.existsSync(poster), false)
      assert.doesNotMatch((await get(routes.channels.href())).html, /Board Games/)
    })
  })
})

describe('admin delete Frozen Home channel', () => {
  const created: string[] = []
  const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 2, 0])
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])

  afterEach(async () => {
    for (let id of created.splice(0)) deleteVideo(id)
    fs.rmSync(path.join(mediaDir, 'uploads'), { recursive: true, force: true })
    fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
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

  async function publish(fields: [string, Blob | string, string?][], cookie: string) {
    let body = new FormData()
    for (let [key, value, filename] of fields) {
      if (value instanceof Blob) body.append(key, value, filename)
      else body.append(key, value)
    }
    return router.fetch(
      new Request(new URL(routes.upload.action.href(), 'http://localhost'), {
        method: 'POST',
        headers: { Cookie: cookie },
        body,
        redirect: 'manual',
      }),
    )
  }

  it('shows a confirm delete zone to an Admin after the Person is removed', async () => {
    await useEmptyHouse()
    let { cookie: adminCookie, person: admin } = await join('Sam')
    let { cookie: memberCookie, person: alex } = await join('Alex')
    let live = await get(routes.channel.href({ channelId: 'alex' }), adminCookie)
    assert.doesNotMatch(live.html, /Delete this channel/)

    assert.equal(await removePerson(admin.id, alex.id), true)
    let frozen = await get(routes.channel.href({ channelId: 'alex' }), adminCookie)
    assert.equal(frozen.response.status, 200)
    assert.match(frozen.html, /This channel is frozen/)
    assert.match(frozen.html, /Delete this channel/)
    assert.match(frozen.html, /including private/)
    assert.match(frozen.html, /This address can be used again/)
    assert.match(frozen.html, new RegExp(`action="${routes.channelDelete.href({ channelId: 'alex' })}"`))

    let outsider = await get(routes.channel.href({ channelId: 'alex' }), memberCookie)
    assert.doesNotMatch(outsider.html, /Delete this channel/)
  })

  it('deletes the Frozen Home, its videos including private, and frees the slug', async () => {
    await useEmptyHouse()
    let { cookie: adminCookie, person: admin } = await join('Sam')
    let { cookie: alexCookie, person: alex } = await join('Alex')

    let house = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'lake.mp4'],
        ['channel', 'alex'],
        ['title', 'Alex public'],
        ['visibility', 'house'],
        ['poster', new Blob([jpeg], { type: 'image/jpeg' }), 'poster.jpg'],
      ],
      alexCookie,
    )
    assert.equal(house.status, 303)
    let publicSlug = decodeURIComponent((house.headers.get('Location') ?? '').split('/').pop() ?? '')
    created.push(publicSlug)

    let secret = await publish(
      [
        ['video', new Blob([clip], { type: 'video/mp4' }), 'secret.mp4'],
        ['channel', 'alex'],
        ['title', 'Alex secret'],
        ['visibility', 'private'],
      ],
      alexCookie,
    )
    assert.equal(secret.status, 303)
    let privateSlug = decodeURIComponent((secret.headers.get('Location') ?? '').split('/').pop() ?? '')
    created.push(privateSlug)

    let publicVideo = getVideo(publicSlug)
    assert.ok(publicVideo?.file)
    let file = path.join(mediaDir, publicVideo.file)
    let poster = path.join(mediaDir, '.lantube', 'posters', `${publicSlug}.jpg`)
    assert.equal(fs.existsSync(file), true)
    assert.equal(getVideo(privateSlug)?.private, true)

    assert.equal(await removePerson(admin.id, alex.id), true)
    assert.equal((await get(routes.watch.href({ videoId: privateSlug }), adminCookie)).response.status, 404)
    assert.ok(getVideo(privateSlug))

    let deleted = await post(
      routes.channelDelete.href({ channelId: 'alex' }),
      [['confirm', '1']],
      adminCookie,
    )
    assert.equal(deleted.status, 303)
    assert.equal(deleted.headers.get('Location'), routes.channels.href())
    assert.equal((await get(routes.channel.href({ channelId: 'alex' }))).response.status, 404)
    assert.equal(getVideo(publicSlug), undefined)
    assert.equal(getVideo(privateSlug), undefined)
    assert.equal(fs.existsSync(file), false)
    assert.equal(fs.existsSync(poster), false)

    let again = await join('Alex')
    assert.equal(again.person.slug, 'alex')
    assert.equal((await get(routes.channel.href({ channelId: 'alex' }), again.cookie)).response.status, 200)
  })
})

describe('new channel', () => {
  it('asks unsigned visitors to sign in', async () => {
    let { response, html } = await get(routes.channelNew.index.href())

    assert.equal(response.status, 200)
    assert.match(html, /Sign in to start a channel/)
    assert.match(html, /name Managers/)
    assert.doesNotMatch(html, /who else can post|Who can post/)
  })

  it('creates a channel, names Managers, and redirects to it', async () => {
    let cookie = await signIn('leo')
    let form = await get(routes.channelNew.index.href(), cookie)
    assert.match(form.html, /<legend class="field-label">Managers<\/legend>/)
    assert.match(form.html, /name="managers"/)
    assert.doesNotMatch(form.html, /Who can post|name="posters"/)

    let response = await post(
      routes.channelNew.action.href(),
      [
        ['name', 'Board Games'],
        ['description', 'Catan nights.'],
        ['managers', 'priya'],
      ],
      cookie,
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.channel.href({ channelId: 'board-games' }))

    let { html } = await get(routes.channel.href({ channelId: 'board-games' }), cookie)
    assert.match(html, /Catan nights\./)
    assert.match(html, /Edit channel/)
    assert.match(html, /<dt>Managers<\/dt>/)
    assert.match(html, /Priya/)
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
  it('forbids people who are neither owner nor Manager', async () => {
    let { response, html } = await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('leo'))

    assert.equal(response.status, 403)
    assert.match(html, /You can’t edit Twice/)
    assert.match(html, /name you a Manager/)
    assert.doesNotMatch(html, /who can post/)
  })

  it('lets a Manager edit the channel without naming Managers', async () => {
    let cookie = await signIn('priya')
    let { response, html } = await get(routes.channelEdit.index.href({ channelId: 'twice' }), cookie)
    assert.equal(response.status, 200)
    assert.match(html, /Edit Twice/)
    assert.doesNotMatch(html, /<legend class="field-label">Managers<\/legend>/)
    assert.doesNotMatch(html, /name="managers"/)

    let saved = await post(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [
        ['name', 'Twice'],
        ['description', 'Practice takes.'],
        ['managers', 'leo'],
      ],
      cookie,
    )
    assert.equal(saved.status, 303)
    let channel = await get(routes.channel.href({ channelId: 'twice' }))
    assert.match(channel.html, /Practice takes\./)
    assert.match(channel.html, /<dt>Managers<\/dt>/)
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'twice' }), cookie)).response.status, 200)
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('leo'))).response.status, 403)
    resetChannels()
  })

  it('lets the Channel owner name and remove Managers', async () => {
    let cookie = await signIn('mia')
    let form = await get(routes.channelEdit.index.href({ channelId: 'twice' }), cookie)
    assert.match(form.html, /<legend class="field-label">Managers<\/legend>/)
    assert.match(form.html, /name="managers"/)
    assert.match(form.html, /You · owner/)

    let named = await post(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [
        ['name', 'Twice'],
        ['description', 'Concert clips.'],
        ['managers', 'tomas'],
      ],
      cookie,
    )
    assert.equal(named.status, 303)
    let withTomas = await get(routes.channel.href({ channelId: 'twice' }))
    assert.match(withTomas.html, /<dt>Managers<\/dt>/)
    assert.match(withTomas.html, /Tomás/)
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('tomas'))).response.status, 200)
    assert.equal((await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('priya'))).response.status, 403)

    let cleared = await post(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [
        ['name', 'Twice'],
        ['description', 'Concert clips.'],
      ],
      cookie,
    )
    assert.equal(cleared.status, 303)
    let none = await get(routes.channel.href({ channelId: 'twice' }))
    assert.doesNotMatch(none.html, /<dt>Managers<\/dt>/)
    resetChannels()
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
    assert.doesNotMatch(html, /<dt>Managers<\/dt>/)
    resetChannels()
  })

  it('404s for Home channels and folders, with no Managers control', async () => {
    let cookie = await signIn('mia')
    let { response, html } = await get(routes.channelEdit.index.href({ channelId: 'mia' }), cookie)
    assert.equal(response.status, 404)
    assert.doesNotMatch(html, /<legend class="field-label">Managers<\/legend>/)
    assert.doesNotMatch(html, /name="managers"/)

    let home = await get(routes.channel.href({ channelId: 'mia' }), cookie)
    assert.doesNotMatch(home.html, /<dt>Managers<\/dt>/)
    assert.doesNotMatch(home.html, /name="managers"/)
    assert.doesNotMatch(home.html, /Delete this channel/)
  })
})

describe('delete Custom channel', () => {
  it('shows a confirm delete zone only to the Channel owner', async () => {
    let owner = await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('mia'))
    assert.equal(owner.response.status, 200)
    assert.match(owner.html, /Delete this channel/)
    assert.match(owner.html, /name="confirm"/)
    assert.match(owner.html, /name="intent" value="delete"/)

    let manager = await get(routes.channelEdit.index.href({ channelId: 'twice' }), await signIn('priya'))
    assert.equal(manager.response.status, 200)
    assert.doesNotMatch(manager.html, /Delete this channel/)
    assert.doesNotMatch(manager.html, /name="intent" value="delete"/)

    let adminManager = await get(routes.channelEdit.index.href({ channelId: 'video-games' }), await signIn('tomas'))
    assert.equal(adminManager.response.status, 200)
    assert.doesNotMatch(adminManager.html, /Delete this channel/)
  })

  it('asks to tick confirm and keeps the channel', async () => {
    let cookie = await signIn('mia')
    let denied = await post(routes.channelEdit.action.href({ channelId: 'twice' }), [['intent', 'delete']], cookie)
    assert.equal(denied.status, 400)
    assert.match(await denied.text(), /Tick the box to confirm, then delete/)
    assert.equal((await get(routes.channel.href({ channelId: 'twice' }))).response.status, 200)
  })

  it('forbids a Manager from deleting the channel', async () => {
    let denied = await post(
      routes.channelEdit.action.href({ channelId: 'twice' }),
      [
        ['intent', 'delete'],
        ['confirm', '1'],
      ],
      await signIn('priya'),
    )
    assert.equal(denied.status, 403)
    assert.equal((await get(routes.channel.href({ channelId: 'twice' }))).response.status, 200)
  })

  describe('catalogue Custom channel', () => {
    const created: string[] = []
    const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 2, 0])
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])

    afterEach(async () => {
      for (let id of created.splice(0)) deleteVideo(id)
      fs.rmSync(path.join(mediaDir, 'uploads'), { recursive: true, force: true })
      fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
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

    it('deletes the channel and its uploads, then redirects to /channels', async () => {
      await useEmptyHouse()
      let { cookie: ownerCookie } = await join('Sam')
      let { cookie: managerCookie, person: manager } = await join('Alex')
      assert.equal(
        (
          await post(
            routes.channelNew.action.href(),
            [
              ['name', 'Board Games'],
              ['managers', manager.id],
            ],
            ownerCookie,
          )
        ).status,
        303,
      )

      let body = new FormData()
      body.append('video', new Blob([clip], { type: 'video/mp4' }), 'catan.mp4')
      body.append('channel', 'board-games')
      body.append('title', 'Catan night')
      body.append('visibility', 'house')
      body.append('poster', new Blob([jpeg], { type: 'image/jpeg' }), 'poster.jpg')
      let published = await router.fetch(
        new Request(new URL(routes.upload.action.href(), 'http://localhost'), {
          method: 'POST',
          headers: { Cookie: managerCookie },
          body,
          redirect: 'manual',
        }),
      )
      assert.equal(published.status, 303)
      let slug = decodeURIComponent((published.headers.get('Location') ?? '').split('/').pop() ?? '')
      created.push(slug)
      let video = getVideo(slug)
      assert.ok(video?.file)
      let file = path.join(mediaDir, video.file)
      let poster = path.join(mediaDir, '.lantube', 'posters', `${slug}.jpg`)
      assert.equal(fs.existsSync(file), true)
      assert.equal(fs.existsSync(poster), true)

      let deleted = await post(
        routes.channelEdit.action.href({ channelId: 'board-games' }),
        [
          ['intent', 'delete'],
          ['confirm', '1'],
        ],
        ownerCookie,
      )
      assert.equal(deleted.status, 303)
      assert.equal(deleted.headers.get('Location'), routes.channels.href())
      assert.equal((await get(routes.channel.href({ channelId: 'board-games' }))).response.status, 404)
      assert.equal((await get(routes.watch.href({ videoId: slug }))).response.status, 404)
      assert.equal(getVideo(slug), undefined)
      assert.equal(fs.existsSync(file), false)
      assert.equal(fs.existsSync(poster), false)
      assert.doesNotMatch((await get(routes.channels.href())).html, /Board Games/)
    })
  })
})

describe('Home and People lineage for catalogue People', () => {
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

  it('shows Runs and Manages on Home and the People directory after naming a Manager', async () => {
    await useEmptyHouse()
    let { cookie: ownerCookie, person: owner } = await join('Sam')
    let { cookie: managerCookie, person: manager } = await join('Alex')
    assert.notEqual(owner.id, owner.slug)

    let created = await post(
      routes.channelNew.action.href(),
      [
        ['name', 'Board Games'],
        ['description', 'Catan nights.'],
        ['managers', manager.id],
      ],
      ownerCookie,
    )
    assert.equal(created.status, 303)

    let home = await get(routes.channel.href({ channelId: owner.slug }), ownerCookie)
    assert.equal(home.response.status, 200)
    assert.match(home.html, /<dt>Runs<\/dt>/)
    assert.match(home.html, /Board Games/)
    assert.match(home.html, /New channel/)

    let managerHome = await get(routes.channel.href({ channelId: manager.slug }), managerCookie)
    assert.equal(managerHome.response.status, 200)
    assert.match(managerHome.html, /<dt>Manages<\/dt>/)
    assert.match(managerHome.html, /Board Games/)

    let directory = await get(routes.channels.href())
    assert.match(directory.html, /Runs Board Games/)
    assert.match(directory.html, /Manages Board Games/)
  })
})
