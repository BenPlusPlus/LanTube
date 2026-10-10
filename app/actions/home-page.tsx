import type { Handle } from 'remix/component'

import type { Video } from '../data/library.ts'
import { channels, continueWatching, getTopic, newestFirst, topics, videos } from '../data/library.ts'
import { routes } from '../routes.ts'
import { AppShell } from '../ui/shell.tsx'
import { ChannelCard, VideoCard } from '../ui/cards.tsx'
import { Icon } from '../ui/icons.tsx'

export interface HomePageProps {
  query: string
  topic?: string
  results?: Video[]
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

function Shelf(handle: Handle<{ id: string; title: string; note?: string; videos: Video[]; showRemaining?: boolean; eager?: boolean; single?: boolean }>) {
  return () => {
    let { id, title, note, videos: list, showRemaining, eager, single } = handle.props
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
            <VideoCard video={video} showRemaining={showRemaining} eager={eager && index < 4} />
          ))}
        </div>
      </section>
    )
  }
}

function Results(handle: Handle<{ query: string; topic?: string; results: Video[] }>) {
  return () => {
    let { query, topic, results } = handle.props
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
            <VideoCard video={video} eager={index < 4} />
          ))}
        </div>
      </section>
    )
  }
}

function EmptyLibrary() {
  return () => (
    <section class="empty empty-library" aria-labelledby="empty-title">
      <Icon name="folder" size={40} />
      <h2 id="empty-title">No videos in the house yet</h2>
      <p>
        Point LanTube at a folder of videos on this machine, or upload one. Everyone on your network will see it here.
      </p>
      <a class="btn btn-primary" href={routes.upload.href()}>
        <Icon name="upload" size={20} />
        Upload a video
      </a>
    </section>
  )
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { query, topic, results } = handle.props


    if (videos.length === 0) {
      return (
        <AppShell current="home">
          <EmptyLibrary />
        </AppShell>
      )
    }

    let resume = continueWatching()
    let shelved = new Set(resume.map((video) => video.id))
    let rest = newestFirst(videos).filter((video) => !shelved.has(video.id))
    // Only split off "Earlier" when it can fill at least a row.
    let cut = rest.length - 8 >= 4 ? 8 : rest.length
    let latest = rest.slice(0, cut)
    let earlier = rest.slice(cut)

    return (
      <AppShell current="home" query={query} title={query ? `“${query}”` : undefined}>
        <TopicChips active={topic} />
        {results !== undefined ? (
          <Results query={query} topic={topic} results={results} />
        ) : (
          <>
            <h1 class="visually-hidden">Home</h1>
            {resume.length > 0 ? (
              <Shelf id="continue" title="Continue watching" videos={resume} showRemaining eager single />
            ) : null}
            <Shelf id="latest" title="Latest in the house" videos={latest} eager={resume.length === 0} />
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
                {channels.map((channel) => (
                  <li>
                    <ChannelCard channel={channel} />
                  </li>
                ))}
              </ul>
            </section>
            {earlier.length > 0 ? <Shelf id="earlier" title="Earlier" videos={earlier} /> : null}
          </>
        )}
      </AppShell>
    )
  }
}
