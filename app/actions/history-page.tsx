import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import { formatClock, formatRange, sittingsFor, videosWatchedSince, type Sitting, type SittingRow } from '../data/history.ts'
import { formatDuration, getChannel, progressPercent } from '../data/library.ts'
import { formatLength } from '../data/playlists.ts'
import { routes } from '../routes.ts'
import { Avatar, DurationBadge, ThumbImage } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'

export interface HistoryPageProps {
  query: string
  person?: Person | null
  subject?: Person
  people?: Person[]
}

const WEEK = 7 * 86_400_000
/** Bar scale: a minute watched is this many pixels, so sittings compare at a glance. */
const PX_PER_MIN = 7.2

function asChannel(person: Person) {
  return { id: person.slug, name: person.name, kind: 'person' as const, hue: person.hue, photo: person.photo }
}

function videoCount(n: number) {
  return `${n} video${n === 1 ? '' : 's'}`
}

function historyHref(query = '', personId?: string) {
  let href = routes.history.href()
  let params = new URLSearchParams()
  if (personId) params.set('person', personId)
  if (query) params.set('q', query)
  let qs = params.toString()
  return qs ? `${href}?${qs}` : href
}

function Row(handle: Handle<{ row: SittingRow; subjectId: string; viewerId: string; eager: boolean }>) {
  return () => {
    let { row, subjectId, viewerId, eager } = handle.props
    let { video } = row
    let channel = getChannel(video.channelId)
    let poster = channel?.kind === 'custom' && video.postedBy ? getChannel(video.postedBy) : undefined
    let progress = progressPercent(video, subjectId)

    return (
      <li class="hrow">
        <span class="hrow-thumb">
          <ThumbImage video={video} eager={eager} />
          <DurationBadge seconds={video.durationSec} />
          {progress !== null ? (
            <span class="vcard-progress">
              <span style={`width:${progress.toFixed(1)}%`} />
            </span>
          ) : null}
        </span>
        <span class="hrow-text">
          <a class="hrow-title" href={routes.watch.href({ videoId: video.id })}>
            {video.title}
          </a>
          {channel ? (
            <span class="hrow-channel">
              <Avatar channel={channel} size="sm" />
              <span>
                {channel.name}
                {poster ? ` · posted by ${poster.id === viewerId ? 'you' : poster.name}` : ''}
              </span>
            </span>
          ) : null}
        </span>
        <span class="hrow-status">
          {row.resumeAt === null ? (
            <span class="hrow-done">Finished</span>
          ) : (
            <span class="hrow-resume">
              <Icon name="play" size={14} />
              {row.resumeAt > 0 ? `Resume from ${formatDuration(row.resumeAt)}` : 'Play from start'}
            </span>
          )}
          <span class="hrow-when">{formatClock(row.at)}</span>
        </span>
      </li>
    )
  }
}

function SittingSection(handle: Handle<{ sitting: Sitting; subjectId: string; viewerId: string; eager: boolean; longestSec: number }>) {
  return () => {
    let { sitting, subjectId, viewerId, eager, longestSec } = handle.props
    let barPx = (sitting.watchedSec / 60) * PX_PER_MIN
    // On narrow screens, scale against the longest visible sitting so lengths still compare.
    let barPct = (sitting.watchedSec / Math.max(1, longestSec)) * 100
    let barStyle = `width:max(24px, min(${barPx.toFixed(0)}px, ${barPct.toFixed(2)}%))`

    return (
      <section class="sitting" aria-labelledby={sitting.id}>
        <header class="sitting-head">
          <h2 class="sitting-title" id={sitting.id}>
            {sitting.label}
          </h2>
          <p class="sitting-meta">
            {formatRange(sitting.startedAt, sitting.endedAt)}
            <span aria-hidden="true"> · </span>
            {videoCount(sitting.rows.length)}
            <span aria-hidden="true"> · </span>
            {formatLength(sitting.watchedSec)}
          </p>
        </header>
        <div class="sitting-bar" style={barStyle} aria-hidden="true">
          {sitting.rows.map((row) => (
            <span style={`flex-grow:${Math.max(1, Math.round(row.watchedSec))}`} />
          ))}
        </div>
        <ol class="hrows">
          {sitting.rows.map((row, index) => (
            <Row row={row} subjectId={subjectId} viewerId={viewerId} eager={eager && index < 4} />
          ))}
        </ol>
      </section>
    )
  }
}

function SearchField(handle: Handle<{ query: string; personId?: string; subjectName?: string }>) {
  return () => {
    let { query, personId, subjectName } = handle.props
    let placeholder = subjectName ? `Search ${subjectName}’s history` : 'Search your history'
    return (
      <form class="hfind" role="search" action={routes.history.href()} method="get">
        {personId ? <input type="hidden" name="person" value={personId} /> : null}
        <label class="visually-hidden" for="history-q">
          {placeholder}
        </label>
        <Icon name="search" size={18} />
        <input
          id="history-q"
          class="hfind-input"
          type="search"
          name="q"
          value={query}
          placeholder={placeholder}
          autocomplete="off"
          enterkeyhint="search"
        />
        {query ? (
          <a class="icon-btn hfind-clear" href={historyHref('', personId)} aria-label="Clear search" title="Clear search">
            <Icon name="close" size={18} />
          </a>
        ) : null}
      </form>
    )
  }
}

function PersonSwitcher(handle: Handle<{ viewer: Person; subject: Person; people: Person[]; query: string }>) {
  return () => {
    let { viewer, subject, people, query } = handle.props
    return (
      <nav class="hwho" aria-label="Whose History">
        <a class="hwho-item" href={historyHref(query)} aria-current={subject.id === viewer.id ? 'page' : undefined}>
          <Avatar channel={asChannel(viewer)} size="sm" />
          You
        </a>
        {people.map((entry) => (
          <a
            class="hwho-item"
            href={historyHref(query, entry.id)}
            aria-current={subject.id === entry.id ? 'page' : undefined}
          >
            <Avatar channel={asChannel(entry)} size="sm" />
            {entry.name}
          </a>
        ))}
      </nav>
    )
  }
}

function SignedOut() {
  return () => (
    <section class="empty" aria-labelledby="page-title">
      <Icon name="history" size={40} />
      <h1 id="page-title">Sign in to see your history</h1>
      <p>
        Everyone in the house gets their own history, so you can find what you watched and pick up where you stopped.
        Videos watched without signing in aren’t recorded.
      </p>
      <a class="btn btn-primary" href={routes.signin.index.href()}>
        <Icon name="user" size={20} />
        Sign in
      </a>
    </section>
  )
}

export function HistoryPage(handle: Handle<HistoryPageProps>) {
  return () => {
    let { query, person = null, subject, people } = handle.props

    if (!person) {
      return (
        <AppShell current="history" title="History" person={null}>
          <SignedOut />
        </AppShell>
      )
    }

    let who = subject ?? person
    let viewingOther = who.id !== person.id
    let subjectId = viewingOther ? who.id : undefined
    let switcher = people ? <PersonSwitcher viewer={person} subject={who} people={people} query={query} /> : null
    let all = sittingsFor(who.id)

    if (all.length === 0) {
      return (
        <AppShell current="history" title="History" person={person}>
          <div class="history">
            <header class="page-head">
              <div class="page-head-text">
                <h1 class="page-title">History</h1>
              </div>
              {switcher}
            </header>
            <section class="empty history-empty" aria-labelledby="history-none">
              <Icon name="history" size={40} />
              <h2 id="history-none">Nothing watched yet</h2>
              <p>
                {viewingOther
                  ? `Videos ${who.name} watches while signed in show up here, grouped by when they watched them, with a way back to anything they didn’t finish.`
                  : 'Videos you watch while signed in show up here, grouped by when you watched them, with a way back to anything you didn’t finish.'}
              </p>
              <a class="btn btn-secondary" href={routes.home.href()}>
                Browse videos
              </a>
            </section>
          </div>
        </AppShell>
      )
    }

    let sittings = query ? sittingsFor(who.id, query) : all
    let matched = sittings.reduce((sum, sitting) => sum + sitting.rows.length, 0)
    let longestSec = Math.max(0, ...sittings.map((sitting) => sitting.watchedSec))
    let thisWeek = videosWatchedSince(who.id, Date.now() - WEEK)
    let watchedNote = viewingOther ? `What ${who.name} has watched` : 'What you’ve watched'
    let note = query && matched > 0
      ? `${videoCount(matched)} match “${query}”`
      : thisWeek > 0
        ? `${watchedNote} · ${videoCount(thisWeek)} this week`
        : watchedNote

    return (
      <AppShell current="history" title={query ? `“${query}” in History` : 'History'} person={person}>
        <div class="history">
          <header class="page-head">
            <div class="page-head-text">
              <h1 class="page-title">History</h1>
              <p class="page-note" aria-live="polite">
                {note}
              </p>
            </div>
            {switcher}
            <SearchField query={query} personId={subjectId} subjectName={viewingOther ? who.name : undefined} />
          </header>
          {sittings.length === 0 ? (
            <section class="empty history-empty" aria-labelledby="history-none">
              <Icon name="search" size={40} />
              <h2 id="history-none">
                {viewingOther
                  ? `Nothing in ${who.name}’s history matches “${query}”`
                  : `Nothing in your history matches “${query}”`}
              </h2>
              <p>
                {viewingOther
                  ? `Search looks at the titles and channels of videos ${who.name} has watched. Try a shorter word.`
                  : 'Search looks at the titles and channels of videos you’ve watched. Try a shorter word.'}
              </p>
              <a class="btn btn-secondary" href={historyHref('', subjectId)}>
                Clear search
              </a>
            </section>
          ) : (
            <div class="sittings">
              {sittings.map((sitting, index) => (
                <SittingSection
                  sitting={sitting}
                  subjectId={who.id}
                  viewerId={person.id}
                  eager={index === 0}
                  longestSec={longestSec}
                />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    )
  }
}
