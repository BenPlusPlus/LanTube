import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'
import { initialOf } from '../../ui/public/identity.ts'

export type WatchVisibilityValue = 'house' | 'private'

export interface WatchVisibilityPerson {
  id: string
  name: string
  hue: number
  photo?: string
}

export interface WatchVisibilityProps {
  action: string
  person: WatchVisibilityPerson
  people: WatchVisibilityPerson[]
  visibility: WatchVisibilityValue
  audienceIds: string[]
}

function PersonAvatar(handle: Handle<{ person: WatchVisibilityPerson }>) {
  return () => {
    let { person } = handle.props
    return (
      <span class="avatar avatar-md" style={`--hue:${person.hue}`} aria-hidden="true">
        {person.photo ? <img class="avatar-photo" src={person.photo} alt="" /> : initialOf(person.name) || '?'}
      </span>
    )
  }
}

/** Video owner changes house vs private and names Audience; Save is explicit. */
export const WatchVisibility = clientEntry(import.meta.url, function WatchVisibility(handle: Handle<WatchVisibilityProps>) {
  let visibility: WatchVisibilityValue = handle.props.visibility
  let audienceIds = [...handle.props.audienceIds]

  return () => {
    let { action, person, people } = handle.props
    let isPrivate = visibility === 'private'
    let others = people.filter((other) => other.id !== person.id)

    return (
      <form class="watch-access" method="post" action={action}>
        <fieldset class="chform-posters upload-who">
          <legend class="field-label">Who can see it</legend>
          <div class="pvis-options">
            <label class="poster pvis-option">
              <input
                class="poster-input"
                type="radio"
                name="visibility"
                value="house"
                checked={!isPrivate}
                mix={[
                  on('change', () => {
                    visibility = 'house'
                    handle.update()
                  }),
                ]}
              />
              <Icon name="channels" size={20} />
              <span class="pvis-option-text">
                <span class="poster-name">Everyone in the house</span>
                <span class="poster-role">On Home and on the channel</span>
              </span>
              <span class="radio" aria-hidden="true" />
            </label>
            <label class="poster pvis-option">
              <input
                class="poster-input"
                type="radio"
                name="visibility"
                value="private"
                checked={isPrivate}
                mix={[
                  on('change', () => {
                    visibility = 'private'
                    handle.update()
                  }),
                ]}
              />
              <Icon name="lock" size={20} />
              <span class="pvis-option-text">
                <span class="poster-name">Private</span>
                <span class="poster-role">You choose who else can see it</span>
              </span>
              <span class="radio" aria-hidden="true" />
            </label>
          </div>
          {isPrivate ? (
            <div class="audience-picker">
              <p class="field-hint">You can always see it. Pick anyone else in the house.</p>
              <ul class="poster-list">
                <li>
                  <span class="poster poster-owner">
                    <PersonAvatar person={person} />
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
                        name="audience"
                        value={other.id}
                        checked={audienceIds.includes(other.id)}
                        mix={[
                          on('change', (event) => {
                            let checked = (event.currentTarget as HTMLInputElement).checked
                            audienceIds = checked
                              ? audienceIds.includes(other.id)
                                ? audienceIds
                                : [...audienceIds, other.id]
                              : audienceIds.filter((id) => id !== other.id)
                            handle.update()
                          }),
                        ]}
                      />
                      <PersonAvatar person={other} />
                      <span class="poster-name">{other.name}</span>
                      <span class="check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {others.length === 0 ? <p class="field-hint">Nobody else has joined the house yet.</p> : null}
            </div>
          ) : null}
        </fieldset>
        <div class="chform-actions">
          <button class="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
    )
  }
})
