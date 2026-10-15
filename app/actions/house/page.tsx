import type { Handle } from 'remix/component'

import { brandLimits, brandName } from '../../data/brand.ts'
import type { Person } from '../../data/household.ts'
import { routes } from '../../routes.ts'
import { Avatar } from '../../ui/cards.tsx'
import { Icon } from '../../ui/public/icons.tsx'
import { AppShell } from '../../ui/shell.tsx'

function asChannel(person: Person) {
  return { id: person.slug, name: person.name, kind: 'person' as const, hue: person.hue, photo: person.photo }
}

export function HouseForbidden(handle: Handle<{ person: Person }>) {
  return () => {
    let { person } = handle.props
    return (
      <AppShell current={null} title="House" person={person}>
        <section class="empty" aria-labelledby="page-title">
          <Icon name="home" size={40} />
          <h1 id="page-title">You need to be an Admin</h1>
          <p>House is for people who run {brandName()} for the house.</p>
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
  brand: string
  error?: string
  errorPersonId?: string
  errorField?: 'roles' | 'password' | 'brand'
}

export function HousePage(handle: Handle<HousePageProps>) {
  return () => {
    let { person, people, brand, error, errorPersonId, errorField } = handle.props
    let adminCount = people.filter((member) => member.isAdmin).length
    let brandInvalid = error && errorField === 'brand'
    return (
      <AppShell current={null} title="House" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">House</h1>
            <p class="page-lede">People who can join on this network, and folders on the Media share.</p>
          </div>
        </header>

        <section class="house-section" aria-labelledby="house-brand">
          <header class="shelf-head">
            <h2 class="shelf-title" id="house-brand">
              Branding
            </h2>
          </header>
          <form class="house-brand" method="post" action={routes.house.action.href()}>
            <input type="hidden" name="intent" value="brand" />
            <label class="field-label" for="house-brand-name">
              Name
            </label>
            <input
              id="house-brand-name"
              class="field"
              type="text"
              name="brand"
              value={brand}
              maxlength={brandLimits.name}
              autocomplete="off"
              required
              aria-invalid={brandInvalid ? 'true' : undefined}
              aria-describedby={brandInvalid ? 'house-brand-error' : 'house-brand-hint'}
            />
            <p class="field-hint" id="house-brand-hint">
              Shown in the top bar, titles, and messages around the house.
            </p>
            {brandInvalid ? (
              <p class="field-error" id="house-brand-error" role="alert">
                {error}
              </p>
            ) : null}
            <button class="btn btn-secondary" type="submit">
              Save
            </button>
          </form>
        </section>

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
            {people.map((member) => {
              let self = member.id === person.id
              let lastAdmin = self && member.isAdmin && adminCount === 1
              let invalid = error && errorPersonId === member.id
              let adminId = `house-admin-${member.id}`
              let parentId = `house-parent-${member.id}`
              let passwordId = `house-password-${member.id}`
              let errorId = `house-error-${member.id}`
              return (
                <li class="house-person">
                  <Avatar channel={asChannel(member)} size="md" />
                  <span class="house-person-text">
                    <span class="house-person-name">{member.name}</span>
                    {self ? <span class="house-person-you">You</span> : null}
                  </span>
                  <form class="house-person-roles" method="post" action={routes.house.action.href()}>
                    <input type="hidden" name="personId" value={member.id} />
                    {lastAdmin ? <input type="hidden" name="admin" value="on" /> : null}
                    <label class="house-role" for={adminId}>
                      <input
                        class="poster-input"
                        id={adminId}
                        type="checkbox"
                        name="admin"
                        value="on"
                        checked={member.isAdmin ? true : undefined}
                        disabled={lastAdmin ? true : undefined}
                        aria-describedby={lastAdmin ? 'house-last-admin' : undefined}
                      />
                      <span class="check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                      Admin
                    </label>
                    <label class="house-role" for={parentId}>
                      <input
                        class="poster-input"
                        id={parentId}
                        type="checkbox"
                        name="parent"
                        value="on"
                        checked={member.isParent ? true : undefined}
                      />
                      <span class="check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                      Parent
                    </label>
                    <button class="btn btn-secondary btn-sm" type="submit">
                      Save
                    </button>
                    {lastAdmin ? (
                      <p class="field-hint house-last-admin" id="house-last-admin">
                        The house needs at least one Admin.
                      </p>
                    ) : null}
                    {invalid && errorField === 'roles' ? (
                      <p class="field-error" id={errorId} role="alert">
                        {error}
                      </p>
                    ) : null}
                  </form>
                  {self ? null : (
                    <form class="house-person-password" method="post" action={routes.house.action.href()}>
                      <input type="hidden" name="intent" value="password" />
                      <input type="hidden" name="personId" value={member.id} />
                      <label class="visually-hidden" for={passwordId}>
                        New password for {member.name}
                      </label>
                      <input
                        id={passwordId}
                        class="field"
                        type="password"
                        name="password"
                        autocomplete="new-password"
                        minlength={4}
                        placeholder="New password"
                        required
                        aria-invalid={invalid ? 'true' : undefined}
                        aria-describedby={invalid ? errorId : undefined}
                      />
                      <button class="btn btn-secondary btn-sm" type="submit">
                        Set password
                      </button>
                      {invalid && errorField === 'password' ? (
                        <p class="field-error" id={errorId} role="alert">
                          {error}
                        </p>
                      ) : null}
                    </form>
                  )}
                </li>
              )
            })}
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
