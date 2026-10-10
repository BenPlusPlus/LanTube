import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { personFromSession } from '../data/household.ts'
import { getChannel, getTopic, getVideo, searchVideos } from '../data/library.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'
import { NotBuiltPage } from './not-built-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    home(context) {
      let params = new URL(context.request.url).searchParams
      let query = (params.get('q') ?? '').trim().slice(0, 120)
      let topic = getTopic(params.get('topic'))?.id
      let filtering = query !== '' || topic !== undefined
      return context.render(
        <HomePage
          query={query}
          topic={topic}
          results={filtering ? searchVideos(query, topic) : undefined}
          person={personFromSession(context.session)}
        />,
      )
    },
    watch(context) {
      let video = getVideo(context.params.videoId)
      if (!video) {
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={personFromSession(context.session)} />,
          { status: 404 },
        )
      }
      return context.render(
        <NotBuiltPage current={null} title={video.title} detail="The watch page is the next screen to design. This link will play the video here." person={personFromSession(context.session)} />,
      )
    },
    channel(context) {
      let channel = getChannel(context.params.channelId)
      if (!channel) {
        return context.render(
          <NotBuiltPage current={null} title="Channel not found" detail="Nobody in the house has a channel by that name." person={personFromSession(context.session)} />,
          { status: 404 },
        )
      }
      return context.render(
        <NotBuiltPage
          current={`channel:${channel.id}`}
          title={channel.name}
          detail={channel.kind === 'folder' ? `Videos indexed from ${channel.path} will be listed here.` : `${channel.name}’s channel page hasn’t been designed yet.`}
          person={personFromSession(context.session)}
        />,
      )
    },
    channels(context) {
      return context.render(<NotBuiltPage current="channels" title="Channels" detail="A directory of everyone’s channels and indexed folders is coming." person={personFromSession(context.session)} />)
    },
    playlists(context) {
      return context.render(<NotBuiltPage current="playlists" title="Playlists" detail="Playlists you and the house put together will live here." person={personFromSession(context.session)} />)
    },
    history(context) {
      return context.render(<NotBuiltPage current="history" title="History" detail="Everything watched on this device will be listed here." person={personFromSession(context.session)} />)
    },
    upload(context) {
      return context.render(<NotBuiltPage current="upload" title="Upload" detail="Uploading straight to your channel is coming. Videos in indexed folders already appear automatically." person={personFromSession(context.session)} />)
    },
    signout(context) {
      context.session.destroy()
      return redirect(routes.home.href(), 303)
    },
  },
})
