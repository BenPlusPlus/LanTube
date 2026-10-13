import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPeople, personFromSession } from '../../data/household.ts'
import { createChannel } from '../../data/library.ts'
import { readPhoto } from '../../data/photo.ts'
import { routes } from '../../routes.ts'
import { readChannelForm } from '../channel-form.ts'
import { ChannelFormPage, SignInToCreate } from '../channel-form-page.tsx'

export default createController(routes.channelNew, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToCreate />)
      return context.render(
        <ChannelFormPage person={person} people={listPeople()} values={{ name: '', description: '', managerIds: [] }} />,
      )
    },
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToCreate />, { status: 401 })

      let values = readChannelForm(context.formData)
      let fail = (error: string, errorField: 'name' | 'description' | 'photo') =>
        context.render(
          <ChannelFormPage person={person} people={listPeople()} values={values} error={error} errorField={errorField} />,
          { status: 400 },
        )

      let photo = await readPhoto(context.formData)
      if (photo && typeof photo === 'object') return fail(photo.error, 'photo')

      let created = await createChannel(person.id, { ...values, photo })
      if ('error' in created) return fail(created.error, created.field)
      return redirect(routes.channel.href({ channelId: created.id }), 303)
    },
  },
})
