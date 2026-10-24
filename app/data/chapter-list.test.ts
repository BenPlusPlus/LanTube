import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { chapterAt, chapterSpans, normalizeChapters } from '../ui/public/chapter-list.ts'

describe('normalizeChapters', () => {
  it('drops a single chapter because the seek bar needs a split', () => {
    assert.deepEqual(normalizeChapters([{ startSec: 0, title: 'Only' }]), [])
  })

  it('sorts, snaps a near-zero start, and fills a blank title', () => {
    assert.deepEqual(
      normalizeChapters([
        { startSec: 40, title: '  Two  ' },
        { startSec: 0.2, title: '   ' },
      ]),
      [
        { startSec: 0, title: 'Chapter 1' },
        { startSec: 40, title: 'Two' },
      ],
    )
  })
})

describe('chapterAt and chapterSpans', () => {
  let chapters = [
    { startSec: 0, title: 'Open' },
    { startSec: 10, title: 'Middle' },
    { startSec: 20, title: 'End' },
  ]

  it('names the chapter that contains the playhead', () => {
    assert.equal(chapterAt(chapters, 0, 30)?.title, 'Open')
    assert.equal(chapterAt(chapters, 10, 30)?.title, 'Middle')
    assert.equal(chapterAt(chapters, 19.9, 30)?.title, 'Middle')
    assert.equal(chapterAt(chapters, 20, 30)?.title, 'End')
  })

  it('fills the bar to duration', () => {
    assert.deepEqual(chapterSpans(chapters, 30), [
      { startSec: 0, endSec: 10, title: 'Open' },
      { startSec: 10, endSec: 20, title: 'Middle' },
      { startSec: 20, endSec: 30, title: 'End' },
    ])
  })
})
