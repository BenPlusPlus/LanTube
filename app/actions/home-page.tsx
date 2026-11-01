import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Video } from '../data/library.ts'
import { getChannels } from '../data/library.ts'
import { getTag, shuffleTags, tagsInUse } from '../data/tags.ts'
import { splitHomeLibrary } from '../data/video-feed.ts'
import { routes } from '../routes.ts'
import { VideoFeedMore } from './public/video-feed-more.tsx'
import { AppShell } from '../ui/shell.tsx'
import { ChannelCard, VideoCard } from '../ui/cards.tsx'
import { FeedBatch, homeEarlierHrefs } from '../ui/feed-batch.tsx'
import { Icon } from '../ui/public/icons.tsx'

export interface HomePageProps {
  query: string
  tag?: string
  results?: Video[]
  person?: Person | null
  videos: Video[]
  earlierShown: number
}

function tagHref(tag?: string) {
  let href = routes.home.href()
  return tag ? `${href}?tag=${encodeURIComponent(tag)}` : href
}

function homeReturn(query?: string, tag?: string) {
  if (query) return `${routes.home.href()}?q=${encodeURIComponent(query)}`
  if (tag) return `${routes.home.href()}?tag=${encodeURIComponent(tag)}`
  return routes.home.href()
}

function TagChips(handle: Handle<{ active?: string; videos: Video[] }>) {
  return () => {
    let { active, videos } = handle.props
    return (
      <nav class="chips" aria-label="Tags">
        <ul>
          <li>
            <a class="chip" href={tagHref()} aria-current={!active ? 'page' : undefined}>
              All
            </a>
          </li>
          {shuffleTags(tagsInUse(videos)).map((tag) => (
            <li>
              <a class="chip" href={tagHref(tag.slug)} aria-current={active === tag.slug ? 'page' : undefined}>
                {tag.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
}

function Shelf(handle: Handle<{ id: string; title: string; note?: string; videos: Video[]; viewerId?: string; showRemaining?: boolean; eager?: boolean; single?: boolean; returnTo?: string }>) {
  return () => {
    let { id, title, note, videos: list, viewerId, showRemaining, eager, single, returnTo } = handle.props
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
            <VideoCard video={video} viewerId={viewerId} showRemaining={showRemaining} eager={eager && index < 4} returnTo={returnTo} />
          ))}
        </div>
      </section>
    )
  }
}

function Results(handle: Handle<{ query: string; tag?: string; results: Video[]; viewerId?: string }>) {
  return () => {
    let { query, tag, results, viewerId } = handle.props
    let returnTo = homeReturn(query, tag)
    let tagLabel = getTag(tag)?.name ?? tag
    let heading = query ? `Results for “${query}”` : (tagLabel ?? 'All videos')
    let scope = query && tagLabel ? ` in ${tagLabel}` : ''

    if (results.length === 0) {
      return (
        <section class="empty" aria-labelledby="results-title">
          <Icon name="search" size={40} />
          <h2 id="results-title">
            Nothing in the house matches “{query || tagLabel}”{scope}
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
            <VideoCard video={video} viewerId={viewerId} eager={index < 4} returnTo={returnTo} />
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
          Index a folder on <a href={routes.house.index.href()}>House</a>, or upload a video. House-visible videos show here for everyone on this network.
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
    let { query, tag, results, person = null, videos, earlierShown } = handle.props
    let viewerId = person?.id

    if (videos.length === 0) {
      return (
        <AppShell current="home" title="Home" person={person}>
          <EmptyLibrary person={person} />
        </AppShell>
      )
    }

    let { assigned, resume, latest, earlier, earlierTotal } = splitHomeLibrary(videos, viewerId)
    let returnTo = homeReturn(query, tag)
    let shown = Math.min(earlierShown, earlier.length)
    let visibleEarlier = earlier.slice(0, shown)
    let earlierHasMore = shown < earlier.length
    let earlierHrefs = homeEarlierHrefs(shown)

    return (
      <AppShell current="home" query={query} title={query ? `“${query}”` : undefined} person={person}>
        <TagChips active={tag} videos={videos} />
        {results !== undefined ? (
          <Results query={query} tag={tag} results={results} viewerId={viewerId} />
        ) : (
          <>
            <h1 class="visually-hidden">Home</h1>
            {assigned.length > 0 ? (
              <Shelf
                id="assigned"
                title="Watch these first"
                note="Other videos play after you finish these."
                videos={assigned}
                viewerId={viewerId}
                showRemaining
                eager
                returnTo={returnTo}
              />
            ) : resume.length > 0 ? (
              <Shelf id="continue" title="Continue watching" videos={resume} viewerId={viewerId} showRemaining eager single returnTo={returnTo} />
            ) : null}
            <Shelf id="latest" title="Latest in the house" videos={latest} viewerId={viewerId} eager={assigned.length === 0 && resume.length === 0} returnTo={returnTo} />
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
            {earlier.length > 0 ? (
              <section class="shelf" aria-labelledby="earlier">
                <header class="shelf-head">
                  <h2 class="shelf-title" id="earlier">
                    Earlier
                  </h2>
                </header>
                <div class="video-grid">
                  {visibleEarlier.map((video) => (
                    <VideoCard video={video} viewerId={viewerId} returnTo={returnTo} />
                  ))}
                  {earlierHasMore ? (
                    <VideoFeedMore nextHref={earlierHrefs.nextHref} moreHref={earlierHrefs.moreHref} label="Show earlier videos" />
                  ) : null}
                </div>
                {!earlierHasMore && earlierTotal > earlier.length ? (
                  <p class="shelf-note">Older videos live on channels and in search.</p>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </AppShell>
    )
  }
}

export function HomeEarlierBatch(
  handle: Handle<{ videos: Video[]; nextHref?: string | null; moreHref?: string | null; viewerId?: string }>,
) {
  return () => {
    let { videos, nextHref, moreHref, viewerId } = handle.props
    return (
      <FeedBatch nextHref={nextHref} moreHref={moreHref}>
        {videos.map((video) => (
          <VideoCard video={video} viewerId={viewerId} returnTo={routes.home.href()} />
        ))}
      </FeedBatch>
    )
  }
}
