import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { formatAdded, getChannel, progressPercent, type Video } from '../data/library.ts'
import { daysSince, formatLength, isOwner, playlistDuration, playlistVideos, type Playlist } from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { AssignMenu, Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon, type IconName } from '../ui/public/icons.tsx'
import { FeedBatch, playlistFeedHrefs } from '../ui/feed-batch.tsx'
import { ownerOf, PlaylistCover, videoCount, VisibilityLabel, watchInList } from '../ui/playlists.tsx'
import { AppShell } from '../ui/shell.tsx'
import { VideoFeedMore } from './public/video-feed-more.tsx'

export interface PlaylistPageProps {
  playlist: Playlist
  person?: Person | null
  shown: number
}

function ItemButton(
  handle: Handle<{ playlist: Playlist; video: Video; intent: 'up' | 'down' | 'remove'; icon: IconName; label: string; disabled?: boolean; shown: number }>,
) {
  return () => {
    let { playlist, video, intent, icon, label, disabled, shown } = handle.props
    return (
      <form method="post" action={routes.playlistItems.href({ playlistId: playlist.id })}>
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="videoId" value={video.id} />
        <input type="hidden" name="returnTo" value={`${routes.playlist.href({ playlistId: playlist.id })}?n=${shown}#entry-${video.id}`} />
        <button class="icon-btn pentry-btn" type="submit" aria-label={`${label}: ${video.title}`} title={label} disabled={disabled}>
          <Icon name={icon} size={20} />
        </button>
      </form>
    )
  }
}

function Entry(handle: Handle<{ playlist: Playlist; video: Video; index: number; count: number; editable: boolean; viewerId?: string; shown: number }>) {
  return () => {
    let { playlist, video, index, count, editable, viewerId, shown } = handle.props
    let channel = getChannel(video.channelId)
    let href = watchInList(video.id, playlist.id)
    let progress = progressPercent(video, viewerId)

    return (
      <li class="pentry" id={`entry-${video.id}`}>
        <span class="pentry-index">{index + 1}</span>
        <span class="pentry-thumb">
          <ThumbImage video={video} eager={index < 6} />
          <DurationBadge seconds={video.durationSec} />
          {progress !== null ? (
            <span class="vcard-progress">
              <span style={`width:${progress.toFixed(1)}%`} />
            </span>
          ) : null}
        </span>
        <span class="pentry-text">
          <span class="pentry-heading">
            <a class="pentry-title" href={href}>
              {video.title}
            </a>
            <AssignMenu video={video} viewerId={viewerId} />
          </span>
          <span class="pentry-meta">
            {channel?.name}
            <span aria-hidden="true"> · </span>
            {formatAdded(video.addedDaysAgo)}
          </span>
        </span>
        {editable ? (
          <span class="pentry-tools">
            <ItemButton playlist={playlist} video={video} intent="up" icon="arrow-up" label="Move up" disabled={index === 0} shown={shown} />
            <ItemButton playlist={playlist} video={video} intent="down" icon="arrow-down" label="Move down" disabled={index === count - 1} shown={shown} />
            <ItemButton playlist={playlist} video={video} intent="remove" icon="close" label="Remove from playlist" shown={shown} />
          </span>
        ) : null}
      </li>
    )
  }
}

export function PlaylistPage(handle: Handle<PlaylistPageProps>) {
  return () => {
    let { playlist, person = null, shown } = handle.props
    let owner = ownerOf(playlist)
    let videos = playlistVideos(playlist, person?.id)
    let visible = videos.slice(0, shown)
    let hasMore = visible.length < videos.length
    let hrefs = playlistFeedHrefs(playlist.id, visible.length)
    let mine = isOwner(playlist, person?.id)
    let length = playlistDuration(playlist, person?.id)
    let updated = formatAdded(daysSince(playlist.activity.at))

    return (
      <AppShell current="playlists" title={playlist.name} person={person}>
        <div class="pl">
          <header class="plhead">
            <PlaylistCover playlist={playlist} size="lg" eager viewerId={person?.id} />
            <div class="plhead-text">
              <h1 class="page-title">{playlist.name}</h1>
              {owner ? (
                <a class="chhead-link plhead-owner" href={routes.channel.href({ channelId: owner.id })}>
                  <Avatar channel={owner} size="sm" />
                  <span>{mine ? 'You' : owner.name}</span>
                </a>
              ) : null}
              <p class="plhead-meta">
                <VisibilityLabel playlist={playlist} />
                <span aria-hidden="true">·</span>
                <span>{videoCount(videos.length)}</span>
                {length > 0 ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatLength(length)}</span>
                  </>
                ) : null}
              </p>
              <p class="plhead-meta plhead-updated">Updated {updated.charAt(0).toLowerCase() + updated.slice(1)}</p>
              {playlist.description ? <p class="plhead-desc">{playlist.description}</p> : null}
              <div class="plhead-actions">
                {videos.length > 0 ? (
                  <a class="btn btn-primary" href={watchInList(videos[0].id, playlist.id)}>
                    <Icon name="play" size={18} />
                    Play all
                  </a>
                ) : null}
                {mine ? (
                  <a class="btn btn-secondary" href={routes.playlistEdit.index.href({ playlistId: playlist.id })}>
                    <Icon name="pencil" size={18} />
                    Edit
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          <section class="plbody" aria-label="Videos in this playlist">
            {videos.length > 0 ? (
              <ol class="pentries">
                {visible.map((video, index) => (
                  <Entry playlist={playlist} video={video} index={index} count={videos.length} editable={mine} viewerId={person?.id} shown={visible.length} />
                ))}
                {hasMore ? (
                  <VideoFeedMore
                    nextHref={hrefs.nextHref}
                    moreHref={hrefs.moreHref}
                    label="Show more videos"
                    asListItem
                  />
                ) : null}
              </ol>
            ) : (
              <div class="chlist-empty">
                <p>
                  {mine
                    ? 'Nothing in it yet. Open any video and use Save to put it here.'
                    : `${owner?.name ?? 'Its owner'} hasn’t added any videos yet.`}
                </p>
                {mine ? (
                  <a class="btn btn-secondary" href={routes.home.href()}>
                    Browse videos
                  </a>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    )
  }
}

export function PlaylistVideosBatch(
  handle: Handle<{
    playlist: Playlist
    videos: Video[]
    from: number
    count: number
    editable: boolean
    viewerId?: string
    nextHref?: string | null
    moreHref?: string | null
  }>,
) {
  return () => {
    let { playlist, videos, from, count, editable, viewerId, nextHref, moreHref } = handle.props
    return (
      <FeedBatch nextHref={nextHref} moreHref={moreHref} list>
        {videos.map((video, index) => (
          <Entry playlist={playlist} video={video} index={from + index} count={count} editable={editable} viewerId={viewerId} shown={from + videos.length} />
        ))}
      </FeedBatch>
    )
  }
}
