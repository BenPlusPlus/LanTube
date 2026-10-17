import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { listenHost, readHostConfig } from './config.ts'
import { attachFolder } from './data/folders.ts'
import { createPerson, resetHousehold, useEmptyHouse } from './data/household.ts'
import { clearFolderChannels, deleteVideo, getVideo, resetChannels, videos } from './data/library.ts'
import { mediaDir } from './data/media.ts'
import { channels, people, videos as videoTable } from './data/tables.ts'
import { db, loadCatalogueMigrations, sqlWithLf } from './db.ts'
import { prepareHost } from './host.ts'

describe('catalogue migrations', () => {
  it('keeps applied up.sql as LF so Remix checksums match the Host journal', async () => {
    let dir = fileURLToPath(new URL('../db/migrations/', import.meta.url))
    let names = (await fsp.readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    assert.ok(names.length > 0)
    for (let name of names) {
      let bytes = await fsp.readFile(path.join(dir, name, 'up.sql'))
      assert.equal(bytes.includes(13), false, `${name}/up.sql contains CR`)
    }
  })

  it('checksums CRLF up.sql as LF so a Windows save does not drift the journal', () => {
    let lf = 'create table watch_limits (\n  person_id uuid primary key\n);\n'
    let crlf = 'create table watch_limits (\r\n  person_id uuid primary key\r\n);\r\n'
    assert.equal(sqlWithLf(crlf), lf)
    assert.equal(sqlWithLf(lf), lf)
  })

  it('loads catalogue migrations with CR stripped before Remix checksums them', async () => {
    let migrations = await loadCatalogueMigrations()
    assert.ok(migrations.length > 0)
    for (let migration of migrations) {
      assert.equal(migration.up.includes('\r'), false, `${migration.id} up contains CR`)
      if (migration.down !== undefined) {
        assert.equal(migration.down.includes('\r'), false, `${migration.id} down contains CR`)
      }
    }
  })
})

describe('host config', () => {
  it('refuses production start when DATABASE_URL is missing', () => {
    assert.throws(
      () =>
        readHostConfig({
          NODE_ENV: 'production',
          LANTUBE_MEDIA_DIR: './media',
          SESSION_SECRET: 'secret',
        }),
      /DATABASE_URL/,
    )
  })

  it('refuses production start when LANTUBE_MEDIA_DIR is missing', () => {
    assert.throws(
      () =>
        readHostConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgres://localhost/lantube',
          SESSION_SECRET: 'secret',
        }),
      /LANTUBE_MEDIA_DIR/,
    )
  })

  it('refuses production start when SESSION_SECRET is missing', () => {
    assert.throws(
      () =>
        readHostConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgres://localhost/lantube',
          LANTUBE_MEDIA_DIR: './media',
        }),
      /SESSION_SECRET/,
    )
  })

  it('defaults development DATABASE_URL and LANTUBE_MEDIA_DIR', () => {
    let config = readHostConfig({ NODE_ENV: 'development', SESSION_SECRET: 'dev' })
    assert.equal(config.databaseUrl, 'postgres://localhost/lantube')
    assert.equal(config.mediaDir, './media')
  })

  it('binds production to all interfaces when HOST is unset', () => {
    assert.equal(listenHost({ NODE_ENV: 'production' }), '0.0.0.0')
  })

  it('uses HOST when it is set', () => {
    assert.equal(listenHost({ NODE_ENV: 'production', HOST: '127.0.0.1' }), '127.0.0.1')
  })

  it('leaves the development listen address to Node', () => {
    assert.equal(listenHost({ NODE_ENV: 'development' }), undefined)
  })
})

describe('host start', () => {
  it('does not migrate when production config is incomplete', async () => {
    let migrated = false
    await assert.rejects(
      () =>
        prepareHost({
          env: { NODE_ENV: 'production', SESSION_SECRET: 'secret', LANTUBE_MEDIA_DIR: './media' },
          migrate: async () => {
            migrated = true
          },
        }),
      /DATABASE_URL/,
    )
    assert.equal(migrated, false)
  })

  it('applies catalogue migrations before becoming ready to listen', async () => {
    let order: string[] = []
    await prepareHost({
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://localhost/lantube_test',
        LANTUBE_MEDIA_DIR: 'test/fixtures/media',
        SESSION_SECRET: 'test',
      },
      migrate: async () => {
        order.push('migrate')
      },
    })
    order.push('ready')
    assert.deepEqual(order, ['migrate', 'ready'])
  })

  it('does not become ready when a migration fails', async () => {
    await assert.rejects(
      () =>
        prepareHost({
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgres://localhost/lantube_test',
            LANTUBE_MEDIA_DIR: 'test/fixtures/media',
            SESSION_SECRET: 'test',
          },
          migrate: async () => {
            throw new Error('migration failed')
          },
        }),
      /migration failed/,
    )
  })

  it('does not insert People, Videos, or Folders when applying migrations', async () => {
    let before = {
      people: await db.count(people),
      videos: await db.count(videoTable),
      folders: await db.count(channels, { where: { kind: 'folder' } }),
    }
    await prepareHost()
    assert.equal(await db.count(people), before.people)
    assert.equal(await db.count(videoTable), before.videos)
    assert.equal(await db.count(channels, { where: { kind: 'folder' } }), before.folders)
  })
})

describe('host folder scan', () => {
  const scanDirName = 'cabin-tapes'
  const scanDir = path.join(mediaDir, scanDirName)

  afterEach(async () => {
    for (let video of [...videos]) {
      if (video.channelId === 'cabin-tapes') deleteVideo(video.id)
    }
    resetChannels()
    await fsp.rm(scanDir, { recursive: true, force: true })
    await useEmptyHouse()
    resetHousehold()
  })

  it('indexes attached Folder videos when the Host becomes ready to listen', async () => {
    await useEmptyHouse()
    resetHousehold()
    resetChannels()
    clearFolderChannels()
    await fsp.mkdir(scanDir, { recursive: true })
    await fsp.copyFile(path.join(mediaDir, 'tahoe-day-2.mp4'), path.join(scanDir, 'cabin-weekend.mp4'))
    let person = await createPerson('Sam', 'lantern')
    assert.ok(!('error' in person))
    let folder = await attachFolder({ path: scanDirName, name: 'Cabin tapes' })
    assert.ok(!('error' in folder))
    assert.equal(getVideo('cabin-weekend'), undefined)

    resetChannels()
    clearFolderChannels()
    await prepareHost()

    let video = getVideo('cabin-weekend')
    assert.ok(video)
    assert.equal(video.channelId, 'cabin-tapes')
    assert.equal(video.postedBy, undefined)
    assert.equal(video.file, 'cabin-tapes/cabin-weekend.mp4')
  })
})
