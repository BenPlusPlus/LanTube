import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { assign, isAssigned, resetAssignments } from '../data/assignments.ts'
import { insertUploadedVideo } from '../data/catalogue.ts'
import { createPerson, getPerson, resetHousehold, useEmptyHouse } from '../data/household.ts'
import { addUploadedVideo, canWatch, deleteVideo, getVideo, resetChannels } from '../data/library.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

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

async function get(path: string, cookie?: string) {
  let response = await router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      redirect: 'manual',
      ...(cookie ? { headers: { Cookie: cookie } } : undefined),
    }),
  )
  return { response, html: await response.text() }
}

function post(path: string, fields: Record<string, string>, cookie?: string, referer?: string) {
  let body = new FormData()
  for (let [key, value] of Object.entries(fields)) body.set(key, value)
  let headers = new Headers()
  if (cookie) headers.set('Cookie', cookie)
  if (referer) headers.set('Referer', referer)
  return router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      method: 'POST',
      body,
      headers,
      redirect: 'manual',
    }),
  )
}

function withRoles() {
  getPerson('ruth')!.isParent = true
  getPerson('mia')!.isAdmin = true
  getPerson('tomas')!.isAdmin = true
}

function dropRoles() {
  for (let id of ['mia', 'tomas', 'ruth', 'leo', 'priya']) {
    let person = getPerson(id)
    if (person) {
      person.isParent = undefined
      person.isAdmin = undefined
    }
  }
}

function assignAction(videoId: string) {
  return routes.watchAssign.href({ videoId })
}

function menu(html: string, videoId: string) {
  let start = html.indexOf(`id="assign-${videoId}"`)
  if (start < 0) return ''
  let end = html.indexOf('</div>', start)
  return html.slice(start, end < 0 ? start : end)
}

describe('assign from the card kebab', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
    let secret = getVideo('secret-clip')
    if (secret) deleteVideo(secret.id)
  })

  it('shows Assign to on Home, search, and channel cards for a Parent, and omits it for everyone else', async () => {
    withRoles()
    let sam = await createPerson('Sam', 'house')
    assert.ok(!('error' in sam))
    let slug = 'home-duty'
    let inserted = await insertUploadedVideo({
      slug,
      title: 'Garden path',
      channelSlug: sam.slug,
      ownerId: sam.id,
      durationSec: 18,
      filePath: `uploads/${sam.slug}/${slug}.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    addUploadedVideo({
      id: slug,
      title: 'Garden path',
      channelId: sam.slug,
      durationSec: 18,
      thumb: '',
      tags: [],
      file: `uploads/${sam.slug}/${slug}.mp4`,
      postedBy: sam.id,
    })

    try {
      let ruth = await signIn('ruth')
      let home = await get(routes.home.href(), ruth)
      assert.match(home.html, /id="assign-home-duty"/)
      assert.match(menu(home.html, 'home-duty'), /Assign to/)
      assert.match(menu(home.html, 'home-duty'), />Leo</)
      assert.match(menu(home.html, 'home-duty'), />Priya</)
      assert.doesNotMatch(menu(home.html, 'home-duty'), /Tomás|Tomas/)

      let search = await get(`${routes.home.href()}?q=Garden`, ruth)
      assert.match(menu(search.html, 'home-duty'), /Assign to/)

      let channel = await get(routes.channel.href({ channelId: 'leo' }), ruth)
      assert.match(channel.html, /id="assign-no-training-wheels"/)
      assert.match(menu(channel.html, 'no-training-wheels'), />Leo</)

      assert.doesNotMatch((await get(routes.home.href())).html, /id="assign-/)
      assert.doesNotMatch((await get(routes.home.href(), await signIn('leo'))).html, /id="assign-/)
      assert.doesNotMatch((await get(routes.channel.href({ channelId: 'leo' }), await signIn('tomas'))).html, /id="assign-/)
    } finally {
      deleteVideo(slug)
      await useEmptyHouse()
      resetHousehold()
      resetChannels()
      withRoles()
    }
  })

  it('assigns and unassigns from the kebab, and lists the Assignment on Controls', async () => {
    withRoles()
    let ruth = await signIn('ruth')
    let videoId = 'no-training-wheels'
    let title = getVideo(videoId)!.title
    let saved = await post(
      assignAction(videoId),
      { intent: 'assign', personId: 'leo' },
      ruth,
      `http://localhost${routes.channel.href({ channelId: 'leo' })}`,
    )
    assert.equal(saved.status, 303)
    assert.equal(saved.headers.get('Location'), routes.channel.href({ channelId: 'leo' }))
    assert.equal(isAssigned('leo', videoId), true)

    let { html } = await get(routes.controls.index.href(), ruth)
    assert.match(html, new RegExp(`id="controls-leo"[\\s\\S]*?${title}[\\s\\S]*?Ruth · Just now`))
    assert.doesNotMatch(html, /name="intent" value="assign"/)

    let again = await get(routes.channel.href({ channelId: 'leo' }), ruth)
    assert.match(menu(again.html, videoId), /name="intent" value="unassign"[\s\S]*?personId" value="leo"/)

    let cleared = await post(assignAction(videoId), { intent: 'unassign', personId: 'leo' }, ruth)
    assert.equal(cleared.status, 303)
    assert.equal(isAssigned('leo', videoId), false)
    assert.doesNotMatch((await get(routes.controls.index.href(), ruth)).html, new RegExp(title))
  })

  it('assigns the same Video to Priya without dropping Leo’s Assignment', async () => {
    withRoles()
    let ruth = await signIn('ruth')
    await post(assignAction('tahoe-day-2'), { intent: 'assign', personId: 'leo' }, ruth)
    await post(assignAction('tahoe-day-2'), { intent: 'assign', personId: 'priya' }, ruth)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), true)
    assert.equal(isAssigned('priya', 'tahoe-day-2'), true)
  })

  it('refuses assign from an Admin who is not a Parent, and from a limited Person', async () => {
    withRoles()
    let tomas = await post(assignAction('tahoe-day-2'), { intent: 'assign', personId: 'leo' }, await signIn('tomas'))
    assert.equal(tomas.status, 403)
    let leo = await post(assignAction('tahoe-day-2'), { intent: 'assign', personId: 'priya' }, await signIn('leo'))
    assert.equal(leo.status, 403)
    let signedOut = await post(assignAction('tahoe-day-2'), { intent: 'assign', personId: 'leo' })
    assert.equal(signedOut.status, 303)
    assert.equal(isAssigned('leo', 'tahoe-day-2'), false)
  })

  it('omits a Person who cannot watch a private Video, and shows empty copy when nobody listed can', async () => {
    withRoles()
    addUploadedVideo({
      id: 'secret-clip',
      title: 'Secret clip',
      channelId: 'mia',
      durationSec: 12,
      thumb: '',
      tags: [],
      postedBy: 'mia',
      private: true,
    })
    let ruth = await signIn('ruth')
    let { html } = await get(routes.channel.href({ channelId: 'mia' }), ruth)
    let empty = menu(html, 'secret-clip')
    assert.match(empty, /No one here can watch this yet\. Name them on Audience first\./)
    assert.doesNotMatch(empty, />Leo</)

    getVideo('secret-clip')!.audience = ['priya']
    let named = menu((await get(routes.channel.href({ channelId: 'mia' }), ruth)).html, 'secret-clip')
    assert.match(named, />Priya</)
    assert.doesNotMatch(named, />Leo</)

    let refused = await post(assignAction('secret-clip'), { intent: 'assign', personId: 'leo' }, ruth)
    assert.equal(refused.status, 400)
    assert.equal(await assign('ruth', 'priya', 'secret-clip'), true)
    assert.equal(canWatch(getVideo('secret-clip')!, 'leo'), false)
    assert.doesNotMatch((await get(routes.channel.href({ channelId: 'mia' }), await signIn('leo'))).html, /Secret clip/)
  })

  it('hides the kebab when every Person is a Parent or Admin', async () => {
    withRoles()
    getPerson('leo')!.isParent = true
    getPerson('priya')!.isAdmin = true
    let { html } = await get(routes.channel.href({ channelId: 'leo' }), await signIn('ruth'))
    assert.doesNotMatch(html, /id="assign-/)
    assert.doesNotMatch(html, /Assign to/)
  })
})

describe('remove an Assignment from Controls', () => {
  afterEach(() => {
    dropRoles()
    resetAssignments()
  })

  it('removes an outstanding Assignment without an assign picker', async () => {
    withRoles()
    let ruth = await signIn('ruth')
    await assign('ruth', 'leo', 'rosie-one')
    let removed = await post(
      routes.controls.action.href(),
      { intent: 'unassign', personId: 'leo', videoId: 'rosie-one' },
      ruth,
    )
    assert.equal(removed.status, 303)
    assert.equal(isAssigned('leo', 'rosie-one'), false)
    assert.doesNotMatch((await get(routes.controls.index.href(), ruth)).html, /Rosie turns one/)
  })
})
