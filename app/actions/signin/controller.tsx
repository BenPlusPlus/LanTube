import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { createPerson, listPeople, personFromSession, verifyPassword } from '../../data/household.ts'
import { routes } from '../../routes.ts'
import { SignInPage } from './page.tsx'

function readText(formData: FormData, name: string) {
  let value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

async function readPhoto(formData: FormData): Promise<string | undefined | { error: string }> {
  let file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return undefined
  if (file.size > 1024 * 1024) return { error: 'Keep the photo under 1 MB.' }
  if (!file.type.startsWith('image/')) return { error: 'Choose a photo file (JPEG, PNG, or WebP).' }
  let bytes = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${bytes.toString('base64')}`
}

export default createController(routes.signin, {
  actions: {
    index(context) {
      if (personFromSession(context.session)) {
        return redirect(routes.home.href(), 303)
      }

      let params = new URL(context.request.url).searchParams
      let joining = params.get('join') === '1'
      let selectedId = joining ? undefined : (params.get('person') ?? undefined)
      if (selectedId && !listPeople().some((person) => person.id === selectedId)) {
        selectedId = undefined
      }

      return context.render(<SignInPage people={listPeople()} selectedId={selectedId} joining={joining} />)
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
        let created = createPerson(name, password, photo)
        if ('error' in created) {
          return context.render(<SignInPage people={listPeople()} joining error={created.error} joinName={name} />, { status: 400 })
        }
        context.session.regenerateId()
        context.session.set('personId', created.id)
        return redirect(routes.home.href(), 303)
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
