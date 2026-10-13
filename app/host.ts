import { readHostConfig } from './config.ts'
import { loadCatalogueVideos } from './data/catalogue.ts'
import { loadCatalogueHistory } from './data/history.ts'
import { loadCataloguePeople } from './data/household.ts'
import { loadCatalogueChannels } from './data/library.ts'
import { loadCataloguePlaylists } from './data/playlists.ts'
import { migrateCatalogue } from './db.ts'

export async function prepareHost(
  options: {
    env?: NodeJS.ProcessEnv
    migrate?: () => Promise<void>
  } = {},
) {
  readHostConfig(options.env ?? process.env)
  await (options.migrate ?? migrateCatalogue)()
  if (!options.migrate) {
    await loadCataloguePeople()
    await loadCatalogueChannels()
    await loadCatalogueVideos()
    await loadCataloguePlaylists()
    await loadCatalogueHistory()
  }
}
