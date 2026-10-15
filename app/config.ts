export type HostConfig = {
  nodeEnv: 'development' | 'test' | 'production'
  databaseUrl: string
  mediaDir: string
  sessionSecret: string
}

/** Address passed to `server.listen`. Production binds all interfaces so Docker and LAN clients can connect. */
export function listenHost(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.HOST) return env.HOST
  if (env.NODE_ENV === 'production') return '0.0.0.0'
  return undefined
}

export function readHostConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  let nodeEnv: HostConfig['nodeEnv'] =
    env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development'

  if (nodeEnv === 'production') {
    let missing = ['DATABASE_URL', 'LANTUBE_MEDIA_DIR', 'SESSION_SECRET'].filter((name) => !env[name])
    if (missing.length > 0) {
      throw new Error(`Production refuses to listen without ${missing.join(', ')}`)
    }
    return {
      nodeEnv,
      databaseUrl: env.DATABASE_URL as string,
      mediaDir: env.LANTUBE_MEDIA_DIR as string,
      sessionSecret: env.SESSION_SECRET as string,
    }
  }

  return {
    nodeEnv,
    databaseUrl:
      env.DATABASE_URL ?? (nodeEnv === 'test' ? 'postgres://localhost/lantube_test' : 'postgres://localhost/lantube'),
    mediaDir: env.LANTUBE_MEDIA_DIR ?? (nodeEnv === 'test' ? 'test/fixtures/media' : './media'),
    sessionSecret: env.SESSION_SECRET ?? (nodeEnv === 'test' ? 'test-lantube-session' : 'dev-lantube-session'),
  }
}
