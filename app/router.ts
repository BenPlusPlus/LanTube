import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import channelEditController from './actions/channelEdit/controller.tsx'
import channelNewController from './actions/channelNew/controller.tsx'
import channelPostsController from './actions/channelPosts/controller.tsx'
import channelSettingsController from './actions/channelSettings/controller.tsx'
import controlsController from './actions/controls/controller.tsx'
import detailsController from './actions/details/controller.tsx'
import houseController from './actions/house/controller.tsx'
import playlistEditController from './actions/playlistEdit/controller.tsx'
import playlistNewController from './actions/playlistNew/controller.tsx'
import signinController from './actions/signin/controller.tsx'
import uploadController from './actions/upload/controller.tsx'
import watchAssignController from './actions/watchAssign/controller.tsx'
import { assets } from './assets.ts'
import { routes } from './routes.ts'
import { sessionMiddleware } from './session.ts'

const parseForms = formData({
  maxFiles: 1,
  maxFileSize: 1024 * 1024,
  maxTotalSize: 1.5 * 1024 * 1024,
})

/**
 * Publishing an upload can carry a whole video without JavaScript, and a Post can carry four pictures,
 * so each parses its own form with its own limits.
 */
const ownForms = [/^\/upload$/, /^\/channel\/[^/]+\/posts$/]

const forms: typeof parseForms = (context, next) => {
  if (context.method === 'POST' && ownForms.some((pattern) => pattern.test(new URL(context.request.url).pathname))) return next()
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
router.map(routes.house, houseController)
router.map(routes.controls, controlsController)
router.map(routes.channelNew, channelNewController)
router.map(routes.channelEdit, channelEditController)
router.map(routes.channelPosts, channelPostsController)
router.map(routes.channelSettings, channelSettingsController)
router.map(routes.playlistNew, playlistNewController)
router.map(routes.playlistEdit, playlistEditController)
router.map(routes.upload, uploadController)
router.map(routes.watchAssign, watchAssignController)
