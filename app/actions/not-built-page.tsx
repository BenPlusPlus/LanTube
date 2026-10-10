import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { routes } from '../routes.ts'
import { AppShell, type Section } from '../ui/shell.tsx'
import { Icon } from '../ui/icons.tsx'

export interface NotBuiltPageProps {
  current: Section
  title: string
  detail: string
  person?: Person | null
}

/** Shell-framed stand-in for routes whose pages haven't been designed yet. */
export function NotBuiltPage(handle: Handle<NotBuiltPageProps>) {
  return () => {
    let { current, title, detail, person = null } = handle.props
    return (
      <AppShell current={current} title={title} person={person}>
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
