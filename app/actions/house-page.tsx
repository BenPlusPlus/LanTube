import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { routes } from '../routes.ts'
import { Avatar } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'

function asChannel(person: Person) {
  return { id: person.slug, name: person.name, kind: 'person' as const, hue: person.hue, photo: person.photo }
}

function rolesOf(person: Person) {
  let roles = [
    person.isAdmin ? 'Admin' : undefined,
    person.isParent ? 'Parent' : undefined,
  ].filter((role): role is string => role !== undefined)
  return roles.join(' · ')
}

export function HouseForbidden(handle: Handle<{ person: Person }>) {
  return () => {
    let { person } = handle.props
    return (
      <AppShell current={null} title="House" person={person}>
        <section class="empty" aria-labelledby="page-title">
          <Icon name="home" size={40} />
          <h1 id="page-title">You need to be an Admin</h1>
          <p>House is for people who run LanTube for the house.</p>
          <a class="btn btn-secondary" href={routes.home.href()}>
            Back to home
          </a>
        </section>
      </AppShell>
    )
  }
}

export interface HousePageProps {
  person: Person
  people: Person[]
}

export function HousePage(handle: Handle<HousePageProps>) {
  return () => {
    let { person, people } = handle.props
    return (
      <AppShell current={null} title="House" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">House</h1>
            <p class="page-lede">People who can join on this network, and folders on the Media share.</p>
          </div>
        </header>

        <section class="house-section" aria-labelledby="house-people">
          <header class="shelf-head">
            <h2 class="shelf-title" id="house-people">
              People
            </h2>
            <p class="shelf-note">
              {people.length} {people.length === 1 ? 'Person' : 'People'}
            </p>
          </header>
          <ul class="house-people">
            {people.map((member) => (
              <li class="house-person">
                <Avatar channel={asChannel(member)} size="md" />
                <span class="house-person-text">
                  <span class="house-person-name">{member.name}</span>
                  {rolesOf(member) ? <span class="house-person-roles">{rolesOf(member)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section class="house-section" aria-labelledby="house-folders">
          <header class="shelf-head">
            <h2 class="shelf-title" id="house-folders">
              Folders
            </h2>
          </header>
          <p class="page-lede">Index a folder on the Media share. Those videos show on Home as house-visible.</p>
          <div class="chlist-empty">
            <p>No folders attached yet.</p>
          </div>
        </section>
      </AppShell>
    )
  }
}
