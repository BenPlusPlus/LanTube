import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Channel } from '../data/library.ts'
import {
  byLatestActivity,
  channelStats,
  channelVideos,
  channelsFor,
  formatAdded,
  getChannel,
  getChannels,
  isNew,
  progressPercent,
} from '../data/library.ts'
import { routes } from '../routes.ts'
import { Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'

export interface ChannelsPageProps {
  person?: Person | null
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function sentenceCase(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Who stands behind a row: a custom channel's runner and posters, or what a person runs. */
function RowPeople(handle: Handle<{ channel: Channel }>) {
  return () => {
    let { channel } = handle.props
    if (channel.kind === 'custom') {
      let owner = channel.ownerId ? getChannel(channel.ownerId) : undefined
      let posters = (channel.posterIds ?? []).map((id) => getChannel(id)?.name).filter((name): name is string => !!name)
      if (!owner) return null
      return (
        <p class="chrow-people">
          <Avatar channel={owner} size="sm" />
          <span>
            Run by {owner.name}
            {posters.length > 0 ? <span class="chrow-with"> with {listNames(posters)}</span> : null}
          </span>
        </p>
      )
    }
    if (channel.kind === 'person') {
      let { runs, postsTo } = channelsFor(channel.id)
      if (runs.length === 0 && postsTo.length === 0) return null
      return (
        <p class="chrow-people chrow-people-plain">
          {runs.length > 0 ? `Runs ${listNames(runs.map((c) => c.name))}` : null}
          {runs.length > 0 && postsTo.length > 0 ? ' · ' : null}
          {postsTo.length > 0 ? `Posts to ${listNames(postsTo.map((c) => c.name))}` : null}
        </p>
      )
    }
    return channel.path ? <p class="chrow-path">{channel.path}</p> : null
  }
}

function ChannelRow(handle: Handle<{ channel: Channel; viewerId?: string; eager?: boolean }>) {
  return () => {
    let { channel, viewerId, eager = false } = handle.props
    let stats = channelStats(channel.id, viewerId)
    let peek = channelVideos(channel.id, 'latest', viewerId).slice(0, 3)
    let href = routes.channel.href({ channelId: channel.id })

    return (
      <li class="chrow">
        <Avatar channel={channel} size="lg" />
        <div class="chrow-text">
          <h3 class="chrow-name">
            <a href={href}>{channel.name}</a>
          </h3>
          <p class="chrow-meta">
            <span>{stats.count === 0 ? 'No videos yet' : plural(stats.count, 'video')}</span>
            {stats.latest ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {sentenceCase(formatAdded(stats.latest.addedDaysAgo))}</span>
              </>
            ) : null}
            {stats.newCount > 0 ? <span class="badge-new">{stats.newCount} new</span> : null}
          </p>
          <RowPeople channel={channel} />
          {channel.description ? <p class="chrow-desc">{channel.description}</p> : null}
        </div>
        {peek.length > 0 ? (
          <ul class="chrow-peek" aria-hidden="true">
            {peek.map((video) => {
              let progress = progressPercent(video, viewerId)
              return (
                <li>
                  <a class="chrow-thumb" href={routes.watch.href({ videoId: video.id })} tabindex={-1} title={video.title}>
                    <ThumbImage video={video} eager={eager} />
                    {isNew(video, viewerId) ? <span class="badge-new chrow-thumb-new">New</span> : null}
                    <DurationBadge seconds={video.durationSec} />
                    {progress !== null ? (
                      <span class="vcard-progress">
                        <span style={`width:${progress.toFixed(1)}%`} />
                      </span>
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </li>
    )
  }
}

function Section(handle: Handle<{ id: string; title: string; note: string; channels: Channel[]; viewerId?: string; eager?: boolean }>) {
  return () => {
    let { id, title, note, channels, viewerId, eager } = handle.props
    return (
      <section class="shelf" aria-labelledby={id}>
        <header class="shelf-head">
          <h2 class="shelf-title" id={id}>
            {title}
          </h2>
          <p class="shelf-note">{note}</p>
        </header>
        <ul class="chlist">
          {channels.map((channel, index) => (
            <ChannelRow channel={channel} viewerId={viewerId} eager={eager && index < 2} />
          ))}
        </ul>
      </section>
    )
  }
}

export function ChannelsPage(handle: Handle<ChannelsPageProps>) {
  return () => {
    let { person = null } = handle.props
    let all = getChannels()
    let people = all.filter((channel) => channel.kind === 'person')
    let custom = byLatestActivity(all.filter((channel) => channel.kind === 'custom'))
    let folders = all.filter((channel) => channel.kind === 'folder')
    let newHref = routes.channelNew.index.href()

    return (
      <AppShell current="channels" title="Channels" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">Channels</h1>
            <p class="page-note">{plural(all.length, 'channel')} in the house</p>
          </div>
          <a class="btn btn-secondary" href={newHref}>
            <Icon name="plus" size={20} />
            New channel
          </a>
        </header>

        <Section id="people" title="People" note="Everyone’s home channel" channels={people} viewerId={person?.id} eager />

        <section class="shelf" aria-labelledby="more">
          <header class="shelf-head">
            <h2 class="shelf-title" id="more">
              More channels
            </h2>
            <p class="shelf-note">Started by people in the house</p>
          </header>
          {custom.length > 0 ? (
            <ul class="chlist">
              {custom.map((channel) => (
                <ChannelRow channel={channel} viewerId={person?.id} />
              ))}
            </ul>
          ) : (
            <div class="chlist-empty">
              <p>
                Nobody has started one yet. A channel collects videos about one thing, like a band, a hobby, or a game, and its
                owner picks who can post.
              </p>
              <a class="btn btn-secondary" href={newHref}>
                <Icon name="plus" size={20} />
                New channel
              </a>
            </div>
          )}
        </section>

        {folders.length > 0 ? (
          <Section id="folders" title="Folders" note="Indexed from this machine" channels={folders} viewerId={person?.id} />
        ) : null}
      </AppShell>
    )
  }
}
