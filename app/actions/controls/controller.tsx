import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPeople, personFromSession, type Person } from '../../data/household.ts'
import {
  clearExtraToday,
  EXTEND_STEPS,
  extendToday,
  extraToday,
  isLimitable,
  limitFor,
  LIMIT_PRESETS,
  setDailyLimit,
  usedTodaySec,
} from '../../data/watch-limits.ts'
import { routes } from '../../routes.ts'
import { ControlsForbidden, ControlsPage } from './page.tsx'

function readText(formData: FormData, name: string) {
  let value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function page(person: Person, extras: { error?: string; errorPersonId?: string } = {}) {
  let people = listPeople()
  let now = Date.now()
  return (
    <ControlsPage
      person={person}
      rows={people.filter(isLimitable).map((member) => ({
        person: member,
        limitMin: limitFor(member.id),
        extraMin: extraToday(member.id, now),
        usedSec: Math.round(usedTodaySec(member.id, now)),
      }))}
      unlimited={people.filter((member) => !isLimitable(member))}
      presets={[...LIMIT_PRESETS]}
      steps={[...EXTEND_STEPS]}
      error={extras.error}
      errorPersonId={extras.errorPersonId}
    />
  )
}

export default createController(routes.controls, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isParent) return context.render(<ControlsForbidden person={person} />, { status: 403 })
      return context.render(page(person))
    },
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return redirect(routes.signin.index.href(), 303)
      if (!person.isParent) return context.render(<ControlsForbidden person={person} />, { status: 403 })

      let form = context.formData
      let personId = readText(form, 'personId')
      let intent = readText(form, 'intent')
      let minutes = readText(form, 'minutes')

      let result =
        intent === 'limit'
          ? await setDailyLimit(person.id, personId, minutes === 'none' ? null : Number(minutes))
          : intent === 'extend'
            ? await extendToday(person.id, personId, Number(minutes))
            : intent === 'clear'
              ? await clearExtraToday(person.id, personId)
              : { error: 'That change isn’t one this page makes.' }

      if (result !== true) {
        return context.render(page(person, { error: result.error, errorPersonId: personId }), { status: 400 })
      }
      return redirect(`${routes.controls.index.href()}#controls-${personId}`, 303)
    },
  },
})
