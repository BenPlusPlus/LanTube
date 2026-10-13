import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'

const TAG_MAX = 40

export interface TagsFieldProps {
  tags: string[]
  tagDraft?: string
  error?: string
  /** Associate the input with a form elsewhere on the page. */
  form?: string
  inputId: string
  hintId: string
  errorId: string
}

export const TagsField = clientEntry(import.meta.url, function TagsField(handle: Handle<TagsFieldProps>) {
  let chosenTags = [...handle.props.tags]
  let tagDraft = handle.props.tagDraft ?? ''
  let enhanced = false
  let tagsInput: HTMLInputElement | undefined

  function applyTokens(raw: string, keepLastAsDraft: boolean) {
    let tokens = raw
      .split(',')
      .map((value) => value.trim().replace(/\s+/g, ' '))
      .filter((value) => value.length > 0)
    let draft = ''
    if (keepLastAsDraft && !raw.trim().endsWith(',') && tokens.length > 0) {
      draft = tokens.pop() ?? ''
    }
    for (let name of tokens) {
      if (name.length > TAG_MAX) {
        draft = name
        continue
      }
      let key = name.toLocaleLowerCase()
      if (!chosenTags.some((entry) => entry.toLocaleLowerCase() === key)) chosenTags = [...chosenTags, name]
    }
    tagDraft = draft
    if (tagsInput) tagsInput.value = draft
    handle.update()
  }

  handle.queueTask(() => {
    enhanced = true
    handle.update()
    if (handle.props.error) tagsInput?.focus()
    tagsInput?.form?.addEventListener(
      'submit',
      () => {
        applyTokens(tagsInput?.value ?? tagDraft, false)
        if (tagsInput) tagsInput.value = tagDraft ? [...chosenTags, tagDraft].join(', ') : chosenTags.join(', ')
      },
      { capture: true, signal: handle.signal },
    )
  })

  return () => {
    let { error, form, inputId, hintId, errorId } = handle.props
    return (
      <fieldset class="upload-tags">
        <legend class="field-label">
          Tags <span class="field-optional">(optional)</span>
        </legend>
        <p class="field-hint" id={hintId}>
          Separate names with commas.
        </p>
        {enhanced && chosenTags.length > 0 ? (
          <div class="upload-chips">
            {chosenTags.map((name) => (
              <span class="chip upload-chip">
                {name}
                <button
                  class="upload-chip-remove"
                  type="button"
                  aria-label={`Remove ${name}`}
                  mix={[
                    on('click', () => {
                      chosenTags = chosenTags.filter((entry) => entry !== name)
                      handle.update()
                    }),
                  ]}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          id={inputId}
          class="field"
          type="text"
          name="tags"
          form={form}
          value={enhanced ? tagDraft : [chosenTags.join(', '), tagDraft].filter(Boolean).join(', ')}
          autocomplete="off"
          placeholder="Kids, trips"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          mix={[
            ref((node) => (tagsInput = node as HTMLInputElement)),
            on('keydown', (event) => {
              if (event.key !== 'Enter' && event.key !== ',') return
              event.preventDefault()
              applyTokens((event.currentTarget as HTMLInputElement).value, false)
            }),
            on('input', (event) => {
              let value = (event.currentTarget as HTMLInputElement).value
              if (value.includes(',')) {
                applyTokens(value, true)
                return
              }
              tagDraft = value
              handle.update()
            }),
          ]}
        />
        {error ? (
          <p class="field-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    )
  }
})
