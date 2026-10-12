import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPeople, personFromSession, type Person } from '../../data/household.ts'
import { getChannel, updateChannel, type Channel } from '../../data/library.ts'
import { readPhoto } from '../../data/photo.ts'
import { routes } from '../../routes.ts'
import { readChannelForm } from '../channel-form.ts'
import { ChannelFormPage } from '../channel-form-page.tsx'
import { NotBuiltPage } from '../not-built-page.tsx'

type Access = { channel: Channel; person: Person } | { status: number; title: string; detail: string; person: Person | null }

function access(channelId: string, person: Person | null): Access {
  let channel = getChannel(channelId)
  if (!channel || channel.kind !== 'custom') {
    return { status: 404, title: 'Channel not found', detail: 'Only channels people start can be edited here.', person }
  }
  let owner = channel.ownerId ? getChannel(channel.ownerId) : undefined
  if (!person) {
    return { status: 401, title: `Sign in to edit ${channel.name}`, detail: `Only ${owner?.name ?? 'its owner'} can change this channel.`, person }
  }
  if (channel.ownerId !== person.id) {
    return { status: 403, title: `Only ${owner?.name ?? 'its owner'} can edit ${channel.name}`, detail: 'Ask them to change the name, picture, or who can post.', person }
  }
  return { channel, person }
}

export default createController(routes.channelEdit, {
  actions: {
    index(context) {
      let result = access(context.params.channelId, personFromSession(context.session))
      if ('status' in result) {
        return context.render(<NotBuiltPage current="channels" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { channel, person } = result
      return context.render(
        <ChannelFormPage
          person={person}
          people={listPeople()}
          channel={channel}
          values={{ name: channel.name, description: channel.description ?? '', posterIds: channel.posterIds ?? [] }}
        />,
      )
    },
    async action(context) {
      let result = access(context.params.channelId, personFromSession(context.session))
      if ('status' in result) {
        return context.render(<NotBuiltPage current="channels" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { channel, person } = result
      let values = readChannelForm(context.formData)
      let fail = (error: string, errorField: 'name' | 'description' | 'photo') =>
        context.render(
          <ChannelFormPage person={person} people={listPeople()} channel={channel} values={values} error={error} errorField={errorField} />,
          { status: 400 },
        )

      let photo = await readPhoto(context.formData)
      if (photo && typeof photo === 'object') return fail(photo.error, 'photo')

      let updated = updateChannel(channel, { ...values, photo })
      if ('error' in updated) return fail(updated.error, updated.field)
      return redirect(routes.channel.href({ channelId: channel.id }), 303)
    },
  },
})
