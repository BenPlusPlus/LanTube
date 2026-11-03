import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'
import { initialOf } from '../../ui/public/identity.ts'

export interface VideoEditPreviewProps {
  /** The edit form this preview follows. */
  formId: string
  title: string
  tags: string[]
  private: boolean
  channel: { name: string; sub: string; kind: 'person' | 'custom' | 'folder'; hue: number; photo?: string }
  plays: string
  dateLabel: string
  dateIso: string
  dateLong: string
  relative: string
  source?: string
}

function tidy(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function readTags(form: HTMLFormElement): string[] {
  let names = Array.from(form.querySelectorAll('.upload-chip'), (chip) => tidy(chip.textContent ?? ''))
  let field = form.elements.namedItem('tags')
  if (field instanceof HTMLInputElement) names.push(...field.value.split(',').map(tidy))
  let seen = new Set<string>()
  return names.filter((name) => {
    let key = name.toLocaleLowerCase()
    if (!name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The watch page's title block as it will read once saved, following the form as you type. */
export const VideoEditPreview = clientEntry(import.meta.url, function VideoEditPreview(handle: Handle<VideoEditPreviewProps>) {
  let title = handle.props.title
  let tags = [...handle.props.tags]
  let isPrivate = handle.props.private

  handle.queueTask(() => {
    let form = document.getElementById(handle.props.formId)
    if (!(form instanceof HTMLFormElement)) return
    let sync = () => {
      let field = form.elements.namedItem('title')
      if (field instanceof HTMLInputElement) title = tidy(field.value)
      let visibility = form.querySelector<HTMLInputElement>('input[name="visibility"]:checked')
      if (visibility) isPrivate = visibility.value === 'private'
      tags = readTags(form)
      handle.update()
    }
    form.addEventListener('input', sync, { signal: handle.signal })
    form.addEventListener('change', sync, { signal: handle.signal })
    let chips = new MutationObserver(sync)
    chips.observe(form, { childList: true, subtree: true })
    handle.signal.addEventListener('abort', () => chips.disconnect())
  })

  return () => {
    let { channel, plays, dateLabel, dateIso, dateLong, relative, source } = handle.props
    return (
      <div class="vedit-preview">
        <p class={title ? 'watch-title vedit-preview-title' : 'watch-title vedit-preview-title is-placeholder'}>
          {title || 'Your title goes here'}
        </p>
        <div class="watch-channel">
          <span class="watch-channel-link">
            <span
              class={`avatar avatar-md${channel.kind === 'custom' ? ' avatar-channel' : ''}`}
              style={`--hue:${channel.hue}`}
              aria-hidden="true"
            >
              {channel.photo ? (
                <img class="avatar-photo" src={channel.photo} alt="" />
              ) : channel.kind === 'folder' ? (
                <Icon name="folder" size={16} />
              ) : (
                initialOf(channel.name) || '?'
              )}
            </span>
            <span class="watch-channel-text">
              <span class="watch-channel-name">{channel.name}</span>
              <span class="watch-channel-sub">{channel.sub}</span>
            </span>
          </span>
        </div>
        <div class="watch-facts">
          <p class="watch-stats">
            <span>{plays}</span>
            <span aria-hidden="true">·</span>
            <span>
              {dateLabel} <time datetime={dateIso}>{dateLong}</time>
            </span>
            <span class="watch-stats-rel">({relative})</span>
            {isPrivate ? (
              <>
                <span aria-hidden="true">·</span>
                <span class="pvis">
                  <Icon name="lock" size={14} />
                  Private
                </span>
              </>
            ) : null}
          </p>
          {tags.length > 0 ? (
            <ul class="watch-tags" aria-label="Tags">
              {tags.map((name) => (
                <li>
                  <span class="chip">{name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {source ? <p class="watch-source">Indexed from {source}</p> : null}
        </div>
      </div>
    )
  }
})
