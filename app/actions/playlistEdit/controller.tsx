import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { personFromSession } from '../../data/household.ts'
import { deletePlaylist, updatePlaylist } from '../../data/playlists.ts'
import { routes } from '../../routes.ts'
import { NotBuiltPage } from '../not-built-page.tsx'
import { playlistAccess } from '../playlist-access.ts'
import { PlaylistFormPage, readPlaylistForm } from '../playlist-form-page.tsx'

export default createController(routes.playlistEdit, {
  actions: {
    index(context) {
      let result = playlistAccess(context.params.playlistId, personFromSession(context.session))
      if ('status' in result) {
        return context.render(<NotBuiltPage current="playlists" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { playlist, person } = result
      return context.render(
        <PlaylistFormPage
          person={person}
          playlist={playlist}
          values={{ name: playlist.name, description: playlist.description ?? '', visibility: playlist.visibility }}
        />,
      )
    },
    action(context) {
      let result = playlistAccess(context.params.playlistId, personFromSession(context.session))
      if ('status' in result) {
        return context.render(<NotBuiltPage current="playlists" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { playlist, person } = result

      if (context.formData.get('intent') === 'delete') {
        if (context.formData.get('confirm') !== '1') {
          return context.render(
            <PlaylistFormPage
              person={person}
              playlist={playlist}
              values={{ name: playlist.name, description: playlist.description ?? '', visibility: playlist.visibility }}
              error="Tick the box to confirm, then delete."
              errorField="delete"
            />,
            { status: 400 },
          )
        }
        deletePlaylist(playlist)
        return redirect(routes.playlists.href(), 303)
      }

      let values = readPlaylistForm(context.formData)
      let updated = updatePlaylist(playlist, values)
      if ('error' in updated) {
        return context.render(
          <PlaylistFormPage person={person} playlist={playlist} values={values} error={updated.error} errorField={updated.field} />,
          { status: 400 },
        )
      }
      return redirect(routes.playlist.href({ playlistId: playlist.id }), 303)
    },
  },
})
