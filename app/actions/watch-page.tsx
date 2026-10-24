import type { Handle } from 'remix/component'

import { highWaterOf, isAssigned, mustFinishAssignedFirst } from '../data/assignments.ts'
import { brandName } from '../data/brand.ts'
import type { Person } from '../data/household.ts'
import { allowanceFor } from '../data/watch-limits.ts'
import type { Channel, Video } from '../data/library.ts'
import {
  channelStats,
  formatAdded,
  formatPlays,
  getChannel,
  posterChannel,
  isInProgress,
  progressOf,
  progressPercent,
  publishedAt,
  relatedVideos,
  thumbUrl,
} from '../data/library.ts'
import type { MediaFile } from '../data/media.ts'
import { playlistsOwnedBy, playlistVideos, type Playlist } from '../data/playlists.ts'
import { tagsInUse } from '../data/tags.ts'
import { uploadLimits } from '../data/uploads.ts'
import { routes } from '../routes.ts'
import { AssignMenu, Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { ownerOf, watchInList } from '../ui/playlists.tsx'
import { AppShell } from '../ui/shell.tsx'
import { Player } from './public/player.tsx'
import { SaveMenu } from './public/save-menu.tsx'
import { TagsField } from './public/tags-field.tsx'

export interface WatchEditValues {
  title: string
  tags: string[]
  tagDraft?: string
  visibility: 'house' | 'private'
  audienceIds: string[]
}

export interface WatchPageProps {
  video: Video
  media: MediaFile | null
  theater: boolean
  person?: Person | null
  people?: Person[]
  /** Playing through a playlist that holds this video. */
  list?: Playlist
  canEditTitle?: boolean
  canEditTags?: boolean
  canEditAccess?: boolean
  canDelete?: boolean
  canDrop?: boolean
  edit?: WatchEditValues
  error?: string
  errorField?: 'title' | 'tags' | 'delete' | 'drop' | 'captions'
}

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

function asChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

function RelatedCard(handle: Handle<{ video: Video; viewerId?: string; returnTo?: string }>) {
  return () => {
    let { video, viewerId, returnTo } = handle.props
    let channel = getChannel(video.channelId)!
    let href = routes.watch.href({ videoId: video.id })
    let progress = progressPercent(video, viewerId)

    return (
      <article class="rcard">
        <a class="rcard-thumb" href={href} tabindex={-1} aria-hidden="true">
          <ThumbImage video={video} />
          <DurationBadge seconds={video.durationSec} />
          {progress !== null ? (
            <span class="vcard-progress">
              <span style={`width:${progress.toFixed(1)}%`} />
            </span>
          ) : null}
        </a>
        <div class="rcard-text">
          <div class="rcard-heading">
            <h3 class="rcard-title">
              <a href={href}>{video.title}</a>
            </h3>
            <AssignMenu video={video} viewerId={viewerId} returnTo={returnTo} />
          </div>
          <p class="rcard-meta">
            <a href={routes.channel.href({ channelId: channel.id })}>{channel.name}</a>
          </p>
          <p class="rcard-meta">
            {formatPlays(video.plays)} · {formatAdded(video.addedDaysAgo)}
          </p>
        </div>
      </article>
    )
  }
}

/** The playlist being played through: where you are, what's either side, and the rest. */
function ListPanel(handle: Handle<{ playlist: Playlist; video: Video; person: Person | null }>) {
  return () => {
    let { playlist, video, person } = handle.props
    let videos = playlistVideos(playlist, person?.id)
    let index = videos.findIndex((entry) => entry.id === video.id)
    let prev = videos[index - 1]
    let next = videos[index + 1]
    let owner = ownerOf(playlist)
    let ownerName = owner && person?.id === playlist.ownerId ? 'You' : owner?.name

    return (
      <section class="wlist" aria-labelledby="wlist-title">
        <header class="wlist-head">
          <div class="wlist-heading">
            <h2 class="wlist-title" id="wlist-title">
              <a href={routes.playlist.href({ playlistId: playlist.id })}>{playlist.name}</a>
            </h2>
            <p class="wlist-meta">
              {ownerName ? `${ownerName} · ` : ''}
              <span class="wlist-pos">
                {index + 1} / {videos.length}
              </span>
            </p>
          </div>
          <nav class="wlist-nav" aria-label="Playlist">
            {prev ? (
              <a class="icon-btn" href={watchInList(prev.id, playlist.id)} aria-label={`Previous: ${prev.title}`} title="Previous">
                <Icon name="skip-back" size={20} />
              </a>
            ) : (
              <span class="icon-btn is-off" aria-hidden="true">
                <Icon name="skip-back" size={20} />
              </span>
            )}
            {next ? (
              <a class="icon-btn" href={watchInList(next.id, playlist.id)} aria-label={`Next: ${next.title}`} title="Next">
                <Icon name="skip-forward" size={20} />
              </a>
            ) : (
              <span class="icon-btn is-off" aria-hidden="true">
                <Icon name="skip-forward" size={20} />
              </span>
            )}
          </nav>
        </header>
        <ol class="wlist-items">
          {videos.map((entry, i) => {
            let current = entry.id === video.id
            let channel = getChannel(entry.channelId)
            return (
              <li class={current ? 'wlist-item is-current' : 'wlist-item'}>
                <a href={watchInList(entry.id, playlist.id)} aria-current={current ? 'true' : undefined}>
                  <span class="wlist-index" aria-hidden="true">
                    {current ? <Icon name="play" size={12} /> : i + 1}
                  </span>
                  <span class="wlist-thumb">
                    <ThumbImage video={entry} />
                    <DurationBadge seconds={entry.durationSec} />
                  </span>
                  <span class="wlist-text">
                    <span class="wlist-name">{entry.title}</span>
                    <span class="wlist-channel">{channel?.name}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </section>
    )
  }
}

export function WatchPage(handle: Handle<WatchPageProps>) {
  return () => {
    let {
      video,
      media,
      theater,
      person = null,
      people = [],
      list,
      canEditTitle = false,
      canEditTags = false,
      canEditAccess = false,
      canDelete = false,
      canDrop = false,
      error,
      errorField,
    } = handle.props
    let canSave = canEditTitle || canEditTags || canEditAccess
    let channel = getChannel(video.channelId)!
    let stats = channelStats(channel.id, person?.id)
    let published = publishedAt(video)
    let related = relatedVideos(video, 12, person?.id)
    let isFolder = channel.kind === 'folder'
    let playable = media?.exists === true
    let assignedFirst = mustFinishAssignedFirst(person, video.id)
    let assigned = Boolean(person && isAssigned(person.id, video.id))
    let expectedFile = media?.displayPath ?? video.file ?? `${video.id}.mp4`
    let here = list ? watchInList(video.id, list.id) : routes.watch.href({ videoId: video.id })
    let videoOwner = video.postedBy ? posterChannel(video.postedBy) : undefined
    let videoOwnerIsViewer = Boolean(person && video.postedBy === person.id)
    let others = people.filter((other) => other.id !== video.postedBy)
    let edit = handle.props.edit ?? {
      title: video.title,
      tags: tagsInUse([video]).map((tag) => tag.name),
      visibility: video.private ? 'private' : 'house',
      audienceIds: video.audience ?? [],
    }
    let audienceIds = edit.audienceIds
    let titleError = error && errorField === 'title' ? error : undefined
    let tagError = error && errorField === 'tags' ? error : undefined
    let captionsError = error && errorField === 'captions' ? error : undefined

    return (
      <AppShell current={null} title={canEditTitle ? edit.title || video.title : video.title} person={person} layout="watch">
        <div class={theater ? 'watch is-theater' : 'watch'}>
          <div class="watch-player">
            <Player
              key={video.id}
              videoId={video.id}
              title={video.title}
              src={playable && !assignedFirst ? routes.media.href({ videoId: video.id }) : null}
              poster={thumbUrl(video) ?? undefined}
              durationSec={video.durationSec}
              resumeAt={isInProgress(video, person?.id) ? progressOf(video, person?.id) : undefined}
              furthestAt={assigned && person ? highWaterOf(person.id, video.id) : undefined}
              maxRate={assigned ? 1.5 : undefined}
              activityHref={routes.watchActivity.href({ videoId: video.id })}
              theater={theater}
              expectedFile={expectedFile}
              brand={brandName()}
              timeLeftSec={person ? allowanceFor(person)?.remainingSec : undefined}
              mustFinishAssigned={assignedFirst}
              captionsSrc={video.captions ? routes.captions.href({ videoId: video.id }) : undefined}
              chapters={video.chapters && video.chapters.length >= 2 ? video.chapters : undefined}
            />
            {playable && !assignedFirst ? (
              <noscript>
                <p class="watch-noscript">
                  The {brandName()} player needs JavaScript.{' '}
                  <a href={routes.media.href({ videoId: video.id })}>Open the video file directly</a>.
                </p>
              </noscript>
            ) : null}
          </div>

          <section class="watch-info" aria-labelledby="watch-title">
            {canEditTitle ? (
              <>
                <input
                  id="watch-title"
                  class="watch-title"
                  type="text"
                  name="title"
                  form="watch-save"
                  value={edit.title}
                  maxlength={uploadLimits.title}
                  autocomplete="off"
                  required
                  aria-label="Title"
                  aria-invalid={titleError ? 'true' : undefined}
                  aria-describedby={titleError ? 'watch-error' : undefined}
                />
                {titleError ? (
                  <p class="field-error" id="watch-error" role="alert">
                    {titleError}
                  </p>
                ) : null}
              </>
            ) : (
              <h1 class="watch-title" id="watch-title">
                {video.title}
              </h1>
            )}

            <div class="watch-channel">
              <a class="watch-channel-link" href={routes.channel.href({ channelId: channel.id })}>
                <Avatar channel={channel} />
                <span class="watch-channel-text">
                  <span class="watch-channel-name">{channel.name}</span>
                  <span class="watch-channel-sub">
                    {stats.count} video{stats.count === 1 ? '' : 's'}
                    {isFolder ? ' · folder' : ''}
                  </span>
                </span>
              </a>
              {person ? (
                <SaveMenu
                  videoId={video.id}
                  videoTitle={video.title}
                  items={playlistsOwnedBy(person.id).map((playlist) => ({
                    id: playlist.id,
                    name: playlist.name,
                    private: playlist.visibility === 'private',
                    saved: playlist.videoIds.includes(video.id),
                    action: routes.playlistItems.href({ playlistId: playlist.id }),
                  }))}
                  newHref={`${routes.playlistNew.index.href()}?video=${encodeURIComponent(video.id)}`}
                  returnTo={here}
                />
              ) : (
                <a class="btn btn-secondary save-btn" href={routes.signin.index.href()} title="Sign in to save videos to playlists">
                  <Icon name="list-plus" size={20} />
                  Save
                </a>
              )}
            </div>

            <div class="watch-facts">
              <p class="watch-stats">
                <span>{formatPlays(video.plays)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isFolder ? 'Added' : 'Published'}{' '}
                  <time datetime={published.toISOString()} title={published.toLocaleString('en-US')}>
                    {longDate.format(published)}
                  </time>
                </span>
                <span class="watch-stats-rel">({formatAdded(video.addedDaysAgo).toLowerCase()})</span>
                {video.private ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span class="pvis">
                      <Icon name="lock" size={14} />
                      Private
                    </span>
                  </>
                ) : null}
              </p>
              {canEditTags ? (
                <TagsField
                  tags={edit.tags}
                  tagDraft={edit.tagDraft}
                  error={tagError}
                  form="watch-save"
                  inputId="watch-tags"
                  hintId="watch-tags-hint"
                  errorId="watch-error"
                />
              ) : video.tags.length > 0 ? (
                <ul class="watch-tags" aria-label="Tags">
                  {tagsInUse([video]).map((tag) => (
                    <li>
                      <a class="chip" href={`${routes.home.href()}?tag=${encodeURIComponent(tag.slug)}`}>
                        {tag.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {isFolder && channel.path ? <p class="watch-source">Indexed from {channel.path}</p> : null}
              {canEditTitle && person ? (
                <form
                  class="watch-captions"
                  method="post"
                  action={routes.watchCaptions.href({ videoId: video.id })}
                  enctype="multipart/form-data"
                >
                  <label class="field-label" for="watch-captions-file">
                    Subtitles <span class="field-optional">(optional)</span>
                  </label>
                  <p class="field-hint" id="watch-captions-hint">
                    {video.captions
                      ? 'A .vtt is attached. Choose another file to replace it.'
                      : 'One WebVTT file. Shown as captions on this video.'}
                  </p>
                  <input
                    id="watch-captions-file"
                    class="field"
                    type="file"
                    name="captions"
                    accept=".vtt,text/vtt"
                    required
                    aria-invalid={captionsError ? 'true' : undefined}
                    aria-describedby={captionsError ? 'watch-captions-error' : 'watch-captions-hint'}
                  />
                  {captionsError ? (
                    <p class="field-error" id="watch-captions-error" role="alert">
                      {captionsError}
                    </p>
                  ) : null}
                  <div class="watch-captions-actions">
                    <button class="btn btn-secondary" type="submit">
                      {video.captions ? 'Replace subtitles' : 'Attach subtitles'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            {canSave && person ? (
              <form id="watch-save" class="watch-access" method="post" action={routes.watchSave.href({ videoId: video.id })}>
                {canEditAccess ? (
                  <fieldset class="chform-posters upload-who">
                    <legend class="field-label">Who can see it</legend>
                    <div class="pvis-options">
                      <label class="poster pvis-option">
                        <input class="poster-input" type="radio" name="visibility" value="house" checked={edit.visibility !== 'private'} />
                        <Icon name="channels" size={20} />
                        <span class="pvis-option-text">
                          <span class="poster-name">Everyone in the house</span>
                          <span class="poster-role">On Home and on the channel</span>
                        </span>
                        <span class="radio" aria-hidden="true" />
                      </label>
                      <label class="poster pvis-option">
                        <input class="poster-input" type="radio" name="visibility" value="private" checked={edit.visibility === 'private'} />
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
                                checked={audienceIds.includes(other.id)}
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
                ) : null}
                <div class="chform-actions">
                  <button class="btn btn-primary" type="submit">
                    Save
                  </button>
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
                    aria-describedby={errorField === 'delete' ? 'watch-delete-error' : undefined}
                  />
                  <span class="check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  Yes, delete {edit.title || video.title}
                </label>
                {errorField === 'delete' && error ? (
                  <p class="field-error" id="watch-delete-error" role="alert">
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
                    aria-describedby={errorField === 'drop' ? 'watch-drop-error' : undefined}
                  />
                  <span class="check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  Yes, drop {edit.title || video.title}
                </label>
                {errorField === 'drop' && error ? (
                  <p class="field-error" id="watch-drop-error" role="alert">
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
          </section>

          <div class="watch-rail">
            {list ? <ListPanel playlist={list} video={video} person={person} /> : null}
            <section class="watch-related" aria-labelledby="related-title">
              <h2 class="watch-related-title" id="related-title">
                More like this
              </h2>
              {related.length > 0 ? (
                <ul class="watch-related-list">
                  {related.map((other) => (
                    <li>
                      <RelatedCard video={other} viewerId={person?.id} returnTo={here} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="watch-related-empty">This is the only video in the house so far.</p>
              )}
            </section>
          </div>
        </div>
      </AppShell>
    )
  }
}
