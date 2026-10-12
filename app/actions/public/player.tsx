import { clientEntry, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon, type IconName } from '../../ui/public/icons.tsx'

export interface PlayerProps {
  videoId: string
  title: string
  /** Media URL, or null when the file isn't on the host. */
  src: string | null
  poster?: string
  /** Catalogue duration, used until the file reports its own. */
  durationSec: number
  /** Where this house left off, in seconds. */
  resumeAt?: number
  activityHref: string
  theater: boolean
  /** The file LanTube expected, relative to the media folder. */
  expectedFile: string
}

type Failure = 'unsupported' | 'network' | 'missing'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const HIDE_AFTER_MS = 2600
const PROGRESS_EVERY_MS = 15_000

function clock(totalSec: number): string {
  let t = Math.max(0, Math.floor(totalSec || 0))
  let h = Math.floor(t / 3600)
  let m = Math.floor((t % 3600) / 60)
  let s = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function spoken(totalSec: number): string {
  let t = Math.max(0, Math.floor(totalSec || 0))
  let h = Math.floor(t / 3600)
  let m = Math.floor((t % 3600) / 60)
  let s = t % 60
  let parts = []
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s || parts.length === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function rateLabel(rate: number): string {
  return `${rate}×`
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

export const Player = clientEntry(import.meta.url, function Player(handle: Handle<PlayerProps>) {
  let video: HTMLVideoElement | undefined
  let root: HTMLElement | undefined
  let seekEl: HTMLElement | undefined
  let speedBtn: HTMLButtonElement | undefined
  let speedMenu: HTMLElement | undefined

  let startedOnce = false
  let playing = false
  let ended = false
  let waiting = false
  let failure: Failure | null = handle.props.src ? null : 'missing'
  let current = handle.props.resumeAt ?? 0
  let duration = handle.props.durationSec
  let bufferedEnd = 0
  let volume = 1
  let muted = false
  let rate = 1
  let fullscreen = false
  let pip = false
  let theater = handle.props.theater
  let resumeAt = handle.props.resumeAt ?? 0
  let controlsShown = true
  let pointerOverBar = false
  let speedOpen = false
  let scrubbing = false
  let hover: { x: number; time: number } | null = null
  let flash: { icon: IconName; label?: string; n: number } | null = null
  let flashN = 0
  let pipSupported = false
  let fullscreenSupported = false
  let touch = false

  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let flashTimer: ReturnType<typeof setTimeout> | undefined
  let lastSent = 0
  let frame = 0

  let canControl = () => failure === null && video !== undefined

  function report(data: Record<string, string>, beacon = false) {
    let body = new FormData()
    for (let [key, value] of Object.entries(data)) body.set(key, value)
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(handle.props.activityHref, body)
      return
    }
    fetch(handle.props.activityHref, { method: 'POST', body, keepalive: true }).catch(() => {})
  }

  function saveProgress(beacon = false) {
    if (!video || !startedOnce || !Number.isFinite(video.duration)) return
    lastSent = Date.now()
    report({ event: 'progress', t: video.currentTime.toFixed(1), d: video.duration.toFixed(1) }, beacon)
  }

  function showFlash(icon: IconName, label?: string) {
    flash = { icon, label, n: ++flashN }
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flash = null
      handle.update()
    }, 700)
  }

  function poke() {
    controlsShown = true
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (playing && !speedOpen && !scrubbing && !pointerOverBar && !root?.querySelector(':focus-visible')) {
        controlsShown = false
        handle.update()
      }
    }, HIDE_AFTER_MS)
    handle.update()
  }

  function tick() {
    if (!video) return
    current = video.currentTime
    handle.update()
    frame = playing ? requestAnimationFrame(tick) : 0
  }

  function togglePlay(withFlash = false) {
    if (!canControl()) return
    if (video!.paused || video!.ended) {
      video!.play().catch(() => {})
      if (withFlash) showFlash('play')
    } else {
      video!.pause()
      if (withFlash) showFlash('pause')
    }
    poke()
  }

  function seekTo(time: number) {
    if (!canControl()) return
    let max = Number.isFinite(video!.duration) ? video!.duration : duration
    video!.currentTime = Math.min(Math.max(time, 0), max)
    current = video!.currentTime
    ended = false
    resumeAt = 0
    poke()
  }

  function seekBy(delta: number) {
    seekTo((video?.currentTime ?? current) + delta)
    showFlash(delta < 0 ? 'seek-back' : 'seek-forward', `${delta > 0 ? '+' : '−'}${Math.abs(delta)} s`)
  }

  function setVolume(next: number) {
    if (!video) return
    video.volume = Math.min(Math.max(next, 0), 1)
    video.muted = video.volume === 0
    let pct = Math.round(video.volume * 100)
    showFlash(video.muted ? 'volume-off' : video.volume < 0.5 ? 'volume-low' : 'volume-high', `${pct}%`)
    poke()
  }

  function toggleMute(viaKey = false) {
    if (!video) return
    video.muted = !video.muted
    if (!video.muted && video.volume === 0) video.volume = 0.5
    if (viaKey) showFlash(video.muted ? 'volume-off' : 'volume-high', video.muted ? 'Muted' : undefined)
    poke()
  }

  function setRate(next: number) {
    if (!video) return
    video.playbackRate = next
    speedOpen = false
    showFlash('speed', rateLabel(next))
    poke()
  }

  function stepRate(direction: 1 | -1) {
    let index = RATES.indexOf(rate)
    let next = RATES[Math.min(Math.max((index === -1 ? 2 : index) + direction, 0), RATES.length - 1)]
    setRate(next)
  }

  async function toggleFullscreen() {
    if (!root || !video) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' })
      else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.()
    } catch {}
  }

  async function togglePip() {
    if (!video || !pipSupported) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {}
  }

  function toggleTheater() {
    theater = !theater
    root?.closest('.watch')?.classList.toggle('is-theater', theater)
    document.cookie = theater
      ? 'lt_theater=1; path=/; max-age=31536000; samesite=lax'
      : 'lt_theater=; path=/; max-age=0; samesite=lax'
    poke()
  }

  function timeAt(clientX: number): { x: number; time: number } {
    let box = seekEl!.getBoundingClientRect()
    let x = Math.min(Math.max(clientX - box.left, 0), box.width)
    return { x, time: (x / box.width) * (Number.isFinite(duration) ? duration : 0) }
  }

  function openSpeed() {
    speedOpen = true
    poke()
    handle.queueTask(() => {
      let checked = speedMenu?.querySelector<HTMLElement>('[aria-checked="true"]')
      checked?.focus()
    })
  }

  function closeSpeed(restoreFocus = true) {
    if (!speedOpen) return
    speedOpen = false
    handle.update()
    if (restoreFocus) speedBtn?.focus()
  }

  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (isTyping(event.target) || !canControl()) return
    let target = event.target as HTMLElement | null
    let onControl = target?.closest('button, a, [role="slider"], [role="menu"]') != null
    let inPlayer = root?.contains(target) ?? false

    switch (event.key) {
      case ' ':
      case 'Enter':
        if (onControl || (event.key === 'Enter' && !inPlayer)) return
        togglePlay(true)
        break
      case 'k':
        togglePlay(true)
        break
      case 'j':
        seekBy(-10)
        break
      case 'l':
        seekBy(10)
        break
      case 'ArrowLeft':
        seekBy(-5)
        break
      case 'ArrowRight':
        seekBy(5)
        break
      case 'ArrowUp':
      case 'ArrowDown':
        if (!inPlayer) return
        setVolume((video!.muted ? 0 : video!.volume) + (event.key === 'ArrowUp' ? 0.05 : -0.05))
        break
      case 'f':
        toggleFullscreen()
        break
      case 'm':
        toggleMute(true)
        break
      case 't':
        if (!fullscreen) toggleTheater()
        break
      case 'i':
        togglePip()
        break
      case '<':
        stepRate(-1)
        break
      case '>':
        stepRate(1)
        break
      case 'Home':
        if (!inPlayer) return
        seekTo(0)
        break
      case 'End':
        if (!inPlayer) return
        seekTo(duration)
        break
      default:
        if (/^[0-9]$/.test(event.key)) {
          seekTo((Number(event.key) / 10) * duration)
          break
        }
        return
    }
    event.preventDefault()
  }

  handle.queueTask(() => {
    pipSupported = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && !!video
    fullscreenSupported =
      document.fullscreenEnabled || (video !== undefined && 'webkitEnterFullscreen' in video)
    touch = matchMedia('(hover: none)').matches

    try {
      let saved = JSON.parse(localStorage.getItem('lt_volume') ?? 'null')
      if (video && saved && typeof saved.volume === 'number') {
        video.volume = Math.min(Math.max(saved.volume, 0), 1)
        video.muted = Boolean(saved.muted)
      }
    } catch {}

    let signal = handle.signal
    document.addEventListener('keydown', onKey, { signal })
    document.addEventListener(
      'fullscreenchange',
      () => {
        fullscreen = document.fullscreenElement === root
        poke()
      },
      { signal },
    )
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!speedOpen) return
        let target = event.target as Node
        if (speedMenu?.contains(target) || speedBtn?.contains(target)) return
        closeSpeed(false)
      },
      { signal },
    )
    let flush = () => {
      if (document.visibilityState === 'hidden') saveProgress(true)
    }
    document.addEventListener('visibilitychange', flush, { signal })
    window.addEventListener('pagehide', () => saveProgress(true), { signal })
    signal.addEventListener('abort', () => {
      saveProgress(true)
      cancelAnimationFrame(frame)
      clearTimeout(hideTimer)
      clearTimeout(waitTimer)
      clearTimeout(flashTimer)
    })
    handle.update()
  })

  return () => {
    let { title, src, poster, expectedFile } = handle.props
    let shown = controlsShown || !playing || speedOpen || scrubbing
    let played = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
    let buffered = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0
    let offerResume = !startedOnce && resumeAt > 0 && failure === null
    let volumeIcon: IconName = muted || volume === 0 ? 'volume-off' : volume < 0.5 ? 'volume-low' : 'volume-high'
    let classes = ['player']
    if (!shown) classes.push('is-idle')
    if (!startedOnce) classes.push('is-fresh')
    if (fullscreen) classes.push('is-fullscreen')
    if (failure) classes.push('has-failure')

    if (failure === 'missing' || src === null) {
      return (
        <div class="player has-failure" aria-label={`Video player: ${title}`} role="region">
          {poster ? <img class="player-poster" src={poster} alt="" /> : null}
          <div class="player-message" role="status">
            <Icon name="file-missing" size={40} />
            <p class="player-message-title">This video’s file isn’t on the host</p>
            <p>
              LanTube looks for <code>{expectedFile}</code> in its media folder. Copy the file there, then reload this
              page.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div
        class={classes.join(' ')}
        role="region"
        aria-label={`Video player: ${title}`}
        mix={[
          ref((node) => (root = node)),
          on('pointermove', (event) => {
            if (event.pointerType === 'mouse') poke()
          }),
          on('pointerleave', () => {
            if (playing && !speedOpen) {
              controlsShown = false
              handle.update()
            }
          }),
          on('focusin', () => poke()),
        ]}
      >
        <video
          class="player-video"
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          mix={[
            ref((node, signal) => {
              video = node
              let setPip = (value: boolean) => () => {
                pip = value
                handle.update()
              }
              node.addEventListener('enterpictureinpicture', setPip(true), { signal })
              node.addEventListener('leavepictureinpicture', setPip(false), { signal })
            }),
            on('loadedmetadata', () => {
              duration = video!.duration
              if (resumeAt > 0 && resumeAt < duration - 15) video!.currentTime = resumeAt
              else resumeAt = 0
              current = video!.currentTime
              handle.update()
            }),
            on('durationchange', () => {
              if (Number.isFinite(video!.duration)) duration = video!.duration
              handle.update()
            }),
            on('progress', () => {
              let ranges = video!.buffered
              let t = video!.currentTime
              bufferedEnd = 0
              for (let i = 0; i < ranges.length; i++) {
                if (ranges.start(i) <= t + 0.5) bufferedEnd = Math.max(bufferedEnd, ranges.end(i))
              }
              handle.update()
            }),
            on('play', () => {
              playing = true
              ended = false
              if (!startedOnce) {
                startedOnce = true
                report({ event: 'play' })
              }
              cancelAnimationFrame(frame)
              frame = requestAnimationFrame(tick)
              poke()
            }),
            on('pause', () => {
              playing = false
              saveProgress()
              poke()
            }),
            on('ended', () => {
              playing = false
              ended = true
              saveProgress()
              poke()
            }),
            on('waiting', () => {
              clearTimeout(waitTimer)
              waitTimer = setTimeout(() => {
                waiting = true
                handle.update()
              }, 300)
            }),
            on('playing', () => {
              clearTimeout(waitTimer)
              waiting = false
              handle.update()
            }),
            on('seeked', () => {
              clearTimeout(waitTimer)
              waiting = false
              handle.update()
            }),
            on('timeupdate', () => {
              if (!playing) {
                current = video!.currentTime
                handle.update()
              }
              if (playing && Date.now() - lastSent > PROGRESS_EVERY_MS) saveProgress()
            }),
            on('volumechange', () => {
              volume = video!.volume
              muted = video!.muted
              try {
                localStorage.setItem('lt_volume', JSON.stringify({ volume, muted }))
              } catch {}
              handle.update()
            }),
            on('ratechange', () => {
              rate = video!.playbackRate
              handle.update()
            }),
            on('error', () => {
              let code = video!.error?.code
              failure = code === MediaError.MEDIA_ERR_NETWORK ? 'network' : 'unsupported'
              playing = false
              waiting = false
              handle.update()
            }),
          ]}
        />

        <button
          class="player-surface"
          type="button"
          tabindex={-1}
          aria-hidden="true"
          mix={[
            on('click', (event) => {
              if ((event as PointerEvent).pointerType === 'touch' || touch) {
                // Touch follows the category: a tap reveals or hides the controls, the buttons do the rest.
                if (controlsShown && playing) {
                  clearTimeout(hideTimer)
                  controlsShown = false
                  handle.update()
                } else poke()
                return
              }
              togglePlay(startedOnce)
            }),
            on('dblclick', () => {
              if (touch) return
              toggleFullscreen()
            }),
          ]}
        />

        {waiting && !failure ? <span class="player-spinner" aria-hidden="true" /> : null}

        {flash ? (
          <span class="player-flash" key={`flash-${flash.n}`} aria-hidden="true">
            <Icon name={flash.icon} size={28} />
            {flash.label ? <span>{flash.label}</span> : null}
          </span>
        ) : null}

        {failure ? (
          <div class="player-message" role="alert">
            <Icon name="file-missing" size={40} />
            {failure === 'network' ? (
              <>
                <p class="player-message-title">Lost the connection to the host</p>
                <p>The machine streaming LanTube stopped responding. Check it’s on, then try again.</p>
                <button
                  class="btn btn-secondary"
                  type="button"
                  mix={on('click', () => {
                    failure = null
                    resumeAt = current
                    video?.load()
                    handle.update()
                  })}
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p class="player-message-title">This file can’t play in this browser</p>
                <p>
                  LanTube doesn’t convert videos yet. <code>{expectedFile}</code> needs to be MP4 (H.264) or WebM to play
                  everywhere.
                </p>
              </>
            )}
          </div>
        ) : !playing && !waiting && (!startedOnce || ended) ? (
          <div class="player-center">
            <button
              class="player-big"
              type="button"
              aria-label={ended ? 'Watch again' : offerResume ? `Resume from ${clock(resumeAt)}` : 'Play'}
              mix={on('click', () => {
                if (ended) seekTo(0)
                togglePlay()
              })}
            >
              <Icon name={ended ? 'replay' : 'play'} size={32} />
            </button>
            {offerResume ? (
              <div class="player-resume">
                <span>Resume from {clock(resumeAt)}</span>
                <button
                  class="player-startover"
                  type="button"
                  mix={on('click', () => {
                    resumeAt = 0
                    seekTo(0)
                    togglePlay()
                  })}
                >
                  Start over
                </button>
              </div>
            ) : ended ? (
              <div class="player-resume">
                <span>Watch again</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {failure ? null : (
          <div
            class="player-bar"
            mix={[
              on('pointerenter', () => {
                pointerOverBar = true
              }),
              on('pointerleave', () => {
                pointerOverBar = false
              }),
            ]}
          >
            <div
              class={scrubbing ? 'seek is-scrubbing' : 'seek'}
              role="slider"
              tabindex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(current)}
              aria-valuetext={`${spoken(current)} of ${spoken(duration)}`}
              style={`--played:${played.toFixed(2)}%;--buffered:${buffered.toFixed(2)}%`}
              mix={[
                ref((node) => (seekEl = node)),
                on('pointerdown', (event) => {
                  if (event.button !== 0) return
                  seekEl!.setPointerCapture(event.pointerId)
                  scrubbing = true
                  hover = timeAt(event.clientX)
                  seekTo(hover.time)
                }),
                on('pointermove', (event) => {
                  hover = timeAt(event.clientX)
                  if (scrubbing) seekTo(hover.time)
                  else handle.update()
                }),
                on('pointerup', (event) => {
                  if (!scrubbing) return
                  scrubbing = false
                  seekEl!.releasePointerCapture(event.pointerId)
                  poke()
                }),
                on('pointercancel', () => {
                  scrubbing = false
                  poke()
                }),
                on('pointerleave', () => {
                  if (scrubbing) return
                  hover = null
                  handle.update()
                }),
                on('keydown', (event) => {
                  let step: number | null = null
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') step = -5
                  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') step = 5
                  else if (event.key === 'PageDown') step = -duration / 10
                  else if (event.key === 'PageUp') step = duration / 10
                  if (step !== null) {
                    seekTo(current + step)
                    event.preventDefault()
                  }
                }),
              ]}
            >
              <span class="seek-track">
                <span class="seek-buffered" />
                <span class="seek-played" />
              </span>
              <span class="seek-thumb" />
              {hover ? (
                <span class="seek-tip" style={`--x:${hover.x.toFixed(1)}px`} aria-hidden="true">
                  {clock(hover.time)}
                </span>
              ) : null}
            </div>

            <div class="player-controls">
              <button
                class="pbtn"
                type="button"
                aria-label={playing ? 'Pause' : 'Play'}
                aria-keyshortcuts="k"
                title={playing ? 'Pause (k)' : 'Play (k)'}
                mix={on('click', () => {
                  if (ended) seekTo(0)
                  togglePlay()
                })}
              >
                <Icon name={playing ? 'pause' : ended ? 'replay' : 'play'} />
              </button>

              <div class="pvolume">
                <button
                  class="pbtn"
                  type="button"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  aria-keyshortcuts="m"
                  title={muted ? 'Unmute (m)' : 'Mute (m)'}
                  mix={on('click', () => toggleMute())}
                >
                  <Icon name={volumeIcon} />
                </button>
                <input
                  class="pvolume-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={String(muted ? 0 : volume)}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
                  style={`--level:${((muted ? 0 : volume) * 100).toFixed(0)}%`}
                  mix={on('input', (event) => {
                    if (!video) return
                    video.volume = Number(event.currentTarget.value)
                    video.muted = video.volume === 0
                  })}
                />
              </div>

              <p class="ptime">
                <span>{clock(current)}</span>
                <span class="ptime-sep" aria-hidden="true">
                  /
                </span>
                <span class="visually-hidden">of</span>
                <span class="ptime-total">{clock(duration)}</span>
              </p>

              <span class="pspacer" />

              <div class="pspeed">
                <button
                  class={rate === 1 ? 'pbtn pbtn-text' : 'pbtn pbtn-text is-changed'}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={speedOpen ? 'true' : 'false'}
                  aria-controls="player-speed-menu"
                  aria-label={`Playback speed, ${rate === 1 ? 'normal' : rateLabel(rate)}`}
                  title="Playback speed (< >)"
                  mix={[
                    ref((node) => (speedBtn = node)),
                    on('click', () => (speedOpen ? closeSpeed() : openSpeed())),
                  ]}
                >
                  {rateLabel(rate)}
                </button>
                {speedOpen ? (
                  <ul
                    class="pmenu"
                    id="player-speed-menu"
                    role="menu"
                    aria-label="Playback speed"
                    mix={[
                      ref((node) => (speedMenu = node)),
                      on('keydown', (event) => {
                        let items = [...speedMenu!.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
                        let index = items.indexOf(document.activeElement as HTMLElement)
                        if (event.key === 'Escape') {
                          closeSpeed()
                        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                          let next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                          items[next]?.focus()
                        } else if (event.key === 'Tab') {
                          closeSpeed(false)
                          return
                        } else return
                        event.preventDefault()
                        event.stopPropagation()
                      }),
                    ]}
                  >
                    {RATES.map((value) => (
                      <li role="none">
                        <button
                          class="pmenu-item"
                          type="button"
                          role="menuitemradio"
                          aria-checked={value === rate ? 'true' : 'false'}
                          tabindex={-1}
                          mix={on('click', () => {
                            setRate(value)
                            speedBtn?.focus()
                          })}
                        >
                          <span class="pmenu-check">{value === rate ? <Icon name="check" size={18} /> : null}</span>
                          {value === 1 ? 'Normal' : rateLabel(value)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {pipSupported ? (
                <button
                  class="pbtn"
                  type="button"
                  aria-label={pip ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                  aria-pressed={pip ? 'true' : 'false'}
                  aria-keyshortcuts="i"
                  title="Picture-in-picture (i)"
                  mix={on('click', () => togglePip())}
                >
                  <Icon name="pip" />
                </button>
              ) : null}

              {fullscreen ? null : (
                <button
                  class="pbtn pbtn-theater"
                  type="button"
                  aria-label="Theater mode"
                  aria-pressed={theater ? 'true' : 'false'}
                  aria-keyshortcuts="t"
                  title={theater ? 'Default view (t)' : 'Theater mode (t)'}
                  mix={on('click', () => toggleTheater())}
                >
                  <Icon name={theater ? 'theater-exit' : 'theater'} />
                </button>
              )}

              {fullscreenSupported ? (
                <button
                  class="pbtn"
                  type="button"
                  aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                  aria-keyshortcuts="f"
                  title={fullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
                  mix={on('click', () => toggleFullscreen())}
                >
                  <Icon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }
})
