import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Video } from '../data/library.ts'
import { getChannels, getTopic, isInProgress, newestFirst, topics } from '../data/library.ts'
import { routes } from '../routes.ts'
import { AppShell } from '../ui/shell.tsx'
import { ChannelCard, VideoCard } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'

export interface HomePageProps {
  query: string
  topic?: string
  results?: Video[]
  person?: Person | null
  videos: Video[]
}

function topicHref(topic?: string) {
  let href = routes.home.href()
  return topic ? `${href}?topic=${encodeURIComponent(topic)}` : href
}

function TopicChips(handle: Handle<{ active?: string }>) {
  return () => {
    let { active } = handle.props
    return (
      <nav class="chips" aria-label="Topics">
        <ul>
          <li>
            <a class="chip" href={topicHref()} aria-current={!active ? 'page' : undefined}>
              All
            </a>
          </li>
          {topics.map((topic) => (
            <li>
              <a class="chip" href={topicHref(topic.id)} aria-current={active === topic.id ? 'page' : undefined}>
                {topic.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
}

function Shelf(handle: Handle<{ id: string; title: string; note?: string; videos: Video[]; viewerId?: string; showRemaining?: boolean; eager?: boolean; single?: boolean }>) {
  return () => {
    let { id, title, note, videos: list, viewerId, showRemaining, eager, single } = handle.props
    return (
      <section class="shelf" aria-labelledby={id}>
        <header class="shelf-head">
          <h2 class="shelf-title" id={id}>
            {title}
          </h2>
          {note ? <p class="shelf-note">{note}</p> : null}
        </header>
        <div class={single ? 'video-grid is-single-row' : 'video-grid'}>
          {list.map((video, index) => (
            <VideoCard video={video} viewerId={viewerId} showRemaining={showRemaining} eager={eager && index < 4} />
          ))}
        </div>
      </section>
    )
  }
}

function Results(handle: Handle<{ query: string; topic?: string; results: Video[]; viewerId?: string }>) {
  return () => {
    let { query, topic, results, viewerId } = handle.props
    let topicLabel = getTopic(topic)?.label
    let heading = query ? `Results for “${query}”` : (topicLabel ?? 'All videos')
    let scope = query && topicLabel ? ` in ${topicLabel}` : ''

    if (results.length === 0) {
      return (
        <section class="empty" aria-labelledby="results-title">
          <Icon name="search" size={40} />
          <h2 id="results-title">
            Nothing in the house matches “{query || topicLabel}”{scope}
          </h2>
          <p>Search looks at video titles and people’s names. Try a shorter word, or browse everything.</p>
          <a class="btn btn-secondary" href={routes.home.href()}>
            Show all videos
          </a>
        </section>
      )
    }

    return (
      <section class="shelf" aria-labelledby="results-title">
        <header class="shelf-head">
          <h2 class="shelf-title" id="results-title">
            {heading}
            {scope}
          </h2>
          <p class="shelf-note">
            {results.length} video{results.length === 1 ? '' : 's'}
          </p>
        </header>
        <div class="video-grid">
          {results.map((video, index) => (
            <VideoCard video={video} viewerId={viewerId} eager={index < 4} />
          ))}
        </div>
      </section>
    )
  }
}

function emptyLibraryCopy(person: Person | null) {
  if (person?.isAdmin) {
    return {
      lede: (
        <>
          Index a folder on <a href={routes.house.href()}>House</a>, or upload a video. House-visible videos show here for everyone on this network.
        </>
      ),
      upload: true,
    }
  }
  if (person) {
    return {
      lede: 'Upload a video and everyone on this network can watch it here. An Admin can also index a folder on the Media share.',
      upload: true,
    }
  }
  return {
    lede: 'People in the house can upload, or an Admin can index a folder. Anyone on this network can watch once something is here.',
    upload: false,
  }
}

function EmptyLibrary(handle: Handle<{ person: Person | null }>) {
  return () => {
    let { person } = handle.props
    let { lede, upload } = emptyLibraryCopy(person)
    return (
      <section class="empty empty-library" aria-labelledby="empty-title">
        <Icon name="folder" size={40} />
        <h2 id="empty-title">No videos in the house yet</h2>
        <p>{lede}</p>
        {upload ? (
          <a class="btn btn-primary" href={routes.upload.index.href()}>
            <Icon name="upload" size={20} />
            Upload a video
          </a>
        ) : null}
      </section>
    )
  }
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { query, topic, results, person = null, videos } = handle.props
    let viewerId = person?.id

    if (videos.length === 0) {
      return (
        <AppShell current="home" title="Home" person={person}>
          <EmptyLibrary person={person} />
        </AppShell>
      )
    }

    let libraryVideos = videos
    let resume = newestFirst(libraryVideos.filter((video) => isInProgress(video, viewerId)))
    let shelved = new Set(resume.map((video) => video.id))
    let rest = newestFirst(libraryVideos).filter((video) => !shelved.has(video.id))
    // Only split off "Earlier" when it can fill at least a row.
    let cut = rest.length - 8 >= 4 ? 8 : rest.length
    let latest = rest.slice(0, cut)
    let earlier = rest.slice(cut)

    return (
      <AppShell current="home" query={query} title={query ? `“${query}”` : undefined} person={person}>
        <TopicChips active={topic} />
        {results !== undefined ? (
          <Results query={query} topic={topic} results={results} viewerId={viewerId} />
        ) : (
          <>
            <h1 class="visually-hidden">Home</h1>
            {resume.length > 0 ? (
              <Shelf id="continue" title="Continue watching" videos={resume} viewerId={viewerId} showRemaining eager single />
            ) : null}
            <Shelf id="latest" title="Latest in the house" videos={latest} viewerId={viewerId} eager={resume.length === 0} />
            <section class="shelf" aria-labelledby="people">
              <header class="shelf-head">
                <h2 class="shelf-title" id="people">
                  Channels in this house
                </h2>
                <a class="shelf-link" href={routes.channels.href()}>
                  All channels
                </a>
              </header>
              <ul class="channel-row">
                {getChannels().map((channel) => (
                  <li>
                    <ChannelCard channel={channel} viewerId={viewerId} />
                  </li>
                ))}
              </ul>
            </section>
            {earlier.length > 0 ? <Shelf id="earlier" title="Earlier" videos={earlier} viewerId={viewerId} /> : null}
          </>
        )}
      </AppShell>
    )
  }
}
