import type { Handle } from 'remix/component'

import {
  assignablePeople,
  houseHasLimitablePeople,
  isAssigned,
} from '../data/assignments.ts'
import { getPerson } from '../data/household.ts'
import type { Channel, Video } from '../data/library.ts'
import {
  formatAdded,
  formatDuration,
  formatPlays,
  formatRemaining,
  getChannel,
  posterChannel,
  isInProgress,
  isNew,
  channelStats,
  progressPercent,
  thumbUrl,
} from '../data/library.ts'
import { routes } from '../routes.ts'
import { Icon } from './public/icons.tsx'
import { initialOf as sharedInitialOf } from './public/identity.ts'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'card' | 'xl'

export function Avatar(handle: Handle<{ channel: Channel; size?: AvatarSize }>) {
  return () => {
    let { channel, size = 'md' } = handle.props
    let folderIcon = size === 'xl' ? 52 : size === 'lg' ? 40 : size === 'card' ? 24 : 16
    let shape = channel.kind === 'custom' ? ' avatar-channel' : ''
    return (
      <span class={`avatar avatar-${size}${shape}`} style={`--hue:${channel.hue}`} aria-hidden="true">
        {channel.photo ? (
          <img class="avatar-photo" src={channel.photo} alt="" />
        ) : channel.kind === 'folder' ? (
          <Icon name="folder" size={folderIcon} />
        ) : (
          initialOf(channel.name)
        )}
      </span>
    )
  }
}

/** First letter, including accented and non-Latin initials, as one grapheme. */
function initialOf(name: string): string {
  return sharedInitialOf(name) || '?'
}

/** A video's still, or nothing: the thumb box behind it stays Graphite Raised. */
export function ThumbImage(handle: Handle<{ video: Pick<Video, 'thumb'>; eager?: boolean }>) {
  return () => {
    let { video, eager = false } = handle.props
    let src = thumbUrl(video)
    return src ? <img src={src} alt="" width={960} height={540} loading={eager ? 'eager' : 'lazy'} decoding="async" /> : null
  }
}

/** "24:37", or nothing until the host knows the length. */
export function DurationBadge(handle: Handle<{ seconds: number }>) {
  return () => (handle.props.seconds > 0 ? <span class="vcard-duration">{formatDuration(handle.props.seconds)}</span> : null)
}

export function VideoCard(handle: Handle<{ video: Video; viewerId?: string; showRemaining?: boolean; eager?: boolean; onChannel?: boolean }>) {
  return () => {
    let { video, viewerId, showRemaining = false, eager = false, onChannel = false } = handle.props
    let channel = getChannel(video.channelId)!
    let watchHref = routes.watch.href({ videoId: video.id })
    let channelHref = routes.channel.href({ channelId: channel.id })
    let poster = onChannel && channel.kind === 'custom' && video.postedBy ? posterChannel(video.postedBy) : undefined
    let progress = progressPercent(video, viewerId)
    let inProgress = isInProgress(video, viewerId)
    let fresh = isNew(video, viewerId)
    let viewer = viewerId ? getPerson(viewerId) : undefined
    let assigned = Boolean(viewerId && isAssigned(viewerId, video.id))
    let assignMenu = viewer?.isParent && houseHasLimitablePeople()
    let assignPeople = assignMenu ? assignablePeople(video) : []
    let menuId = `assign-${video.id}`
    let anchor = `--assign-${video.id}`

    return (
      <article class={onChannel ? 'vcard vcard-on-channel' : 'vcard'}>
        <a class="vcard-thumb" href={watchHref} tabindex={-1} aria-hidden="true">
          <ThumbImage video={video} eager={eager} />
          <DurationBadge seconds={video.durationSec} />
          {progress !== null ? (
            <span class="vcard-progress">
              <span style={`width:${progress.toFixed(1)}%`} />
            </span>
          ) : null}
        </a>
        <div class="vcard-meta">
          {onChannel ? null : (
            <a class="vcard-avatar" href={channelHref} tabindex={-1} aria-hidden="true">
              <Avatar channel={channel} />
            </a>
          )}
          <div class="vcard-text">
            <div class="vcard-heading">
              <h3 class="vcard-title">
                <a href={watchHref}>{video.title}</a>
              </h3>
              {assignMenu ? (
                <div class="vcard-assign">
                  <button
                    class="icon-btn vcard-assign-btn"
                    type="button"
                    popovertarget={menuId}
                    aria-haspopup="dialog"
                    aria-label={`Assign ${video.title}`}
                    style={`anchor-name:${anchor}`}
                  >
                    <Icon name="ellipsis-vertical" size={18} />
                  </button>
                  <div
                    class="vcard-assign-menu"
                    id={menuId}
                    popover="auto"
                    role="dialog"
                    aria-labelledby={`${menuId}-title`}
                    style={`position-anchor:${anchor}`}
                  >
                    <p class="vcard-assign-title" id={`${menuId}-title`}>
                      Assign to
                    </p>
                    {assignPeople.length === 0 ? (
                      <p class="vcard-assign-empty">No one here can watch this yet. Name them on Audience first.</p>
                    ) : (
                      assignPeople.map((member) => {
                        let assigned = isAssigned(member.id, video.id)
                        return (
                          <form method="post" action={routes.watchAssign.href({ videoId: video.id })}>
                            <input type="hidden" name="intent" value={assigned ? 'unassign' : 'assign'} />
                            <input type="hidden" name="personId" value={member.id} />
                            <button
                              class="account-menu-item vcard-assign-item"
                              type="submit"
                              aria-pressed={assigned ? 'true' : 'false'}
                            >
                              <span class={`check${assigned ? ' is-on' : ''}`} aria-hidden="true">
                                <Icon name="check" size={14} />
                              </span>
                              {member.name}
                            </button>
                          </form>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {onChannel ? (
              poster ? (
                <p class="vcard-byline">
                  <a href={routes.channel.href({ channelId: poster.id })}>{poster.name}</a>
                </p>
              ) : null
            ) : (
              <p class="vcard-byline">
                <a href={channelHref}>{channel.name}</a>
              </p>
            )}
            <p class="vcard-when">
              {onChannel ? `${formatPlays(video.plays)} · ` : null}
              {showRemaining && inProgress ? formatRemaining(video, viewerId) : formatAdded(video.addedDaysAgo)}
              {fresh ? <span class="badge-new">New</span> : null}
              {assigned ? (
                <span class="vcard-watched">Assigned</span>
              ) : !inProgress && progress !== null ? (
                <span class="vcard-watched">Watched</span>
              ) : null}
              {video.private ? (
                <span class="pvis vcard-private">
                  <Icon name="lock" size={14} />
                  Private
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </article>
    )
  }
}

export function ChannelCard(handle: Handle<{ channel: Channel; viewerId?: string }>) {
  return () => {
    let { channel, viewerId } = handle.props
    let stats = channelStats(channel.id, viewerId)
    return (
      <a class="ccard" href={routes.channel.href({ channelId: channel.id })}>
        <Avatar channel={channel} size="lg" />
        <span class="ccard-name">{channel.name}</span>
        <span class="ccard-sub">
          {stats.count} video{stats.count === 1 ? '' : 's'}
          {channel.kind === 'folder' ? ' · folder' : ''}
        </span>
        {stats.newCount > 0 ? <span class="ccard-new">{stats.newCount} new</span> : null}
      </a>
    )
  }
}
