import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from './icons.tsx'

export interface AssignPerson {
  id: string
  name: string
  assigned: boolean
}

export interface AssignMenuProps {
  videoId: string
  videoTitle: string
  action: string
  people: AssignPerson[]
  /** Where the no-JavaScript form lands after assigning. */
  returnTo?: string
}

/**
 * Assign ticks in place so the kebab never navigates to /assign.
 * Without JavaScript, each row is a plain form that returns to this page.
 */
export const AssignMenu = clientEntry(import.meta.url, function AssignMenu(handle: Handle<AssignMenuProps>) {
  let assigned = new Map(handle.props.people.map((person) => [person.id, person.assigned]))
  let pending = new Set<string>()
  let failed: string | null = null
  let notice = ''

  async function toggle(person: AssignPerson) {
    if (pending.has(person.id)) return
    let next = !assigned.get(person.id)
    pending.add(person.id)
    assigned.set(person.id, next)
    failed = null
    notice = next
      ? `Assigned ${handle.props.videoTitle} to ${person.name}.`
      : `${handle.props.videoTitle} is no longer assigned to ${person.name}.`
    handle.update()
    let body = new FormData()
    body.set('intent', next ? 'assign' : 'unassign')
    body.set('personId', person.id)
    body.set('async', '1')
    try {
      let response = await fetch(handle.props.action, { method: 'POST', body })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      assigned.set(person.id, !next)
      failed = person.name
      notice = ''
    }
    pending.delete(person.id)
    handle.update()
  }

  return () => {
    let { action, people, returnTo, videoId, videoTitle } = handle.props
    let menuId = `assign-${videoId}`
    let anchor = `--assign-${videoId}`

    return (
      <div class="vcard-assign">
        <button
          class="icon-btn vcard-assign-btn"
          type="button"
          popovertarget={menuId}
          aria-haspopup="dialog"
          aria-label={`Assign ${videoTitle}`}
          style={`anchor-name:${anchor}`}
        >
          <Icon name="ellipsis-vertical" size={18} />
        </button>
        <div
          class="vcard-assign-menu"
          id={menuId}
          popover="auto"
          role="dialog"
          aria-labelledby={`${menuId}-title`}
          style={`position-anchor:${anchor}`}
        >
          <p class="vcard-assign-title" id={`${menuId}-title`}>
            Assign to
          </p>
          {people.length === 0 ? (
            <p class="vcard-assign-empty">No one here can watch this yet. Name them on Audience first.</p>
          ) : (
            people.map((member) => {
              let isAssigned = assigned.get(member.id) === true
              return (
                <form
                  method="post"
                  action={action}
                  mix={[
                    on('submit', (event) => {
                      event.preventDefault()
                      void toggle(member)
                    }),
                  ]}
                >
                  <input type="hidden" name="intent" value={isAssigned ? 'unassign' : 'assign'} />
                  <input type="hidden" name="personId" value={member.id} />
                  {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
                  <button
                    class="account-menu-item vcard-assign-item"
                    type="submit"
                    aria-pressed={isAssigned ? 'true' : 'false'}
                    aria-busy={pending.has(member.id) ? 'true' : undefined}
                  >
                    <span class={`check${isAssigned ? ' is-on' : ''}`} aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                    {member.name}
                  </button>
                </form>
              )
            })
          )}
          {failed ? (
            <p class="vcard-assign-error" role="alert">
              Couldn’t change {failed}. Check the connection to the host and try again.
            </p>
          ) : null}
          <span class="visually-hidden" aria-live="polite">
            {notice}
          </span>
        </div>
      </div>
    )
  }
})
