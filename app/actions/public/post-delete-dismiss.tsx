import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

/**
 * Gives the posts' delete confirms the house popover manners: Esc or a press outside closes
 * an open one and hands focus back to its trash button. Without JavaScript they stay plain details.
 */
export const PostDeleteDismiss = clientEntry(import.meta.url, function PostDeleteDismiss(handle: Handle<{}>) {
  function close(details: HTMLDetailsElement, refocus: boolean) {
    details.open = false
    if (refocus) details.querySelector('summary')?.focus()
  }

  handle.queueTask(() => {
    let options = { signal: handle.signal }
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return
        let open = document.querySelector<HTMLDetailsElement>('details.post-delete[open]')
        if (!open) return
        event.preventDefault()
        close(open, true)
      },
      options,
    )
    document.addEventListener(
      'pointerdown',
      (event) => {
        let target = event.target instanceof Node ? event.target : null
        for (let open of document.querySelectorAll<HTMLDetailsElement>('details.post-delete[open]')) {
          if (!target || !open.contains(target)) close(open, false)
        }
      },
      options,
    )
  })

  return () => <span hidden />
})
