import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Channel, Video } from '../data/library.ts'
import { channelStats, formatPlays, getChannel, posterChannel } from '../data/library.ts'
import type { MediaFile } from '../data/media.ts'
import { tagsInUse } from '../data/tags.ts'
import { uploadLimits } from '../data/uploads.ts'
import { routes } from '../routes.ts'
import { Avatar } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'
import { Player } from './public/player.tsx'
import { TagsField } from './public/tags-field.tsx'
import { VideoEditPreview } from './public/video-edit-preview.tsx'
import { videoDates, videoPlayerProps } from './watch-page.tsx'

export interface VideoEditValues {
  title: string
  tags: string[]
  tagDraft?: string
  visibility: 'house' | 'private'
  audienceIds: string[]
}

export type VideoEditField = 'title' | 'tags' | 'captions' | 'delete' | 'drop'

export interface VideoEditPageProps {
  video: Video
  media: MediaFile | null
  person: Person
  people: Person[]
  canEditTitle: boolean
  canEditTags: boolean
  canEditAccess: boolean
  canDelete: boolean
  canDrop: boolean
  values?: VideoEditValues
  error?: string
  errorField?: VideoEditField
}

function asChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

/** Change a Video's details away from the player, then go back and watch it. */
export function VideoEditPage(handle: Handle<VideoEditPageProps>) {
  return () => {
    let { video, media, person, people, canEditTitle, canEditTags, canEditAccess, canDelete, canDrop, error, errorField } =
      handle.props
    let channel = getChannel(video.channelId)!
    let isFolder = channel.kind === 'folder'
    let stats = channelStats(channel.id, person.id)
    let watchHref = routes.watch.href({ videoId: video.id })
    let player = videoPlayerProps(video, media, person)
    let dates = videoDates(video, isFolder)
    let values = handle.props.values ?? {
      title: video.title,
      tags: tagsInUse([video]).map((tag) => tag.name),
      visibility: video.private ? 'private' : 'house',
      audienceIds: video.audience ?? [],
    }
    let videoOwner = video.postedBy ? posterChannel(video.postedBy) : undefined
    let videoOwnerIsViewer = video.postedBy === person.id
    let others = people.filter((other) => other.id !== video.postedBy)
    let canSave = canEditTitle || canEditTags || canEditAccess
    let fieldError = (field: VideoEditField) => (error && errorField === field ? error : undefined)
    let titleError = fieldError('title')
    let captionsError = fieldError('captions')

    return (
      <AppShell current={null} title={`Edit ${video.title}`} person={person}>
        <header class="upload-head">
          <h1 class="page-title" id="vedit-title">
            Edit video
          </h1>
          <p class="page-lede">Changes show everywhere in the house once you save.</p>
        </header>

        <div class="vedit">
          <div class="vedit-main">
            {canSave ? (
              <form
                id="vedit-form"
                class="vedit-form"
                method="post"
                action={routes.watchSave.href({ videoId: video.id })}
                enctype="multipart/form-data"
                aria-labelledby="vedit-title"
              >
                {canEditTitle ? (
                  <>
                    <label class="field-label" for="vedit-title-field">
                      Title
                    </label>
                    <input
                      id="vedit-title-field"
                      class="field"
                      type="text"
                      name="title"
                      value={values.title}
                      maxlength={uploadLimits.title}
                      autocomplete="off"
                      required
                      aria-invalid={titleError ? 'true' : undefined}
                      aria-describedby={titleError ? 'vedit-title-error' : undefined}
                    />
                    {titleError ? (
                      <p class="field-error" id="vedit-title-error" role="alert">
                        {titleError}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div class="vedit-fixed">
                    <p class="field-label">Title</p>
                    <p class="vedit-fixed-value">{video.title}</p>
                    <p class="field-hint">Only an Admin renames a folder video. Its file keeps its name either way.</p>
                  </div>
                )}

                {canEditTags ? (
                  <TagsField
                    tags={values.tags}
                    tagDraft={values.tagDraft}
                    error={fieldError('tags')}
                    inputId="vedit-tags"
                    hintId="vedit-tags-hint"
                    errorId="vedit-tags-error"
                  />
                ) : null}

                {canEditTitle ? (
                  <>
                    <label class="field-label" for="vedit-captions">
                      Subtitles <span class="field-optional">(optional)</span>
                    </label>
                    <p class="field-hint" id="vedit-captions-hint">
                      {video.captions
                        ? 'A .vtt is attached. Choose another file to replace it.'
                        : 'One WebVTT file. Shown as captions on this video.'}
                    </p>
                    <input
                      id="vedit-captions"
                      class="field"
                      type="file"
                      name="captions"
                      accept=".vtt,text/vtt"
                      aria-invalid={captionsError ? 'true' : undefined}
                      aria-describedby={captionsError ? 'vedit-captions-error' : 'vedit-captions-hint'}
                    />
                    {captionsError ? (
                      <p class="field-error" id="vedit-captions-error" role="alert">
                        {captionsError}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {canEditAccess ? (
                  <fieldset class="chform-posters upload-who">
                    <legend class="field-label">Who can see it</legend>
                    <div class="pvis-options">
                      <label class="poster pvis-option">
                        <input class="poster-input" type="radio" name="visibility" value="house" checked={values.visibility !== 'private'} />
                        <Icon name="channels" size={20} />
                        <span class="pvis-option-text">
                          <span class="poster-name">Everyone in the house</span>
                          <span class="poster-role">On Home and on the channel</span>
                        </span>
                        <span class="radio" aria-hidden="true" />
                      </label>
                      <label class="poster pvis-option">
                        <input class="poster-input" type="radio" name="visibility" value="private" checked={values.visibility === 'private'} />
                        <Icon name="lock" size={20} />
                        <span class="pvis-option-text">
                          <span class="poster-name">Private</span>
                          <span class="poster-role">You choose who else can see it</span>
                        </span>
                        <span class="radio" aria-hidden="true" />
                      </label>
                    </div>
                    <div class="audience-picker">
                      <p class="field-hint">
                        {videoOwnerIsViewer
                          ? 'You can always see it. Pick anyone else in the house.'
                          : `${videoOwner?.name ?? 'The Video owner'} can always see it. Pick anyone else in the house.`}
                      </p>
                      <ul class="poster-list">
                        <li>
                          <span class="poster poster-owner">
                            <Avatar channel={videoOwner ?? asChannel(person)} size="md" />
                            <span class="poster-name">{videoOwner?.name ?? person.name}</span>
                            <span class="poster-role">{videoOwnerIsViewer ? 'You · owner' : 'Owner'}</span>
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
                                checked={values.audienceIds.includes(other.id)}
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
                    </div>
                  </fieldset>
                ) : isFolder ? (
                  <div class="vedit-fixed">
                    <p class="field-label">Who can see it</p>
                    <p class="field-hint">Everyone in the house. Folder videos are shared with the whole house.</p>
                  </div>
                ) : null}

                <div class="chform-actions">
                  <button class="btn btn-primary" type="submit">
                    Save changes
                  </button>
                  <a class="btn btn-ghost" href={watchHref}>
                    Cancel
                  </a>
                </div>
              </form>
            ) : null}

            {canDelete ? (
              <form class="pldelete" method="post" action={routes.watchDelete.href({ videoId: video.id })} aria-labelledby="vdelete-title">
                <h2 class="pldelete-title" id="vdelete-title">
                  Delete this video
                </h2>
                <p class="field-hint">The video leaves the house. The file LanTube wrote is removed from the Media share.</p>
                <label class="chform-remove">
                  <input
                    type="checkbox"
                    name="confirm"
                    value="1"
                    aria-invalid={errorField === 'delete' ? 'true' : undefined}
                    aria-describedby={errorField === 'delete' ? 'vedit-delete-error' : undefined}
                  />
                  <span class="check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  Yes, delete {video.title}
                </label>
                {fieldError('delete') ? (
                  <p class="field-error" id="vedit-delete-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div>
                  <button class="btn btn-secondary" type="submit">
                    <Icon name="trash" size={18} />
                    Delete video
                  </button>
                </div>
              </form>
            ) : null}
            {canDrop ? (
              <form class="pldelete" method="post" action={routes.watchDelete.href({ videoId: video.id })} aria-labelledby="vdrop-title">
                <h2 class="pldelete-title" id="vdrop-title">
                  Drop this video
                </h2>
                <p class="field-hint">The video leaves the house catalogue. The file on the Media share stays.</p>
                <label class="chform-remove">
                  <input
                    type="checkbox"
                    name="confirm"
                    value="1"
                    aria-invalid={errorField === 'drop' ? 'true' : undefined}
                    aria-describedby={errorField === 'drop' ? 'vedit-drop-error' : undefined}
                  />
                  <span class="check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  Yes, drop {video.title}
                </label>
                {fieldError('drop') ? (
                  <p class="field-error" id="vedit-drop-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div>
                  <button class="btn btn-secondary" type="submit">
                    <Icon name="trash" size={18} />
                    Drop video
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <aside class="vedit-side" aria-label="Preview">
            <div class="vedit-player">
              <Player key={video.id} {...player.props} theater={false} compact />
            </div>
            <p class="vedit-side-label">On the watch page</p>
            <VideoEditPreview
              formId="vedit-form"
              title={values.title}
              tags={values.tags}
              private={values.visibility === 'private'}
              channel={{
                name: channel.name,
                sub: `${stats.count} video${stats.count === 1 ? '' : 's'}${isFolder ? ' · folder' : ''}`,
                kind: channel.kind,
                hue: channel.hue,
                photo: channel.photo,
              }}
              plays={formatPlays(video.plays)}
              dateLabel={dates.label}
              dateIso={dates.iso}
              dateLong={dates.long}
              relative={dates.relative}
              source={isFolder ? channel.path : undefined}
            />
          </aside>
        </div>
      </AppShell>
    )
  }
}
