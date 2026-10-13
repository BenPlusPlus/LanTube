import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { hashPassword, verifyPasswordHash } from './password.ts'

describe('password hashing', () => {
  it('stores argon2id and verifies the original password', () => {
    let password = 'lantern'
    let hash = hashPassword(password)

    assert.match(hash, /^\$argon2id\$v=19\$/)
    assert.ok(!hash.includes(password))
    assert.equal(verifyPasswordHash(hash, password), true)
    assert.equal(verifyPasswordHash(hash, 'wrong-password'), false)
  })
})
