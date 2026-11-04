import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'

interface Picture {
  src: string
  alt: string
  width?: number
  height?: number
}

const id = 'post-lightbox'

function dimension(value: string | null) {
  let number = value ? Number(value) : NaN
  return Number.isFinite(number) && number > 0 ? number : undefined
}

/**
 * Opens a post's pictures in a viewer over the page: arrows (and arrow keys, and a swipe) step through
 * that post's pictures, wrapping at the ends; Esc, the close button, or a press beside the picture closes it.
 * Without JavaScript, or with a modifier-click, each picture stays a plain link to its full-size file.
 */
export const PostLightbox = clientEntry(import.meta.url, function PostLightbox(handle: Handle<{}>) {
  let pictures: Picture[] = []
  let index = 0
  let opener: HTMLElement | null = null
  /** Opened with a pointer: the close button's focus ring waits for the first Tab. */
  let pointer = false
  let swipeFrom: { x: number; y: number } | null = null

  function dialog() {
    let element = document.getElementById(id)
    return element instanceof HTMLDialogElement ? element : null
  }

  function step(by: number) {
    if (pictures.length < 2) return
    index = (index + by + pictures.length) % pictures.length
    void handle.update()
  }

  /** The neighbours load while this one is on screen, so stepping doesn't wait on the network. */
  function warm() {
    if (pictures.length < 2) return
    for (let by of [1, -1]) new Image().src = pictures[(index + by + pictures.length) % pictures.length].src
  }

  function closed() {
    pictures = []
    index = 0
    pointer = false
    void handle.update()
    if (opener?.isConnected) opener.focus({ preventScroll: true })
    opener = null
  }

  handle.queueTask(() => {
    // `close` doesn't bubble, so it's heard on the dialog itself.
    dialog()?.addEventListener('close', closed, { signal: handle.signal })
    document.addEventListener(
      'click',
      async (event) => {
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        let link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a.post-pic') : null
        let mosaic = link?.closest('.post-pics')
        if (!link || !mosaic) return
        event.preventDefault()
        let links = [...mosaic.querySelectorAll<HTMLAnchorElement>('a.post-pic')]
        pictures = links.map((each) => {
          let image = each.querySelector('img')
          return {
            src: each.href,
            alt: image?.alt ?? '',
            width: dimension(image?.getAttribute('width') ?? null),
            height: dimension(image?.getAttribute('height') ?? null),
          }
        })
        index = Math.max(0, links.indexOf(link))
        opener = link
        pointer = event.detail > 0
        await handle.update()
        let element = dialog()
        if (!element || element.open) return
        element.showModal()
      },
      { signal: handle.signal },
    )
  })

  return () => {
    let picture = pictures[index]
    let many = pictures.length > 1
    if (picture) handle.queueTask(warm)
    return (
      <dialog
        class={`lightbox${many ? '' : ' is-single'}${pointer ? ' is-pointer' : ''}`}
        id={id}
        aria-label={picture ? (many ? 'Pictures from this post' : 'Picture from this post') : 'Picture viewer'}
        mix={[
          on('keydown', (event) => {
            if (event.key === 'Tab' && pointer) {
              pointer = false
              void handle.update()
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              step(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              step(-1)
            }
          }),
          on('click', (event) => {
            // A press on the dark around the picture closes, like the house's other overlays.
            let target = event.target as Element
            if (target === event.currentTarget || target.classList.contains('lightbox-stage')) {
              ;(event.currentTarget as HTMLDialogElement).close()
            }
          }),
          on('pointerdown', (event) => {
            swipeFrom = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
          }),
          on('pointerup', (event) => {
            if (!swipeFrom) return
            let dx = event.clientX - swipeFrom.x
            let dy = event.clientY - swipeFrom.y
            swipeFrom = null
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
          }),
        ]}
      >
        <p class="lightbox-count" aria-live="polite">
          {many ? `${index + 1} of ${pictures.length}` : ''}
        </p>
        <button
          class="lightbox-btn lightbox-close"
          type="button"
          aria-label="Close"
          mix={[on('click', () => dialog()?.close())]}
        >
          <Icon name="close" size={24} />
        </button>
        <div class="lightbox-stage">
          {picture ? (
            <img
              class="lightbox-img"
              src={picture.src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              decoding="async"
            />
          ) : null}
        </div>
        <button
          class="lightbox-btn lightbox-nav lightbox-prev"
          type="button"
          aria-label="Previous picture"
          hidden={!many}
          mix={[on('click', () => step(-1))]}
        >
          <Icon name="chevron-left" size={28} />
        </button>
        <button
          class="lightbox-btn lightbox-nav lightbox-next"
          type="button"
          aria-label="Next picture"
          hidden={!many}
          mix={[on('click', () => step(1))]}
        >
          <Icon name="chevron-right" size={28} />
        </button>
      </dialog>
    )
  }
})
