import type { Handle } from 'remix/component'

import type { Channel, Video } from '../data/library.ts'
import {
  formatAdded,
  formatDuration,
  formatRemaining,
  getChannel,
  isInProgress,
  isNew,
  channelStats,
} from '../data/library.ts'
import { routes } from '../routes.ts'
import { Icon } from './icons.tsx'

export function Avatar(handle: Handle<{ channel: Channel; size?: 'sm' | 'md' | 'lg' }>) {
  return () => {
    let { channel, size = 'md' } = handle.props
    return (
      <span class={`avatar avatar-${size}`} style={`--hue:${channel.hue}`} aria-hidden="true">
        {channel.kind === 'folder' ? <Icon name="folder" size={size === 'lg' ? 40 : 16} /> : channel.name.charAt(0)}
      </span>
    )
  }
}

export function VideoCard(handle: Handle<{ video: Video; showRemaining?: boolean; eager?: boolean }>) {
  return () => {
    let { video, showRemaining = false, eager = false } = handle.props
    let channel = getChannel(video.channelId)!
    let watchHref = routes.watch.href({ videoId: video.id })
    let channelHref = routes.channel.href({ channelId: channel.id })
    let progress = video.progressSec !== undefined ? Math.min(100, (video.progressSec / video.durationSec) * 100) : null
    let fresh = isNew(video)

    return (
      <article class="vcard">
        <a class="vcard-thumb" href={watchHref} tabindex={-1} aria-hidden="true">
          <img
            src={`/thumbs/${video.thumb}`}
            alt=""
            width={960}
            height={540}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
          <span class="vcard-duration">{formatDuration(video.durationSec)}</span>
          {progress !== null ? (
            <span class="vcard-progress">
              <span style={`width:${progress.toFixed(1)}%`} />
            </span>
          ) : null}
        </a>
        <div class="vcard-meta">
          <a class="vcard-avatar" href={channelHref} tabindex={-1} aria-hidden="true">
            <Avatar channel={channel} />
          </a>
          <div class="vcard-text">
            <h3 class="vcard-title">
              <a href={watchHref}>{video.title}</a>
            </h3>
            <p class="vcard-byline">
              <a href={channelHref}>{channel.name}</a>
            </p>
            <p class="vcard-when">
              {showRemaining && isInProgress(video) ? formatRemaining(video) : formatAdded(video.addedDaysAgo)}
              {fresh ? <span class="badge-new">New</span> : null}
              {!isInProgress(video) && progress !== null ? <span class="vcard-watched">Watched</span> : null}
            </p>
          </div>
        </div>
      </article>
    )
  }
}

export function ChannelCard(handle: Handle<{ channel: Channel }>) {
  return () => {
    let { channel } = handle.props
    let stats = channelStats(channel.id)
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
