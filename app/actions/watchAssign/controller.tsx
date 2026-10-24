import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assign, unassign } from '../../data/assignments.ts'
import { personFromSession } from '../../data/household.ts'
import { canWatch, getVideo } from '../../data/library.ts'
import { routes } from '../../routes.ts'
import { NotBuiltPage } from '../not-built-page.tsx'

function safeReturn(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined
}

export default createController(routes.watchAssign, {
  actions: {
    index(context) {
      return redirect(routes.watch.href({ videoId: context.params.videoId }), 303)
    },
    async action(context) {
      let quiet = context.formData.get('async') === '1'
      let person = personFromSession(context.session)
      if (!person) {
        if (quiet) return new Response('Unauthorized', { status: 401 })
        return redirect(routes.signin.index.href(), 303)
      }
      if (!person.isParent) return new Response('Forbidden', { status: 403 })
      let video = getVideo(context.params.videoId)
      if (!video || !canWatch(video, person.id)) {
        if (quiet) return new Response('Not Found', { status: 404 })
        return context.render(
          <NotBuiltPage current={null} title="Video not found" detail="It may have been removed or renamed on the host." person={person} />,
          { status: 404 },
        )
      }
      let form = context.formData
      let personId = form.get('personId')
      let intent = form.get('intent')
      if (typeof personId !== 'string' || (intent !== 'assign' && intent !== 'unassign')) {
        return new Response('Bad Request', { status: 400 })
      }
      let result = intent === 'assign' ? await assign(person.id, personId, video.id) : await unassign(person.id, personId, video.id)
      if (result !== true) return new Response(result.error, { status: 400 })
      if (quiet) return new Response(null, { status: 204 })
      let next = safeReturn(form.get('returnTo'))
      if (!next) {
        let referer = context.request.headers.get('Referer')
        if (referer) {
          try {
            let url = new URL(referer)
            let path = `${url.pathname}${url.search}`
            if (url.origin === new URL(context.request.url).origin) next = safeReturn(path)
          } catch {}
        }
      }
      return redirect(next ?? routes.home.href(), 303)
    },
  },
})
