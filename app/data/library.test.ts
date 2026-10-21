import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { createPerson, getPerson, removePerson, resetHousehold, updatePersonRoles, useEmptyHouse } from './household.ts'
import {
  addUploadedVideo,
  canAdminDeleteChannel,
  canDeleteCustomChannel,
  canDeleteVideo,
  canDropFolderVideo,
  canEditVideo,
  canEditVideoTags,
  canEditVideoTitle,
  canPost,
  canWatch,
  createChannel,
  deleteVideo,
  getChannel,
  getVideo,
  loadCatalogueChannels,
  resetChannels,
  updateChannel,
  visibleVideos,
  type Video,
} from './library.ts'

const created: string[] = []

afterEach(() => {
  for (let id of created.splice(0)) deleteVideo(id)
})

function clip(input: Partial<Video> & Pick<Video, 'id' | 'postedBy'>): Video {
  created.push(input.id)
  return addUploadedVideo({
    title: 'Secret clip',
    channelId: 'mia',
    durationSec: 12,
    thumb: '',
    tags: [],
    private: true,
    ...input,
  })
}

describe('private Video entitlement', () => {
  it('lets the Video owner watch a private Video with an empty Audience', () => {
    let video = clip({ id: 'entitlement-owner', postedBy: 'mia' })
    assert.equal(canWatch(video, 'mia'), true)
    assert.equal(canWatch(video, 'tomas'), false)
    assert.equal(canWatch(video, undefined), false)
    assert.equal(canWatch(video, null), false)
    assert.ok(visibleVideos('mia').some((entry) => entry.id === video.id))
    assert.equal(
      visibleVideos('tomas').some((entry) => entry.id === video.id),
      false,
    )
    assert.equal(
      visibleVideos(undefined).some((entry) => entry.id === video.id),
      false,
    )
  })

  it('lets a named Audience watch and keeps everyone else out', () => {
    let video = clip({ id: 'entitlement-audience', postedBy: 'mia', audience: ['tomas'] })
    assert.equal(canWatch(video, 'mia'), true)
    assert.equal(canWatch(video, 'tomas'), true)
    assert.equal(canWatch(video, 'ruth'), false)
    assert.ok(visibleVideos('tomas').some((entry) => entry.id === video.id))
    assert.equal(
      visibleVideos('ruth').some((entry) => entry.id === video.id),
      false,
    )
  })

  it('lets a Parent watch a private Video they are not named on', () => {
    let video = clip({ id: 'entitlement-parent', postedBy: 'mia', audience: ['tomas'] })
    let ruth = getPerson('ruth')!
    ruth.isParent = true
    try {
      assert.equal(canWatch(video, 'ruth'), true)
      assert.ok(visibleVideos('ruth').some((entry) => entry.id === video.id))
    } finally {
      delete ruth.isParent
    }
  })

  it('does not let Admin grant sight of a private Video', () => {
    let video = clip({ id: 'entitlement-admin', postedBy: 'tomas' })
    let mia = getPerson('mia')!
    mia.isAdmin = true
    try {
      assert.equal(canWatch(video, 'mia'), false)
      assert.equal(
        visibleVideos('mia').some((entry) => entry.id === video.id),
        false,
      )
    } finally {
      delete mia.isAdmin
    }
  })

  it('keeps another Person’s private Video hidden from an Admin who is not a Parent', async () => {
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    try {
      let sam = await createPerson('Sam', 'lantern')
      let alex = await createPerson('Alex', 'lantern')
      assert.ok(!('error' in sam) && !('error' in alex))
      assert.equal(sam.isAdmin, true)
      assert.equal(sam.isParent, false)
      let video = clip({
        id: 'entitlement-admin-not-parent',
        postedBy: alex.id,
        channelId: alex.slug,
      })
      assert.equal(canWatch(video, alex.id), true)
      assert.equal(canWatch(video, sam.id), false)
      assert.equal(
        visibleVideos(sam.id).some((entry) => entry.id === video.id),
        false,
      )

      let parent = await updatePersonRoles(sam.id, sam.id, { isAdmin: true, isParent: true })
      assert.ok(!('error' in parent))
      assert.equal(canWatch(video, sam.id), true)
    } finally {
      await useEmptyHouse()
      resetHousehold()
      resetChannels()
    }
  })

  it('leaves a house-visible Video visible to anyone on the LAN', () => {
    let video = getVideo('tahoe-day-2')!
    assert.equal(canWatch(video, undefined), true)
    assert.equal(canWatch(video, 'tomas'), true)
  })

  it('lets a Custom channel owner and Managers watch a private Video they did not post', () => {
    let owners = clip({ id: 'entitlement-custom-owner', postedBy: 'priya', channelId: 'twice' })
    let managers = clip({ id: 'entitlement-custom-manager', postedBy: 'mia', channelId: 'twice' })
    assert.equal(canWatch(owners, 'mia'), true)
    assert.equal(canWatch(managers, 'priya'), true)
    assert.equal(canWatch(owners, 'tomas'), false)
    assert.equal(canWatch(managers, 'tomas'), false)
    assert.ok(visibleVideos('mia').some((entry) => entry.id === owners.id))
    assert.ok(visibleVideos('priya').some((entry) => entry.id === managers.id))
    assert.equal(
      visibleVideos('tomas').some((entry) => entry.id === owners.id || entry.id === managers.id),
      false,
    )
  })

  it('keeps the Video owner able to watch their Video after they stop being a Manager', async () => {
    let channel = getChannel('twice')!
    let own = clip({ id: 'entitlement-ex-manager-own', postedBy: 'priya', channelId: 'twice' })
    let other = clip({ id: 'entitlement-ex-manager-other', postedBy: 'mia', channelId: 'twice' })
    await updateChannel(channel, { name: channel.name, description: channel.description ?? '', managerIds: [] })
    try {
      assert.equal(canWatch(own, 'priya'), true)
      assert.equal(canWatch(other, 'priya'), false)
      assert.equal(canWatch(other, 'mia'), true)
      assert.equal(canPost(channel, 'priya'), false)
      assert.equal(canPost(channel, 'mia'), true)
      assert.ok(visibleVideos('priya').some((entry) => entry.id === own.id))
      assert.equal(
        visibleVideos('priya').some((entry) => entry.id === other.id),
        false,
      )
    } finally {
      resetChannels()
    }
  })
})

describe('who may delete a Video', () => {
  it('lets the Video owner delete an uploaded Video and keeps unsigned people out', () => {
    let video = clip({ id: 'delete-owner', postedBy: 'mia', channelId: 'mia' })
    assert.equal(canDeleteVideo(video, 'mia'), true)
    assert.equal(canDeleteVideo(video, 'tomas'), false)
    assert.equal(canDeleteVideo(video, undefined), false)
    assert.equal(canDeleteVideo(video, null), false)
  })

  it('lets a Custom channel owner and Managers delete a Video they did not post', () => {
    let video = clip({ id: 'delete-custom', postedBy: 'priya', channelId: 'twice' })
    assert.equal(canDeleteVideo(video, 'priya'), true)
    assert.equal(canDeleteVideo(video, 'mia'), true)
    assert.equal(canDeleteVideo(video, 'tomas'), false)
    assert.equal(canDeleteVideo(video, 'ruth'), false)
  })

  it('does not let anyone drop a Folder Video this way', () => {
    let video = getVideo('christmas-2009')!
    assert.equal(canDeleteVideo(video, 'mia'), false)
    assert.equal(canDeleteVideo(video, 'tomas'), false)
  })

  it('keeps the Video owner able to delete after they stop being a Manager', async () => {
    let channel = getChannel('twice')!
    let own = clip({ id: 'delete-ex-manager-own', postedBy: 'priya', channelId: 'twice' })
    let other = clip({ id: 'delete-ex-manager-other', postedBy: 'mia', channelId: 'twice' })
    await updateChannel(channel, { name: channel.name, description: channel.description ?? '', managerIds: [] })
    try {
      assert.equal(canDeleteVideo(own, 'priya'), true)
      assert.equal(canDeleteVideo(other, 'priya'), false)
      assert.equal(canDeleteVideo(other, 'mia'), true)
    } finally {
      resetChannels()
    }
  })
})

describe('who may change a Folder Video', () => {
  it('lets only an Admin change the title', () => {
    let video = getVideo('christmas-2009')!
    let mia = getPerson('mia')!
    mia.isAdmin = true
    try {
      assert.equal(canEditVideoTitle(video, 'mia'), true)
      assert.equal(canEditVideoTitle(video, 'leo'), false)
      assert.equal(canEditVideoTitle(video, undefined), false)
      assert.equal(canEditVideoTitle(video, null), false)
    } finally {
      delete mia.isAdmin
    }
  })

  it('lets any signed-in Person attach Tags and keeps unsigned people out', () => {
    let video = getVideo('christmas-2009')!
    assert.equal(canEditVideoTags(video, 'leo'), true)
    assert.equal(canEditVideoTags(video, 'mia'), true)
    assert.equal(canEditVideoTags(video, undefined), false)
    assert.equal(canEditVideoTags(video, null), false)
  })

  it('lets only an Admin drop a Folder Video from the catalogue', () => {
    let video = getVideo('christmas-2009')!
    let mia = getPerson('mia')!
    mia.isAdmin = true
    try {
      assert.equal(canDropFolderVideo(video, 'mia'), true)
      assert.equal(canDropFolderVideo(video, 'leo'), false)
      assert.equal(canDropFolderVideo(video, undefined), false)
      assert.equal(canDeleteVideo(video, 'mia'), false)
    } finally {
      delete mia.isAdmin
    }
  })

  it('keeps uploaded title, Tags, and visibility with the Video owner', () => {
    let video = clip({ id: 'folder-rights-uploaded', postedBy: 'mia', channelId: 'mia' })
    assert.equal(canEditVideo(video, 'mia'), true)
    assert.equal(canEditVideoTitle(video, 'mia'), true)
    assert.equal(canEditVideoTags(video, 'mia'), true)
    assert.equal(canEditVideoTitle(video, 'leo'), false)
    assert.equal(canEditVideoTags(video, 'leo'), false)
    assert.equal(canDropFolderVideo(video, 'mia'), false)
  })
})

describe('who may delete a Custom channel', () => {
  it('lets only the Channel owner delete it from the edit form', () => {
    let channel = getChannel('twice')!
    assert.equal(canDeleteCustomChannel(channel, 'mia'), true)
    assert.equal(canDeleteCustomChannel(channel, 'priya'), false)
    assert.equal(canDeleteCustomChannel(channel, 'tomas'), false)
    assert.equal(canDeleteCustomChannel(channel, 'ruth'), false)
    assert.equal(canDeleteCustomChannel(channel, undefined), false)
  })

  it('does not offer delete on a Home channel', () => {
    let home = getChannel('mia')!
    assert.equal(canDeleteCustomChannel(home, 'mia'), false)
    let mia = getPerson('mia')!
    mia.isAdmin = true
    try {
      assert.equal(canAdminDeleteChannel(home, 'mia'), false)
    } finally {
      delete mia.isAdmin
    }
  })

  it('lets an Admin delete a Custom channel they do not own', () => {
    let channel = getChannel('twice')!
    let tomas = getPerson('tomas')!
    tomas.isAdmin = true
    try {
      assert.equal(canAdminDeleteChannel(channel, 'tomas'), true)
      assert.equal(canDeleteCustomChannel(channel, 'tomas'), false)
      assert.equal(canAdminDeleteChannel(channel, 'priya'), false)
      assert.equal(canAdminDeleteChannel(channel, undefined), false)
    } finally {
      delete tomas.isAdmin
    }
  })

  it('lets an Admin delete a Frozen Home channel and keeps a live Home channel', async () => {
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    try {
      let sam = await createPerson('Sam', 'lantern')
      let alex = await createPerson('Alex', 'lantern')
      assert.ok(!('error' in sam) && !('error' in alex))
      assert.equal(await removePerson(sam.id, alex.id), true)
      let frozen = getChannel('alex')!
      assert.equal(frozen.kind, 'person')
      assert.equal(canAdminDeleteChannel(frozen, sam.id), true)
      assert.equal(canAdminDeleteChannel(frozen, undefined), false)
      assert.equal(canAdminDeleteChannel(getChannel('sam')!, sam.id), false)
    } finally {
      await useEmptyHouse()
      resetHousehold()
      resetChannels()
    }
  })
})

describe('Custom channel Managers', () => {
  afterEach(() => {
    resetChannels()
  })

  it('lets the Channel owner and Managers post, and keeps everyone else out', () => {
    let channel = getChannel('twice')!
    assert.equal(canPost(channel, 'mia'), true)
    assert.equal(canPost(channel, 'priya'), true)
    assert.equal(canPost(channel, 'tomas'), false)
    assert.equal(canPost(channel, undefined), false)
  })

  it('creates a Custom channel whose owner is not a Manager', async () => {
    let created = await createChannel('leo', { name: 'Board Games', description: '', managerIds: ['priya', 'leo'] })
    assert.ok(!('error' in created))
    assert.equal(created.kind, 'custom')
    assert.equal(created.ownerId, 'leo')
    assert.deepEqual(created.managerIds, ['priya'])
    assert.equal(canPost(created, 'leo'), true)
    assert.equal(canPost(created, 'priya'), true)
    assert.equal(canPost(created, 'mia'), false)
  })

  it('restores a Custom channel and its Managers after reload', async () => {
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    try {
      let owner = await createPerson('Sam', 'lantern')
      let manager = await createPerson('Alex', 'lantern')
      assert.ok(!('error' in owner) && !('error' in manager))
      let created = await createChannel(owner.id, {
        name: 'Board Games',
        description: 'Catan nights.',
        managerIds: [manager.id],
      })
      assert.ok(!('error' in created))
      resetChannels()
      assert.equal(getChannel(created.id), undefined)
      await loadCatalogueChannels()
      let restored = getChannel(created.id)
      assert.ok(restored)
      assert.equal(restored.name, 'Board Games')
      assert.equal(restored.ownerId, owner.id)
      assert.deepEqual(restored.managerIds, [manager.id])
      assert.equal(canPost(restored, manager.id), true)
      assert.equal(canPost(restored, owner.id), true)
    } finally {
      await useEmptyHouse()
      resetHousehold()
      resetChannels()
    }
  })
})
