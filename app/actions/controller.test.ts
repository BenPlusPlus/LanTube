import * as assert from 'remix/assert'
import { afterEach, beforeEach, describe, it } from 'remix/test'

import { assign, resetAssignments, unassign } from '../data/assignments.ts'
import { insertUploadedVideo, listVisibleVideos } from '../data/catalogue.ts'
import { loadCatalogueHistory, resetHistory } from '../data/history.ts'
import { createPerson, getPerson, listPeople, resetHousehold, useEmptyHouse, type Person } from '../data/household.ts'
import { addUploadedVideo, channelVideos, deleteVideo, getVideo, recordProgress, resetChannels } from '../data/library.ts'
import { findOrCreateTags } from '../data/tags.ts'
import { addVideo, createPlaylist, resetPlaylists } from '../data/playlists.ts'
import { splitHomeLibrary, VIDEO_FEED_PAGE } from '../data/video-feed.ts'
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

describe('watch these first', () => {
  const created: string[] = []
  let owner: Person | undefined

  function withRoles() {
    getPerson('ruth')!.isParent = true
    getPerson('mia')!.isAdmin = true
    getPerson('tomas')!.isAdmin = true
  }

  afterEach(async () => {
    resetAssignments()
    for (let id of created.splice(0)) deleteVideo(id)
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    owner = undefined
  })

  async function addClip(slug: string, title: string, extras: { durationSec?: number; tags?: string[]; tagIds?: string[] } = {}) {
    assert.ok(owner)
    let durationSec = extras.durationSec ?? 600
    let inserted = await insertUploadedVideo({
      slug,
      title,
      channelSlug: owner.slug,
      ownerId: owner.id,
      durationSec,
      filePath: `uploads/${owner.slug}/${slug}.mp4`,
      posterPath: null,
      visibility: 'house',
      tagIds: extras.tagIds,
    })
    assert.ok(inserted)
    created.push(slug)
    addUploadedVideo({
      id: slug,
      title,
      channelId: owner.slug,
      durationSec,
      thumb: '',
      tags: extras.tags ?? [],
      file: `uploads/${owner.slug}/${slug}.mp4`,
      postedBy: owner.id,
    })
    return getVideo(slug)!
  }

  async function houseWithLeoAssignments() {
    withRoles()
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    withRoles()
    let person = await createPerson('Sam', 'house')
    assert.ok(!('error' in person))
    owner = person
    let tags = await findOrCreateTags(['Kids'])
    let bike = await addClip('first-duty', 'Garden path', { tags: ['kids'], tagIds: tags.map((tag) => tag.id) })
    let lake = await addClip('second-duty', 'Lake walk')
    let other = await addClip('other-clip', 'Kitchen window')
    recordProgress(lake, 'leo', 60)
    recordProgress(other, 'leo', 90)
    await assign('ruth', 'leo', bike.id, 1_000)
    await assign('ruth', 'leo', lake.id, 2_000)
    return { bike, lake, other }
  }

  it('opens Home with Watch these first for Leo, newest Assignment first, and hides Continue watching', async () => {
    await houseWithLeoAssignments()
    let { html } = await get(routes.home.href(), await signIn('leo'))
    let assignedAt = html.indexOf('Watch these first')
    let latestAt = html.indexOf('Latest in the house')
    assert.ok(assignedAt > 0 && assignedAt < latestAt, 'Expected Watch these first above Latest')
    let assigned = html.slice(assignedAt, latestAt)
    assert.match(assigned, /Other videos play after you finish these\./)
    let lake = assigned.indexOf('/watch/second-duty')
    let bike = assigned.indexOf('/watch/first-duty')
    assert.ok(lake > 0 && bike > lake, 'Expected newest Assignment first')
    assert.match(assigned, /9 min left/)
    assert.doesNotMatch(html, /Continue watching/)
    let rest = html.slice(latestAt)
    assert.doesNotMatch(rest, /href="\/watch\/second-duty"/)
    assert.doesNotMatch(rest, /href="\/watch\/first-duty"/)
  })

  it('brings Continue watching back once Assignments are gone', async () => {
    await houseWithLeoAssignments()
    await unassign('ruth', 'leo', 'second-duty')
    await unassign('ruth', 'leo', 'first-duty')
    let { html } = await get(routes.home.href(), await signIn('leo'))
    assert.doesNotMatch(html, /Watch these first/)
    assert.match(html, /Continue watching/)
    assert.match(html, /Kitchen window/)
  })

  it('keeps search and tag results flat, and marks assigned cards Assigned on search and channel', async () => {
    await houseWithLeoAssignments()
    let leo = await signIn('leo')

    let search = await get(`${routes.home.href()}?q=Garden`, leo)
    assert.doesNotMatch(search.html, /Watch these first/)
    assert.match(search.html, /Results for/)
    assert.match(search.html, /class="vcard-watched">Assigned/)

    let tagged = await get(`${routes.home.href()}?tag=kids`, leo)
    assert.doesNotMatch(tagged.html, /Watch these first/)
    assert.match(tagged.html, /id="results-title"/)
    assert.match(tagged.html, /class="vcard-watched">Assigned/)

    let channel = await get(routes.channel.href({ channelId: owner!.slug }), leo)
    assert.doesNotMatch(channel.html, /Watch these first/)
    assert.match(channel.html, /class="vcard-watched">Assigned/)
  })

  it('does not show Watch these first on Ruth’s Home or unsigned Home', async () => {
    await houseWithLeoAssignments()
    let ruth = await get(routes.home.href(), await signIn('ruth'))
    assert.doesNotMatch(ruth.html, /Watch these first/)
    let unsigned = await get(routes.home.href())
    assert.doesNotMatch(unsigned.html, /Watch these first/)
    assert.match(unsigned.html, /Latest in the house/)
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

  it('does not offer delete on a Folder Video', async () => {
    let { html } = await get(routes.watch.href({ videoId: 'christmas-2009' }), await signIn('mia'))
    assert.doesNotMatch(html, /Delete this video/)
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
    let { response, html } = await get(`${routes.history.href()}?person=leo`)

    assert.equal(response.status, 200)
    assert.match(html, /Sign in to see your history/)
    assert.match(html, /aren’t recorded/)
    assert.doesNotMatch(html, /class="sitting"/)
    assert.doesNotMatch(html, /Whose History/)
    assert.doesNotMatch(html, /Treehouse build, part 3/)
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
    let christmas = html.indexOf('Christmas morning 2009')
    let hilltop = html.indexOf('Hilltop camp')
    assert.ok(sourdough > 0 && hilltop > sourdough, 'Expected the newest sitting first')
    assert.ok(christmas > 0 && christmas < sourdough, 'Expected newest video first within a sitting')
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

  it('ignores ?person= and shows own sittings', async () => {
    let { html } = await get(`${routes.history.href()}?person=ruth`, await signIn('mia'))

    assert.match(html, /Sourdough attempt #4/)
    assert.doesNotMatch(html, /Rosie turns one/)
    assert.doesNotMatch(html, /Whose History/)
  })
})

describe('parent history switcher', () => {
  beforeEach(() => {
    getPerson('mia')!.isParent = true
    getPerson('ruth')!.isParent = true
  })

  afterEach(() => {
    for (let person of listPeople()) {
      delete person.isParent
      delete person.isAdmin
    }
  })

  it('shows a Person switcher on own History', async () => {
    let { html } = await get(routes.history.href(), await signIn('mia'))

    assert.match(html, /Whose History/)
    assert.match(html, /Sourdough attempt #4/)
    assert.match(html, new RegExp(`href="${routes.history.href()}\\?person=leo"`))
    assert.match(html, new RegExp(`href="${routes.history.href()}\\?person=tomas"`))
    assert.doesNotMatch(html, new RegExp(`href="${routes.history.href()}\\?person=ruth"`))
    assert.doesNotMatch(html, /Rosie turns one/)
    assert.doesNotMatch(html, /The cardinal is back/)
  })

  it('opens a non-Parent’s History with ?person=', async () => {
    let { html } = await get(`${routes.history.href()}?person=leo`, await signIn('mia'))

    assert.match(html, /Whose History/)
    assert.match(html, /Treehouse build, part 3/)
    assert.match(html, /Boss fight, attempt 14/)
    assert.doesNotMatch(html, /Sourdough attempt #4/)
    assert.doesNotMatch(html, /Rosie turns one/)
    assert.match(html, /href="\/history\?person=leo" aria-current="page"/)
  })

  it('falls back to own History for a Parent, unknown id, or empty ?person=', async () => {
    let cookie = await signIn('mia')
    for (let path of [
      `${routes.history.href()}?person=ruth`,
      `${routes.history.href()}?person=nope`,
      `${routes.history.href()}?person=`,
      `${routes.history.href()}?person=%20`,
    ]) {
      let { html } = await get(path, cookie)
      assert.match(html, /Sourdough attempt #4/)
      assert.doesNotMatch(html, /Rosie turns one/)
      assert.match(html, /Whose History/)
    }
  })

  it('keeps ?person= on search and filters that Person’s sittings', async () => {
    let { html } = await get(`${routes.history.href()}?person=leo&q=treehouse`, await signIn('mia'))

    assert.match(html, /Treehouse build, part 3/)
    assert.doesNotMatch(html, /Boss fight, attempt 14/)
    assert.doesNotMatch(html, /Sourdough attempt #4/)
    assert.match(html, /name="person" value="leo"/)
    assert.match(html, new RegExp(`href="${routes.history.href()}\\?person=leo"`))
    assert.match(html, /1 video match “treehouse”/)
  })
})

describe('catalogue watch history over HTTP', () => {
  const created: string[] = []

  afterEach(async () => {
    for (let id of created.splice(0)) deleteVideo(id)
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    resetHistory()
  })

  async function join(name: string, parent = false) {
    let person = await createPerson(name, 'lantern', undefined, () => false, parent)
    assert.ok(!('error' in person))
    assert.notEqual(person.id, person.slug)
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

  function postActivity(videoId: string, fields: Record<string, string>, cookie?: string) {
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

  it('keeps a signed-in Person’s sitting and Continue watching after reload', async () => {
    await useEmptyHouse()
    let { cookie, person } = await join('Sam')
    created.push('issue-23-http-lake')
    let inserted = await insertUploadedVideo({
      slug: 'issue-23-http-lake',
      title: 'Kitchen window',
      channelSlug: person.slug,
      ownerId: person.id,
      durationSec: 120,
      filePath: `uploads/${person.slug}/issue-23-http-lake.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    addUploadedVideo({
      id: 'issue-23-http-lake',
      title: 'Kitchen window',
      channelId: person.slug,
      durationSec: 120,
      thumb: '',
      tags: [],
      file: `uploads/${person.slug}/issue-23-http-lake.mp4`,
      postedBy: person.id,
    })

    assert.equal((await postActivity('issue-23-http-lake', { event: 'play' }, cookie)).status, 204)
    assert.equal((await postActivity('issue-23-http-lake', { event: 'progress', t: '5', d: '120' }, cookie)).status, 204)

    resetHistory()
    await loadCatalogueHistory()

    let history = await get(routes.history.href(), cookie)
    assert.match(history.html, /Kitchen window/)
    assert.match(history.html, /class="sitting"/)
    assert.match(history.html, /Resume from 0:05/)

    let home = await get(routes.home.href(), cookie)
    assert.match(home.html, /Continue watching/)
    assert.match(home.html, /Kitchen window/)

    let watch = await get(routes.watch.href({ videoId: 'issue-23-http-lake' }), cookie)
    assert.match(watch.html, /"resumeAt":5\b/)
  })

  it('does not write History for an unsigned watch', async () => {
    await useEmptyHouse()
    let { cookie, person } = await join('Sam')
    created.push('issue-23-http-unsigned')
    let inserted = await insertUploadedVideo({
      slug: 'issue-23-http-unsigned',
      title: 'Unsigned clip',
      channelSlug: person.slug,
      ownerId: person.id,
      durationSec: 120,
      filePath: `uploads/${person.slug}/issue-23-http-unsigned.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    addUploadedVideo({
      id: 'issue-23-http-unsigned',
      title: 'Unsigned clip',
      channelId: person.slug,
      durationSec: 120,
      thumb: '',
      tags: [],
      file: `uploads/${person.slug}/issue-23-http-unsigned.mp4`,
      postedBy: person.id,
    })

    assert.equal((await postActivity('issue-23-http-unsigned', { event: 'play' })).status, 204)
    assert.equal((await postActivity('issue-23-http-unsigned', { event: 'progress', t: '5', d: '120' })).status, 204)

    resetHistory()
    await loadCatalogueHistory()

    let history = await get(routes.history.href(), cookie)
    assert.match(history.html, /Nothing watched yet/)
    assert.doesNotMatch(history.html, /Unsigned clip/)
    assert.doesNotMatch(history.html, /class="sitting"/)

    let home = await get(routes.home.href(), cookie)
    assert.doesNotMatch(home.html, /Continue watching/)
    let watch = await get(routes.watch.href({ videoId: 'issue-23-http-unsigned' }), cookie)
    assert.doesNotMatch(watch.html, /"resumeAt"/)
  })

  it('shows a Parent the switcher when their own History is empty', async () => {
    await useEmptyHouse()
    let { cookie, person: sam } = await join('Sam', true)
    let alex = await createPerson('Alex', 'lantern')
    assert.ok(!('error' in alex))

    let { html } = await get(routes.history.href(), cookie)
    assert.match(html, /Whose History/)
    assert.match(html, /Nothing watched yet/)
    assert.match(html, new RegExp(`href="${routes.history.href()}\\?person=${alex.id}"`))
    assert.doesNotMatch(html, new RegExp(`href="${routes.history.href()}\\?person=${sam.id}"`))
    assert.doesNotMatch(html, /class="sitting"/)
  })

  it('lets a Parent open catalogue History by Person id, not a guessed query from a non-Parent', async () => {
    await useEmptyHouse()
    let { cookie: parentCookie } = await join('Sam', true)
    let { cookie: childCookie, person: alex } = await join('Alex')
    let bess = await createPerson('Bess', 'lantern')
    assert.ok(!('error' in bess))
    created.push('issue-25-http-pond')
    let inserted = await insertUploadedVideo({
      slug: 'issue-25-http-pond',
      title: 'Pond ice',
      channelSlug: alex.slug,
      ownerId: alex.id,
      durationSec: 120,
      filePath: `uploads/${alex.slug}/issue-25-http-pond.mp4`,
      posterPath: null,
      visibility: 'house',
    })
    assert.ok(inserted)
    addUploadedVideo({
      id: 'issue-25-http-pond',
      title: 'Pond ice',
      channelId: alex.slug,
      durationSec: 120,
      thumb: '',
      tags: [],
      file: `uploads/${alex.slug}/issue-25-http-pond.mp4`,
      postedBy: alex.id,
    })
    assert.equal((await postActivity('issue-25-http-pond', { event: 'play' }, childCookie)).status, 204)
    assert.equal((await postActivity('issue-25-http-pond', { event: 'progress', t: '5', d: '120' }, childCookie)).status, 204)

    let asParent = await get(`${routes.history.href()}?person=${alex.id}`, parentCookie)
    assert.match(asParent.html, /Whose History/)
    assert.match(asParent.html, /Pond ice/)
    assert.match(asParent.html, /Resume from 0:05/)
    assert.match(asParent.html, new RegExp(`name="person" value="${alex.id}"`))
    assert.doesNotMatch(asParent.html, new RegExp(`href="${routes.history.href()}\\?person=${alex.slug}"`))

    let emptyChild = await get(`${routes.history.href()}?person=${bess.id}`, parentCookie)
    assert.match(emptyChild.html, /Whose History/)
    assert.match(emptyChild.html, /Nothing watched yet/)
    assert.match(emptyChild.html, /Videos Bess watches while signed in/)
    assert.doesNotMatch(emptyChild.html, /Pond ice/)

    let guessed = await get(`${routes.history.href()}?person=${bess.id}`, childCookie)
    assert.match(guessed.html, /Pond ice/)
    assert.doesNotMatch(guessed.html, /Whose History/)
    assert.doesNotMatch(guessed.html, /Videos Bess watches while signed in/)
  })
})

describe('video feeds', () => {
  const created: string[] = []

  afterEach(async () => {
    for (let id of created.splice(0)) deleteVideo(id)
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    resetPlaylists()
  })

  async function fillHouse(count: number) {
    await useEmptyHouse()
    let person = await createPerson('Sam', 'lantern')
    assert.ok(!('error' in person))
    let titles: string[] = []
    for (let i = 0; i < count; i++) {
      let slug = `feed-clip-${String(i).padStart(2, '0')}`
      let title = `Feed clip ${String(i).padStart(2, '0')}`
      let inserted = await insertUploadedVideo({
        slug,
        title,
        channelSlug: person.slug,
        ownerId: person.id,
        durationSec: 12,
        filePath: `uploads/${person.slug}/${slug}.mp4`,
        posterPath: `/poster/${slug}`,
        visibility: 'house',
      })
      assert.ok(inserted)
      created.push(slug)
      addUploadedVideo({
        id: slug,
        title,
        channelId: person.slug,
        durationSec: 12,
        thumb: `/poster/${slug}`,
        tags: [],
        file: `uploads/${person.slug}/${slug}.mp4`,
        postedBy: person.id,
      })
      titles.push(title)
    }
    return { person, titles }
  }

  it('keeps Earlier off the first Home paint and serves it from the fragment', async () => {
    await fillHouse(22)
    let { latest, earlier } = splitHomeLibrary(await listVisibleVideos())
    let home = await get(routes.home.href())
    assert.match(home.html, /Latest in the house/)
    assert.match(home.html, new RegExp(latest[0]!.title))
    assert.match(home.html, new RegExp(latest[7]!.title))
    assert.doesNotMatch(home.html, new RegExp(earlier[0]!.title))
    assert.match(home.html, /Show earlier videos/)
    assert.match(home.html, new RegExp(`href="${routes.home.href()}\\?earlier=${VIDEO_FEED_PAGE}"`))

    let batch = await get(`${routes.homeEarlier.href()}?from=0`)
    assert.equal(batch.response.status, 200)
    assert.match(batch.html, /class="feed-batch"/)
    assert.match(batch.html, new RegExp(earlier[0]!.title))
    assert.match(batch.html, new RegExp(earlier[VIDEO_FEED_PAGE - 1]!.title))
    assert.doesNotMatch(batch.html, new RegExp(earlier[VIDEO_FEED_PAGE]!.title))
    assert.doesNotMatch(batch.html, /Latest in the house/)
    assert.match(batch.html, /data-next="\/home\/earlier\?from=10"/)

    let more = await get(`${routes.home.href()}?earlier=${VIDEO_FEED_PAGE}`)
    assert.match(more.html, new RegExp(earlier[0]!.title))
    assert.doesNotMatch(more.html, new RegExp(earlier[VIDEO_FEED_PAGE]!.title))
  })

  it('paints about two rows on a channel and leaves the rest for the fragment', async () => {
    let { person } = await fillHouse(15)
    let list = channelVideos(person.slug)
    let page = await get(routes.channel.href({ channelId: person.slug }))
    assert.match(page.html, new RegExp(list[0]!.title))
    assert.match(page.html, new RegExp(list[VIDEO_FEED_PAGE - 1]!.title))
    assert.doesNotMatch(page.html, new RegExp(list[VIDEO_FEED_PAGE]!.title))
    assert.match(page.html, /Show more videos/)

    let batch = await get(`${routes.channelVideos.href({ channelId: person.slug })}?from=${VIDEO_FEED_PAGE}`)
    assert.equal(batch.response.status, 200)
    assert.match(batch.html, new RegExp(list[VIDEO_FEED_PAGE]!.title))
    assert.doesNotMatch(batch.html, new RegExp(list[0]!.title))
    assert.doesNotMatch(batch.html, /Show more videos/)
  })

  it('pages a long playlist the same way', async () => {
    let { person, titles } = await fillHouse(15)
    let createdList = await createPlaylist(person.id, {
      name: 'Feed stack',
      description: '',
      visibility: 'public',
    })
    assert.ok(!('error' in createdList))
    for (let i = 0; i < titles.length; i++) {
      assert.equal(await addVideo(createdList, `feed-clip-${String(i).padStart(2, '0')}`), true)
    }

    let page = await get(routes.playlist.href({ playlistId: createdList.id }))
    assert.match(page.html, new RegExp(titles[0]!))
    assert.match(page.html, new RegExp(titles[VIDEO_FEED_PAGE - 1]!))
    assert.doesNotMatch(page.html, new RegExp(titles[VIDEO_FEED_PAGE]!))
    assert.match(page.html, /Show more videos/)

    let batch = await get(`${routes.playlistVideos.href({ playlistId: createdList.id })}?from=${VIDEO_FEED_PAGE}`)
    assert.equal(batch.response.status, 200)
    assert.match(batch.html, new RegExp(titles[VIDEO_FEED_PAGE]!))
    assert.match(batch.html, /pentry-index">11</)
    assert.doesNotMatch(batch.html, new RegExp(titles[0]!))
  })
})
