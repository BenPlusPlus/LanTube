import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { brandName, setBrandName } from '../../data/brand.ts'
import { attachFolder, detachFolder, scanFolder } from '../../data/folders.ts'
import {
  listPeople,
  personFromSession,
  setPersonPassword,
  updatePersonRoles,
  type Person,
} from '../../data/household.ts'
import { getChannel } from '../../data/library.ts'
import { routes } from '../../routes.ts'
import { HouseForbidden, HousePage, type HouseErrorField } from './page.tsx'

function readText(formData: FormData, name: string) {
  return typeof formData.get(name) === 'string' ? (formData.get(name) as string) : ''
}

function page(
  person: Person,
  extras: {
    error?: string
    errorPersonId?: string
    errorFolderId?: string
    errorField?: HouseErrorField
    brand?: string
    folderPath?: string
    folderName?: string
  } = {},
) {
  return (
    <HousePage
      person={person}
      people={listPeople()}
      brand={extras.brand ?? brandName()}
      error={extras.error}
      errorPersonId={extras.errorPersonId}
      errorFolderId={extras.errorFolderId}
      errorField={extras.errorField}
      folderPath={extras.folderPath}
      folderName={extras.folderName}
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
      let fail = (error: string, errorField: HouseErrorField, extras: Parameters<typeof page>[1] = {}) =>
        context.render(page(person, { ...extras, error, errorField, errorPersonId: extras.errorPersonId ?? personId }), {
          status: 400,
        })

      if (readText(context.formData, 'intent') === 'brand') {
        let brand = readText(context.formData, 'brand')
        let saved = await setBrandName(brand)
        if (saved !== true) return fail(saved.error, 'brand', { brand })
        return redirect(routes.house.index.href(), 303)
      }

      if (readText(context.formData, 'intent') === 'password') {
        let password = readText(context.formData, 'password')
        if (!password) return fail('Choose a new password.', 'password')
        let changed = await setPersonPassword(person.id, personId, password)
        if (changed !== true) return fail(changed.error, 'password')
        return redirect(routes.house.index.href(), 303)
      }

      if (readText(context.formData, 'intent') === 'attach') {
        let folderPath = readText(context.formData, 'path')
        let folderName = readText(context.formData, 'name')
        let attached = await attachFolder({ path: folderPath, name: folderName })
        if ('error' in attached) return fail(attached.error, attached.field, { folderPath, folderName })
        return redirect(routes.house.index.href(), 303)
      }

      if (readText(context.formData, 'intent') === 'scan') {
        let folderId = readText(context.formData, 'folderId')
        let folder = getChannel(folderId)
        if (!folder || folder.kind !== 'folder') return fail('That folder isn’t attached.', 'scan')
        await scanFolder(folder)
        return redirect(routes.house.index.href(), 303)
      }

      if (readText(context.formData, 'intent') === 'detach') {
        let folderId = readText(context.formData, 'folderId')
        if (readText(context.formData, 'confirm') !== '1') {
          return fail('Tick the box to confirm, then detach.', 'detach', { errorFolderId: folderId })
        }
        let detached = await detachFolder(folderId)
        if (!detached) return fail('That folder isn’t attached.', 'detach')
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
