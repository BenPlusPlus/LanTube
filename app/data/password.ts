import { argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const MEMORY_KIB = 19_456
const PASSES = 2
const PARALLELISM = 1
const TAG_LENGTH = 32
const SALT_LENGTH = 16

function b64(buf: Buffer) {
  return buf.toString('base64').replace(/=+$/, '')
}

function fromB64(value: string) {
  return Buffer.from(value + '='.repeat((4 - (value.length % 4)) % 4), 'base64')
}

/** argon2id PHC string. Never log the password or the hash. */
export function hashPassword(password: string): string {
  let salt = randomBytes(SALT_LENGTH)
  let hash = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: salt,
    parallelism: PARALLELISM,
    tagLength: TAG_LENGTH,
    memory: MEMORY_KIB,
    passes: PASSES,
  })
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${b64(salt)}$${b64(hash)}`
}

export function verifyPasswordHash(encoded: string, password: string): boolean {
  let match = encoded.match(/^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/)
  if (!match) return false
  let [, memory, passes, parallelism, saltB64, hashB64] = match
  let expected = fromB64(hashB64)
  let actual = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: fromB64(saltB64),
    parallelism: Number(parallelism),
    tagLength: expected.length,
    memory: Number(memory),
    passes: Number(passes),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
