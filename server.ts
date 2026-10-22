import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { listenHost } from './app/config.ts'
import { db } from './app/db.ts'
import { getPerson } from './app/data/household.ts'
import { prepareHost } from './app/host.ts'
import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const host = listenHost()
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

try {
  await prepareHost()
} catch (error) {
  console.error(error)
  await db.close().catch(() => {})
  process.exit(1)
}

if (process.env.NODE_ENV === 'test') {
  let ruth = getPerson('ruth')
  if (ruth) ruth.isParent = true
  let mia = getPerson('mia')
  if (mia) mia.isAdmin = true
  let tomas = getPerson('tomas')
  if (tomas) tomas.isAdmin = true
}

const server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }))

function onListening() {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  let shownHost = host ?? 'localhost'
  console.log(`Server listening on http://${shownHost}:${hmrProxyPort ?? port}`)
}

if (host) {
  server.listen(port, host, onListening)
} else {
  server.listen(port, onListening)
}

let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  server.close(() => {
    db.close().finally(() => process.exit(0))
  })
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
