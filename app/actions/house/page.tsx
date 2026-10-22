import type { Handle, RemixNode } from 'remix/component'

import { brandLimits, brandName } from '../../data/brand.ts'
import type { Person } from '../../data/household.ts'
import { channelLimits, getChannels } from '../../data/library.ts'
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

export type HouseErrorField = 'roles' | 'password' | 'remove' | 'brand' | 'path' | 'name' | 'detach' | 'scan'

export interface HousePageProps {
  person: Person
  people: Person[]
  brand: string
  unsignedWatch: boolean
  error?: string
  errorPersonId?: string
  errorFolderId?: string
  errorField?: HouseErrorField
  folderPath?: string
  folderName?: string
}

/** A destructive step tucked behind a disclosure; it opens itself when the server sends back an error for it. */
function confirmDisclosure(options: {
  open: boolean
  summary: string
  summaryLabel: string
  children: RemixNode
}) {
  return (
    <details class="house-confirm" name="house-confirm" open={options.open ? true : undefined}>
      <summary class="btn btn-ghost btn-sm house-confirm-summary" aria-label={options.summaryLabel}>
        {options.summary}
        <Icon name="chevron-down" size={16} />
      </summary>
      <div class="house-confirm-panel">{options.children}</div>
    </details>
  )
}

export function HousePage(handle: Handle<HousePageProps>) {
  return () => {
    let { person, people, brand, unsignedWatch, error, errorPersonId, errorFolderId, errorField, folderPath, folderName } =
      handle.props
    let action = routes.house.action.href()
    let adminCount = people.filter((member) => member.isAdmin).length
    let brandInvalid = error && errorField === 'brand'
    let pathInvalid = error && errorField === 'path'
    let nameInvalid = error && errorField === 'name'
    let folders = getChannels().filter((channel) => channel.kind === 'folder')
    let folderStray = error && (errorField === 'scan' || (errorField === 'detach' && !errorFolderId))
    return (
      <AppShell current={null} title="House" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">House</h1>
            <p class="page-lede">
              Name the site, choose who can watch, and look after the people and folders in the house.
            </p>
          </div>
        </header>

        <div class="house">
          <section class="house-section" aria-labelledby="house-brand">
            <header class="house-head">
              <h2 class="shelf-title" id="house-brand">
                Branding
              </h2>
            </header>
            <form class="house-brand" method="post" action={action}>
              <input type="hidden" name="intent" value="brand" />
              <label class="field-label" for="house-brand-name">
                Site name
              </label>
              <div class="house-inline">
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
                <button class="btn btn-secondary" type="submit">
                  Save
                </button>
              </div>
              {brandInvalid ? (
                <p class="field-error" id="house-brand-error" role="alert">
                  {error}
                </p>
              ) : (
                <p class="field-hint" id="house-brand-hint">
                  Shown in the top bar, titles, and messages around the house.
                </p>
              )}
            </form>
          </section>

          <section class="house-section" aria-labelledby="house-watch">
            <header class="house-head">
              <h2 class="shelf-title" id="house-watch">
                Watching
              </h2>
            </header>
            <form class="house-watch" method="post" action={action}>
              <input type="hidden" name="intent" value="unsigned-watch" />
              <label class="house-switch" for="house-unsigned-watch">
                <input
                  class="poster-input"
                  id="house-unsigned-watch"
                  type="checkbox"
                  name="unsignedWatch"
                  value="on"
                  checked={unsignedWatch ? true : undefined}
                  aria-describedby="house-unsigned-watch-hint"
                />
                <span class="check" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
                <span class="house-switch-text">
                  <span class="house-switch-label">Watch without signing in</span>
                  <span class="field-hint" id="house-unsigned-watch-hint">
                    When this is off, people can still open Home and channels. Playing a video sends them to sign in.
                  </span>
                </span>
              </label>
              <button class="btn btn-secondary" type="submit">
                Save
              </button>
            </form>
          </section>

          <section class="house-section" aria-labelledby="house-people">
            <header class="house-head">
              <h2 class="shelf-title" id="house-people">
                People
              </h2>
              <p class="shelf-note">
                {people.length} {people.length === 1 ? 'Person' : 'People'} · {adminCount}{' '}
                {adminCount === 1 ? 'Admin' : 'Admins'}
              </p>
            </header>
            <ul class="house-roster">
              {people.map((member) => {
                let self = member.id === person.id
                let lastAdmin = self && member.isAdmin && adminCount === 1
                let invalid = error && errorPersonId === member.id
                let removeInvalid = invalid && errorField === 'remove'
                let adminId = `house-admin-${member.id}`
                let parentId = `house-parent-${member.id}`
                let passwordId = `house-password-${member.id}`
                let removeId = `house-remove-${member.id}`
                let errorId = `house-error-${member.id}`
                return (
                  <li class="house-person">
                    <span class="house-person-who">
                      <Avatar channel={asChannel(member)} size="md" />
                      <span class="house-person-text">
                        <span class="house-person-name">{member.name}</span>
                        {self ? <span class="house-person-you">You</span> : null}
                      </span>
                    </span>
                    <form class="house-person-roles" method="post" action={action}>
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
                      <button class="btn btn-secondary btn-sm" type="submit" aria-label={`Save roles for ${member.name}`}>
                        Save
                      </button>
                    </form>
                    {self ? (
                      <a class="house-person-password house-person-self" href={routes.details.index.href()}>
                        Change your password in Your details
                      </a>
                    ) : (
                      <form class="house-person-password" method="post" action={action}>
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
                          aria-invalid={invalid && errorField === 'password' ? 'true' : undefined}
                          aria-describedby={invalid && errorField === 'password' ? errorId : undefined}
                        />
                        <button class="btn btn-secondary btn-sm" type="submit">
                          Set password
                        </button>
                      </form>
                    )}
                    <div class="house-person-remove">
                      {lastAdmin
                        ? null
                        : confirmDisclosure({
                            open: !!removeInvalid,
                            summary: 'Remove',
                            summaryLabel: `Remove ${member.name}…`,
                            children: (
                              <form method="post" action={action}>
                                <input type="hidden" name="intent" value="remove" />
                                <input type="hidden" name="personId" value={member.id} />
                                <p class="house-confirm-title">Remove {member.name}?</p>
                                <p class="field-hint">
                                  They cannot sign in. Their Home channel freezes. Playlists and History go. Custom
                                  channels they owned pass to you.
                                </p>
                                <label class="chform-remove" for={removeId}>
                                  <input
                                    id={removeId}
                                    type="checkbox"
                                    name="confirm"
                                    value="1"
                                    aria-invalid={removeInvalid ? 'true' : undefined}
                                    aria-describedby={removeInvalid ? errorId : undefined}
                                  />
                                  <span class="check" aria-hidden="true">
                                    <Icon name="check" size={14} />
                                  </span>
                                  Yes, remove {member.name}
                                </label>
                                {removeInvalid ? (
                                  <p class="field-error" id={errorId} role="alert">
                                    {error}
                                  </p>
                                ) : null}
                                <button class="btn btn-secondary btn-sm" type="submit">
                                  Remove
                                </button>
                              </form>
                            ),
                          })}
                    </div>
                    {lastAdmin ? (
                      <p class="field-hint house-person-note" id="house-last-admin">
                        The house needs at least one Admin.
                      </p>
                    ) : null}
                    {invalid && (errorField !== 'remove' || lastAdmin) ? (
                      <p class="field-error house-person-note" id={errorId} role="alert">
                        {error}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>

          <section class="house-section" aria-labelledby="house-folders">
            <header class="house-head">
              <h2 class="shelf-title" id="house-folders">
                Folders
              </h2>
              <p class="shelf-note">Videos in an attached folder on the Media share show on Home as house-visible.</p>
            </header>
            {folderStray ? (
              <p class="field-error house-stray" role="alert">
                {error}
              </p>
            ) : null}
            {folders.length === 0 ? (
              <div class="chlist-empty house-folders-empty">
                <p>No folders attached yet.</p>
              </div>
            ) : (
              <ul class="house-roster">
                {folders.map((folder) => {
                  let detachInvalid = error && errorField === 'detach' && errorFolderId === folder.id
                  let confirmId = `house-detach-${folder.id}`
                  let errorId = `house-detach-error-${folder.id}`
                  return (
                    <li class="house-folder">
                      <span class="house-folder-icon">
                        <Icon name="folder" size={20} />
                      </span>
                      <span class="house-folder-text">
                        <span class="house-folder-name">{folder.name}</span>
                        {folder.path ? <span class="house-folder-path path-chip">{folder.path}</span> : null}
                      </span>
                      <form class="house-folder-scan" method="post" action={action}>
                        <input type="hidden" name="intent" value="scan" />
                        <input type="hidden" name="folderId" value={folder.id} />
                        <button class="btn btn-secondary btn-sm" type="submit" aria-label={`Scan ${folder.name} now`}>
                          Scan now
                        </button>
                      </form>
                      <div class="house-folder-detach">
                        {confirmDisclosure({
                          open: !!detachInvalid,
                          summary: 'Detach',
                          summaryLabel: `Detach ${folder.name}…`,
                          children: (
                            <form method="post" action={action}>
                              <input type="hidden" name="intent" value="detach" />
                              <input type="hidden" name="folderId" value={folder.id} />
                              <p class="house-confirm-title">Detach {folder.name}?</p>
                              <label class="chform-remove" for={confirmId}>
                                <input
                                  id={confirmId}
                                  type="checkbox"
                                  name="confirm"
                                  value="1"
                                  aria-invalid={detachInvalid ? 'true' : undefined}
                                  aria-describedby={detachInvalid ? errorId : undefined}
                                />
                                <span class="check" aria-hidden="true">
                                  <Icon name="check" size={14} />
                                </span>
                                Indexed videos leave the catalogue. Files on the share stay.
                              </label>
                              {detachInvalid ? (
                                <p class="field-error" id={errorId} role="alert">
                                  {error}
                                </p>
                              ) : null}
                              <button class="btn btn-secondary btn-sm" type="submit">
                                Detach folder
                              </button>
                            </form>
                          ),
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <form class="house-attach" method="post" action={action} aria-labelledby="house-attach-title">
              <input type="hidden" name="intent" value="attach" />
              <h3 class="house-attach-title" id="house-attach-title">
                Attach a folder
              </h3>
              <div class="house-attach-fields">
                <div class="house-attach-field">
                  <label class="field-label" for="house-folder-path">
                    Path
                  </label>
                  <input
                    id="house-folder-path"
                    class="field"
                    type="text"
                    name="path"
                    value={folderPath ?? ''}
                    autocomplete="off"
                    spellcheck="false"
                    required
                    aria-invalid={pathInvalid ? 'true' : undefined}
                    aria-describedby={pathInvalid ? 'house-folder-path-error' : 'house-folder-path-hint'}
                  />
                  {pathInvalid ? (
                    <p class="field-error" id="house-folder-path-error" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p class="field-hint" id="house-folder-path-hint">
                      A folder under the Media share. Type the path; there isn’t a file picker.
                    </p>
                  )}
                </div>
                <div class="house-attach-field">
                  <label class="field-label" for="house-folder-name">
                    Name <span class="field-optional">(optional)</span>
                  </label>
                  <input
                    id="house-folder-name"
                    class="field"
                    type="text"
                    name="name"
                    value={folderName ?? ''}
                    maxlength={channelLimits.name}
                    autocomplete="off"
                    aria-invalid={nameInvalid ? 'true' : undefined}
                    aria-describedby={nameInvalid ? 'house-folder-name-error' : 'house-folder-name-hint'}
                  />
                  {nameInvalid ? (
                    <p class="field-error" id="house-folder-name-error" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p class="field-hint" id="house-folder-name-hint">
                      Shown in the house. Leave blank to use the directory name.
                    </p>
                  )}
                </div>
              </div>
              <button class="btn btn-secondary" type="submit">
                Attach folder
              </button>
            </form>
          </section>
        </div>
      </AppShell>
    )
  }
}

