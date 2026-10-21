import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export interface VideoFeedMoreProps {
  nextHref: string
  moreHref: string
  label: string
  asListItem?: boolean
}

export const VideoFeedMore = clientEntry(import.meta.url, function VideoFeedMore(handle: Handle<VideoFeedMoreProps>) {
  let link: HTMLAnchorElement | undefined
  let observer: IntersectionObserver | undefined
  let status: 'idle' | 'loading' | 'error' = 'idle'
  let nextHref = handle.props.nextHref
  let moreHref = handle.props.moreHref
  let done = false
  let loading = false

  function watch() {
    observer?.disconnect()
    if (!link || done || typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore(handle.signal)
      },
      { rootMargin: '960px 0px' },
    )
    observer.observe(link)
  }

  async function loadMore(signal?: AbortSignal) {
    if (loading || done || !nextHref) return
    loading = true
    status = 'loading'
    handle.update()
    try {
      let response = await fetch(nextHref, { headers: { Accept: 'text/html' }, signal })
      if (!response.ok) throw new Error(String(response.status))
      let html = await response.text()
      if (signal?.aborted) return
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let batch = doc.querySelector('.feed-batch')
      if (!batch) throw new Error('empty')
      let follow = batch.getAttribute('data-next') ?? ''
      let more = batch.getAttribute('data-more') ?? ''
      let anchor = handle.props.asListItem ? link?.parentElement : link
      if (anchor?.parentNode) {
        for (let node of [...batch.childNodes]) {
          if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue
          anchor.parentNode.insertBefore(document.importNode(node, true), anchor)
        }
      }
      if (follow) {
        nextHref = follow
        moreHref = more || moreHref
        status = 'idle'
      } else {
        done = true
        observer?.disconnect()
      }
    } catch {
      if (signal?.aborted) return
      status = 'error'
    }
    loading = false
    handle.update()
  }

  handle.queueTask(() => {
    watch()
    handle.signal.addEventListener('abort', () => observer?.disconnect())
  })

  return () => {
    if (done) return null
    let label =
      status === 'loading'
        ? 'Loading more videos…'
        : status === 'error'
          ? 'Couldn’t load more videos. Try again.'
          : handle.props.label
    let control = (
      <a
        class="btn btn-secondary feed-more"
        href={moreHref}
        aria-busy={status === 'loading' ? 'true' : undefined}
        mix={[
          ref((node) => {
            link = node as HTMLAnchorElement
            watch()
          }),
          on('click', (event, signal) => {
            event.preventDefault()
            void loadMore(signal)
          }),
        ]}
      >
        {label}
      </a>
    )
    return handle.props.asListItem ? <li class="feed-more-item">{control}</li> : control
  }
})
