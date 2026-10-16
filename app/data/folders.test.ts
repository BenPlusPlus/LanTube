import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { createPerson, resetHousehold, useEmptyHouse } from './household.ts'
import {
  clearFolderChannels,
  deleteVideo,
  getChannel,
  getVideo,
  resetChannels,
  videos,
} from './library.ts'
import { mediaDir } from './media.ts'
import { loadCatalogueVideos, saveIndexedVideo } from './catalogue.ts'
import { attachFolder, dropIndexedVideo, scanFolder } from './folders.ts'
import { findOrCreateTags } from './tags.ts'

const scanDirName = 'cabin-tapes'
const scanDir = path.join(mediaDir, scanDirName)
const scanFile = path.join(scanDir, 'cabin-weekend.mp4')
const nestedFile = path.join(scanDir, 'more', 'lake.mp4')
const fixtureMp4 = path.join(mediaDir, 'tahoe-day-2.mp4')

async function seedScanDir() {
  await fsp.mkdir(path.join(scanDir, 'more'), { recursive: true })
  await fsp.copyFile(fixtureMp4, scanFile)
  await fsp.copyFile(fixtureMp4, nestedFile)
}

async function wipeScanDir() {
  await fsp.rm(scanDir, { recursive: true, force: true })
}

function forgetIndexed() {
  for (let video of [...videos]) {
    if (video.channelId === 'cabin-tapes') deleteVideo(video.id)
  }
  resetChannels()
}

async function attachedFolder() {
  await useEmptyHouse()
  resetHousehold()
  resetChannels()
  clearFolderChannels()
  await seedScanDir()
  let person = await createPerson('Sam', 'lantern')
  assert.ok(!('error' in person))
  let folder = await attachFolder({ path: scanDirName, name: 'Cabin tapes' })
  assert.ok(!('error' in folder))
  await scanFolder(folder)
  return folder
}

describe('folder scan and drop', () => {
  afterEach(async () => {
    forgetIndexed()
    await wipeScanDir()
    await useEmptyHouse()
    resetHousehold()
  })

  it('keeps catalogue title and Tags when rescan matches the same relative path', async () => {
    let folder = await attachedFolder()
    let weekend = getVideo('cabin-weekend')
    assert.ok(weekend)
    let tags = await findOrCreateTags(['Trips'])
    assert.equal(
      await saveIndexedVideo({
        slug: weekend.id,
        title: 'Cabin weekend',
        tagIds: tags.map((tag) => tag.id),
      }),
      true,
    )
    await scanFolder(folder)
    deleteVideo(weekend.id)
    await loadCatalogueVideos()

    let kept = getVideo('cabin-weekend')
    assert.ok(kept)
    assert.equal(kept.title, 'Cabin weekend')
    assert.deepEqual(kept.tags, ['trips'])
    assert.equal(kept.file, 'cabin-tapes/cabin-weekend.mp4')
  })

  it('indexes a new file with a filename title and no Tags', async () => {
    let folder = await attachedFolder()
    await fsp.copyFile(fixtureMp4, path.join(scanDir, 'dock-morning.mp4'))

    await scanFolder(folder)

    let added = getVideo('dock-morning')
    assert.ok(added)
    assert.equal(added.title, 'dock-morning')
    assert.deepEqual(added.tags, [])
    assert.equal(added.file, 'cabin-tapes/dock-morning.mp4')
    assert.equal(added.postedBy, undefined)
    assert.equal(added.private, undefined)
  })

  it('leaves a missing file in the catalogue until drop or rescan', async () => {
    await attachedFolder()
    assert.ok(getVideo('cabin-weekend'))
    await fsp.rm(scanFile)

    assert.ok(getVideo('cabin-weekend'))
    assert.equal(getVideo('cabin-weekend')?.file, 'cabin-tapes/cabin-weekend.mp4')
    assert.ok(getVideo('lake'))
  })

  it('drops a renamed path on rescan and creates a new Video with a filename title', async () => {
    let folder = await attachedFolder()
    let weekend = getVideo('cabin-weekend')
    assert.ok(weekend)
    let tags = await findOrCreateTags(['Kids'])
    assert.equal(
      await saveIndexedVideo({
        slug: weekend.id,
        title: 'Cabin weekend',
        tagIds: tags.map((tag) => tag.id),
      }),
      true,
    )
    weekend.title = 'Cabin weekend'
    weekend.tags = tags.map((tag) => tag.slug)

    await fsp.rename(scanFile, path.join(scanDir, 'porch-evening.mp4'))
    await scanFolder(folder)

    assert.equal(getVideo('cabin-weekend'), undefined)
    let renamed = getVideo('porch-evening')
    assert.ok(renamed)
    assert.equal(renamed.title, 'porch-evening')
    assert.deepEqual(renamed.tags, [])
    assert.equal(renamed.file, 'cabin-tapes/porch-evening.mp4')
  })

  it('drops missing paths from the catalogue on rescan and leaves the share files', async () => {
    let folder = await attachedFolder()
    await fsp.rm(scanFile)
    await scanFolder(folder)

    assert.equal(getVideo('cabin-weekend'), undefined)
    assert.ok(getVideo('lake'))
    await fsp.access(nestedFile)
    assert.equal(getChannel('cabin-tapes')?.kind, 'folder')
  })
})
