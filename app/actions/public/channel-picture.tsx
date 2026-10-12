import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'
import { hueFor, initialOf } from '../../ui/public/identity.ts'

export interface ChannelPictureProps {
  /** The name field this preview follows as the person types. */
  nameInputId: string
  name: string
  /** A saved channel keeps its colour; a new one takes it from the name. */
  hue?: number
  photo?: string
  invalid?: 'true'
  describedBy?: string
}

function tidy(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

/** The picture row on the channel form: a live preview of the channel's avatar, then the picker. */
export const ChannelPicture = clientEntry(import.meta.url, function ChannelPicture(handle: Handle<ChannelPictureProps>) {
  let name = tidy(handle.props.name)
  let chosen: { url: string; fileName: string } | null = null
  let removing = false

  handle.queueTask(() => {
    let input = document.getElementById(handle.props.nameInputId)
    if (!(input instanceof HTMLInputElement)) return
    input.addEventListener(
      'input',
      () => {
        name = tidy(input.value)
        handle.update()
      },
      { signal: handle.signal },
    )
    handle.signal.addEventListener('abort', () => {
      if (chosen) URL.revokeObjectURL(chosen.url)
    })
  })

  return () => {
    let { hue, photo, invalid, describedBy } = handle.props
    let shownPhoto = chosen?.url ?? (removing ? undefined : photo)
    let letter = initialOf(name)
    let blank = !shownPhoto && !letter

    return (
      <div class="chform-photo">
        <span
          class={`avatar avatar-card avatar-channel${blank ? ' avatar-blank' : ''}`}
          style={`--hue:${hue ?? hueFor(name)}`}
          aria-hidden="true"
        >
          {shownPhoto ? <img class="avatar-photo" src={shownPhoto} alt="" /> : letter}
        </span>
        <label class={`photo-well${chosen ? ' has-file' : ''}`} for="channel-photo">
          <Icon name="camera" size={20} />
          <span class="photo-well-text">{chosen ? chosen.fileName : photo ? 'Replace picture' : 'Add a picture'}</span>
        </label>
        <input
          class="visually-hidden"
          id="channel-photo"
          type="file"
          name="photo"
          accept="image/*"
          aria-labelledby="channel-photo-label"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          mix={[
            on('change', (event) => {
              let file = (event.currentTarget as HTMLInputElement).files?.[0]
              if (chosen) URL.revokeObjectURL(chosen.url)
              chosen = file ? { url: URL.createObjectURL(file), fileName: file.name } : null
              handle.update()
            }),
          ]}
        />
        {photo ? (
          <label class="chform-remove">
            <input
              type="checkbox"
              name="removePhoto"
              value="1"
              mix={[
                on('change', (event) => {
                  removing = (event.currentTarget as HTMLInputElement).checked
                  handle.update()
                }),
              ]}
            />
            <span class="check" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            Remove picture
          </label>
        ) : null}
      </div>
    )
  }
})
