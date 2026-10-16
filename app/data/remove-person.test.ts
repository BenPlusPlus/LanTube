import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from './catalogue.ts'
import {
  loadCatalogueHistory,
  recordWatchProgress,
  recordWatchStart,
  resetHistory,
  sessionsFor,
  sittingsFor,
} from './history.ts'
import {
  createPerson,
  getPerson,
  loadCataloguePeople,
  removePerson,
  resetHousehold,
  useEmptyHouse,
  type Person,
} from './household.ts'
import {
  addUploadedVideo,
  canEditVideo,
  canEditVideoTags,
  canEditVideoTitle,
  canPost,
  canWatch,
  createChannel,
  deleteVideo,
  getChannel,
  getChannels,
  getVideo,
  loadCatalogueChannels,
  resetChannels,
} from './library.ts'
import {
  createPlaylist,
  getPlaylist,
  loadCataloguePlaylists,
  playlistsOwnedBy,
  resetPlaylists,
} from './playlists.ts'

const created: string[] = []

afterEach(async () => {
  for (let id of created.splice(0)) deleteVideo(id)
  await useEmptyHouse()
  resetHousehold()
  resetChannels()
  resetPlaylists()
  resetHistory()
})

async function join(name: string) {
  let person = await createPerson(name, 'lantern')
  assert.ok(!('error' in person))
  return person
}

async function postVideo(person: Person, slug: string, channelSlug = person.slug, extra: { audience?: string[]; private?: boolean } = {}) {
  created.push(slug)
  let inserted = await insertUploadedVideo({
    slug,
    title: slug,
    channelSlug,
    ownerId: person.id,
    durationSec: 12,
    filePath: `uploads/${channelSlug}/${slug}.mp4`,
    posterPath: null,
    visibility: extra.private ? 'private' : 'house',
    audienceIds: extra.audience,
  })
  assert.ok(inserted)
  return addUploadedVideo({
    id: slug,
    title: slug,
    channelId: channelSlug,
    durationSec: 12,
    thumb: '',
    tags: ['trips'],
    file: `uploads/${channelSlug}/${slug}.mp4`,
    postedBy: person.id,
    private: extra.private,
    audience: extra.audience,
  })
}

describe('Removed Person library', () => {
  it('keeps the Home channel Frozen at the same slug, with Videos, and nobody may post or change title and Tags', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    let video = await postVideo(alex, 'issue-29-home')

    let result = await removePerson(sam.id, alex.id)
    assert.equal(result, true)

    let frozen = getChannel(alex.slug)
    assert.ok(frozen)
    assert.equal(frozen.kind, 'person')
    assert.equal(frozen.name, 'Alex')
    assert.equal(getChannel(alex.id)?.id, alex.slug)
    assert.ok(getChannels().some((channel) => channel.id === alex.slug))
    assert.equal(getVideo(video.id)?.channelId, alex.slug)
    assert.equal(canPost(frozen, sam.id), false)
    assert.equal(canPost(frozen, alex.id), false)
    assert.equal(canEditVideoTitle(video, sam.id), false)
    assert.equal(canEditVideoTags(video, sam.id), false)
    assert.equal(canEditVideo(video, sam.id), false)

    resetHousehold()
    resetChannels()
    await loadCataloguePeople()
    await loadCatalogueChannels()
    let restored = getChannel(alex.slug)
    assert.ok(restored)
    assert.equal(restored.kind, 'person')
    assert.equal(restored.name, 'Alex')
    assert.equal(canPost(restored, sam.id), false)
  })

  it('transfers Custom channels to the acting Admin, drops the Removed Person from Managers and Audiences, and leaves the posted name', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    let riley = await join('Riley')
    let channel = await createChannel(alex.id, {
      name: 'Board Games',
      description: 'Catan nights.',
      managerIds: [riley.id],
    })
    assert.ok(!('error' in channel))
    let posted = await postVideo(alex, 'issue-29-custom', channel.id)
    let secret = await postVideo(sam, 'issue-29-secret', sam.slug, { private: true, audience: [alex.id] })

    let result = await removePerson(sam.id, alex.id)
    assert.equal(result, true)

    let transferred = getChannel(channel.id)
    assert.ok(transferred)
    assert.equal(transferred.ownerId, sam.id)
    assert.deepEqual(transferred.managerIds, [riley.id])
    assert.equal(canPost(transferred, sam.id), true)
    assert.equal(canPost(transferred, riley.id), true)
    assert.equal(canEditVideo(posted, sam.id), true)
    assert.equal(getChannel(posted.postedBy!)?.name, 'Alex')
    assert.deepEqual(getVideo(secret.id)?.audience, [])
    assert.equal(canWatch(secret, alex.id), false)

    resetHousehold()
    resetChannels()
    await loadCataloguePeople()
    await loadCatalogueChannels()
    let restored = getChannel(channel.id)
    assert.ok(restored)
    assert.equal(restored.ownerId, sam.id)
    assert.deepEqual(restored.managerIds, [riley.id])
    assert.equal(getChannel(alex.id)?.name, 'Alex')
  })

  it('deletes their Playlists and History, including after reload', async () => {
    let sam = await join('Sam')
    let alex = await join('Alex')
    let video = await postVideo(alex, 'issue-29-watch')
    let own = await createPlaylist(alex.id, { name: 'Alex nights', description: '', visibility: 'private' }, video.id)
    let shared = await createPlaylist(sam.id, {
      name: 'House nights',
      description: '',
      visibility: 'private',
      audienceIds: [alex.id],
    })
    assert.ok(!('error' in own) && !('error' in shared))
    assert.deepEqual(getPlaylist(shared.id)?.audience, [alex.id])

    let start = Date.now()
    await recordWatchStart(alex.id, video, start)
    await recordWatchProgress(alex.id, video, 8, undefined, start + 8_000)
    assert.ok(sessionsFor(alex.id).length > 0)
    assert.ok(sittingsFor(alex.id, '', start + 8_000).length > 0)

    let result = await removePerson(sam.id, alex.id)
    assert.equal(result, true)
    assert.equal(getPlaylist(own.id), undefined)
    assert.deepEqual(playlistsOwnedBy(alex.id), [])
    assert.deepEqual(getPlaylist(shared.id)?.audience, [])
    assert.deepEqual(sessionsFor(alex.id), [])
    assert.deepEqual(sittingsFor(alex.id, '', start + 8_000), [])

    resetPlaylists()
    resetHistory()
    resetHousehold()
    resetChannels()
    await loadCataloguePeople()
    await loadCataloguePlaylists()
    await loadCatalogueHistory()
    assert.equal(getPlaylist(own.id), undefined)
    assert.deepEqual(getPlaylist(shared.id)?.audience ?? [], [])
    assert.deepEqual(sessionsFor(alex.id), [])
    assert.equal(getPerson(alex.id), undefined)
  })
})
