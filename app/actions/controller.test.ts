import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

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

describe('home page', () => {
  it('shows the unsigned empty library on an empty catalogue', async () => {
    let { response, html } = await get(routes.home.href())

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(html, /<title>Home/)
    assert.match(html, /<h2 id="empty-title">No videos in the house yet<\/h2>/)
    assert.match(
      html,
      /People in the house can upload, or an Admin can index a folder\. Anyone on this network can watch once something is here\./,
    )
    assert.doesNotMatch(html, /Upload a video/)
    assert.doesNotMatch(html, /aria-label="Topics"/)
    assert.doesNotMatch(html, /aria-label="Tags"/)
    assert.doesNotMatch(html, /Latest in the house/)
    assert.doesNotMatch(html, /Channels in this house/)
  })

  it('keeps the library-empty frame when search or tag filters are present', async () => {
    let { html } = await get(`${routes.home.href()}?q=zzzz&tag=music`)

    assert.match(html, /No videos in the house yet/)
    assert.doesNotMatch(html, /Nothing in the house matches/)
    assert.doesNotMatch(html, /Upload a video/)
  })
})

describe('placeholder routes', () => {
  it('renders known channels', async () => {
    let { response, html } = await get(routes.channel.href({ channelId: 'mia' }))
    assert.equal(response.status, 200)
    assert.match(html, /Mia/)
  })
})

describe('watch page', () => {
  it('404s unknown videos', async () => {
    let { response } = await get(routes.watch.href({ videoId: 'nope' }))
    assert.equal(response.status, 404)
  })

  it('renders the player, facts, and related videos', async () => {
    let { response, html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }))

    assert.equal(response.status, 200)
    assert.match(html, /<h1[^>]*>Lake Tahoe 2025, day 2: Emerald Bay at sunset<\/h1>/)
    assert.match(html, /3 plays/)
    assert.match(html, /Published <time datetime="\d{4}-\d{2}-\d{2}T/)
    assert.match(html, /More like this/)
    assert.match(html, new RegExp(`src="${routes.media.href({ videoId: 'tahoe-day-2' })}"`))
    assert.doesNotMatch(html, /isn’t on the host/)
  })

  it('shows read-only Tag chips as Home links, A–Z by name', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'u9-final' }))
    let tags = html.slice(html.indexOf('aria-label="Tags"'), html.indexOf('More like this'))
    assert.match(tags, new RegExp(`href="${routes.home.href()}\\?tag=kids"`))
    assert.match(tags, new RegExp(`href="${routes.home.href()}\\?tag=sports"`))
    assert.match(tags, />Kids</)
    assert.match(tags, />Sports</)
    let kids = tags.indexOf('Kids')
    let sports = tags.indexOf('Sports')
    assert.ok(kids > 0 && sports > kids, 'Expected Watch Tags A–Z by name')
  })

  it('lists tag matches before other videos', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'tahoe-day-2' }))
    let related = html.slice(html.indexOf('More like this'))
    let first = related.match(/class="rcard-title"><a href="\/watch\/([^"]+)"/)

    assert.equal(first?.[1], 'hilltop-camp')
    assert.doesNotMatch(related, /href="\/watch\/tahoe-day-2"/)
  })

  it('explains a missing file instead of streaming', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'christmas-2009' }))

    assert.match(html, /isn’t on the host/)
    assert.match(html, /Home Movies\/christmas-2009\.mp4/)
    assert.match(html, /Added <time/)
    assert.match(html, /Indexed from \/media\/Home Movies/)
  })

  it('restores theater mode from the cookie', async () => {
    let response = await router.fetch(
      new Request(new URL(routes.watch.href({ videoId: 'cardinal' }), 'http://localhost'), {
        headers: { Cookie: 'lt_theater=1' },
      }),
    )
    assert.match(await response.text(), /class="watch is-theater"/)
  })
})

describe('media route', () => {
  it('streams byte ranges', async () => {
    let response = await router.fetch(
      new Request(new URL(routes.media.href({ videoId: 'tahoe-day-2' }), 'http://localhost'), {
        headers: { Range: 'bytes=0-9' },
      }),
    )

    assert.equal(response.status, 206)
    assert.equal(response.headers.get('Content-Type'), 'video/mp4')
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-9/256')
    assert.equal((await response.arrayBuffer()).byteLength, 10)
  })

  it('404s when the file is missing', async () => {
    let { response } = await get(routes.media.href({ videoId: 'christmas-2009' }))
    assert.equal(response.status, 404)
  })

  it('404s unknown videos', async () => {
    let { response } = await get(routes.media.href({ videoId: 'nope' }))
    assert.equal(response.status, 404)
  })
})

describe('watch activity', () => {
  function post(videoId: string, fields: Record<string, string>, cookie?: string) {
    let body = new FormData()
    for (let [key, value] of Object.entries(fields)) body.set(key, value)
    return router.fetch(
      new Request(new URL(routes.watchActivity.href({ videoId }), 'http://localhost'), {
        method: 'POST',
        body,
        headers: cookie ? { Cookie: cookie } : undefined,
      }),
    )
  }

  it('counts a play', async () => {
    let before = await get(routes.watch.href({ videoId: 'kitchen-reveal' }))
    assert.match(before.html, /8 plays/)

    let response = await post('kitchen-reveal', { event: 'play' })
    assert.equal(response.status, 204)

    let after = await get(routes.watch.href({ videoId: 'kitchen-reveal' }))
    assert.match(after.html, /9 plays/)
  })

  it('saves progress for the signed-in person only', async () => {
    let mia = await signIn('mia')
    let response = await post('rosie-one', { event: 'progress', t: '95.5', d: '748' }, mia)
    assert.equal(response.status, 204)

    assert.match((await get(routes.watch.href({ videoId: 'rosie-one' }), mia)).html, /"resumeAt":96\b/)
    assert.doesNotMatch((await get(routes.watch.href({ videoId: 'rosie-one' }), await signIn('leo'))).html, /"resumeAt"/)
    assert.doesNotMatch((await get(routes.watch.href({ videoId: 'rosie-one' }))).html, /"resumeAt"/)
  })

  it('does not record progress unsigned', async () => {
    let response = await post('treehouse-3', { event: 'progress', t: '120', d: '1085' })
    assert.equal(response.status, 204)

    let { html } = await get(routes.watch.href({ videoId: 'treehouse-3' }), await signIn('priya'))
    assert.doesNotMatch(html, /"resumeAt"/)
  })

  it('rejects bad progress', async () => {
    assert.equal((await post('rosie-one', { event: 'progress', t: 'NaN', d: '748' })).status, 400)
    assert.equal((await post('rosie-one', { event: 'progress', t: '10', d: '0' })).status, 400)
    assert.equal((await post('rosie-one', { event: 'progress', t: '-4', d: '748' })).status, 400)
    assert.equal((await post('rosie-one', { event: 'bogus' })).status, 400)
  })

  it('404s unknown videos', async () => {
    assert.equal((await post('nope', { event: 'play' })).status, 404)
  })
})

describe('history page', () => {
  it('asks unsigned visitors to sign in', async () => {
    let { response, html } = await get(routes.history.href())

    assert.equal(response.status, 200)
    assert.match(html, /Sign in to see your history/)
    assert.match(html, /aren’t recorded/)
    assert.doesNotMatch(html, /class="sitting"/)
  })

  it('groups the person’s videos into sittings, newest first', async () => {
    let { html } = await get(routes.history.href(), await signIn('mia'))

    assert.match(html, /<h1 class="page-title">History<\/h1>/)
    assert.match(html, /\d+ videos this week/)
    assert.match(html, /class="sitting-bar"/)
    assert.match(html, /Resume from 2:10/)
    assert.match(html, /Resume from 6:38/)
    assert.match(html, /Finished/)
    let sourdough = html.indexOf('Sourdough attempt #4')
    let hilltop = html.indexOf('Hilltop camp')
    assert.ok(sourdough > 0 && hilltop > sourdough, 'Expected the newest sitting first')
    assert.doesNotMatch(html, /Rosie turns one/)
  })

  it('narrows sittings to search matches', async () => {
    let { html } = await get(`${routes.history.href()}?q=sourdough`, await signIn('mia'))

    assert.match(html, /1 video match “sourdough”/)
    assert.match(html, /Sourdough attempt #4/)
    assert.match(html, /Resume from 2:10/)
    assert.doesNotMatch(html, /Hilltop camp/)
    assert.match(html, /aria-label="Clear search"/)
  })

  it('says when nothing matches', async () => {
    let { html } = await get(`${routes.history.href()}?q=zzzz`, await signIn('mia'))

    assert.match(html, /Nothing in your history matches “zzzz”/)
    assert.match(html, /Clear search/)
  })
})
