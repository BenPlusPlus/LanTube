import type { Handle } from 'remix/component'

import type { Person } from '../data/household.ts'
import type { Channel } from '../data/library.ts'
import { routes } from '../routes.ts'
import { AppShell } from '../ui/shell.tsx'
import { PostVisibilityFieldset, type PostVisibilityValues } from './channel-posts.tsx'

export interface ChannelSettingsPageProps {
  person: Person
  channel: Channel
  values: PostVisibilityValues
}

/** A Home channel's own settings. For now, who can see its Posts. */
export function ChannelSettingsPage(handle: Handle<ChannelSettingsPageProps>) {
  return () => {
    let { person, channel, values } = handle.props
    return (
      <AppShell current="channels" title="Your channel settings" person={person}>
        <section class="chform-page" aria-labelledby="chsettings-title">
          <header class="chform-head">
            <h1 class="page-title" id="chsettings-title">
              Your channel settings
            </h1>
            <p class="page-lede">Choose who in the house can see the posts on your channel. Your videos keep their own visibility.</p>
          </header>

          <form class="chform chsettings" method="post" action={routes.channelSettings.action.href({ channelId: channel.id })}>
            <PostVisibilityFieldset channel={channel} person={person} values={values} />
            <div class="chform-actions">
              <button class="btn btn-primary" type="submit">
                Save
              </button>
              <a class="btn btn-ghost" href={routes.channelPosts.index.href({ channelId: channel.id })}>
                Cancel
              </a>
            </div>
          </form>
        </section>
      </AppShell>
    )
  }
}
