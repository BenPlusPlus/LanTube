import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { createPerson, listPeople, personFromSession, verifyPassword } from '../../data/household.ts'
import { getChannel, getChannels } from '../../data/library.ts'
import { readPhoto } from '../../data/photo.ts'
import { routes } from '../../routes.ts'
import { SignInPage } from './page.tsx'

function readText(formData: FormData, name: string) {
  let value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export default createController(routes.signin, {
  actions: {
    index(context) {
      if (personFromSession(context.session)) {
        return redirect(routes.home.href(), 303)
      }

      let people = listPeople()
      let params = new URL(context.request.url).searchParams
      let firstRun = people.length === 0
      let joining = firstRun || params.get('join') === '1'
      let selectedId = joining ? undefined : (params.get('person') ?? undefined)
      if (selectedId && !people.some((person) => person.id === selectedId)) {
        selectedId = undefined
      }

      return context.render(<SignInPage people={people} selectedId={selectedId} joining={joining} />)
    },
    async action(context) {
      if (personFromSession(context.session)) {
        return redirect(routes.home.href(), 303)
      }

      let intent = readText(context.formData, 'intent')

      if (intent === 'join') {
        let name = readText(context.formData, 'name')
        let password = readText(context.formData, 'password')
        let confirm = readText(context.formData, 'confirm')
        if (password !== confirm) {
          return context.render(
            <SignInPage people={listPeople()} joining error="Those passwords don’t match. Try them again." joinName={name} />,
            { status: 400 },
          )
        }
        let photo = await readPhoto(context.formData)
        if (photo && typeof photo === 'object') {
          return context.render(<SignInPage people={listPeople()} joining error={photo.error} joinName={name} />, { status: 400 })
        }
        let channelNamed = getChannels().find(
          (channel) => channel.kind !== 'person' && channel.name.localeCompare(name.trim(), undefined, { sensitivity: 'accent' }) === 0,
        )
        if (channelNamed) {
          return context.render(
            <SignInPage people={listPeople()} joining error={`There’s already a channel called ${channelNamed.name}. Pick another name.`} joinName={name} />,
            { status: 400 },
          )
        }
        let created = await createPerson(
          name,
          password,
          photo,
          (id) => getChannel(id) !== undefined,
          readText(context.formData, 'parent') === 'on',
        )
        if ('error' in created) {
          return context.render(<SignInPage people={listPeople()} joining error={created.error} joinName={name} />, { status: 400 })
        }
        context.session.regenerateId()
        context.session.set('personId', created.id)
        return redirect(created.isAdmin ? routes.house.index.href() : routes.home.href(), 303)
      }

      let personId = readText(context.formData, 'personId')
      let password = readText(context.formData, 'password')
      if (!personId || !listPeople().some((person) => person.id === personId)) {
        return context.render(
          <SignInPage people={listPeople()} error="Pick someone in the house, then enter their password." />,
          { status: 400 },
        )
      }
      if (!verifyPassword(personId, password)) {
        return context.render(
          <SignInPage
            people={listPeople()}
            selectedId={personId}
            error="That password doesn’t match this person. Try again."
          />,
          { status: 400 },
        )
      }

      context.session.regenerateId()
      context.session.set('personId', personId)
      return redirect(routes.home.href(), 303)
    },
  },
})
