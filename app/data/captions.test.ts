import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readCaptionsBytes } from './captions.ts'

describe('readCaptionsBytes', () => {
  it('accepts a WebVTT file with a BOM and Windows newlines', () => {
    let text = '\uFEFFWEBVTT\r\n\r\n00:00:00.000 --> 00:00:01.000\r\nHi\r\n'
    let result = readCaptionsBytes(new TextEncoder().encode(text))
    assert.equal('text' in result, true)
    if ('text' in result) {
      assert.match(result.text, /^WEBVTT\n/)
      assert.match(result.text, /Hi/)
    }
  })

  it('rejects a file that is not WebVTT', () => {
    let result = readCaptionsBytes(new TextEncoder().encode('1\n00:00:00,000 --> 00:00:01,000\nHi\n'))
    assert.deepEqual(result, { error: 'That isn’t a WebVTT subtitles file. The first line has to be WEBVTT.' })
  })

  it('rejects an empty file', () => {
    assert.deepEqual(readCaptionsBytes(new Uint8Array()), { error: 'Choose a .vtt subtitles file.' })
  })
})
