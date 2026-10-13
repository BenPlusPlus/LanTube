import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { getPerson } from './household.ts'
import {
  addUploadedVideo,
  canWatch,
  deleteVideo,
  getVideo,
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

  it('leaves a house-visible Video visible to anyone on the LAN', () => {
    let video = getVideo('tahoe-day-2')!
    assert.equal(canWatch(video, undefined), true)
    assert.equal(canWatch(video, 'tomas'), true)
  })
})
