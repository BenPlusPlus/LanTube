import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { listVisibleVideos } from '../data/catalogue.ts'
import { listPeople, personFromSession } from '../data/household.ts'
import { recordWatchProgress, recordWatchStart } from '../data/history.ts'
import { canWatch, getChannel, getTopic, getVideo, recordPlay, searchVideos, type ChannelSort, type Video } from '../data/library.ts'
import { mediaFileFor, mimeTypeFor } from '../data/media.ts'
import { addVideo, canSee, getPlaylist, moveVideo, removeVideo } from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { ChannelPage } from './channel-page.tsx'
import { ChannelsPage } from './channels-page.tsx'
import { HistoryPage } from './history-page.tsx'
import { HomePage } from './home-page.tsx'
import { HouseForbidden, HousePage } from './house-page.tsx'
import { NotBuiltPage } from './not-built-page.tsx'
import { getStaged, posterPathFor, stageUpload, UploadTooLargeError } from '../data/uploads.ts'
import { playlistAccess } from './playlist-access.ts'
import { PlaylistPage } from './playlist-page.tsx'
import { PlaylistsPage } from './playlists-page.tsx'
import { WatchPage } from './watch-page.tsx'

/** Only same-site paths; anything else falls back. */
function safeReturn(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined
}

/** The video, if it exists and this viewer may see it. Someone else's private video doesn't exist for you. */
function watchable(videoId: string, viewerId: string | undefined): Video | undefined {
  let video = getVideo(videoId)
  return video && canWatch(video, viewerId) ? video : undefined
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    async home(context) {
      let person = personFromSession(context.session)
      let videos = await listVisibleVideos(person?.id)
      let params = new URL(context.request.url).searchParams
      let query = (params.get('q') ?? '').trim().slice(0, 120)
      let topic = getTopic(params.get('topic'))?.id
      let filtering = query !== '' || topic !== undefined
      return context.render(
        <HomePage
          query={query}
          topic={topic}
          videos={videos}
          results={videos.length > 0 && filtering ? searchVideos(query, topic, person?.id) : undefined}
          person={person}
        />,
      )
    },
    watch(context) {
      let video = watchable(context.params.videoId, personFromSession(context.session)?.id)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={personFromSession(context.session)} />,
          { status: 404 },
        )
      }
      let theater = /(?:^|;\s*)lt_theater=1(?:;|$)/.test(context.request.headers.get('Cookie') ?? '')
      let person = personFromSession(context.session)
      let listId = new URL(context.request.url).searchParams.get('list')
      let list = listId ? getPlaylist(listId) : undefined
      if (list && (!canSee(list, person?.id) || !list.videoIds.includes(video.id))) list = undefined
      return context.render(
        <WatchPage video={video} media={mediaFileFor(video)} theater={theater} person={person} list={list} />,
      )
    },
    async media(context) {
      let video = watchable(context.params.videoId, personFromSession(context.session)?.id)
      let media = video ? mediaFileFor(video) : null
      if (!media?.exists) return new Response('Not Found', { status: 404 })
      return createFileResponse(openLazyFile(media.path, { type: media.type }), context.request, {
        cacheControl: 'private, max-age=3600',
      })
    },
    watchActivity(context) {
      let video = watchable(context.params.videoId, personFromSession(context.session)?.id)
      if (!video) return new Response('Not Found', { status: 404 })
      let form = context.formData
      let event = form.get('event')
      if (event === 'play') {
        recordPlay(video)
        let person = personFromSession(context.session)
        if (person) recordWatchStart(person.id, video)
        return new Response(null, { status: 204 })
      }
      if (event === 'progress') {
        let position = Number(form.get('t'))
        let duration = form.has('d') ? Number(form.get('d')) : undefined
        let valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 86_400
        if (!valid(position) || (duration !== undefined && !(valid(duration) && duration > 0))) {
          return new Response('Bad Request', { status: 400 })
        }
        let person = personFromSession(context.session)
        if (person) recordWatchProgress(person.id, video, position, duration)
        else if (duration !== undefined) video.durationSec = Math.round(duration)
        return new Response(null, { status: 204 })
      }
      return new Response('Bad Request', { status: 400 })
    },
    channel(context) {
      let channel = getChannel(context.params.channelId)
      if (!channel) {
        return context.render(
          <NotBuiltPage current={null} title="Channel not found" detail="Nobody in the house has a channel by that name." person={personFromSession(context.session)} />,
          { status: 404 },
        )
      }
      let requested = new URL(context.request.url).searchParams.get('sort')
      let sort: ChannelSort = requested === 'popular' || requested === 'oldest' ? requested : 'latest'
      return context.render(<ChannelPage channel={channel} sort={sort} person={personFromSession(context.session)} />)
    },
    channels(context) {
      return context.render(<ChannelsPage person={personFromSession(context.session)} />)
    },
    playlists(context) {
      return context.render(<PlaylistsPage person={personFromSession(context.session)} />)
    },
    playlist(context) {
      let person = personFromSession(context.session)
      let playlist = getPlaylist(context.params.playlistId)
      if (!playlist || !canSee(playlist, person?.id)) {
        return context.render(
          <NotBuiltPage current="playlists" title="Playlist not found" detail="It may have been deleted, or it’s private." person={person} />,
          { status: 404 },
        )
      }
      return context.render(<PlaylistPage playlist={playlist} person={person} />)
    },
    playlistItems(context) {
      let form = context.formData
      let quiet = form.get('async') === '1'
      let result = playlistAccess(context.params.playlistId, personFromSession(context.session))
      if ('status' in result) {
        if (quiet) return new Response(null, { status: result.status })
        return context.render(<NotBuiltPage current="playlists" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { playlist } = result
      let videoId = form.get('videoId')
      let intent = form.get('intent')
      if (typeof videoId !== 'string' || !watchable(videoId, result.person?.id)) return new Response('Bad Request', { status: 400 })
      if (intent === 'add') addVideo(playlist, videoId)
      else if (intent === 'remove') removeVideo(playlist, videoId)
      else if (intent === 'up') moveVideo(playlist, videoId, -1)
      else if (intent === 'down') moveVideo(playlist, videoId, 1)
      else return new Response('Bad Request', { status: 400 })
      if (quiet) return new Response(null, { status: 204 })
      return redirect(safeReturn(form.get('returnTo')) ?? routes.playlist.href({ playlistId: playlist.id }), 303)
    },
    history(context) {
      let query = (new URL(context.request.url).searchParams.get('q') ?? '').trim().slice(0, 120)
      return context.render(<HistoryPage query={query} person={personFromSession(context.session)} />)
    },
    async uploadFile(context) {
      let person = personFromSession(context.session)
      if (!person) return Response.json({ error: 'Sign in to upload.' }, { status: 401 })
      let name = new URL(context.request.url).searchParams.get('name') ?? ''
      if (!context.request.body) return Response.json({ error: 'Nothing arrived.' }, { status: 400 })
      try {
        let upload = await stageUpload(person.id, name, context.request.body)
        if (!upload) return Response.json({ error: 'That isn’t a video file LanTube can keep.' }, { status: 415 })
        return Response.json({ id: upload.id, size: upload.size }, { status: 201 })
      } catch (error) {
        if (error instanceof UploadTooLargeError) return Response.json({ error: 'That file is too large for the host.' }, { status: 413 })
        return Response.json({ error: 'The file stopped arriving.' }, { status: 400 })
      }
    },
    uploadStaged(context) {
      let person = personFromSession(context.session)
      let upload = person ? getStaged(context.params.uploadId, person.id) : undefined
      if (!upload) return new Response('Not Found', { status: 404 })
      return createFileResponse(openLazyFile(upload.path, { type: mimeTypeFor(upload.ext) }), context.request, {
        cacheControl: 'private, no-store',
      })
    },
    poster(context) {
      let video = watchable(context.params.videoId, personFromSession(context.session)?.id)
      let file = video ? posterPathFor(video) : null
      if (!file) return new Response('Not Found', { status: 404 })
      return createFileResponse(openLazyFile(file, { type: 'image/jpeg' }), context.request, {
        cacheControl: 'private, max-age=86400',
      })
    },
    signout(context) {
      context.session.destroy()
      return redirect(routes.home.href(), 303)
    },
    house(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isAdmin) {
        return context.render(<HouseForbidden person={person} />, { status: 403 })
      }
      return context.render(<HousePage person={person} people={listPeople()} />)
    },
  },
})
