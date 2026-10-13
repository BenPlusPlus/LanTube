import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../ui/public/icons.tsx'
import { initialOf } from '../../ui/public/identity.ts'

export interface ShelfVideo {
  title: string
  thumb: string | null
  durationSec: number
  /** "3 plays · 5 hours ago" */
  meta: string
  /** Custom channels name who posted it. */
  byline?: string
}

export interface UploadDestination {
  id: string
  name: string
  kind: 'person' | 'custom' | 'folder'
  hue: number
  photo?: string
  /** "Your channel", "You run it", "Leo’s" */
  role: string
  home: boolean
  /** The channel's newest videos, as the uploader sees them. */
  recent: ShelfVideo[]
}

export type UploadVisibility = 'house' | 'private'

export interface UploadFormValues {
  channelId: string
  title: string
  tags: string[]
  tagDraft?: string
  playlistId: string
  visibility: UploadVisibility
  audienceIds: string[]
  uploadId: string
  durationSec: number
}

export type UploadFormField = 'file' | 'channel' | 'title' | 'playlist' | 'poster' | 'tags'

export interface UploadPerson {
  id: string
  name: string
  hue: number
  photo?: string
}

export interface UploadFormProps {
  action: string
  /** Where the browser streams the file as soon as it's picked. */
  fileAction: string
  /** A sent file can be previewed again from here, followed by its id. */
  stagedBase: string
  cancelHref: string
  personName: string
  person: UploadPerson
  people: UploadPerson[]
  destinations: UploadDestination[]
  playlists: { id: string; name: string; private: boolean }[]
  values: UploadFormValues
  /** A file that already reached the host, when the form comes back with a problem. */
  staged?: { id: string; name: string; size: number }
  error?: string
  errorField?: UploadFormField
  titleMax: number
  accept: string
  /** Shown in the drop well: "MP4, MOV, WebM, MKV, AVI". */
  typesLabel: string
}

type Transfer =
  | { state: 'idle' }
  | { state: 'sending'; loaded: number; total: number; rate: number }
  | { state: 'sent' }
  | { state: 'failed'; message: string; retryable: boolean }

const FRAME_COUNT = 10
const DEFAULT_FRAME = 2

function clock(totalSec: number): string {
  let h = Math.floor(totalSec / 3600)
  let m = Math.floor((totalSec % 3600) / 60)
  let s = Math.floor(totalSec % 60)
  let ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function bytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`
  if (n >= 1024 ** 2) return `${Math.max(1, Math.round(n / 1024 ** 2))} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

/** "1.1 of 1.8 GB": both sides in the larger unit so the numbers compare. */
function bytesOf(loaded: number, total: number): string {
  let unit = total >= 1024 ** 3 ? 1024 ** 3 : total >= 1024 ** 2 ? 1024 ** 2 : 1024
  let label = unit === 1024 ** 3 ? 'GB' : unit === 1024 ** 2 ? 'MB' : 'KB'
  let digits = unit === 1024 ** 3 ? 1 : 0
  return `${(loaded / unit).toFixed(digits)} of ${(total / unit).toFixed(digits)} ${label}`
}

function timeLeft(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 5) return 'a few seconds left'
  if (seconds < 60) return `about ${Math.ceil(seconds / 5) * 5} s left`
  if (seconds < 3600) return `about ${Math.round(seconds / 60)} min left`
  let h = Math.floor(seconds / 3600)
  let m = Math.round((seconds % 3600) / 60)
  return `about ${h} hr${m ? ` ${m} min` : ''} left`
}

function suggestTitle(name: string, max: number): string {
  let words = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, max)
}

/** Draws the video into the box, cropped to fill it, like every thumbnail in the house. */
function drawCover(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  let scale = Math.max(width / video.videoWidth, height / video.videoHeight)
  let w = video.videoWidth * scale
  let h = video.videoHeight * scale
  context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h)
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let timer = window.setTimeout(done, 4000)
    function done() {
      window.clearTimeout(timer)
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = time
  })
}

function ShelfAvatar(handle: Handle<{ destination: UploadDestination; size: 'sm' | 'card' }>) {
  return () => {
    let { destination, size } = handle.props
    return (
      <span
        class={`avatar avatar-${size}${destination.kind === 'custom' ? ' avatar-channel' : ''}`}
        style={`--hue:${destination.hue}`}
        aria-hidden="true"
      >
        {destination.photo ? <img class="avatar-photo" src={destination.photo} alt="" /> : initialOf(destination.name) || '?'}
      </span>
    )
  }
}

function PersonAvatar(handle: Handle<{ person: UploadPerson }>) {
  return () => {
    let { person } = handle.props
    return (
      <span class="avatar avatar-md" style={`--hue:${person.hue}`} aria-hidden="true">
        {person.photo ? <img class="avatar-photo" src={person.photo} alt="" /> : initialOf(person.name) || '?'}
      </span>
    )
  }
}

/**
 * Upload is "post to" first: pick where it goes, and the file starts streaming to the
 * host while you name it. Beside the form, the channel's shelf shows the new card
 * landing first. Without JavaScript it is one plain multipart form.
 */
export const UploadForm = clientEntry(import.meta.url, function UploadForm(handle: Handle<UploadFormProps>) {
  let initial = handle.props.values
  let channelId = initial.channelId
  let title = initial.title
  /** Until they type a title, each new file suggests one from its name. */
  let titleTouched = initial.title.trim() !== ''
  let chosenTags = [...initial.tags]
  let tagDraft = initial.tagDraft ?? ''
  let enhanced = false
  let playlistId = initial.playlistId
  let visibility: UploadVisibility = initial.visibility
  let audienceIds = [...initial.audienceIds]
  let uploadId = initial.uploadId
  let duration = initial.durationSec

  let staged = handle.props.staged
  let file: { name: string; size: number } | null = staged ? { name: staged.name, size: staged.size } : null
  let source: File | null = null
  let previewSrc: string | null = staged ? handle.props.stagedBase + encodeURIComponent(staged.id) : null
  let objectUrl: string | null = null
  let transfer: Transfer = staged ? { state: 'sent' } : { state: 'idle' }
  let previewable = true
  let frames: { time: number; src: string | null }[] = []
  let frameJob = 0
  let posterTime: number | null = null
  let posterThumb: string | null = null
  let captureOnSeek = false
  let waiting = false
  let publishing = false
  let notice: string | null = null
  let dragging = false
  let xhr: XMLHttpRequest | null = null
  let lastPaint = 0

  let form: HTMLFormElement | undefined
  let fileInput: HTMLInputElement | undefined
  let posterInput: HTMLInputElement | undefined
  let tagsInput: HTMLInputElement | undefined
  let preview: HTMLVideoElement | undefined
  let sampler: HTMLVideoElement | undefined
  handle.queueTask(() => {
    enhanced = true
    handle.update()
    // The form came back from the host with a problem: take focus to it so it is heard.
    if (handle.props.error) {
      document.querySelector<HTMLElement>('.upload [aria-invalid="true"], .upload-side-error')?.focus()
    }
    window.addEventListener(
      'pageshow',
      (event) => {
        if (!event.persisted) return
        publishing = false
        if (fileInput) fileInput.disabled = false
        handle.update()
      },
      { signal: handle.signal },
    )
    handle.signal.addEventListener('abort', () => {
      xhr?.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
  })

  function destination() {
    let { destinations } = handle.props
    return destinations.find((entry) => entry.id === channelId) ?? destinations[0]
  }

  function clearPoster() {
    posterTime = null
    posterThumb = null
    if (posterInput) posterInput.value = ''
  }

  function choose(next: File) {
    xhr?.abort()
    xhr = null
    frameJob++
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    source = next
    file = { name: next.name, size: next.size }
    objectUrl = URL.createObjectURL(next)
    previewSrc = objectUrl
    previewable = true
    frames = []
    duration = 0
    uploadId = ''
    waiting = false
    clearPoster()
    if (!titleTouched) title = suggestTitle(next.name, handle.props.titleMax)
    send(next)
  }

  function send(next: File) {
    let ext = next.name.includes('.') ? next.name.slice(next.name.lastIndexOf('.')).toLowerCase() : ''
    notice = null
    if (!handle.props.accept.split(',').includes(ext)) {
      waiting = false
      transfer = { state: 'failed', message: `LanTube keeps ${handle.props.typesLabel} files. Choose another file.`, retryable: false }
      handle.update()
      return
    }
    let request = new XMLHttpRequest()
    xhr = request
    transfer = { state: 'sending', loaded: 0, total: next.size, rate: 0 }
    let lastAt = performance.now()
    let lastLoaded = 0
    request.open('POST', `${handle.props.fileAction}?name=${encodeURIComponent(next.name)}`)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.responseType = 'json'
    request.upload.addEventListener('progress', (event) => {
      if (xhr !== request || transfer.state !== 'sending') return
      let now = performance.now()
      let elapsed = (now - lastAt) / 1000
      if (elapsed >= 0.25) {
        let instant = (event.loaded - lastLoaded) / elapsed
        transfer.rate = transfer.rate ? transfer.rate * 0.8 + instant * 0.2 : instant
        lastAt = now
        lastLoaded = event.loaded
      }
      transfer.loaded = event.loaded
      if (now - lastPaint > 200 || event.loaded === event.total) {
        lastPaint = now
        handle.update()
      }
    })
    request.addEventListener('load', () => {
      if (xhr !== request) return
      xhr = null
      let body = request.response as { id?: string; error?: string } | null
      if (request.status === 201 && body?.id) {
        uploadId = body.id
        transfer = { state: 'sent' }
        handle.update()
        if (waiting) {
          waiting = false
          form?.requestSubmit()
        }
        return
      }
      waiting = false
      transfer = {
        state: 'failed',
        message:
          request.status === 401
            ? 'You were signed out. Sign in again, then send it again.'
            : (body?.error ?? 'The host didn’t keep the file.') + ' Nothing was saved.',
        retryable: request.status >= 500 || request.status === 0,
      }
      handle.update()
    })
    request.addEventListener('error', () => {
      if (xhr !== request) return
      xhr = null
      waiting = false
      transfer = { state: 'failed', message: 'Couldn’t reach the host. Check you’re on the home network, then try again.', retryable: true }
      handle.update()
    })
    request.send(next)
    handle.update()
  }

  async function buildFrames() {
    let video = sampler
    if (!video || !video.duration || !Number.isFinite(video.duration)) return
    let job = ++frameJob
    let total = video.duration
    frames = Array.from({ length: FRAME_COUNT }, (_, i) => ({ time: (total * (i + 0.5)) / FRAME_COUNT, src: null }))
    handle.update()
    let canvas = document.createElement('canvas')
    canvas.width = 192
    canvas.height = 108
    let context = canvas.getContext('2d')
    if (!context) return
    for (let [index, frame] of frames.entries()) {
      await seek(video, frame.time)
      if (job !== frameJob) return
      try {
        drawCover(context, video, canvas.width, canvas.height)
        frame.src = canvas.toDataURL('image/jpeg', 0.72)
      } catch {
        return
      }
      if (index === DEFAULT_FRAME && posterTime === null) pickPoster(frame.time)
      handle.update()
    }
  }

  function pickPoster(time: number) {
    posterTime = time
    if (!preview) return
    if (Math.abs(preview.currentTime - time) < 0.04 && preview.readyState >= 2 && !preview.seeking) {
      capture()
    } else {
      captureOnSeek = true
      preview.currentTime = time
    }
    handle.update()
  }

  function capture() {
    let video = preview
    if (!video || !video.videoWidth) return
    let scale = Math.min(1, 1280 / video.videoWidth)
    let full = document.createElement('canvas')
    full.width = Math.round(video.videoWidth * scale)
    full.height = Math.round(video.videoHeight * scale)
    let small = document.createElement('canvas')
    small.width = 480
    small.height = 270
    try {
      full.getContext('2d')?.drawImage(video, 0, 0, full.width, full.height)
      let smallContext = small.getContext('2d')
      if (smallContext) drawCover(smallContext, video, small.width, small.height)
      posterThumb = small.toDataURL('image/jpeg', 0.8)
    } catch {
      return
    }
    full.toBlob(
      (blob) => {
        if (!blob || !posterInput) return
        let files = new DataTransfer()
        files.items.add(new File([blob], 'poster.jpg', { type: 'image/jpeg' }))
        posterInput.files = files.files
      },
      'image/jpeg',
      0.86,
    )
    handle.update()
  }

  const TAG_MAX = 40

  function applyTokens(raw: string, keepLastAsDraft: boolean) {
    let tokens = raw
      .split(',')
      .map((value) => value.trim().replace(/\s+/g, ' '))
      .filter((value) => value.length > 0)
    let draft = ''
    if (keepLastAsDraft && !raw.trim().endsWith(',') && tokens.length > 0) {
      draft = tokens.pop() ?? ''
    }
    for (let name of tokens) {
      if (name.length > TAG_MAX) {
        draft = name
        continue
      }
      let key = name.toLocaleLowerCase()
      if (!chosenTags.some((entry) => entry.toLocaleLowerCase() === key)) chosenTags = [...chosenTags, name]
    }
    tagDraft = draft
    if (tagsInput) tagsInput.value = draft
    handle.update()
  }

  function submitTags() {
    applyTokens(tagsInput?.value ?? tagDraft, false)
    if (tagsInput) tagsInput.value = tagDraft ? [...chosenTags, tagDraft].join(', ') : chosenTags.join(', ')
  }

  function submit(event: Event) {
    submitTags()
    if (publishing) {
      event.preventDefault()
      return
    }
    if (transfer.state === 'sending') {
      event.preventDefault()
      waiting = true
      handle.update()
      return
    }
    if (!uploadId) {
      event.preventDefault()
      notice = transfer.state === 'failed' ? 'The video didn’t reach the host. Send it again first.' : 'Choose a video to upload.'
      handle.update()
      ;(form?.querySelector<HTMLElement>('.upload-file-actions .btn') ?? fileInput)?.focus()
      return
    }
    // The file is already on the host; don't send it twice.
    if (fileInput) fileInput.disabled = true
    publishing = true
    handle.update()
  }

  return () => {
    let {
      action,
      cancelHref,
      personName,
      person,
      people,
      destinations,
      playlists,
      error,
      errorField,
      titleMax,
      accept,
      typesLabel,
    } = handle.props
    let here = destination()
    let playlist = playlists.find((entry) => entry.id === playlistId)
    let invalid = (field: UploadFormField) => (error && errorField === field ? 'true' : undefined)
    let errorFor = (field: UploadFormField) =>
      error && errorField === field ? (
        <p class="field-error" id="upload-error" role="alert">
          {error}
        </p>
      ) : null
    let describedBy = (field: UploadFormField, hint?: string) =>
      [hint, invalid(field) ? 'upload-error' : undefined].filter(Boolean).join(' ') || undefined
    let sending = transfer.state === 'sending' ? transfer : null
    let percent = sending && sending.total > 0 ? Math.min(100, (sending.loaded / sending.total) * 100) : 0
    let isPrivate = visibility === 'private'
    let shelfTitle = here.home ? 'On your channel' : `On ${here.name}`
    let publishLabel = publishing ? 'Publishing…' : waiting ? 'Publishes when sent' : 'Publish'
    let generalError = error && (errorField === undefined || errorField === 'poster') ? error : null

    let status = !file
      ? ''
      : sending
        ? ['Sending to the host', bytesOf(sending.loaded, sending.total), sending.rate > 0 ? timeLeft((sending.total - sending.loaded) / sending.rate) : '']
            .filter(Boolean)
            .join(' · ')
        : transfer.state === 'sent'
          ? 'On the host. Add the details, then publish.'
          : transfer.state === 'failed'
            ? transfer.message
            : ''

    return (
      <form
        class="upload"
        method="post"
        action={action}
        enctype="multipart/form-data"
        mix={[on('submit', (event) => submit(event)), ref((node) => (form = node as HTMLFormElement))]}
      >
        <input type="hidden" name="uploadId" value={uploadId} />
        <input type="hidden" name="duration" value={String(Math.round(duration))} />
        <input
          class="visually-hidden"
          type="file"
          name="poster"
          accept="image/jpeg"
          tabindex={-1}
          aria-hidden="true"
          mix={[ref((node) => (posterInput = node as HTMLInputElement))]}
        />

        <div class="upload-main">
          <fieldset class="upload-to" aria-describedby={invalid('channel') ? 'upload-error' : undefined}>
            <legend class="field-label">Post to</legend>
            <div class="upload-to-list">
              {destinations.map((entry) => (
                <label class="upload-to-tile">
                  <input
                    class="poster-input"
                    type="radio"
                    name="channel"
                    value={entry.id}
                    checked={entry.id === here.id}
                    required
                    aria-invalid={entry.id === here.id ? invalid('channel') : undefined}
                    mix={[
                      on('change', () => {
                        channelId = entry.id
                        handle.update()
                      }),
                    ]}
                  />
                  <ShelfAvatar destination={entry} size="card" />
                  <span class="upload-to-name">{entry.name}</span>
                  <span class="upload-to-role">{entry.role}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {errorFor('channel')}

          <div class="upload-file-block">
            <p class="field-label" id="upload-file-label">
              Video
            </p>
            {file ? (
              <div class={`upload-file${transfer.state === 'failed' ? ' is-failed' : ''}`}>
                <div class="upload-preview">
                  {previewSrc && previewable ? (
                    <video
                      class="upload-video"
                      src={previewSrc}
                      muted
                      playsinline
                      preload="auto"
                      aria-hidden="true"
                      mix={[
                        ref((node) => (preview = node as HTMLVideoElement)),
                        on('loadedmetadata', (event) => {
                          let video = event.currentTarget as HTMLVideoElement
                          if (Number.isFinite(video.duration)) duration = video.duration
                          handle.update()
                        }),
                        on('seeked', () => {
                          if (!captureOnSeek) return
                          captureOnSeek = false
                          capture()
                        }),
                        on('error', () => {
                          previewable = false
                          frames = []
                          clearPoster()
                          handle.update()
                        }),
                      ]}
                    />
                  ) : (
                    <span class="upload-preview-none">
                      <Icon name="file-missing" size={28} />
                      <span>No preview in this browser</span>
                    </span>
                  )}
                  {duration > 0 ? <span class="vcard-duration">{clock(duration)}</span> : null}
                </div>
                <div class="upload-file-info">
                  <p class="upload-file-name" title={file.name}>
                    {file.name}
                  </p>
                  <p class="upload-file-meta">
                    {bytes(file.size)}
                    {duration > 0 ? ` · ${clock(duration)}` : ''}
                  </p>
                  <p class={`upload-file-status upload-file-status-${transfer.state}`}>
                    {transfer.state === 'sent' ? <Icon name="check" size={16} /> : null}
                    <span>{status}</span>
                  </p>
                  {sending ? (
                    <span
                      class="upload-bar"
                      role="progressbar"
                      aria-label="Sent to the host"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(percent)}
                    >
                      <span style={`width:${percent.toFixed(1)}%`} />
                    </span>
                  ) : null}
                  <div class="upload-file-actions">
                    {transfer.state === 'failed' && transfer.retryable && source ? (
                      <button
                        class="btn btn-secondary btn-sm"
                        type="button"
                        mix={[
                          on('click', () => {
                            if (source) send(source)
                          }),
                        ]}
                      >
                        <Icon name="replay" size={18} />
                        Try again
                      </button>
                    ) : null}
                    <button class="btn btn-ghost btn-sm" type="button" mix={[on('click', () => fileInput?.click())]}>
                      Choose another file
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <span class="visually-hidden" role="status">
              {sending ? 'Sending to the host' : transfer.state === 'sent' ? 'Sent to the host' : transfer.state === 'failed' ? transfer.message : ''}
            </span>
            <label
              class={`upload-well${file ? ' is-hidden' : ''}${dragging ? ' is-over' : ''}`}
              mix={[
                on('dragover', (event) => {
                  event.preventDefault()
                  if (!dragging) {
                    dragging = true
                    handle.update()
                  }
                }),
                on('dragleave', (event) => {
                  let to = (event as DragEvent).relatedTarget as Node | null
                  if (to && (event.currentTarget as HTMLElement).contains(to)) return
                  dragging = false
                  handle.update()
                }),
                on('drop', (event) => {
                  event.preventDefault()
                  dragging = false
                  let dropped = (event as DragEvent).dataTransfer?.files?.[0]
                  if (dropped) choose(dropped)
                  else handle.update()
                }),
              ]}
            >
              <span class="upload-well-icon">
                <Icon name="upload" size={24} />
              </span>
              <span class="upload-well-title">Choose a video, or drop it here</span>
              <span class="upload-well-note">It starts sending to the host straight away. {typesLabel}.</span>
              <input
                class="upload-well-input"
                type="file"
                name="video"
                accept={`video/*,${accept}`}
                tabindex={file ? -1 : undefined}
                aria-labelledby="upload-file-label"
                aria-invalid={invalid('file') || (notice ? 'true' : undefined)}
                aria-describedby={describedBy('file', notice ? 'upload-notice' : undefined)}
                mix={[
                  ref((node) => (fileInput = node as HTMLInputElement)),
                  on('change', (event) => {
                    let picked = (event.currentTarget as HTMLInputElement).files?.[0]
                    if (picked) choose(picked)
                  }),
                ]}
              />
            </label>
            {errorFor('file')}
            {notice ? (
              <p class="field-error" id="upload-notice" role="alert">
                {notice}
              </p>
            ) : null}
            {previewSrc && previewable ? (
              <video
                class="upload-sampler"
                src={previewSrc}
                muted
                playsinline
                preload="auto"
                hidden
                aria-hidden="true"
                mix={[
                  ref((node) => (sampler = node as HTMLVideoElement)),
                  on('loadedmetadata', () => void buildFrames()),
                ]}
              />
            ) : null}
          </div>

          {file && previewable ? (
            <div class="upload-frames" role="group" aria-labelledby="upload-frames-label">
              <p class="upload-frames-head">
                <span class="field-label" id="upload-frames-label">
                  Poster frame
                </span>
                <span class="upload-frames-at">{posterTime !== null ? `at ${clock(posterTime)}` : 'Reading frames…'}</span>
              </p>
              <div class="upload-strip">
                {(frames.length > 0 ? frames : Array.from({ length: FRAME_COUNT }, () => null)).map((frame) => {
                  if (!frame) return <span class="upload-frame is-empty" />
                  let on_ = posterTime !== null && Math.abs(frame.time - posterTime) < 0.05
                  return (
                    <button
                      class={`upload-frame${on_ ? ' is-on' : ''}`}
                      type="button"
                      aria-pressed={on_ ? 'true' : 'false'}
                      aria-label={`Frame at ${clock(frame.time)}`}
                      disabled={!frame.src}
                      mix={[on('click', () => pickPoster(frame.time))]}
                    >
                      {frame.src ? <img src={frame.src} alt="" /> : null}
                    </button>
                  )
                })}
              </div>
              {duration > 0 ? (
                <input
                  class="upload-scrub"
                  type="range"
                  min="0"
                  max={String(duration)}
                  step="any"
                  value={String(posterTime ?? 0)}
                  aria-label="Fine-tune the poster frame"
                  aria-valuetext={posterTime !== null ? clock(posterTime) : 'Not picked'}
                  mix={[
                    on('input', (event) => {
                      let time = Number((event.currentTarget as HTMLInputElement).value)
                      posterTime = time
                      if (preview) preview.currentTime = time
                      handle.update()
                    }),
                    on('change', (event) => pickPoster(Number((event.currentTarget as HTMLInputElement).value))),
                  ]}
                />
              ) : null}
            </div>
          ) : file && !previewable ? (
            <p class="field-hint upload-frames-none">
              This browser can’t show frames from this file, so it will have a plain tile instead of a poster. It still uploads.
            </p>
          ) : null}

          <label class="field-label" for="upload-title">
            Title
          </label>
          <input
            id="upload-title"
            class="field"
            type="text"
            name="title"
            value={title}
            maxlength={titleMax}
            autocomplete="off"
            placeholder="Emerald Bay from the boat, day 3"
            required
            aria-invalid={invalid('title')}
            aria-describedby={describedBy('title')}
            mix={[
              on('input', (event) => {
                title = (event.currentTarget as HTMLInputElement).value
                titleTouched = title.trim() !== ''
                handle.update()
              }),
            ]}
          />
          {errorFor('title')}

          <fieldset class="upload-tags">
            <legend class="field-label">
              Tags <span class="field-optional">(optional)</span>
            </legend>
            <p class="field-hint" id="upload-tags-hint">
              Separate names with commas.
            </p>
            {enhanced && chosenTags.length > 0 ? (
              <div class="upload-chips">
                {chosenTags.map((name) => (
                  <span class="chip upload-chip">
                    {name}
                    <button
                      class="upload-chip-remove"
                      type="button"
                      aria-label={`Remove ${name}`}
                      mix={[
                        on('click', () => {
                          chosenTags = chosenTags.filter((entry) => entry !== name)
                          handle.update()
                        }),
                      ]}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <input
              id="upload-tags"
              class="field"
              type="text"
              name="tags"
              value={enhanced ? tagDraft : [chosenTags.join(', '), tagDraft].filter(Boolean).join(', ')}
              autocomplete="off"
              placeholder="Kids, trips"
              aria-invalid={invalid('tags')}
              aria-describedby={describedBy('tags', 'upload-tags-hint')}
              mix={[
                ref((node) => (tagsInput = node as HTMLInputElement)),
                on('keydown', (event) => {
                  if (event.key !== 'Enter' && event.key !== ',') return
                  event.preventDefault()
                  applyTokens((event.currentTarget as HTMLInputElement).value, false)
                }),
                on('input', (event) => {
                  let value = (event.currentTarget as HTMLInputElement).value
                  if (value.includes(',')) {
                    applyTokens(value, true)
                    return
                  }
                  tagDraft = value
                  handle.update()
                }),
              ]}
            />
            {errorFor('tags')}
          </fieldset>

          {playlists.length > 0 ? (
            <>
              <label class="field-label" for="upload-playlist">
                Add to a playlist <span class="field-optional">(optional)</span>
              </label>
              <span class="field-select-wrap">
                <select
                  id="upload-playlist"
                  class="field field-select"
                  name="playlist"
                  aria-invalid={invalid('playlist')}
                  aria-describedby={describedBy('playlist')}
                  mix={[
                    on('change', (event) => {
                      playlistId = (event.currentTarget as HTMLSelectElement).value
                      handle.update()
                    }),
                  ]}
                >
                  <option value="" selected={playlistId === ''}>
                    None
                  </option>
                  {playlists.map((entry) => (
                    <option value={entry.id} selected={entry.id === playlistId}>
                      {entry.private ? `${entry.name} (private)` : entry.name}
                    </option>
                  ))}
                </select>
              </span>
              {errorFor('playlist')}
            </>
          ) : null}

          <fieldset class="chform-posters upload-who">
            <legend class="field-label">Who can see it</legend>
            <div class="pvis-options">
              <label class="poster pvis-option">
                <input
                  class="poster-input"
                  type="radio"
                  name="visibility"
                  value="house"
                  checked={!isPrivate}
                  mix={[
                    on('change', () => {
                      visibility = 'house'
                      handle.update()
                    }),
                  ]}
                />
                <Icon name="channels" size={20} />
                <span class="pvis-option-text">
                  <span class="poster-name">Everyone in the house</span>
                  <span class="poster-role">On Home and on the channel</span>
                </span>
                <span class="radio" aria-hidden="true" />
              </label>
              <label class="poster pvis-option">
                <input
                  class="poster-input"
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={isPrivate}
                  mix={[
                    on('change', () => {
                      visibility = 'private'
                      handle.update()
                    }),
                  ]}
                />
                <Icon name="lock" size={20} />
                <span class="pvis-option-text">
                  <span class="poster-name">Private</span>
                  <span class="poster-role">You choose who else can see it</span>
                </span>
                <span class="radio" aria-hidden="true" />
              </label>
            </div>
            {isPrivate ? (
              <div class="audience-picker">
                <p class="field-hint">You can always see it. Pick anyone else in the house.</p>
                <ul class="poster-list">
                  <li>
                    <span class="poster poster-owner">
                      <PersonAvatar person={person} />
                      <span class="poster-name">{person.name}</span>
                      <span class="poster-role">You · owner</span>
                    </span>
                  </li>
                  {people
                    .filter((other) => other.id !== person.id)
                    .map((other) => (
                      <li>
                        <label class="poster">
                          <input
                            class="poster-input"
                            type="checkbox"
                            name="audience"
                            value={other.id}
                            checked={audienceIds.includes(other.id)}
                            mix={[
                              on('change', (event) => {
                                let checked = (event.currentTarget as HTMLInputElement).checked
                                audienceIds = checked
                                  ? audienceIds.includes(other.id)
                                    ? audienceIds
                                    : [...audienceIds, other.id]
                                  : audienceIds.filter((id) => id !== other.id)
                                handle.update()
                              }),
                            ]}
                          />
                          <PersonAvatar person={other} />
                          <span class="poster-name">{other.name}</span>
                          <span class="check" aria-hidden="true">
                            <Icon name="check" size={14} />
                          </span>
                        </label>
                      </li>
                    ))}
                </ul>
                {people.some((other) => other.id !== person.id) ? null : (
                  <p class="field-hint">Nobody else has joined the house yet.</p>
                )}
              </div>
            ) : null}
          </fieldset>
        </div>

        <aside class="upload-side" aria-labelledby="upload-shelf-title">
          <section class="upload-shelf">
            <h2 class="upload-shelf-title" id="upload-shelf-title">
              <ShelfAvatar destination={here} size="sm" />
              {shelfTitle}
            </h2>
            <p class="upload-shelf-note">
              {isPrivate
                ? audienceIds.length > 0
                  ? 'How it will look. You and the people you name will see it here.'
                  : 'How it will look. Only you will see it here.'
                : 'How it will look, newest first'}
            </p>
            <ul class="upload-cards">
              <li>
                <article class="vcard vcard-on-channel upload-card">
                  <span class="vcard-thumb">
                    {posterThumb ? <img src={posterThumb} alt="" /> : null}
                    {duration > 0 ? <span class="vcard-duration">{clock(duration)}</span> : null}
                  </span>
                  <div class="vcard-meta">
                    <div class="vcard-text">
                      <h3 class={`vcard-title${title.trim() ? '' : ' is-placeholder'}`}>{title.trim() || 'Your title goes here'}</h3>
                      {here.kind === 'custom' ? <p class="vcard-byline">{personName}</p> : null}
                      <p class="vcard-when">
                        Just now
                        <span class="badge-new">New</span>
                        {isPrivate ? (
                          <span class="pvis vcard-private">
                            <Icon name="lock" size={14} />
                            Private
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </article>
              </li>
              {here.recent.map((video) => (
                <li class="upload-card-older" aria-hidden="true">
                  <article class="vcard vcard-on-channel">
                    <span class="vcard-thumb">
                      {video.thumb ? <img src={video.thumb} alt="" loading="lazy" decoding="async" /> : null}
                      {video.durationSec > 0 ? <span class="vcard-duration">{clock(video.durationSec)}</span> : null}
                    </span>
                    <div class="vcard-meta">
                      <div class="vcard-text">
                        <h3 class="vcard-title">{video.title}</h3>
                        {video.byline ? <p class="vcard-byline">{video.byline}</p> : null}
                        <p class="vcard-when">{video.meta}</p>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>

          <dl class="upload-pass" aria-label="Where it lands">
            <div>
              <dt>Channel</dt>
              <dd>{here.name}</dd>
            </div>
            <div>
              <dt>Who can see it</dt>
              <dd>
                {isPrivate ? (
                  <span class="pvis">
                    <Icon name="lock" size={14} />
                    Private
                  </span>
                ) : (
                  'Everyone'
                )}
              </dd>
            </div>
            <div>
              <dt>Playlist</dt>
              <dd>{playlist?.name ?? 'None'}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{duration > 0 ? clock(duration) : '–'}</dd>
            </div>
          </dl>

          {generalError ? (
            <p class="field-error upload-side-error" role="alert" tabindex={-1}>
              {generalError}
            </p>
          ) : null}

          <div class="chform-actions upload-actions">
            <button class="btn btn-primary" type="submit" aria-disabled={publishing ? 'true' : undefined}>
              {publishLabel}
            </button>
            <a class="btn btn-ghost" href={cancelHref}>
              Cancel
            </a>
          </div>
        </aside>
      </form>
    )
  }
})
