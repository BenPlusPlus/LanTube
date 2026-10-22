import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { brandName, unsignedWatchAllowed } from '../data/brand.ts'
import { listVisibleVideos, saveIndexedVideo, saveUploadedVideo } from '../data/catalogue.ts'
import { getPerson, listPeople, personFromSession, type Person } from '../data/household.ts'
import { dropIndexedVideo } from '../data/folders.ts'
import { recordWatchProgress, recordWatchStart } from '../data/history.ts'
import {
  canAdminDeleteChannel,
  canDeleteVideo,
  canDropFolderVideo,
  canEditVideo,
  canEditVideoTags,
  canEditVideoTitle,
  canWatch,
  getChannel,
  getVideo,
  namedAudience,
  recordPlay,
  searchVideos,
  channelVideos,
  type ChannelSort,
  type Video,
} from '../data/library.ts'
import { addVideo, canSee, getPlaylist, isOwner, moveVideo, playlistVideos, removeVideo } from '../data/playlists.ts'
import { feedPage, parseCount, splitHomeLibrary, VIDEO_FEED_PAGE } from '../data/video-feed.ts'
import { mediaFileFor, mimeTypeFor } from '../data/media.ts'

import { findOrCreateTags, parseTagNames } from '../data/tags.ts'
import { deleteCustomChannel, deleteFrozenHomeChannel, deleteUploadedVideo, getStaged, posterPathFor, stagedUploadErrorResponse, stageUpload, uploadLimits } from '../data/uploads.ts'
import { assign, dropImpossibleAssignments, mustFinishAssignedFirst, unassign } from '../data/assignments.ts'
import { allowanceFor, isTimeUp } from '../data/watch-limits.ts'
import { routes } from '../routes.ts'
import { channelFeedHrefs, homeEarlierHrefs, playlistFeedHrefs } from '../ui/feed-batch.tsx'
import { ChannelPage, ChannelVideosBatch } from './channel-page.tsx'
import { ChannelsPage } from './channels-page.tsx'
import { HistoryPage } from './history-page.tsx'
import { HomeEarlierBatch, HomePage } from './home-page.tsx'
import { NotBuiltPage } from './not-built-page.tsx'
import { playlistAccess } from './playlist-access.ts'
import { PlaylistPage, PlaylistVideosBatch } from './playlist-page.tsx'
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

function watchFields(video: Video, personId: string | undefined | null) {
  return {
    canEditTitle: canEditVideoTitle(video, personId),
    canEditTags: canEditVideoTags(video, personId),
    canEditAccess: canEditVideo(video, personId),
    canDelete: canDeleteVideo(video, personId),
    canDrop: canDropFolderVideo(video, personId),
  }
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
      let tag = (params.get('tag') ?? '').trim()
      let filtering = query !== '' || tag !== ''
      return context.render(
        <HomePage
          query={query}
          tag={tag || undefined}
          videos={videos}
          earlierShown={parseCount(params.get('earlier'), 0)}
          results={videos.length > 0 && filtering ? searchVideos(query, tag || undefined, person?.id, videos) : undefined}
          person={person}
        />,
      )
    },
    async homeEarlier(context) {
      let person = personFromSession(context.session)
      let { earlier } = splitHomeLibrary(await listVisibleVideos(person?.id), person?.id)
      let from = parseCount(new URL(context.request.url).searchParams.get('from'), 0)
      let { page, nextFrom, hasMore } = feedPage(earlier, from)
      let hrefs = homeEarlierHrefs(nextFrom)
      return context.render(
        <HomeEarlierBatch
          videos={page}
          nextHref={hasMore ? hrefs.nextHref : null}
          moreHref={hasMore ? hrefs.moreHref : null}
          viewerId={person?.id}
        />,
      )
    },
    watch(context) {
      let person = personFromSession(context.session)
      if (!person && !unsignedWatchAllowed()) return redirect(routes.signin.index.href(), 303)
      let video = watchable(context.params.videoId, person?.id)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      let theater = /(?:^|;\s*)lt_theater=1(?:;|$)/.test(context.request.headers.get('Cookie') ?? '')
      let listId = new URL(context.request.url).searchParams.get('list')
      let list = listId ? getPlaylist(listId) : undefined
      if (list && (!canSee(list, person?.id) || !list.videoIds.includes(video.id))) list = undefined
      return context.render(
        <WatchPage
          video={video}
          media={mediaFileFor(video)}
          theater={theater}
          person={person}
          people={listPeople()}
          list={list}
          {...watchFields(video, person?.id)}
        />,
      )
    },
    async watchSave(context) {
      let person = personFromSession(context.session)
      let video = watchable(context.params.videoId, person?.id)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      let fields = watchFields(video, person?.id)
      if (!person || !(fields.canEditTitle || fields.canEditTags || fields.canEditAccess)) {
        return new Response('Forbidden', { status: 403 })
      }
      let form = context.formData
      let rawTitle = form.get('title')
      let postedTitle = typeof rawTitle === 'string' ? rawTitle.trim().replace(/\s+/g, ' ') : ''
      let title = fields.canEditTitle ? postedTitle : video.title
      let parsed = parseTagNames(form.getAll('tags').filter((value): value is string => typeof value === 'string'))
      let visibility: 'house' | 'private' = form.get('visibility') === 'private' ? 'private' : 'house'
      let audienceIds =
        visibility === 'private'
          ? namedAudience(
              video.postedBy ?? person.id,
              form.getAll('audience').filter((value): value is string => typeof value === 'string'),
            )
          : []
      let edit = {
        title: fields.canEditTitle && typeof rawTitle === 'string' ? rawTitle : video.title,
        tags: parsed.names,
        tagDraft: parsed.leftover,
        visibility,
        audienceIds,
      }
      let fail = (error: string, errorField: 'title' | 'tags') =>
        context.render(
          <WatchPage
            video={video}
            media={mediaFileFor(video)}
            theater={/(?:^|;\s*)lt_theater=1(?:;|$)/.test(context.request.headers.get('Cookie') ?? '')}
            person={person}
            people={listPeople()}
            {...fields}
            edit={edit}
            error={error}
            errorField={errorField}
          />,
          { status: 400 },
        )
      if (fields.canEditTitle && (title.length < 1 || title.length > uploadLimits.title)) {
        return fail(`Give the video a title between 1 and ${uploadLimits.title} characters.`, 'title')
      }
      if (fields.canEditTags && parsed.error) return fail(parsed.error, 'tags')
      let folder = getChannel(video.channelId)?.kind === 'folder'
      let tagRows = fields.canEditTags ? await findOrCreateTags(parsed.names) : []
      let tagIds = fields.canEditTags ? tagRows.map((tag) => tag.id) : []
      let saved = folder
        ? await saveIndexedVideo({ slug: video.id, title, tagIds })
        : await saveUploadedVideo({
            slug: video.id,
            title,
            visibility,
            audienceIds,
            tagIds,
          })
      if (!saved) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      video.title = title
      if (fields.canEditTags) video.tags = tagRows.map((tag) => tag.slug)
      if (!folder) {
        if (visibility === 'private') {
          video.private = true
          video.audience = audienceIds
        } else {
          video.private = undefined
          video.audience = undefined
        }
        await dropImpossibleAssignments()
      }
      return redirect(routes.watch.href({ videoId: video.id }), 303)
    },
    async watchDelete(context) {
      let person = personFromSession(context.session)
      let video = watchable(context.params.videoId, person?.id)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      let fields = watchFields(video, person?.id)
      let folder = getChannel(video.channelId)?.kind === 'folder'
      if (!person || (folder ? !fields.canDrop : !fields.canDelete)) {
        return new Response('Forbidden', { status: 403 })
      }
      if (context.formData.get('confirm') !== '1') {
        return context.render(
          <WatchPage
            video={video}
            media={mediaFileFor(video)}
            theater={/(?:^|;\s*)lt_theater=1(?:;|$)/.test(context.request.headers.get('Cookie') ?? '')}
            person={person}
            people={listPeople()}
            {...fields}
            error={folder ? 'Tick the box to confirm, then drop.' : 'Tick the box to confirm, then delete.'}
            errorField={folder ? 'drop' : 'delete'}
          />,
          { status: 400 },
        )
      }
      let channelId = video.channelId
      if (folder) await dropIndexedVideo(video.id)
      else await deleteUploadedVideo(video)
      return redirect(routes.channel.href({ channelId }), 303)
    },
    async watchAssign(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isParent) return new Response('Forbidden', { status: 403 })
      let video = watchable(context.params.videoId, person.id)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      let form = context.formData
      let personId = form.get('personId')
      let intent = form.get('intent')
      if (typeof personId !== 'string' || (intent !== 'assign' && intent !== 'unassign')) {
        return new Response('Bad Request', { status: 400 })
      }
      let result = intent === 'assign' ? await assign(person.id, personId, video.id) : await unassign(person.id, personId, video.id)
      if (result !== true) return new Response(result.error, { status: 400 })
      let next = routes.home.href()
      let referer = context.request.headers.get('Referer')
      if (referer) {
        try {
          let url = new URL(referer)
          let path = `${url.pathname}${url.search}`
          if (url.origin === new URL(context.request.url).origin && /^\/(?![/\\])/.test(path)) next = path
        } catch {}
      }
      return redirect(next, 303)
    },
    async media(context) {
      let person = personFromSession(context.session)
      if (!person && !unsignedWatchAllowed()) return new Response('Sign in to watch', { status: 401 })
      let video = watchable(context.params.videoId, person?.id)
      let media = video ? mediaFileFor(video) : null
      if (!video || !media?.exists) return new Response('Not Found', { status: 404 })
      if (mustFinishAssignedFirst(person, video.id)) {
        return new Response('Finish your assigned videos first.', { status: 403 })
      }
      if (isTimeUp(person)) return new Response('Time’s up for today', { status: 403 })
      return createFileResponse(openLazyFile(media.path, { type: media.type }), context.request, {
        cacheControl: 'private, max-age=3600',
      })
    },
    async watchActivity(context) {
      let person = personFromSession(context.session)
      if (!person && !unsignedWatchAllowed()) return new Response('Sign in to watch', { status: 401 })
      let video = watchable(context.params.videoId, person?.id)
      if (!video) return new Response('Not Found', { status: 404 })
      let form = context.formData
      let event = form.get('event')
      // A limited viewer learns their time left with every report, so extra time reaches a playing video.
      let allowance = () => {
        let left = person ? allowanceFor(person) : null
        return left ? Response.json({ remainingSec: left.remainingSec }) : new Response(null, { status: 204 })
      }
      if (event === 'play') {
        if (mustFinishAssignedFirst(person, video.id)) {
          return new Response('Finish your assigned videos first.', { status: 403 })
        }
        if (isTimeUp(person)) return allowance()
        recordPlay(video)
        if (person) await recordWatchStart(person.id, video)
        return allowance()
      }
      if (event === 'progress') {
        let position = Number(form.get('t'))
        let duration = form.has('d') ? Number(form.get('d')) : undefined
        let valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 86_400
        if (!valid(position) || (duration !== undefined && !(valid(duration) && duration > 0))) {
          return new Response('Bad Request', { status: 400 })
        }
        if (mustFinishAssignedFirst(person, video.id)) {
          return new Response('Finish your assigned videos first.', { status: 403 })
        }
        if (person) await recordWatchProgress(person.id, video, position, duration)
        else if (duration !== undefined) video.durationSec = Math.round(duration)
        return allowance()
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
      let params = new URL(context.request.url).searchParams
      let requested = params.get('sort')
      let sort: ChannelSort = requested === 'popular' || requested === 'oldest' ? requested : 'latest'
      return context.render(
        <ChannelPage
          channel={channel}
          sort={sort}
          person={personFromSession(context.session)}
          shown={parseCount(params.get('n'), VIDEO_FEED_PAGE)}
        />,
      )
    },
    async channelDelete(context) {
      let person = personFromSession(context.session)
      let channel = getChannel(context.params.channelId)
      if (!channel) {
        return context.render(
          <NotBuiltPage current={null} title="Channel not found" detail="Nobody in the house has a channel by that name." person={person} />,
          { status: 404 },
        )
      }
      if (!person || !canAdminDeleteChannel(channel, person.id)) {
        return new Response('Forbidden', { status: 403 })
      }
      if (context.formData.get('confirm') !== '1') {
        return context.render(
          <ChannelPage
            channel={channel}
            sort="latest"
            person={person}
            shown={VIDEO_FEED_PAGE}
            error="Tick the box to confirm, then delete."
            errorField="delete"
          />,
          { status: 400 },
        )
      }
      if (channel.kind === 'custom') await deleteCustomChannel(channel)
      else if (channel.kind === 'person') await deleteFrozenHomeChannel(channel)
      return redirect(routes.channels.href(), 303)
    },
    channelVideos(context) {
      let channel = getChannel(context.params.channelId)
      if (!channel) return new Response('Not Found', { status: 404 })
      let person = personFromSession(context.session)
      let params = new URL(context.request.url).searchParams
      let requested = params.get('sort')
      let sort: ChannelSort = requested === 'popular' || requested === 'oldest' ? requested : 'latest'
      let list = channelVideos(channel.id, sort, person?.id)
      let from = parseCount(params.get('from'), 0)
      let { page, nextFrom, hasMore } = feedPage(list, from)
      let hrefs = channelFeedHrefs(channel.id, sort, nextFrom)
      return context.render(
        <ChannelVideosBatch
          videos={page}
          nextHref={hasMore ? hrefs.nextHref : null}
          moreHref={hasMore ? hrefs.moreHref : null}
          viewerId={person?.id}
        />,
      )
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
      return context.render(
        <PlaylistPage
          playlist={playlist}
          person={person}
          shown={parseCount(new URL(context.request.url).searchParams.get('n'), VIDEO_FEED_PAGE)}
        />,
      )
    },
    playlistVideos(context) {
      let person = personFromSession(context.session)
      let playlist = getPlaylist(context.params.playlistId)
      if (!playlist || !canSee(playlist, person?.id)) return new Response('Not Found', { status: 404 })
      let videos = playlistVideos(playlist, person?.id)
      let from = parseCount(new URL(context.request.url).searchParams.get('from'), 0)
      let { page, nextFrom, hasMore } = feedPage(videos, from)
      let hrefs = playlistFeedHrefs(playlist.id, nextFrom)
      return context.render(
        <PlaylistVideosBatch
          playlist={playlist}
          videos={page}
          from={from}
          count={videos.length}
          editable={isOwner(playlist, person?.id)}
          viewerId={person?.id}
          nextHref={hasMore ? hrefs.nextHref : null}
          moreHref={hasMore ? hrefs.moreHref : null}
        />,
      )
    },
    async playlistItems(context) {
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
      if (intent === 'add') await addVideo(playlist, videoId)
      else if (intent === 'remove') await removeVideo(playlist, videoId)
      else if (intent === 'up') await moveVideo(playlist, videoId, -1)
      else if (intent === 'down') await moveVideo(playlist, videoId, 1)
      else return new Response('Bad Request', { status: 400 })
      if (quiet) return new Response(null, { status: 204 })
      return redirect(safeReturn(form.get('returnTo')) ?? routes.playlist.href({ playlistId: playlist.id }), 303)
    },
    history(context) {
      let person = personFromSession(context.session)
      let params = new URL(context.request.url).searchParams
      let query = (params.get('q') ?? '').trim().slice(0, 120)
      let subject = person
      let people: Person[] | undefined
      if (person?.isParent) {
        people = listPeople().filter((other) => other.id !== person.id && !other.isParent)
        let requested = params.get('person')
        if (requested) {
          let target = getPerson(requested)
          if (target && target.id !== person.id && !target.isParent) subject = target
        }
      }
      return context.render(<HistoryPage query={query} person={person} subject={subject ?? undefined} people={people} />)
    },
    async uploadFile(context) {
      let person = personFromSession(context.session)
      if (!person) {
        await context.request.body?.cancel().catch(() => {})
        return Response.json({ error: 'Sign in to upload.' }, { status: 401 })
      }
      let name = new URL(context.request.url).searchParams.get('name') ?? ''
      if (!context.request.body) return Response.json({ error: 'Nothing arrived.' }, { status: 400 })
      try {
        let upload = await stageUpload(person.id, name, context.request.body)
        if (!upload) return Response.json({ error: `That isn’t a video file ${brandName()} can keep.` }, { status: 415 })
        return Response.json({ id: upload.id, size: upload.size }, { status: 201 })
      } catch (error) {
        await context.request.body?.cancel().catch(() => {})
        return stagedUploadErrorResponse(error)
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
  },
})
