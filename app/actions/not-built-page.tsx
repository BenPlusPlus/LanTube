import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import { AppShell, type Section } from '../ui/shell.tsx'
import { Icon } from '../ui/icons.tsx'

export interface NotBuiltPageProps {
  current: Section
  title: string
  detail: string
}

/** Shell-framed stand-in for routes whose pages haven't been designed yet. */
export function NotBuiltPage(handle: Handle<NotBuiltPageProps>) {
  return () => {
    let { current, title, detail } = handle.props
    return (
      <AppShell current={current} title={title}>
        <section class="empty" aria-labelledby="page-title">
          <Icon name="home" size={40} />
          <h1 id="page-title">{title}</h1>
          <p>{detail}</p>
          <a class="btn btn-secondary" href={routes.home.href()}>
            Back to home
          </a>
        </section>
      </AppShell>
    )
  }
}
