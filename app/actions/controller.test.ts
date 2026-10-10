import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from '../router.ts'
import { routes } from '../routes.ts'

async function get(path: string) {
  let response = await router.fetch(new URL(path, 'http://localhost'))
  return { response, html: await response.text() }
}

describe('home page', () => {
  it('renders the shelves', async () => {
    let { response, html } = await get(routes.home.href())

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(html, /Continue watching/)
    assert.match(html, /Latest in the house/)
    assert.match(html, /Channels in this house/)
  })

  it('filters by search query', async () => {
    let { html } = await get(`${routes.home.href()}?q=sourdough`)

    assert.match(html, /Results for “sourdough”/)
    assert.match(html, /Sourdough attempt #4/)
    assert.doesNotMatch(html, /Continue watching/)
  })

  it('shows an empty state when nothing matches', async () => {
    let { html } = await get(`${routes.home.href()}?q=zzzz`)

    assert.match(html, /Nothing in the house matches/)
    assert.match(html, /Show all videos/)
  })

  it('filters by topic', async () => {
    let { html } = await get(`${routes.home.href()}?topic=music`)

    assert.match(html, /aria-current="page"[^>]*>Music|>Music<\/a>/)
    assert.match(html, /Chopin nocturne/)
  })
})

describe('placeholder routes', () => {
  it('404s unknown videos', async () => {
    let { response } = await get(routes.watch.href({ videoId: 'nope' }))
    assert.equal(response.status, 404)
  })

  it('renders known channels', async () => {
    let { response, html } = await get(routes.channel.href({ channelId: 'mia' }))
    assert.equal(response.status, 200)
    assert.match(html, /Mia/)
  })
})
