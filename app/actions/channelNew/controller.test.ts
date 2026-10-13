import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { listPeople, resetHousehold, useEmptyHouse } from '../../data/household.ts'
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
