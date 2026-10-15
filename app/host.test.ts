import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { listenHost, readHostConfig } from './config.ts'
import { db } from './db.ts'
import { channels, people, videos } from './data/tables.ts'
import { prepareHost } from './host.ts'

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
      videos: await db.count(videos),
      folders: await db.count(channels, { where: { kind: 'folder' } }),
    }
    await prepareHost()
    assert.equal(await db.count(people), before.people)
    assert.equal(await db.count(videos), before.videos)
    assert.equal(await db.count(channels, { where: { kind: 'folder' } }), before.folders)
  })
})
