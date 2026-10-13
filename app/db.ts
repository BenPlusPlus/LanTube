import { fileURLToPath } from 'node:url'

import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

let connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === 'test' ? 'postgres://localhost/lantube_test' : 'postgres://localhost/lantube')

export const db = createPostgresDatabase({
  connectionString,
})

export async function migrateCatalogue() {
  let migrations = await loadMigrations(fileURLToPath(new URL('../db/migrations/', import.meta.url)))
  await db.migrate(migrations)
}
