import * as os from 'node:os'
import type { Handle, RemixNode } from 'remix/component'

import { channels, channelStats } from '../data/library.ts'
import { routes } from '../routes.ts'
import { Document } from '../actions/document.tsx'
import { Avatar } from './cards.tsx'
import { Icon, LogoMark, type IconName } from './icons.tsx'

export type Section = 'home' | 'channels' | 'playlists' | 'history' | 'upload' | `channel:${string}` | null

const hostName = os.hostname()

const primaryNav: { section: Section; label: string; icon: IconName; href: string }[] = [
  { section: 'home', label: 'Home', icon: 'home', href: routes.home.href() },
  { section: 'channels', label: 'Channels', icon: 'channels', href: routes.channels.href() },
  { section: 'playlists', label: 'Playlists', icon: 'playlists', href: routes.playlists.href() },
  { section: 'history', label: 'History', icon: 'history', href: routes.history.href() },
]

function NavLinks(handle: Handle<{ current: Section; idPrefix: string }>) {
  return () => {
    let { current, idPrefix } = handle.props
    let people = channels.filter((channel) => channel.kind === 'person')
    let folders = channels.filter((channel) => channel.kind === 'folder')

    return (
      <>
        <ul class="nav-list nav-primary">
          {primaryNav.map((item) => (
            <li>
              <a class="nav-item" href={item.href} aria-current={current === item.section ? 'page' : undefined}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <section class="nav-group" aria-labelledby={`${idPrefix}-people`}>
          <h2 class="nav-heading" id={`${idPrefix}-people`}>
            In this house
          </h2>
          <ul class="nav-list">
            {people.map((channel) => {
              let fresh = channelStats(channel.id).newCount
              return (
                <li>
                  <a
                    class="nav-item"
                    href={routes.channel.href({ channelId: channel.id })}
                    aria-current={current === `channel:${channel.id}` ? 'page' : undefined}
                  >
                    <Avatar channel={channel} size="sm" />
                    <span>{channel.name}</span>
                    {fresh > 0 ? (
                      <span class="nav-dot" title={`${fresh} new`}>
                        <span class="visually-hidden">, {fresh} new</span>
                      </span>
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
        <section class="nav-group" aria-labelledby={`${idPrefix}-folders`}>
          <h2 class="nav-heading" id={`${idPrefix}-folders`}>
            Folders
          </h2>
          <ul class="nav-list">
            {folders.map((channel) => (
              <li>
                <a
                  class="nav-item"
                  href={routes.channel.href({ channelId: channel.id })}
                  aria-current={current === `channel:${channel.id}` ? 'page' : undefined}
                >
                  <Icon name="folder" />
                  <span class="nav-item-stack">
                    <span>{channel.name}</span>
                    <span class="nav-path">{channel.path}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <p class="nav-host">
          <Icon name="network" size={16} />
          <span>
            Streaming from <strong>{hostName}</strong> on your home network
          </span>
        </p>
      </>
    )
  }
}

export interface AppShellProps {
  title?: string
  current: Section
  query?: string
  children?: RemixNode
}

export function AppShell(handle: Handle<AppShellProps>) {
  return () => {
    let { title, current, query = '', children } = handle.props

    return (
      <Document title={title ? `${title} · LanTube` : 'LanTube'}>
        <a class="skip-link" href="#main">
          Skip to videos
        </a>
        <header class="topbar">
          <div class="topbar-start">
            <button class="icon-btn menu-btn" type="button" popovertarget="nav-drawer" aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <a class="brand" href={routes.home.href()} aria-label="LanTube home">
              <LogoMark />
              <span class="brand-name">LanTube</span>
            </a>
          </div>
          <form class="search" role="search" action={routes.home.href()} method="get">
            <label class="visually-hidden" for="search-q">
              Search videos and channels
            </label>
            <input
              id="search-q"
              class="search-input"
              type="search"
              name="q"
              value={query}
              placeholder="Search the house"
              autocomplete="off"
              enterkeyhint="search"
            />
            <button class="search-btn" type="submit" aria-label="Search">
              <Icon name="search" size={20} />
            </button>
          </form>
          <div class="topbar-end">
            <a class="btn btn-primary upload-btn" href={routes.upload.href()}>
              <Icon name="upload" size={20} />
              <span class="upload-label">Upload</span>
            </a>
          </div>
        </header>

        <nav class="sidebar" aria-label="Main">
          <NavLinks current={current} idPrefix="side" />
        </nav>

        <div class="drawer" id="nav-drawer" popover="auto">
          <div class="drawer-head">
            <button
              class="icon-btn"
              type="button"
              popovertarget="nav-drawer"
              popovertargetaction="hide"
              aria-label="Close navigation"
            >
              <Icon name="close" />
            </button>
            <a class="brand" href={routes.home.href()} aria-label="LanTube home">
              <LogoMark />
              <span class="brand-name">LanTube</span>
            </a>
          </div>
          <nav aria-label="Main (drawer)">
            <NavLinks current={current} idPrefix="drawer" />
          </nav>
        </div>

        <main class="content" id="main" tabindex={-1}>
          {children}
        </main>
      </Document>
    )
  }
}
