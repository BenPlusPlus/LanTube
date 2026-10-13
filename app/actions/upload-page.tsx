import type { Handle } from 'remix/component'

import { getPerson, type Person } from '../data/household.ts'
import { channelsFor, channelVideos, formatAdded, formatPlays, getChannel, thumbUrl, type Channel } from '../data/library.ts'
import { videoExtensions } from '../data/media.ts'
import { playlistsOwnedBy } from '../data/playlists.ts'
import { destinationsFor, uploadLimits, type UploadField } from '../data/uploads.ts'
import { routes } from '../routes.ts'
import { Icon } from '../ui/public/icons.tsx'
import { AppShell } from '../ui/shell.tsx'
import { UploadForm, type UploadDestination, type UploadFormValues } from './public/upload-form.tsx'

export interface UploadPageProps {
  person: Person
  values: UploadFormValues
  staged?: { id: string; name: string; size: number }
  error?: string
  errorField?: UploadField
}

/** What an unsigned visitor sees on /upload. */
export function SignInToUpload() {
  return () => (
    <AppShell current="upload" title="Upload a video" person={null}>
      <section class="empty" aria-labelledby="page-title">
        <Icon name="upload" size={40} />
        <h1 id="page-title">Sign in to upload</h1>
        <p>Videos go up on someone’s channel. Sign in, and you can send one to the host for the whole house.</p>
        <a class="btn btn-secondary" href={routes.signin.index.href()}>
          <Icon name="user" size={20} />
          Sign in
        </a>
      </section>
    </AppShell>
  )
}

function roleFor(channel: Channel, person: Person, runs: Set<string>): string {
  if (channel.id === person.slug) return 'Your channel'
  if (runs.has(channel.id)) return 'You run it'
  let owner = channel.ownerId ? getPerson(channel.ownerId) : undefined
  return owner ? `${owner.name}’s` : 'You post here'
}

function destinationOf(channel: Channel, person: Person, runs: Set<string>): UploadDestination {
  return {
    id: channel.id,
    name: channel.name,
    kind: channel.kind,
    hue: channel.hue,
    photo: channel.photo,
    role: roleFor(channel, person, runs),
    home: channel.id === person.slug,
    recent: channelVideos(channel.id, 'latest', person.id)
      .slice(0, 2)
      .map((video) => ({
        title: video.title,
        thumb: thumbUrl(video),
        durationSec: video.durationSec,
        meta: `${formatPlays(video.plays)} · ${formatAdded(video.addedDaysAgo)}`,
        byline: channel.kind === 'custom' && video.postedBy ? getChannel(video.postedBy)?.name : undefined,
      })),
  }
}

/** Where a fresh upload page points: the channel asked for, if they can post there, else their own. */
export function defaultUploadValues(person: Person, requested: string | null): UploadFormValues {
  let channels = destinationsFor(person.id)
  let channelId = channels.find((channel) => channel.id === requested)?.id ?? channels[0]?.id ?? person.slug
  return { channelId, title: '', tags: [], playlistId: '', visibility: 'house', uploadId: '', durationSec: 0 }
}

const typesLabel = videoExtensions.map((ext) => (ext === '.webm' ? 'WebM' : ext.slice(1).toUpperCase())).join(', ')

export function UploadPage(handle: Handle<UploadPageProps>) {
  return () => {
    let { person, values, staged, error, errorField } = handle.props
    let runs = new Set(channelsFor(person.id).runs.map((channel) => channel.id))
    let destinations = destinationsFor(person.id).map((channel) => destinationOf(channel, person, runs))
    let cancel = values.channelId === person.slug ? routes.home.href() : routes.channel.href({ channelId: values.channelId })

    return (
      <AppShell current="upload" title="Upload a video" person={person}>
        <section class="upload-page" aria-labelledby="upload-title-head">
          <header class="upload-head">
            <h1 class="page-title" id="upload-title-head">
              Upload a video
            </h1>
            <p class="page-lede">It goes to the host and plays for everyone you let see it. Nothing leaves the house.</p>
          </header>
          <UploadForm
            action={routes.upload.action.href()}
            fileAction={routes.uploadFile.href()}
            stagedBase={`${routes.uploadFile.href()}/`}
            cancelHref={cancel}
            personName={person.name}
            destinations={destinations}
            playlists={playlistsOwnedBy(person.id).map((playlist) => ({
              id: playlist.id,
              name: playlist.name,
              private: playlist.visibility === 'private',
            }))}
            values={values}
            staged={staged}
            error={error}
            errorField={errorField}
            titleMax={uploadLimits.title}
            accept={videoExtensions.join(',')}
            typesLabel={typesLabel}
          />
        </section>
      </AppShell>
    )
  }
}
