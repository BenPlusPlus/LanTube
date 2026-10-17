import { fileURLToPath } from 'node:url'

import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

let connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === 'test' ? 'postgres://localhost/lantube_test' : 'postgres://localhost/lantube')

export const db = createPostgresDatabase({
  connectionString,
})

/** Remix checksums `up.sql` bytes, so Host start hashes LF newlines. */
export function sqlWithLf(sql: string): string {
  return sql.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

export async function loadCatalogueMigrations() {
  let migrations = await loadMigrations(fileURLToPath(new URL('../db/migrations/', import.meta.url)))
  return migrations.map((migration) => ({
    ...migration,
    up: sqlWithLf(migration.up),
    down: migration.down === undefined ? undefined : sqlWithLf(migration.down),
  }))
}

export async function migrateCatalogue() {
  await db.migrate(await loadCatalogueMigrations())
}
