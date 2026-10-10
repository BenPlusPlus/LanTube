import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import signinController from './actions/signin/controller.tsx'
import { assets } from './assets.ts'
import { routes } from './routes.ts'
import { sessionMiddleware } from './session.ts'

export const router = createRouter({
  middleware: [
    staticFiles('./public', { index: false }),
    sessionMiddleware,
    formData({
      maxFiles: 1,
      maxFileSize: 1024 * 1024,
      maxTotalSize: 1.5 * 1024 * 1024,
    }),
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
