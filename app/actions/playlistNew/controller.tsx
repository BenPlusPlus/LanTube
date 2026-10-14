import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { personFromSession } from '../../data/household.ts'
import { canWatch, getVideo } from '../../data/library.ts'
import { createPlaylist } from '../../data/playlists.ts'
import { routes } from '../../routes.ts'
import { PlaylistFormPage, readPlaylistForm, SignInToCreatePlaylist } from '../playlist-form-page.tsx'

export default createController(routes.playlistNew, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToCreatePlaylist />, { status: 401 })
      let video = getVideo(new URL(context.request.url).searchParams.get('video') ?? '')
      if (video && !canWatch(video, person.id)) video = undefined
      return context.render(
        <PlaylistFormPage person={person} video={video} values={{ name: '', description: '', visibility: 'private', audienceIds: [] }} />,
      )
    },
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToCreatePlaylist />, { status: 401 })
      let videoField = context.formData.get('video')
      let video = typeof videoField === 'string' ? getVideo(videoField) : undefined
      if (video && !canWatch(video, person.id)) video = undefined
      let values = readPlaylistForm(context.formData)
      let created = await createPlaylist(person.id, values, video?.id)
      if ('error' in created) {
        return context.render(
          <PlaylistFormPage person={person} video={video} values={values} error={created.error} errorField={created.field} />,
          { status: 400 },
        )
      }
      return redirect(video ? routes.watch.href({ videoId: video.id }) : routes.playlist.href({ playlistId: created.id }), 303)
    },
  },
})
