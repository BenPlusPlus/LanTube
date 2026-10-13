import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { channelLimits, type Channel } from '../data/library.ts'
import { routes } from '../routes.ts'
import { Avatar } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'
import { ChannelPicture } from './public/channel-picture.tsx'

export interface ChannelFormValues {
  name: string
  description: string
  managerIds: string[]
}

export interface ChannelFormPageProps {
  person: Person
  people: Person[]
  /** Present when editing an existing channel. */
  channel?: Channel
  values: ChannelFormValues
  /** Only the Channel owner names Managers. Hidden when a Manager edits. */
  canNameManagers?: boolean
  error?: string
  errorField?: 'name' | 'description' | 'photo'
}

function asChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

/** What an unsigned visitor sees on /channels/new: why, and the one way forward. */
export function SignInToCreate() {
  return () => (
    <AppShell current="channels" title="New channel" person={null}>
      <section class="empty" aria-labelledby="page-title">
        <Icon name="user" size={40} />
        <h1 id="page-title">Sign in to start a channel</h1>
        <p>Channels belong to people in the house. Sign in, and you can start one and name Managers.</p>
        <a class="btn btn-secondary" href={routes.signin.index.href()}>
          <Icon name="user" size={20} />
          Sign in
        </a>
      </section>
    </AppShell>
  )
}

export function ChannelFormPage(handle: Handle<ChannelFormPageProps>) {
  return () => {
    let { person, people, channel, values, error, errorField } = handle.props
    let editing = channel !== undefined
    let canNameManagers = handle.props.canNameManagers ?? true
    let action = channel ? routes.channelEdit.action.href({ channelId: channel.id }) : routes.channelNew.action.href()
    let cancel = channel ? routes.channel.href({ channelId: channel.id }) : routes.channels.href()
    let heading = channel ? `Edit ${channel.name}` : 'New channel'
    let others = people.filter((other) => other.id !== person.id)
    let invalid = (field: ChannelFormPageProps['errorField']) => (error && errorField === field ? 'true' : undefined)
    let describedBy = (field: ChannelFormPageProps['errorField'], hint?: string) =>
      [hint, invalid(field) ? 'channel-error' : undefined].filter(Boolean).join(' ') || undefined
    let errorMessage = error ? (
      <p class="field-error" id="channel-error" role="alert">
        {error}
      </p>
    ) : null

    return (
      <AppShell current="channels" title={heading} person={person}>
        <section class="chform-page" aria-labelledby="chform-title">
          <header class="chform-head">
            <h1 class="page-title" id="chform-title">
              {heading}
            </h1>
            <p class="page-lede">
              {editing
                ? canNameManagers
                  ? 'Rename it, change the picture, or change the Managers. Its address stays the same.'
                  : 'Rename it or change the picture. Its address stays the same.'
                : 'A channel collects videos about one thing: a band, a hobby, a game. You run it, and you name Managers.'}
            </p>
          </header>

          <form class="chform" method="post" action={action} enctype="multipart/form-data">
            <label class="field-label" for="channel-name">
              Name
            </label>
            <input
              id="channel-name"
              class="field"
              type="text"
              name="name"
              value={values.name}
              maxlength={channelLimits.name}
              autocomplete="off"
              placeholder="Board games"
              required
              autofocus={!editing || errorField === 'name' ? true : undefined}
              aria-invalid={invalid('name')}
              aria-describedby={describedBy('name')}
            />
            {errorField === 'name' ? errorMessage : null}

            <label class="field-label" for="channel-description">
              Description <span class="field-optional">(optional)</span>
            </label>
            <textarea
              id="channel-description"
              class="field field-area"
              name="description"
              rows={3}
              maxlength={channelLimits.description}
              placeholder="What goes on this channel?"
              aria-invalid={invalid('description')}
              aria-describedby={describedBy('description', 'channel-description-hint')}
              value={values.description}
            />
            <p class="field-hint" id="channel-description-hint">
              Up to {channelLimits.description} characters. Shown on the channel page and in the directory.
            </p>
            {errorField === 'description' ? errorMessage : null}

            <span class="field-label" id="channel-photo-label">
              Picture <span class="field-optional">(optional)</span>
            </span>
            <ChannelPicture
              nameInputId="channel-name"
              name={values.name}
              hue={channel?.hue}
              photo={channel?.photo}
              invalid={invalid('photo')}
              describedBy={describedBy('photo')}
            />
            <p class="field-hint">Without one, the channel shows its first letter. Under 1 MB, kept on this machine.</p>
            {errorField === 'photo' ? errorMessage : null}

            {canNameManagers ? (
              <fieldset class="chform-posters">
                <legend class="field-label">Managers</legend>
                <p class="field-hint">You run this channel. Name anyone else in the house as a Manager.</p>
                <ul class="poster-list">
                  <li>
                    <span class="poster poster-owner">
                      <Avatar channel={asChannel(person)} size="md" />
                      <span class="poster-name">{person.name}</span>
                      <span class="poster-role">You · owner</span>
                    </span>
                  </li>
                  {others.map((other) => (
                    <li>
                      <label class="poster">
                        <input
                          class="poster-input"
                          type="checkbox"
                          name="managers"
                          value={other.id}
                          checked={values.managerIds.includes(other.id)}
                        />
                        <Avatar channel={asChannel(other)} size="md" />
                        <span class="poster-name">{other.name}</span>
                        <span class="check" aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {others.length === 0 ? <p class="field-hint">Nobody else has joined the house yet.</p> : null}
              </fieldset>
            ) : null}

            {error && !errorField ? errorMessage : null}

            <div class="chform-actions">
              <button class="btn btn-primary" type="submit">
                {editing ? 'Save changes' : 'Create channel'}
              </button>
              <a class="btn btn-ghost" href={cancel}>
                Cancel
              </a>
            </div>
          </form>
        </section>
      </AppShell>
    )
  }
}
