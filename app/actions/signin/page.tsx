import type { Handle } from 'remix/component'

import { brandName } from '../../data/brand.ts'
import type { Person } from '../../data/household.ts'
import { channelStats, type Channel } from '../../data/library.ts'
import { routes } from '../../routes.ts'
import { AppShell } from '../../ui/shell.tsx'
import { Avatar } from '../../ui/cards.tsx'
import { Icon } from '../../ui/public/icons.tsx'

function asChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

export interface SignInPageProps {
  people: Person[]
  selectedId?: string
  joining?: boolean
  error?: string
  joinName?: string
}

export function SignInPage(handle: Handle<SignInPageProps>) {
  return () => {
    let { people, selectedId, joining = false, error, joinName = '' } = handle.props
    let selected = selectedId ? people.find((person) => person.id === selectedId) : undefined
    let firstRun = people.length === 0
    let brand = brandName()

    return (
      <AppShell title={firstRun ? 'Start this house' : 'Sign in'} current={null} layout="signin">
        <section class="who" aria-labelledby="who-title">
          <h1 class="who-title" id="who-title">
            {firstRun ? 'Start this house' : `Who’s using ${brand}?`}
          </h1>
          <p class="who-lede">
            {firstRun
              ? `You’re the first Person. You’ll run ${brand} for the house. Other people on this network can join later.`
              : 'Pick yourself, then enter your password. Anyone on this network can still watch unsigned.'}
          </p>

          <ul class="who-grid">
            {people.map((person) => {
              let open = person.id === selected?.id
              let href = `${routes.signin.index.href()}?person=${encodeURIComponent(person.id)}`
              let videos = channelStats(person.slug).count
              return (
                <li class={open ? 'who-card is-open' : 'who-card'}>
                  <a class="who-pick" href={href} aria-current={open ? 'true' : undefined}>
                    <Avatar channel={asChannel(person)} size="card" />
                    <span class="who-meta">
                      <span class="who-name">{person.name}</span>
                      <span class="who-count">
                        {videos} video{videos === 1 ? '' : 's'}
                      </span>
                    </span>
                  </a>
                  {open ? (
                    <form class="who-form" method="post" action={routes.signin.action.href()}>
                      <input type="hidden" name="intent" value="signin" />
                      <input type="hidden" name="personId" value={person.id} />
                      <label class="field-label" for="signin-password">
                        Password
                      </label>
                      <input
                        id="signin-password"
                        class="field"
                        type="password"
                        name="password"
                        autocomplete="current-password"
                        required
                        autofocus
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? 'signin-error' : undefined}
                      />
                      {error ? (
                        <p class="field-error" id="signin-error" role="alert">
                          {error}
                        </p>
                      ) : null}
                      <button class="btn btn-primary" type="submit">
                        Sign in
                      </button>
                    </form>
                  ) : null}
                </li>
              )
            })}
            <li class={joining ? 'who-card who-new is-open' : 'who-card who-new'}>
              {joining ? (
                <form class="who-form who-join" method="post" action={routes.signin.action.href()} enctype="multipart/form-data">
                  <input type="hidden" name="intent" value="join" />
                  <p class="who-join-head">
                    <span class="who-plus" aria-hidden="true">
                      <Icon name="plus" size={24} />
                    </span>
                    <span class="who-name">I’m new in the house</span>
                  </p>
                  <label class="field-label" for="join-name">
                    Name
                  </label>
                  <input
                    id="join-name"
                    class="field"
                    type="text"
                    name="name"
                    value={joinName}
                    autocomplete="nickname"
                    maxlength={32}
                    required
                    autofocus
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? 'signin-error' : undefined}
                  />
                  <label class="field-label" for="join-password">
                    Password
                  </label>
                  <input
                    id="join-password"
                    class="field"
                    type="password"
                    name="password"
                    autocomplete="new-password"
                    required
                    minlength={4}
                  />
                  <label class="field-label" for="join-confirm">
                    Confirm password
                  </label>
                  <input
                    id="join-confirm"
                    class="field"
                    type="password"
                    name="confirm"
                    autocomplete="new-password"
                    required
                    minlength={4}
                  />
                  <label class="field-label" for="join-photo">
                    Photo (optional)
                  </label>
                  <label class="photo-well" for="join-photo">
                    <Icon name="camera" size={20} />
                    <span>Add a photo</span>
                  </label>
                  <input class="visually-hidden" id="join-photo" type="file" name="photo" accept="image/*" />
                  {firstRun ? (
                    <>
                      <p class="who-admin-note">You’ll be an Admin: attach folders, name Parents, and add other Admins.</p>
                      <label class="who-parent" for="join-parent">
                        <input class="poster-input" id="join-parent" type="checkbox" name="parent" value="on" />
                        <span class="check" aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                        <span class="who-parent-text">
                          <span class="who-parent-label">Parent</span>
                          <span class="field-hint" id="join-parent-hint">
                            See private videos and playlists, and the History of people who aren’t Parents.
                          </span>
                        </span>
                      </label>
                    </>
                  ) : null}
                  {error ? (
                    <p class="field-error" id="signin-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button class="btn btn-primary" type="submit">
                    Create my channel
                  </button>
                </form>
              ) : (
                <a class="who-pick who-pick-new" href={`${routes.signin.index.href()}?join=1`}>
                  <span class="who-plus" aria-hidden="true">
                    <Icon name="plus" size={24} />
                  </span>
                  <span class="who-name">I’m new in the house</span>
                </a>
              )}
            </li>
          </ul>
        </section>
      </AppShell>
    )
  }
}
