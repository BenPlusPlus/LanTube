import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { personFromSession, type Person } from '../../data/household.ts'
import { getChannel, type Channel } from '../../data/library.ts'
import { canSetPostVisibility, savePostSettings } from '../../data/posts.ts'
import { routes } from '../../routes.ts'
import { ChannelSettingsPage } from '../channel-settings-page.tsx'
import { currentPostVisibility, postSettingsHref, readPostVisibility } from '../channel-posts.tsx'
import { NotBuiltPage } from '../not-built-page.tsx'

type Access = { channel: Channel; person: Person } | { response: 'redirect'; href: string } | { status: number; title: string; detail: string; person: Person | null }

/** Only a Home channel's own person. A Custom channel keeps this in its edit form. */
function access(channelId: string, person: Person | null): Access {
  let channel = getChannel(channelId)
  if (channel?.kind === 'custom') return { response: 'redirect', href: postSettingsHref(channel) }
  if (!channel || !person || !canSetPostVisibility(channel, person.id)) {
    return { status: 404, title: 'Nothing to change here', detail: 'Only the person whose channel this is can change its settings.', person }
  }
  return { channel, person }
}

export default createController(routes.channelSettings, {
  actions: {
    index(context) {
      let result = access(context.params.channelId, personFromSession(context.session))
      if ('response' in result) return redirect(result.href, 303)
      if ('status' in result) {
        return context.render(<NotBuiltPage current="channels" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      return context.render(<ChannelSettingsPage person={result.person} channel={result.channel} values={currentPostVisibility(result.channel)} />)
    },
    async action(context) {
      let result = access(context.params.channelId, personFromSession(context.session))
      if ('response' in result) return new Response('Not Found', { status: 404 })
      if ('status' in result) {
        return context.render(<NotBuiltPage current="channels" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let values = readPostVisibility(context.formData)
      await savePostSettings(result.channel, { private: values.postsPrivate, audienceIds: values.postsAudience })
      return redirect(routes.channelPosts.index.href({ channelId: result.channel.id }), 303)
    },
  },
})
