import type { Handle } from 'remix/component'

import { formatAssignedAt } from '../../data/assignments.ts'
import { brandName } from '../../data/brand.ts'
import type { Person } from '../../data/household.ts'
import { routes } from '../../routes.ts'
import { Avatar } from '../../ui/cards.tsx'
import { Icon } from '../../ui/public/icons.tsx'
import { AppShell } from '../../ui/shell.tsx'
import { ExtendMenu, LimitSelect, minutesLabel } from '../public/controls.tsx'

function asChannel(person: Person) {
  return { id: person.slug, name: person.name, kind: 'person' as const, hue: person.hue, photo: person.photo }
}

export function ControlsForbidden(handle: Handle<{ person: Person }>) {
  return () => {
    let { person } = handle.props
    return (
      <AppShell current={null} title="Parental controls" person={person}>
        <section class="empty" aria-labelledby="page-title">
          <Icon name="timer" size={40} />
          <h1 id="page-title">You need to be a Parent</h1>
          <p>
            Parental controls set how long people can watch {brandName()} each day. An Admin can make someone a Parent
            in House.
          </p>
          <a class="btn btn-secondary" href={routes.home.href()}>
            Back to home
          </a>
        </section>
      </AppShell>
    )
  }
}

export interface ControlsAssignment {
  videoId: string
  title: string
  assignedBy: string
  assignedAt: number
}

export interface ControlsRow {
  person: Person
  /** Minutes, or null for no limit. */
  limitMin: number | null
  extraMin: number
  usedSec: number
  assignments: ControlsAssignment[]
}

export interface ControlsPageProps {
  person: Person
  rows: ControlsRow[]
  /** Parents and Admins, who are never limited. */
  unlimited: Person[]
  presets: number[]
  steps: number[]
  error?: string
  errorPersonId?: string
}

function names(people: Person[]): string {
  let list = people.map((member) => member.name)
  if (list.length <= 2) return list.join(' and ')
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

function Today(handle: Handle<{ row: ControlsRow }>) {
  return () => {
    let { limitMin, extraMin, usedSec } = handle.props.row
    let usedMin = Math.floor(usedSec / 60)
    if (limitMin === null) {
      return (
        <div class="controls-today">
          <p class="controls-left">No limit</p>
          <p class="controls-used">{minutesLabel(usedMin)} watched</p>
        </div>
      )
    }
    let totalMin = limitMin + extraMin
    let leftSec = Math.max(0, totalMin * 60 - usedSec)
    let up = leftSec === 0
    let fill = Math.min(100, (usedSec / (totalMin * 60)) * 100)
    return (
      <div class={up ? 'controls-today is-up' : 'controls-today'}>
        <p class="controls-left">{up ? 'Time’s up' : `${minutesLabel(Math.ceil(leftSec / 60))} left`}</p>
        <p class="controls-used">
          {minutesLabel(Math.min(usedMin, totalMin))} of {minutesLabel(totalMin)}
        </p>
        <span class="controls-meter" style={`--used:${fill.toFixed(1)}%`} aria-hidden="true" />
      </div>
    )
  }
}

export function ControlsPage(handle: Handle<ControlsPageProps>) {
  return () => {
    let { person, rows, unlimited, presets, steps, error, errorPersonId } = handle.props
    let action = routes.controls.action.href()
    let strayError = error && !rows.some((row) => row.person.id === errorPersonId)
    return (
      <AppShell current={null} title="Parental controls" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">Parental controls</h1>
            <p class="page-lede">How long each person can watch each day. Extra time lasts until 5 am.</p>
          </div>
        </header>

        {strayError ? (
          <p class="field-error controls-stray" role="alert">
            {error}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div class="chlist-empty controls-empty">
            <p>Everyone in the house is a Parent or Admin, so there’s no one to limit.</p>
            {person.isAdmin ? (
              <a class="btn btn-secondary btn-sm" href={routes.house.index.href()}>
                Change roles in House
              </a>
            ) : null}
          </div>
        ) : (
          <table class="controls">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Today</th>
                <th scope="col">Daily limit</th>
                <th scope="col">Extra today</th>
                <th scope="col">
                  <span class="visually-hidden">Extend</span>
                </th>
              </tr>
            </thead>
            {rows.map((row) => {
              let member = row.person
              let invalid = error && errorPersonId === member.id
              let errorId = `controls-error-${member.id}`
              let leftSec = row.limitMin === null ? 0 : Math.max(0, (row.limitMin + row.extraMin) * 60 - row.usedSec)
              return (
                <tbody class="controls-row" id={`controls-${member.id}`}>
                  <tr>
                    <th scope="row" class="controls-who">
                      <span class="controls-who-inner">
                        <Avatar channel={asChannel(member)} size="md" />
                        <span class="controls-name">{member.name}</span>
                      </span>
                    </th>
                    <td class="controls-today-cell">
                      <Today row={row} />
                    </td>
                    <td class="controls-limit-cell">
                      <LimitSelect
                        action={action}
                        personId={member.id}
                        personName={member.name}
                        value={row.limitMin}
                        presets={presets}
                        errorId={invalid ? errorId : undefined}
                      />
                    </td>
                    <td class="controls-extra-cell">
                      {row.limitMin === null ? null : row.extraMin > 0 ? (
                        <form class="controls-extra" method="post" action={action}>
                          <input type="hidden" name="intent" value="clear" />
                          <input type="hidden" name="personId" value={member.id} />
                          <span class="controls-extra-amount">+{minutesLabel(row.extraMin)}</span>
                          <button
                            class="controls-clear"
                            type="submit"
                            aria-label={`Clear ${member.name}’s extra time today`}
                          >
                            Clear
                          </button>
                        </form>
                      ) : (
                        <span class="controls-none">None</span>
                      )}
                    </td>
                    <td class="controls-act">
                      {row.limitMin === null ? null : (
                        <ExtendMenu
                          action={action}
                          personId={member.id}
                          personName={member.name}
                          steps={steps}
                          remainingSec={leftSec}
                        />
                      )}
                    </td>
                  </tr>
                  {row.assignments.length > 0 ? (
                    <tr class="controls-assignments-row">
                      <td colspan={5}>
                        <ul class="controls-assignments">
                          {row.assignments.map((entry) => (
                            <li>
                              <a class="controls-assignment-title" href={routes.watch.href({ videoId: entry.videoId })}>
                                {entry.title}
                              </a>
                              <span class="controls-assignment-meta">
                                {entry.assignedBy} · {formatAssignedAt(entry.assignedAt)}
                              </span>
                              <form method="post" action={action}>
                                <input type="hidden" name="intent" value="unassign" />
                                <input type="hidden" name="personId" value={member.id} />
                                <input type="hidden" name="videoId" value={entry.videoId} />
                                <button
                                  class="controls-clear"
                                  type="submit"
                                  aria-label={`Remove ${entry.title} from ${member.name}`}
                                >
                                  Remove
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                  {invalid ? (
                    <tr class="controls-error-row">
                      <td colspan={5}>
                        <p class="field-error" id={errorId} role="alert">
                          {error}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              )
            })}
          </table>
        )}

        {unlimited.length > 0 ? (
          <p class="controls-note">Parents and Admins aren’t limited: {names(unlimited)}.</p>
        ) : null}
      </AppShell>
    )
  }
}
