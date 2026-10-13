import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Channel, ChannelSort } from '../data/library.ts'
import { canPost, channelStats, channelVideos, channelsFor, formatPlays, getChannel } from '../data/library.ts'
import { routes } from '../routes.ts'
import { Avatar, VideoCard } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell, type Section } from '../ui/shell.tsx'

export interface ChannelPageProps {
  channel: Channel
  sort: ChannelSort
  person?: Person | null
}

const sorts: { id: ChannelSort; label: string }[] = [
  { id: 'latest', label: 'Latest' },
  { id: 'popular', label: 'Most played' },
  { id: 'oldest', label: 'Oldest' },
]

function plural(n: number, word: string) {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function PersonLink(handle: Handle<{ channel: Channel }>) {
  return () => {
    let { channel } = handle.props
    return (
      <a class="chhead-link" href={routes.channel.href({ channelId: channel.id })}>
        <Avatar channel={channel} size="sm" />
        <span>{channel.name}</span>
      </a>
    )
  }
}

function present(ids: string[]): Channel[] {
  return ids.map((id) => getChannel(id)).filter((channel): channel is Channel => channel !== undefined)
}

/** The second line of the header: who is behind this channel, or where it comes from. */
function Lineage(handle: Handle<{ channel: Channel }>) {
  return () => {
    let { channel } = handle.props
    if (channel.kind === 'custom') {
      let owner = channel.ownerId ? getChannel(channel.ownerId) : undefined
      let managers = present(channel.managerIds ?? [])
      return (
        <dl class="chhead-people">
          {owner ? (
            <div>
              <dt>Run by</dt>
              <dd>
                <PersonLink channel={owner} />
              </dd>
            </div>
          ) : null}
          {managers.length > 0 ? (
            <div>
              <dt>Managers</dt>
              <dd>
                {managers.map((manager) => (
                  <PersonLink channel={manager} />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      )
    }
    if (channel.kind === 'person') {
      let { runs, postsTo } = channelsFor(channel.id)
      if (runs.length === 0 && postsTo.length === 0) return null
      return (
        <dl class="chhead-people">
          {runs.length > 0 ? (
            <div>
              <dt>Runs</dt>
              <dd>
                {runs.map((other) => (
                  <PersonLink channel={other} />
                ))}
              </dd>
            </div>
          ) : null}
          {postsTo.length > 0 ? (
            <div>
              <dt>Manages</dt>
              <dd>
                {postsTo.map((other) => (
                  <PersonLink channel={other} />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      )
    }
    return channel.path ? (
      <p class="chhead-source">
        Indexed from <code class="path-chip">{channel.path}</code>
      </p>
    ) : null
  }
}

function sortHref(channel: Channel, sort: ChannelSort) {
  let href = routes.channel.href({ channelId: channel.id })
  return sort === 'latest' ? href : `${href}?sort=${sort}`
}

function Empty(handle: Handle<{ channel: Channel; person: Person | null }>) {
  return () => {
    let { channel, person } = handle.props
    let mine = canPost(channel, person?.id)
    let heading: string
    let detail: string

    if (channel.kind === 'folder') {
      heading = 'No videos in this folder yet'
      detail = `LanTube lists videos it finds in ${channel.path}. Add files there and they’ll show up on their own.`
    } else if (channel.kind === 'person') {
      heading = mine ? 'Your channel is empty' : `${channel.name} hasn’t posted yet`
      detail = mine
        ? 'Upload a video and everyone on the home network can watch it here.'
        : `When ${channel.name} uploads something, it will show up here.`
    } else {
      let names = [channel.ownerId, ...(channel.managerIds ?? [])]
        .map((id) => (id === person?.id ? 'you' : id ? getChannel(id)?.name : undefined))
        .filter((name): name is string => !!name)
      heading = `Nothing on ${channel.name} yet`
      detail = mine
        ? `Uploads from ${listNames(names)} will land here.`
        : `When ${listNames(names)} ${names.length > 1 ? 'post' : 'posts'} something, it will show up here.`
    }

    return (
      <section class="empty empty-channel" aria-labelledby="channel-empty">
        <Icon name={channel.kind === 'folder' ? 'folder' : 'playlists'} size={40} />
        <h2 id="channel-empty">{heading}</h2>
        <p>{detail}</p>
        {mine ? (
          <a class="btn btn-primary" href={`${routes.upload.index.href()}?to=${encodeURIComponent(channel.id)}`}>
            <Icon name="upload" size={20} />
            Upload a video
          </a>
        ) : null}
      </section>
    )
  }
}

export function ChannelPage(handle: Handle<ChannelPageProps>) {
  return () => {
    let { channel, sort, person = null } = handle.props
    let stats = channelStats(channel.id, person?.id)
    let list = channelVideos(channel.id, sort, person?.id)
    let canEdit = channel.kind === 'custom' && canPost(channel, person?.id)
    let isHome = channel.kind === 'person' && person?.id === channel.id
    let current: Section = channel.kind === 'custom' ? 'channels' : `channel:${channel.id}`

    return (
      <AppShell current={current} title={channel.name} person={person}>
        <header class={`chhead chhead-${channel.kind}`}>
          <Avatar channel={channel} size="xl" />
          <div class="chhead-text">
            <h1 class="chhead-name">{channel.name}</h1>
            <p class="chhead-meta">
              <span>{channel.kind === 'person' ? 'Home channel' : channel.kind === 'folder' ? 'Folder' : 'Channel'}</span>
              <span aria-hidden="true">·</span>
              <span>{plural(stats.count, 'video')}</span>
              {stats.count > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatPlays(stats.plays)}</span>
                </>
              ) : null}
              {stats.newCount > 0 ? <span class="badge-new">{stats.newCount} new</span> : null}
            </p>
            <Lineage channel={channel} />
            {channel.description ? <p class="chhead-desc">{channel.description}</p> : null}
          </div>
          {canEdit || isHome ? (
            <div class="chhead-actions">
              {canEdit ? (
                <a class="btn btn-secondary" href={routes.channelEdit.index.href({ channelId: channel.id })}>
                  <Icon name="pencil" size={20} />
                  Edit channel
                </a>
              ) : (
                <a class="btn btn-secondary" href={routes.channelNew.index.href()}>
                  <Icon name="plus" size={20} />
                  New channel
                </a>
              )}
            </div>
          ) : null}
        </header>

        {list.length === 0 ? (
          <Empty channel={channel} person={person} />
        ) : (
          <>
            {list.length > 1 ? (
              <nav class="chips chips-channel" aria-label="Sort videos">
                <ul>
                  {sorts.map((option) => (
                    <li>
                      <a class="chip" href={sortHref(channel, option.id)} aria-current={sort === option.id ? 'page' : undefined}>
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <section class="shelf shelf-channel" aria-labelledby="channel-videos">
              <h2 class="visually-hidden" id="channel-videos">
                Videos
              </h2>
              <div class="video-grid">
                {list.map((video, index) => (
                  <VideoCard video={video} viewerId={person?.id} onChannel showRemaining eager={index < 4} />
                ))}
              </div>
            </section>
          </>
        )}
      </AppShell>
    )
  }
}
