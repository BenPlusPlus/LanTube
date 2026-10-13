import { readHostConfig } from './config.ts'
import { loadCataloguePeople } from './data/household.ts'
import { migrateCatalogue } from './db.ts'

export async function prepareHost(
  options: {
    env?: NodeJS.ProcessEnv
    migrate?: () => Promise<void>
  } = {},
) {
  readHostConfig(options.env ?? process.env)
  await (options.migrate ?? migrateCatalogue)()
  if (!options.migrate) await loadCataloguePeople()
}
