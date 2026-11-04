import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'

export interface PostPicturesProps {
  max: number
  invalid?: 'true'
  describedBy?: string
}

const accepted = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * The composer's picture well. Without JavaScript it is a plain multiple-file input.
 * With it, picks add up to the limit, each shows as a tile, and any tile can be taken out again.
 */
export const PostPictures = clientEntry(import.meta.url, function PostPictures(handle: Handle<PostPicturesProps>) {
  let chosen: { file: File; url: string }[] = []
  let dropped = 0

  function input() {
    let element = document.getElementById('post-pictures')
    return element instanceof HTMLInputElement ? element : null
  }

  /** The browser sends whatever the input holds, so the input always mirrors the tiles. */
  function sync() {
    let element = input()
    if (!element) return
    let transfer = new DataTransfer()
    for (let entry of chosen) transfer.items.add(entry.file)
    element.files = transfer.files
  }

  handle.queueTask(() => {
    handle.signal.addEventListener('abort', () => {
      for (let entry of chosen) URL.revokeObjectURL(entry.url)
    })
  })

  return () => {
    let { max, invalid, describedBy } = handle.props
    let full = chosen.length >= max
    return (
      <div class="ppics">
        {chosen.length > 0 ? (
          <ul class={`ppics-tiles ppics-tiles-${chosen.length}`} aria-label="Pictures to post">
            {chosen.map((entry, index) => (
              <li class="ppics-tile">
                <img src={entry.url} alt="" />
                <button
                  class="ppics-remove"
                  type="button"
                  aria-label={`Take out ${entry.file.name}`}
                  mix={[
                    on('click', () => {
                      URL.revokeObjectURL(entry.url)
                      chosen = chosen.filter((_, at) => at !== index)
                      dropped = 0
                      sync()
                      handle.update()
                      input()?.focus()
                    }),
                  ]}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div class="ppics-bar">
          <label class={`photo-well ppics-well${full ? ' is-full' : ''}`} for="post-pictures" aria-disabled={full ? 'true' : undefined}>
            <Icon name="image" size={20} />
            <span class="photo-well-text">
              {chosen.length === 0 ? 'Add pictures' : full ? `${max} of ${max} pictures` : `Add more (${chosen.length} of ${max})`}
            </span>
          </label>
          {dropped > 0 ? (
            <p class="ppics-note" role="status">
              Only {max} pictures fit on a post. {dropped === 1 ? 'One was' : `${dropped} were`} left out.
            </p>
          ) : null}
        </div>
        <input
          class="visually-hidden"
          id="post-pictures"
          type="file"
          name="pictures"
          accept={accepted}
          multiple
          aria-invalid={invalid}
          aria-describedby={describedBy}
          mix={[
            on('change', (event) => {
              let element = event.currentTarget as HTMLInputElement
              let picked = [...(element.files ?? [])].filter((file) => !chosen.some((entry) => entry.file === file))
              let room = Math.max(0, max - chosen.length)
              dropped = Math.max(0, picked.length - room)
              for (let file of picked.slice(0, room)) chosen.push({ file, url: URL.createObjectURL(file) })
              sync()
              handle.update()
            }),
          ]}
        />
      </div>
    )
  }
})
