import type { Handle } from 'remix/component'

import { getPerson, type Person } from '../data/household.ts'
import { getChannel, type Channel, type Video } from '../data/library.ts'
import { playlistVideos, type Playlist } from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { ThumbImage } from './cards.tsx'
import { Icon } from './public/icons.tsx'

export function personChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

/** The owner as an avatar-ready channel, or undefined if they've left the house. */
export function ownerOf(playlist: Playlist): Channel | undefined {
  let channel = getChannel(playlist.ownerId)
  if (channel) return channel
  let person = getPerson(playlist.ownerId)
  return person ? personChannel(person) : undefined
}

export function videoCount(n: number) {
  return n === 0 ? 'No videos' : `${n} video${n === 1 ? '' : 's'}`
}

export function watchInList(videoId: string, playlistId: string) {
  return `${routes.watch.href({ videoId })}?list=${encodeURIComponent(playlistId)}`
}

/**
 * A playlist reads as a stack: the first video's thumbnail in front, the next two as
 * slivers behind it, and the count in the corner.
 */
export function PlaylistCover(handle: Handle<{ playlist: Playlist; size?: 'md' | 'lg'; eager?: boolean; viewerId?: string | null }>) {
  return () => {
    let { playlist, size = 'md', eager = false, viewerId } = handle.props
    let visible = playlistVideos(playlist, viewerId)
    let [front, second, third] = visible
    let thumb = (video: Video | undefined) => (video ? <ThumbImage video={video} eager={eager} /> : null)

    return (
      <span class={`pcover pcover-${size}`} aria-hidden="true">
        <span class="pcover-sliver pcover-back">{thumb(third ?? second ?? front)}</span>
        <span class="pcover-sliver pcover-mid">{thumb(second ?? front)}</span>
        <span class="pcover-front">
          {front ? thumb(front) : <Icon name="playlists" size={size === 'lg' ? 40 : 28} />}
          <span class="pcover-count">
            <Icon name="playlists" size={14} />
            {visible.length}
          </span>
        </span>
      </span>
    )
  }
}

/** Private with a lock, or Everyone in the house. Never coloured: privacy is a fact, not a warning. */
export function VisibilityLabel(handle: Handle<{ playlist: Playlist }>) {
  return () =>
    handle.props.playlist.visibility === 'private' ? (
      <span class="pvis">
        <Icon name="lock" size={14} />
        Private
      </span>
    ) : (
      <span class="pvis">Everyone in the house</span>
    )
}
