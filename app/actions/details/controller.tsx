import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { changeOwnPassword, personFromSession, updatePersonDetails, type Person } from '../../data/household.ts'
import { getChannels } from '../../data/library.ts'
import { readPhoto } from '../../data/photo.ts'
import { routes } from '../../routes.ts'
import { DetailsPage, type DetailsField } from './page.tsx'

function readText(formData: FormData, name: string) {
  return typeof formData.get(name) === 'string' ? (formData.get(name) as string) : ''
}

function page(person: Person, values: { name: string }, error?: string, errorField?: DetailsField) {
  return <DetailsPage person={person} values={values} error={error} errorField={errorField} />
}

export default createController(routes.details, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      return context.render(page(person, { name: person.name }))
    },
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)

      let intent = readText(context.formData, 'intent')
      let fail = (error: string, errorField: DetailsField, name = person.name) =>
        context.render(page(person, { name }, error, errorField), { status: 400 })

      if (intent === 'password') {
        let current = readText(context.formData, 'current')
        let password = readText(context.formData, 'password')
        let confirm = readText(context.formData, 'confirm')
        if (!current) return fail('Enter your current password.', 'current')
        if (password !== confirm) return fail('Those passwords don’t match. Try them again.', 'password')
        if (!password) return fail('Choose a new password.', 'password')
        let changed = await changeOwnPassword(person.id, current, password)
        if (changed !== true) return fail(changed.error, changed.field)
        context.session.regenerateId()
        context.session.set('personId', person.id)
        return redirect(routes.details.index.href(), 303)
      }

      if (intent !== 'details') return fail('Choose what to change.', 'name')

      let name = readText(context.formData, 'name')
      let channelNamed = getChannels().find(
        (channel) => channel.kind !== 'person' && channel.name.localeCompare(name.trim(), undefined, { sensitivity: 'accent' }) === 0,
      )
      if (channelNamed) {
        return fail(`There’s already a channel called ${channelNamed.name}. Pick another name.`, 'name', name)
      }

      let photo = await readPhoto(context.formData)
      if (photo && typeof photo === 'object') return fail(photo.error, 'photo', name)

      let updated = await updatePersonDetails(person.id, {
        name,
        photo,
        removePhoto: readText(context.formData, 'removePhoto') === '1',
      })
      if ('error' in updated) return fail(updated.error, updated.field, name)
      return redirect(routes.details.index.href(), 303)
    },
  },
})
