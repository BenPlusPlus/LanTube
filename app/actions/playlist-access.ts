import type { Person } from '../data/household.ts'
import { canSee, getPlaylist, type Playlist } from '../data/playlists.ts'
import { ownerOf } from '../ui/playlists.tsx'

export type PlaylistAccess =
  | { playlist: Playlist; person: Person }
  | { status: 401 | 403 | 404; title: string; detail: string; person: Person | null }

/** Changing a playlist is its owner's alone; a private one doesn't exist for anyone else. */
export function playlistAccess(playlistId: string, person: Person | null): PlaylistAccess {
  let playlist = getPlaylist(playlistId)
  if (!playlist || !canSee(playlist, person?.id)) {
    return { status: 404, title: 'Playlist not found', detail: 'It may have been deleted, or it’s private.', person }
  }
  let owner = ownerOf(playlist)?.name ?? 'its owner'
  if (!person) {
    return { status: 401, title: `Sign in to change ${playlist.name}`, detail: `Only ${owner} can change this playlist.`, person }
  }
  if (playlist.ownerId !== person.id) {
    return { status: 403, title: `Only ${owner} can change ${playlist.name}`, detail: 'Ask them to add or remove videos.', person }
  }
  return { playlist, person }
}
