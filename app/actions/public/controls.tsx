import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'

/** "5 min", "1 hr", "1 hr 30 min" */
export function minutesLabel(minutes: number): string {
  let h = Math.floor(minutes / 60)
  let m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export interface LimitSelectProps {
  action: string
  personId: string
  personName: string
  /** Minutes, or null for no limit. */
  value: number | null
  presets: number[]
  errorId?: string
}

/** Choosing a limit saves it. Without JavaScript, Save does. */
export const LimitSelect = clientEntry(import.meta.url, function LimitSelect(handle: Handle<LimitSelectProps>) {
  let enhanced = false
  let select: HTMLSelectElement | undefined

  handle.queueTask(() => {
    enhanced = true
    handle.update()
  })

  return () => {
    let { action, personId, personName, value, presets, errorId } = handle.props
    let id = `controls-limit-${personId}`
    return (
      <form class="controls-limit" method="post" action={action}>
        <input type="hidden" name="intent" value="limit" />
        <input type="hidden" name="personId" value={personId} />
        <label class="visually-hidden" for={id}>
          Daily limit for {personName}
        </label>
        <select
          id={id}
          class="field field-select controls-select"
          name="minutes"
          aria-invalid={errorId ? 'true' : undefined}
          aria-describedby={errorId}
          mix={[
            ref((node) => (select = node as HTMLSelectElement)),
            on('change', () => {
              if (enhanced) select?.form?.requestSubmit()
            }),
          ]}
        >
          <option value="none" selected={value === null ? true : undefined}>
            No limit
          </option>
          {presets.map((minutes) => (
            <option value={String(minutes)} selected={value === minutes ? true : undefined}>
              {minutesLabel(minutes)}
            </option>
          ))}
        </select>
        {enhanced ? null : (
          <button class="btn btn-secondary btn-sm" type="submit">
            Save
          </button>
        )}
      </form>
    )
  }
})

export interface ExtendMenuProps {
  action: string
  personId: string
  personName: string
  steps: number[]
  /** Seconds left today before any more extra time. */
  remainingSec: number
}

const GAP = 8
const EDGE = 12

/** Extra time for today. Each amount is a submit button, so it works as a plain form. */
export const ExtendMenu = clientEntry(import.meta.url, function ExtendMenu(handle: Handle<ExtendMenuProps>) {
  let button: HTMLButtonElement | undefined
  let menu: HTMLElement | undefined

  function place() {
    if (!button || !menu) return
    let anchor = button.getBoundingClientRect()
    let width = menu.offsetWidth
    let height = menu.offsetHeight
    let left = Math.min(Math.max(EDGE, anchor.right - width), window.innerWidth - width - EDGE)
    let below = anchor.bottom + GAP
    let top = below + height > window.innerHeight - EDGE && anchor.top - GAP - height > EDGE ? anchor.top - GAP - height : below
    menu.style.inset = 'auto'
    menu.style.margin = '0'
    menu.style.left = `${Math.round(left)}px`
    menu.style.top = `${Math.round(top)}px`
  }

  return () => {
    let { action, personId, personName, steps, remainingSec } = handle.props
    let menuId = `extend-${personId}`
    let titleId = `extend-title-${personId}`
    return (
      <div class="extend">
        <button
          class="btn btn-secondary btn-sm extend-btn"
          type="button"
          popovertarget={menuId}
          aria-haspopup="dialog"
          aria-label={`Extend ${personName}’s time today`}
          mix={[ref((node) => (button = node as HTMLButtonElement))]}
        >
          Extend
          <Icon name="chevron-down" size={16} />
        </button>
        <div
          class="extend-menu"
          id={menuId}
          popover="auto"
          role="dialog"
          aria-labelledby={titleId}
          mix={[
            ref((node) => (menu = node as HTMLElement)),
            on('toggle', (event) => {
              if ((event as ToggleEvent).newState !== 'open') return
              place()
              menu?.querySelector<HTMLElement>('.extend-item')?.focus()
            }),
          ]}
        >
          <p class="extend-title" id={titleId}>
            More time for {personName} today
          </p>
          <form method="post" action={action}>
            <input type="hidden" name="intent" value="extend" />
            <input type="hidden" name="personId" value={personId} />
            {steps.map((minutes) => (
              <button class="account-menu-item extend-item" type="submit" name="minutes" value={String(minutes)}>
                <span class="extend-amount">+{minutes} min</span>
                <span class="extend-result">{minutesLabel(Math.ceil(remainingSec / 60) + minutes)} left</span>
              </button>
            ))}
          </form>
        </div>
      </div>
    )
  }
})
