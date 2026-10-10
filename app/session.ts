import { createCookie } from 'remix/cookie'
import { session } from 'remix/middleware/session'
import { createCookieSessionStorage } from 'remix/session-storage/cookie'

const secret = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev-lantube-session')

if (!secret) {
  throw new Error('SESSION_SECRET is required')
}

export const sessionCookie = createCookie('lt_session', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secrets: [secret],
})

export const sessionStorage = createCookieSessionStorage()

export const sessionMiddleware = session(sessionCookie, sessionStorage)
