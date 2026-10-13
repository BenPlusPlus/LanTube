import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { insertUploadedVideo } from './catalogue.ts'
import { createPerson, resetHousehold, useEmptyHouse, type Person } from './household.ts'
import { addUploadedVideo, deleteVideo, resetChannels } from './library.ts'
import {
  addVideo,
  createPlaylist,
  getPlaylist,
  housePlaylists,
  loadCataloguePlaylists,
  playlistsOwnedBy,
  removeVideo,
  resetPlaylists,
  updatePlaylist,
} from './playlists.ts'

const created: string[] = []

afterEach(async () => {
  for (let id of created.splice(0)) deleteVideo(id)
  await useEmptyHouse()
  resetHousehold()
  resetChannels()
  resetPlaylists()
})

async function join(name: string) {
  let person = await createPerson(name, 'lantern')
  assert.ok(!('error' in person))
  assert.notEqual(person.id, person.slug)
  return person
}

async function clipFor(person: Person, slug: string) {
  created.push(slug)
  let inserted = await insertUploadedVideo({
    slug,
    title: slug,
    channelSlug: person.slug,
    ownerId: person.id,
    durationSec: 12,
    filePath: `uploads/${person.slug}/${slug}.mp4`,
    posterPath: null,
    visibility: 'house',
  })
  assert.ok(inserted)
  addUploadedVideo({
    id: slug,
    title: slug,
    channelId: person.slug,
    durationSec: 12,
    thumb: '',
    tags: [],
    file: `uploads/${person.slug}/${slug}.mp4`,
    postedBy: person.id,
  })
}

describe('catalogue playlists', () => {
  it('keeps a catalogue Person’s playlist after reload', async () => {
    await useEmptyHouse()
    let owner = await join('Sam')
    await clipFor(owner, 'issue-21-lake')
    let createdPlaylist = await createPlaylist(
      owner.id,
      { name: 'Lake days', description: 'The quiet ones.', visibility: 'private' },
      'issue-21-lake',
    )
    assert.ok(!('error' in createdPlaylist))
    assert.equal(createdPlaylist.ownerId, owner.id)
    assert.equal(createdPlaylist.visibility, 'private')
    assert.deepEqual(createdPlaylist.videoIds, ['issue-21-lake'])

    resetPlaylists()
    assert.equal(getPlaylist(createdPlaylist.id), undefined)
    await loadCataloguePlaylists()
    let restored = getPlaylist(createdPlaylist.id)
    assert.ok(restored)
    assert.equal(restored.name, 'Lake days')
    assert.equal(restored.ownerId, owner.id)
    assert.equal(restored.visibility, 'private')
    assert.equal(restored.description, 'The quiet ones.')
    assert.deepEqual(restored.videoIds, ['issue-21-lake'])
    assert.ok(playlistsOwnedBy(owner.id).some((playlist) => playlist.id === restored.id))
    assert.equal(
      housePlaylists().some((playlist) => playlist.id === restored.id),
      false,
    )
  })

  it('persists add, remove, and house-list order after a visibility change', async () => {
    await useEmptyHouse()
    let sam = await join('Sam')
    let alex = await join('Alex')
    await clipFor(sam, 'issue-21-one')
    await clipFor(sam, 'issue-21-two')

    let sams = await createPlaylist(sam.id, { name: 'Sam’s trips', description: '', visibility: 'public' })
    let alexs = await createPlaylist(alex.id, { name: 'Alex’s clips', description: '', visibility: 'public' })
    assert.ok(!('error' in sams) && !('error' in alexs))
    assert.equal(housePlaylists(sam.id)[0]?.id, alexs.id)

    assert.equal(await addVideo(sams, 'issue-21-one'), true)
    assert.equal(housePlaylists(alex.id)[0]?.id, sams.id)
    assert.deepEqual(getPlaylist(sams.id)?.videoIds, ['issue-21-one'])

    assert.equal(await addVideo(sams, 'issue-21-two'), true)
    assert.equal(await removeVideo(sams, 'issue-21-one'), true)

    let hidden = await updatePlaylist(sams, { name: sams.name, description: '', visibility: 'private' })
    assert.ok(!('error' in hidden))
    assert.equal(
      housePlaylists(alex.id).some((playlist) => playlist.id === sams.id),
      false,
    )
    assert.ok(playlistsOwnedBy(sam.id).some((playlist) => playlist.id === sams.id))

    resetPlaylists()
    await loadCataloguePlaylists()
    let restored = getPlaylist(sams.id)
    assert.ok(restored)
    assert.equal(restored.visibility, 'private')
    assert.deepEqual(restored.videoIds, ['issue-21-two'])
    assert.equal(restored.activity.kind, 'unshared')
    assert.equal(
      housePlaylists(alex.id).some((playlist) => playlist.id === sams.id),
      false,
    )
    assert.equal(housePlaylists(sam.id)[0]?.id, alexs.id)
    assert.ok(playlistsOwnedBy(sam.id).some((playlist) => playlist.id === sams.id))
  })
})
