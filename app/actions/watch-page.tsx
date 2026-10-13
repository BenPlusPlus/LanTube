import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Video } from '../data/library.ts'
import {
  channelStats,
  formatAdded,
  formatPlays,
  getChannel,
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
import { routes } from '../routes.ts'
import { Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { ownerOf, watchInList } from '../ui/playlists.tsx'
import { AppShell } from '../ui/shell.tsx'
import { Player } from './public/player.tsx'
import { SaveMenu } from './public/save-menu.tsx'
import { WatchVisibility } from './public/watch-visibility.tsx'

export interface WatchPageProps {
  video: Video
  media: MediaFile | null
  theater: boolean
  person?: Person | null
  people?: Person[]
  /** Playing through a playlist that holds this video. */
  list?: Playlist
}

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

function RelatedCard(handle: Handle<{ video: Video; viewerId?: string }>) {
  return () => {
    let { video, viewerId } = handle.props
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
          <h3 class="rcard-title">
            <a href={href}>{video.title}</a>
          </h3>
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
    let ownerName = owner && person?.id === owner.id ? 'You' : owner?.name

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
    let { video, media, theater, person = null, people = [], list } = handle.props
    let channel = getChannel(video.channelId)!
    let stats = channelStats(channel.id, person?.id)
    let published = publishedAt(video)
    let related = relatedVideos(video, 12, person?.id)
    let isFolder = channel.kind === 'folder'
    let playable = media?.exists === true
    let expectedFile = media?.displayPath ?? video.file ?? `${video.id}.mp4`
    let here = list ? watchInList(video.id, list.id) : routes.watch.href({ videoId: video.id })

    return (
      <AppShell current={null} title={video.title} person={person} layout="watch">
        <div class={theater ? 'watch is-theater' : 'watch'}>
          <div class="watch-player">
            <Player
              key={video.id}
              videoId={video.id}
              title={video.title}
              src={playable ? routes.media.href({ videoId: video.id }) : null}
              poster={thumbUrl(video) ?? undefined}
              durationSec={video.durationSec}
              resumeAt={isInProgress(video, person?.id) ? progressOf(video, person?.id) : undefined}
              activityHref={routes.watchActivity.href({ videoId: video.id })}
              theater={theater}
              expectedFile={expectedFile}
            />
            {playable ? (
              <noscript>
                <p class="watch-noscript">
                  The LanTube player needs JavaScript.{' '}
                  <a href={routes.media.href({ videoId: video.id })}>Open the video file directly</a>.
                </p>
              </noscript>
            ) : null}
          </div>

          <section class="watch-info" aria-labelledby="watch-title">
            <h1 class="watch-title" id="watch-title">
              {video.title}
            </h1>

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
              {video.tags.length > 0 ? (
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
            </div>
            {person && video.postedBy === person.id && !isFolder ? (
              <WatchVisibility
                action={routes.watchVisibility.href({ videoId: video.id })}
                person={person}
                people={people}
                visibility={video.private ? 'private' : 'house'}
                audienceIds={video.audience ?? []}
              />
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
                      <RelatedCard video={other} viewerId={person?.id} />
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
