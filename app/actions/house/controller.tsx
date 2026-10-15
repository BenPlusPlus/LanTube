import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { brandName, setBrandName } from '../../data/brand.ts'
import {
  listPeople,
  personFromSession,
  setPersonPassword,
  updatePersonRoles,
  type Person,
} from '../../data/household.ts'
import { routes } from '../../routes.ts'
import { HouseForbidden, HousePage } from './page.tsx'

function readText(formData: FormData, name: string) {
  return typeof formData.get(name) === 'string' ? (formData.get(name) as string) : ''
}

type HouseErrorField = 'roles' | 'password' | 'brand'

function page(
  person: Person,
  error?: string,
  errorPersonId?: string,
  errorField?: HouseErrorField,
  brand = brandName(),
) {
  return (
    <HousePage
      person={person}
      people={listPeople()}
      brand={brand}
      error={error}
      errorPersonId={errorPersonId}
      errorField={errorField}
    />
  )
}

export default createController(routes.house, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isAdmin) {
        return context.render(<HouseForbidden person={person} />, { status: 403 })
      }
      return context.render(page(person))
    },
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isAdmin) {
        return context.render(<HouseForbidden person={person} />, { status: 403 })
      }

      let personId = readText(context.formData, 'personId')
      let fail = (error: string, errorField: HouseErrorField, brand?: string) =>
        context.render(page(person, error, personId, errorField, brand), { status: 400 })

      if (readText(context.formData, 'intent') === 'brand') {
        let brand = readText(context.formData, 'brand')
        let saved = await setBrandName(brand)
        if (saved !== true) return fail(saved.error, 'brand', brand)
        return redirect(routes.house.index.href(), 303)
      }

      if (readText(context.formData, 'intent') === 'password') {
        let password = readText(context.formData, 'password')
        if (!password) return fail('Choose a new password.', 'password')
        let changed = await setPersonPassword(person.id, personId, password)
        if (changed !== true) return fail(changed.error, 'password')
        return redirect(routes.house.index.href(), 303)
      }

      let updated = await updatePersonRoles(person.id, personId, {
        isAdmin: readText(context.formData, 'admin') === 'on',
        isParent: readText(context.formData, 'parent') === 'on',
      })
      if ('error' in updated) return fail(updated.error, 'roles')
      return redirect(routes.house.index.href(), 303)
    },
  },
})
