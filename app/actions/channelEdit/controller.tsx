import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPeople, personFromSession, type Person } from '../../data/household.ts'
import { canDeleteCustomChannel, canPost, getChannel, updateChannel, type Channel } from '../../data/library.ts'
import { deleteCustomChannel } from '../../data/uploads.ts'
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
    return { status: 401, title: `Sign in to edit ${channel.name}`, detail: `Only ${owner?.name ?? 'its owner'} and Managers can change this channel.`, person }
  }
  if (!canPost(channel, person.id)) {
    return {
      status: 403,
      title: `You can’t edit ${channel.name}`,
      detail: `Ask ${owner?.name ?? 'its owner'} to name you a Manager, or to change the channel.`,
      person,
    }
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
      let canNameManagers = channel.ownerId === person.id
      return context.render(
        <ChannelFormPage
          person={person}
          people={listPeople()}
          channel={channel}
          canNameManagers={canNameManagers}
          canDelete={canDeleteCustomChannel(channel, person.id)}
          values={{ name: channel.name, description: channel.description ?? '', managerIds: channel.managerIds ?? [] }}
        />,
      )
    },
    async action(context) {
      let result = access(context.params.channelId, personFromSession(context.session))
      if ('status' in result) {
        return context.render(<NotBuiltPage current="channels" title={result.title} detail={result.detail} person={result.person} />, { status: result.status })
      }
      let { channel, person } = result
      let canNameManagers = channel.ownerId === person.id
      let canDelete = canDeleteCustomChannel(channel, person.id)
      if (context.formData.get('intent') === 'delete') {
        if (!canDelete) return new Response('Forbidden', { status: 403 })
        if (context.formData.get('confirm') !== '1') {
          return context.render(
            <ChannelFormPage
              person={person}
              people={listPeople()}
              channel={channel}
              canNameManagers={canNameManagers}
              canDelete
              values={{ name: channel.name, description: channel.description ?? '', managerIds: channel.managerIds ?? [] }}
              error="Tick the box to confirm, then delete."
              errorField="delete"
            />,
            { status: 400 },
          )
        }
        await deleteCustomChannel(channel)
        return redirect(routes.channels.href(), 303)
      }
      let values = readChannelForm(context.formData)
      let fail = (error: string, errorField: 'name' | 'description' | 'photo') =>
        context.render(
          <ChannelFormPage
            person={person}
            people={listPeople()}
            channel={channel}
            canNameManagers={canNameManagers}
            canDelete={canDelete}
            values={values}
            error={error}
            errorField={errorField}
          />,
          { status: 400 },
        )

      let photo = await readPhoto(context.formData)
      if (photo && typeof photo === 'object') return fail(photo.error, 'photo')

      let updated = await updateChannel(channel, {
        ...values,
        photo,
        managerIds: canNameManagers ? values.managerIds : (channel.managerIds ?? []),
      })
      if ('error' in updated) return fail(updated.error, updated.field)
      return redirect(routes.channel.href({ channelId: channel.id }), 303)
    },
  },
})
