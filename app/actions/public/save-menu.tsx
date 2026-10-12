import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'

export interface SaveMenuItem {
  id: string
  name: string
  private: boolean
  saved: boolean
  /** Where this playlist's add/remove form posts. */
  action: string
}

export interface SaveMenuProps {
  videoId: string
  videoTitle: string
  items: SaveMenuItem[]
  /** Where a new playlist that starts with this video is made. */
  newHref: string
  /** Where the no-JavaScript form lands after saving. */
  returnTo: string
}

const GAP = 8
const EDGE = 12

/**
 * Save sits beside the channel on the watch page. Ticking a playlist saves in place,
 * so a playing video never reloads; without JavaScript, each row is a plain form.
 */
export const SaveMenu = clientEntry(import.meta.url, function SaveMenu(handle: Handle<SaveMenuProps>) {
  let saved = new Map(handle.props.items.map((item) => [item.id, item.saved]))
  let pending = new Set<string>()
  let failed: string | null = null
  let button: HTMLButtonElement | undefined
  let menu: HTMLElement | undefined

  function place() {
    if (!button || !menu) return
    let anchor = button.getBoundingClientRect()
    let width = menu.offsetWidth
    let height = menu.offsetHeight
    let left = Math.min(Math.max(EDGE, anchor.left), window.innerWidth - width - EDGE)
    let below = anchor.bottom + GAP
    let top = below + height > window.innerHeight - EDGE && anchor.top - GAP - height > EDGE ? anchor.top - GAP - height : below
    menu.style.inset = 'auto'
    menu.style.margin = '0'
    menu.style.left = `${Math.round(left)}px`
    menu.style.top = `${Math.round(top)}px`
  }

  async function toggle(item: SaveMenuItem) {
    if (pending.has(item.id)) return
    let next = !saved.get(item.id)
    pending.add(item.id)
    saved.set(item.id, next)
    failed = null
    handle.update()
    let body = new FormData()
    body.set('intent', next ? 'add' : 'remove')
    body.set('videoId', handle.props.videoId)
    body.set('async', '1')
    try {
      let response = await fetch(item.action, { method: 'POST', body })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      saved.set(item.id, !next)
      failed = item.name
    }
    pending.delete(item.id)
    handle.update()
  }

  return () => {
    let { items, newHref, returnTo, videoId, videoTitle } = handle.props
    let anySaved = items.some((item) => saved.get(item.id))

    return (
      <div class="save">
        <button
          class={`btn btn-secondary save-btn${anySaved ? ' is-saved' : ''}`}
          type="button"
          popovertarget="save-menu"
          aria-haspopup="dialog"
          mix={[ref((node) => (button = node as HTMLButtonElement))]}
        >
          <Icon name={anySaved ? 'list-check' : 'list-plus'} size={20} />
          {anySaved ? 'Saved' : 'Save'}
        </button>
        <div
          class="save-menu"
          id="save-menu"
          popover="auto"
          role="dialog"
          aria-labelledby="save-menu-title"
          mix={[
            ref((node) => (menu = node as HTMLElement)),
            on('toggle', (event) => {
              if ((event as ToggleEvent).newState !== 'open') return
              place()
              menu?.querySelector<HTMLElement>('.save-menu-item, .save-menu-new')?.focus()
            }),
          ]}
        >
          <p class="save-menu-title" id="save-menu-title">
            Save to…
          </p>
          {items.length > 0 ? (
            <ul class="save-menu-list">
              {items.map((item) => {
                let isSaved = saved.get(item.id) === true
                return (
                  <li>
                    <form
                      method="post"
                      action={item.action}
                      mix={[
                        on('submit', (event) => {
                          event.preventDefault()
                          void toggle(item)
                        }),
                      ]}
                    >
                      <input type="hidden" name="intent" value={isSaved ? 'remove' : 'add'} />
                      <input type="hidden" name="videoId" value={videoId} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button
                        class="account-menu-item save-menu-item"
                        type="submit"
                        aria-pressed={isSaved ? 'true' : 'false'}
                        aria-busy={pending.has(item.id) ? 'true' : undefined}
                      >
                        <span class={`check${isSaved ? ' is-on' : ''}`} aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                        <span class="save-menu-name">{item.name}</span>
                        {item.private ? (
                          <span class="save-menu-lock" title="Private">
                            <Icon name="lock" size={16} />
                            <span class="visually-hidden">, private</span>
                          </span>
                        ) : null}
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p class="save-menu-empty">You don’t have any playlists yet.</p>
          )}
          {failed ? (
            <p class="save-menu-error" role="alert">
              Couldn’t change {failed}. Check the connection to the host and try again.
            </p>
          ) : null}
          <a class="account-menu-item save-menu-new" href={newHref}>
            <Icon name="plus" size={18} />
            New playlist
          </a>
          <span class="visually-hidden" aria-live="polite">
            {items.filter((item) => saved.get(item.id)).length > 0
              ? `${videoTitle} is in ${items.filter((item) => saved.get(item.id)).map((item) => item.name).join(', ')}`
              : ''}
          </span>
        </div>
      </div>
    )
  }
})
