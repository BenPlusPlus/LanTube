import { db, migrateCatalogue } from '../app/db.ts'

export async function globalSetup() {
  await migrateCatalogue()
}

export async function globalTeardown() {
  await db.close()
}
