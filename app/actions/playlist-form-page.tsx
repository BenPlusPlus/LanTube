import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Video } from '../data/library.ts'
import { playlistLimits, type Playlist, type Visibility } from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { Icon, type IconName } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'

export interface PlaylistFormValues {
  name: string
  description: string
  visibility: Visibility
}

export type PlaylistFormField = 'name' | 'description' | 'delete'

export interface PlaylistFormPageProps {
  person: Person
  /** Present when editing an existing playlist. */
  playlist?: Playlist
  /** A new playlist started from the watch page begins with this video. */
  video?: Video
  values: PlaylistFormValues
  error?: string
  errorField?: PlaylistFormField
}

export function readPlaylistForm(formData: FormData): PlaylistFormValues {
  let text = (name: string) => {
    let value = formData.get(name)
    return typeof value === 'string' ? value : ''
  }
  return {
    name: text('name'),
    description: text('description'),
    visibility: text('visibility') === 'public' ? 'public' : 'private',
  }
}

/** What an unsigned visitor sees on /playlists/new. */
export function SignInToCreatePlaylist() {
  return () => (
    <AppShell current="playlists" title="New playlist" person={null}>
      <section class="empty" aria-labelledby="page-title">
        <Icon name="playlists" size={40} />
        <h1 id="page-title">Sign in to make a playlist</h1>
        <p>Playlists belong to people in the house. Sign in, and you can collect videos and choose who sees them.</p>
        <a class="btn btn-secondary" href={routes.signin.index.href()}>
          <Icon name="user" size={20} />
          Sign in
        </a>
      </section>
    </AppShell>
  )
}

const visibilityOptions: { value: Visibility; label: string; detail: string; icon: IconName }[] = [
  { value: 'private', label: 'Private', detail: 'Only you can see it', icon: 'lock' },
  { value: 'public', label: 'Everyone in the house', detail: 'Anyone in the house can see it', icon: 'channels' },
]

export function PlaylistFormPage(handle: Handle<PlaylistFormPageProps>) {
  return () => {
    let { person, playlist, video, values, error, errorField } = handle.props
    let editing = playlist !== undefined
    let action = playlist ? routes.playlistEdit.action.href({ playlistId: playlist.id }) : routes.playlistNew.action.href()
    let cancel = playlist
      ? routes.playlist.href({ playlistId: playlist.id })
      : video
        ? routes.watch.href({ videoId: video.id })
        : routes.playlists.href()
    let heading = playlist ? `Edit ${playlist.name}` : 'New playlist'
    let invalid = (field: PlaylistFormField) => (error && errorField === field ? 'true' : undefined)
    let describedBy = (field: PlaylistFormField, hint?: string) =>
      [hint, invalid(field) ? 'playlist-error' : undefined].filter(Boolean).join(' ') || undefined
    let errorMessage = error ? (
      <p class="field-error" id="playlist-error" role="alert">
        {error}
      </p>
    ) : null

    return (
      <AppShell current="playlists" title={heading} person={person}>
        <section class="chform-page" aria-labelledby="plform-title">
          <header class="chform-head">
            <h1 class="page-title" id="plform-title">
              {heading}
            </h1>
            <p class="page-lede">
              {editing
                ? 'Rename it, describe it, or change who can see it. Its videos and their order stay as they are.'
                : video
                  ? `It starts with “${video.title}”. Add more from any video’s Save button.`
                  : 'Collect videos from anywhere in the house. Add them from any video’s Save button.'}
            </p>
          </header>

          <form class="chform" method="post" action={action}>
            {video ? <input type="hidden" name="video" value={video.id} /> : null}
            <label class="field-label" for="playlist-name">
              Name
            </label>
            <input
              id="playlist-name"
              class="field"
              type="text"
              name="name"
              value={values.name}
              maxlength={playlistLimits.name}
              autocomplete="off"
              placeholder="Road trip 2025"
              required
              autofocus={!editing || errorField === 'name' ? true : undefined}
              aria-invalid={invalid('name')}
              aria-describedby={describedBy('name')}
            />
            {errorField === 'name' ? errorMessage : null}

            <label class="field-label" for="playlist-description">
              Description <span class="field-optional">(optional)</span>
            </label>
            <textarea
              id="playlist-description"
              class="field field-area"
              name="description"
              rows={3}
              maxlength={playlistLimits.description}
              placeholder="What ties these videos together?"
              aria-invalid={invalid('description')}
              aria-describedby={describedBy('description', 'playlist-description-hint')}
              value={values.description}
            />
            <p class="field-hint" id="playlist-description-hint">
              Up to {playlistLimits.description} characters. Shown on the playlist page.
            </p>
            {errorField === 'description' ? errorMessage : null}

            <fieldset class="chform-posters">
              <legend class="field-label">Who can see it</legend>
              <div class="pvis-options">
                {visibilityOptions.map((option) => (
                  <label class="poster pvis-option">
                    <input class="poster-input" type="radio" name="visibility" value={option.value} checked={values.visibility === option.value} />
                    <Icon name={option.icon} size={20} />
                    <span class="pvis-option-text">
                      <span class="poster-name">{option.label}</span>
                      <span class="poster-role">{option.detail}</span>
                    </span>
                    <span class="radio" aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>

            {error && !errorField ? errorMessage : null}

            <div class="chform-actions">
              <button class="btn btn-primary" type="submit">
                {editing ? 'Save changes' : 'Create playlist'}
              </button>
              <a class="btn btn-ghost" href={cancel}>
                Cancel
              </a>
            </div>
          </form>

          {playlist ? (
            <form class="pldelete" method="post" action={action} aria-labelledby="pldelete-title">
              <input type="hidden" name="intent" value="delete" />
              <h2 class="pldelete-title" id="pldelete-title">
                Delete this playlist
              </h2>
              <p class="field-hint">
                The playlist goes away for everyone. The videos in it stay where they are.
              </p>
              <label class="chform-remove">
                <input type="checkbox" name="confirm" value="1" aria-invalid={invalid('delete')} aria-describedby={describedBy('delete')} />
                <span class="check" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
                Yes, delete {playlist.name}
              </label>
              {errorField === 'delete' ? errorMessage : null}
              <div>
                <button class="btn btn-secondary" type="submit">
                  <Icon name="trash" size={18} />
                  Delete playlist
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </AppShell>
    )
  }
}
