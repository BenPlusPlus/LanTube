import { MaxFileSizeExceededError, MaxFilesExceededError, MaxTotalSizeExceededError, parseFormData } from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { personFromSession, type Person } from '../../data/household.ts'
import { getChannel, type Channel } from '../../data/library.ts'
import { canSeePosts, canWritePost, channelPosts, createPost, postLimits, POSTS_PAGE, type PostField } from '../../data/posts.ts'
import { parseCount, VIDEO_FEED_PAGE } from '../../data/video-feed.ts'
import { routes } from '../../routes.ts'
import { ChannelPage } from '../channel-page.tsx'
import type { ComposerValues } from '../channel-posts.tsx'
import { NotBuiltPage } from '../not-built-page.tsx'

function notFound(person: Person | null) {
  return (
    <NotBuiltPage current={null} title="Channel not found" detail="Nobody in the house has a channel by that name." person={person} />
  )
}

function postsPage(
  channel: Channel,
  person: Person | null,
  shown: number,
  form?: { values?: ComposerValues; error?: string; errorField?: PostField },
) {
  return (
    <ChannelPage
      channel={channel}
      sort="latest"
      person={person}
      shown={VIDEO_FEED_PAGE}
      tab="posts"
      posts={{ posts: channelPosts(channel.id), shown, ...form }}
    />
  )
}

export default createController(routes.channelPosts, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      let channel = getChannel(context.params.channelId)
      if (!channel || !canSeePosts(channel, person?.id)) return context.render(notFound(person), { status: 404 })
      let shown = parseCount(new URL(context.request.url).searchParams.get('n'), POSTS_PAGE)
      return context.render(postsPage(channel, person, shown))
    },
    async action(context) {
      let person = personFromSession(context.session)
      let channel = getChannel(context.params.channelId)
      let refuse = async (response: Response) => {
        await context.request.body?.cancel().catch(() => {})
        return response
      }
      if (!channel || !canSeePosts(channel, person?.id)) return refuse(context.render(notFound(person), { status: 404 }))
      if (!person) return refuse(new Response('Unauthorized', { status: 401 }))
      if (!canWritePost(channel, person.id)) return refuse(new Response('Forbidden', { status: 403 }))

      let formData: FormData
      try {
        formData = await parseFormData(
          context.request,
          { maxFiles: postLimits.pictures, maxFileSize: postLimits.pictureBytes, maxTotalSize: postLimits.formBytes },
          (file) => (file.fieldName === 'pictures' && file.size > 0 ? file : null),
        )
      } catch (error) {
        let tooMany = error instanceof MaxFilesExceededError
        if (!tooMany && !(error instanceof MaxFileSizeExceededError) && !(error instanceof MaxTotalSizeExceededError)) throw error
        return context.render(
          postsPage(channel, person, POSTS_PAGE, {
            error: tooMany ? `Pick up to ${postLimits.pictures} pictures.` : 'One of those pictures is over 10 MB. Pick a smaller one.',
            errorField: 'pictures',
          }),
          { status: 400 },
        )
      }

      let body = formData.get('body')
      let values: ComposerValues = { body: typeof body === 'string' ? body : '' }
      let pictures = formData.getAll('pictures').filter((value): value is File => typeof value !== 'string')
      let created = await createPost(channel, person.id, { body: values.body, pictures })
      if ('error' in created) {
        return context.render(postsPage(channel, person, POSTS_PAGE, { values, error: created.error, errorField: created.field }), {
          status: 400,
        })
      }
      return redirect(`${routes.channelPosts.index.href({ channelId: channel.id })}#post-${created.post.id}`, 303)
    },
  },
})
