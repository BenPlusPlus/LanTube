import { readHostConfig } from './config.ts'
import { loadHouseSettings } from './data/brand.ts'
import { loadCatalogueVideos } from './data/catalogue.ts'
import { scanAttachedFolders } from './data/folders.ts'
import { loadCatalogueHistory } from './data/history.ts'
import { loadCataloguePeople } from './data/household.ts'
import { loadCatalogueChannels } from './data/library.ts'
import { loadCataloguePlaylists } from './data/playlists.ts'
import { loadCatalogueWatchLimits } from './data/watch-limits.ts'
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
    await loadHouseSettings()
    await loadCataloguePeople()
    await loadCatalogueChannels()
    await loadCatalogueVideos()
    await scanAttachedFolders()
    await loadCataloguePlaylists()
    await loadCatalogueHistory()
    await loadCatalogueWatchLimits()
  }
}
