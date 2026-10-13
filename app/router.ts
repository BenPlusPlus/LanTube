import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import channelEditController from './actions/channelEdit/controller.tsx'
import channelNewController from './actions/channelNew/controller.tsx'
import detailsController from './actions/details/controller.tsx'
import playlistEditController from './actions/playlistEdit/controller.tsx'
import playlistNewController from './actions/playlistNew/controller.tsx'
import signinController from './actions/signin/controller.tsx'
import uploadController from './actions/upload/controller.tsx'
import { assets } from './assets.ts'
import { routes } from './routes.ts'
import { sessionMiddleware } from './session.ts'

const parseForms = formData({
  maxFiles: 1,
  maxFileSize: 1024 * 1024,
  maxTotalSize: 1.5 * 1024 * 1024,
})

/** Publishing an upload can carry a whole video without JavaScript, so it parses its own form with its own limits. */
const forms: typeof parseForms = (context, next) => {
  if (context.method === 'POST' && new URL(context.request.url).pathname === routes.upload.action.href()) return next()
  return parseForms(context, next)
}

export const router = createRouter({
  middleware: [
    staticFiles('./public', { index: false }),
    sessionMiddleware,
    forms,
    render({ assets }),
  ],
})

type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
router.map(routes.signin, signinController)
router.map(routes.details, detailsController)
router.map(routes.channelNew, channelNewController)
router.map(routes.channelEdit, channelEditController)
router.map(routes.playlistNew, playlistNewController)
router.map(routes.playlistEdit, playlistEditController)
router.map(routes.upload, uploadController)
