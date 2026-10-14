import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { formatAdded } from '../data/library.ts'
import {
  activityVideos,
  daysSince,
  describeActivity,
  formatLength,
  housePlaylists,
  playlistDuration,
  playlistsOwnedBy,
  playlistVideos,
  type Playlist,
} from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { ownerOf, PlaylistCover, videoCount, VisibilityLabel, watchInList } from '../ui/playlists.tsx'
import { AppShell } from '../ui/shell.tsx'

export interface PlaylistsPageProps {
  person?: Person | null
}

function sentenceCase(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function when(playlist: Playlist) {
  return formatAdded(daysSince(playlist.activity.at))
}

function YourCard(handle: Handle<{ playlist: Playlist; eager?: boolean }>) {
  return () => {
    let { playlist, eager } = handle.props
    return (
      <li class="pcard">
        <PlaylistCover playlist={playlist} eager={eager} viewerId={playlist.ownerId} />
        <h3 class="pcard-name">
          <a href={routes.playlist.href({ playlistId: playlist.id })}>{playlist.name}</a>
        </h3>
        <p class="pcard-meta">
          <VisibilityLabel playlist={playlist} />
          <span class="pcard-sep" aria-hidden="true">·</span>
          <span>Updated {sentenceCase(when(playlist))}</span>
        </p>
      </li>
    )
  }
}

/** One house playlist, led by what changed and who changed it. */
function HouseRow(handle: Handle<{ playlist: Playlist; eager?: boolean; viewerId?: string | null }>) {
  return () => {
    let { playlist, eager, viewerId } = handle.props
    let owner = ownerOf(playlist)
    let peek = activityVideos(playlist, 3, viewerId)
    let href = routes.playlist.href({ playlistId: playlist.id })
    let length = playlistDuration(playlist, viewerId)

    return (
      <li class="chrow plrow">
        <PlaylistCover playlist={playlist} eager={eager} viewerId={viewerId} />
        <div class="chrow-text">
          <p class="plrow-what">
            {owner ? <Avatar channel={owner} size="sm" /> : null}
            <span>
              <strong>{owner?.name ?? 'Someone'}</strong> {describeActivity(playlist.activity)}
              <span class="plrow-sep" aria-hidden="true"> · </span>
              <span class="plrow-when">{sentenceCase(when(playlist))}</span>
            </span>
          </p>
          <h3 class="chrow-name">
            <a href={href}>{playlist.name}</a>
          </h3>
          <p class="chrow-meta">
            <span>{videoCount(playlistVideos(playlist, viewerId).length)}</span>
            {length > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatLength(length)}</span>
              </>
            ) : null}
          </p>
        </div>
        {peek.length > 0 ? (
          <ul class="chrow-peek plrow-peek" aria-hidden="true">
            {peek.map(({ video, fresh }) => (
              <li>
                <a
                  class="chrow-thumb"
                  href={watchInList(video.id, playlist.id)}
                  tabindex={-1}
                  title={video.title}
                >
                  <ThumbImage video={video} eager={eager} />
                  {fresh ? <span class="badge-new chrow-thumb-new">New</span> : null}
                  <DurationBadge seconds={video.durationSec} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    )
  }
}

export function PlaylistsPage(handle: Handle<PlaylistsPageProps>) {
  return () => {
    let { person = null } = handle.props
    let yours = person ? playlistsOwnedBy(person.id) : []
    let house = housePlaylists(person?.id)
    let newHref = routes.playlistNew.index.href()
    let note = person
      ? `${yours.length} of yours · ${house.length} from the house`
      : `${house.length} shared by the house`

    if (!person && house.length === 0) {
      return (
        <AppShell current="playlists" title="Playlists" person={person}>
          <section class="empty" aria-labelledby="page-title">
            <Icon name="playlists" size={40} />
            <h1 id="page-title">No playlists yet</h1>
            <p>When someone in the house shares a playlist, it shows up here.</p>
          </section>
        </AppShell>
      )
    }

    return (
      <AppShell current="playlists" title="Playlists" person={person}>
        <header class="page-head">
          <div class="page-head-text">
            <h1 class="page-title">Playlists</h1>
            <p class="page-note">{note}</p>
          </div>
          {person ? (
            <a class="btn btn-secondary" href={newHref}>
              <Icon name="plus" size={20} />
              New playlist
            </a>
          ) : null}
        </header>

        {person ? (
          <section class="shelf" aria-labelledby="yours">
            <header class="shelf-head">
              <h2 class="shelf-title" id="yours">
                Yours
              </h2>
              {yours.some((playlist) => playlist.visibility === 'private') ? (
                <p class="shelf-note">Only you can see the private ones</p>
              ) : null}
            </header>
            {yours.length > 0 ? (
              <ul class="pgrid">
                {yours.map((playlist, index) => (
                  <YourCard playlist={playlist} eager={index < 4} />
                ))}
              </ul>
            ) : (
              <div class="chlist-empty">
                <p>
                  You haven’t made one yet. Gather videos for a trip, a birthday, or a quiet evening, then keep it to yourself or
                  share it with the house.
                </p>
                <a class="btn btn-secondary" href={newHref}>
                  <Icon name="plus" size={20} />
                  New playlist
                </a>
              </div>
            )}
          </section>
        ) : null}

        <section class="shelf" aria-labelledby="house">
          <header class="shelf-head">
            <h2 class="shelf-title" id="house">
              From the house
            </h2>
            <p class="shelf-note">Most recently changed first</p>
          </header>
          {house.length > 0 ? (
            <ul class="chlist">
              {house.map((playlist, index) => (
                <HouseRow playlist={playlist} eager={!person && index < 2} viewerId={person?.id} />
              ))}
            </ul>
          ) : (
            <p class="plist-quiet">Nobody else has shared a playlist yet.</p>
          )}
        </section>
      </AppShell>
    )
  }
}
