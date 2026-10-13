import type { Handle } from 'remix/component'

import type { Person } from '../../data/household.ts'
import { routes } from '../../routes.ts'
import { AppShell } from '../../ui/shell.tsx'
import { PersonPhoto } from '../public/person-photo.tsx'

export type DetailsField = 'name' | 'photo' | 'current' | 'password' | 'confirm'

export interface DetailsPageProps {
  person: Person
  values: { name: string }
  error?: string
  errorField?: DetailsField
}

export function DetailsPage(handle: Handle<DetailsPageProps>) {
  return () => {
    let { person, values, error, errorField } = handle.props
    let invalid = (field: DetailsField) => (error && errorField === field ? 'true' : undefined)
    let describedBy = (field: DetailsField, hint?: string) =>
      [hint, invalid(field) ? 'details-error' : undefined].filter(Boolean).join(' ') || undefined
    let errorMessage = error ? (
      <p class="field-error" id="details-error" role="alert">
        {error}
      </p>
    ) : null
    return (
      <AppShell current={null} title="Your details" person={person}>
        <section class="chform-page" aria-labelledby="details-title">
          <header class="chform-head">
            <h1 class="page-title" id="details-title">
              Your details
            </h1>
            <p class="page-lede">Your name and photo show around the house. Your Home channel keeps the same address.</p>
          </header>

          <form class="chform" method="post" action={routes.details.action.href()} enctype="multipart/form-data">
            <input type="hidden" name="intent" value="details" />
            <label class="field-label" for="details-name">
              Name
            </label>
            <input
              id="details-name"
              class="field"
              type="text"
              name="name"
              value={values.name}
              autocomplete="nickname"
              maxlength={32}
              required
              autofocus={errorField === 'name' || !errorField ? true : undefined}
              aria-invalid={invalid('name')}
              aria-describedby={describedBy('name')}
            />
            {errorField === 'name' ? errorMessage : null}

            <p class="field-label" id="details-slug-label">
              Home channel address
            </p>
            <p class="details-slug" aria-labelledby="details-slug-label">
              <span class="path-chip">{routes.channel.href({ channelId: person.slug })}</span>
            </p>
            <p class="field-hint">This stays the same if you change your name.</p>

            <span class="field-label" id="details-photo-label">
              Photo <span class="field-optional">(optional)</span>
            </span>
            <PersonPhoto
              nameInputId="details-name"
              name={values.name}
              hue={person.hue}
              photo={person.photo}
              invalid={invalid('photo')}
              describedBy={describedBy('photo')}
            />
            <p class="field-hint">Without one, your initial shows. Under 1 MB, kept on this machine.</p>
            {errorField === 'photo' ? errorMessage : null}

            <div class="chform-actions">
              <button class="btn btn-primary" type="submit">
                Save changes
              </button>
            </div>
          </form>

          <form class="chform details-password" method="post" action={routes.details.action.href()}>
            <input type="hidden" name="intent" value="password" />
            <h2 class="details-section-title" id="details-password-title">
              Password
            </h2>
            <p class="field-hint details-password-lede">Choose a new one. You’ll need the password you use now.</p>

            <label class="field-label" for="details-current">
              Current password
            </label>
            <input
              id="details-current"
              class="field"
              type="password"
              name="current"
              autocomplete="current-password"
              required
              autofocus={errorField === 'current' ? true : undefined}
              aria-invalid={invalid('current')}
              aria-describedby={describedBy('current')}
            />
            {errorField === 'current' ? errorMessage : null}

            <label class="field-label" for="details-password">
              New password
            </label>
            <input
              id="details-password"
              class="field"
              type="password"
              name="password"
              autocomplete="new-password"
              required
              minlength={4}
              aria-invalid={invalid('password')}
              aria-describedby={describedBy('password')}
            />
            {errorField === 'password' ? errorMessage : null}

            <label class="field-label" for="details-confirm">
              Confirm new password
            </label>
            <input
              id="details-confirm"
              class="field"
              type="password"
              name="confirm"
              autocomplete="new-password"
              required
              minlength={4}
              aria-invalid={invalid('confirm')}
              aria-describedby={describedBy('confirm')}
            />
            {errorField === 'confirm' ? errorMessage : null}

            <div class="chform-actions">
              <button class="btn btn-primary" type="submit">
                Change password
              </button>
            </div>
          </form>
        </section>
      </AppShell>
    )
  }
}
