import type { Handle } from 'remix/component'

import { listPeople, type Person } from '../data/household.ts'
import { formatAdded, getChannel, posterChannel, type Channel } from '../data/library.ts'
import {
  audienceNames,
  canDeletePost,
  canSetPostVisibility,
  canWritePost,
  postLimits,
  POSTS_PAGE,
  postSettings,
  type Post,
  type PostField,
} from '../data/posts.ts'
import { routes } from '../routes.ts'
import { Avatar } from '../ui/cards.tsx'
import { Icon } from '../ui/public/icons.tsx'
import { PostDeleteDismiss } from './public/post-delete-dismiss.tsx'
import { PostLightbox } from './public/post-lightbox.tsx'
import { PostPictures } from './public/post-pictures.tsx'

export type ChannelTab = 'videos' | 'posts'

/** Videos is the channel's address; Posts sits beside it. Only drawn when this viewer can see Posts. */
export function ChannelTabs(handle: Handle<{ channel: Channel; current: ChannelTab }>) {
  return () => {
    let { channel, current } = handle.props
    let tabs: { id: ChannelTab; label: string; href: string }[] = [
      { id: 'videos', label: 'Videos', href: routes.channel.href({ channelId: channel.id }) },
      { id: 'posts', label: 'Posts', href: routes.channelPosts.index.href({ channelId: channel.id }) },
    ]
    return (
      <nav class="chtabs" aria-label={`${channel.name} sections`}>
        <ul>
          {tabs.map((tab) => (
            <li>
              <a class="chtab" href={tab.href} aria-current={tab.id === current ? 'page' : undefined}>
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
}

function asChannel(person: Person): Channel {
  return { id: person.slug, name: person.name, kind: 'person', hue: person.hue, photo: person.photo }
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' })

/** Where people change who sees a channel's Posts. */
export function postSettingsHref(channel: Channel): string {
  return channel.kind === 'custom'
    ? `${routes.channelEdit.index.href({ channelId: channel.id })}#posts-visibility`
    : routes.channelSettings.index.href({ channelId: channel.id })
}

/** One line under the composer, or above the list for readers: who can see these Posts. A fact, not a warning. */
function PostsVisibility(handle: Handle<{ channel: Channel; person: Person | null }>) {
  return () => {
    let { channel, person } = handle.props
    let settings = postSettings(channel.id)
    let manage = canSetPostVisibility(channel, person?.id)
    if (!settings.private && !manage) return null
    let named = audienceNames(channel.id)
    let detail: string
    if (!settings.private) detail = 'Everyone in the house can see posts here.'
    else if (!manage) detail = 'Only some people in the house can see posts here.'
    else {
      let who = [...(channel.kind === 'custom' ? ['The owner', 'Managers'] : ['You']), ...named, 'Parents']
      detail = `${listNames(who)} can see posts here.`
    }
    return (
      <p class="posts-vis">
        <Icon name={settings.private ? 'lock' : 'channels'} size={16} />
        {settings.private ? <strong>Private</strong> : null}
        <span>{detail}</span>
        {manage ? (
          <a class="posts-vis-change" href={postSettingsHref(channel)}>
            Change
          </a>
        ) : null}
      </p>
    )
  }
}

export interface ComposerValues {
  body: string
}

function Composer(
  handle: Handle<{ channel: Channel; person: Person; values?: ComposerValues; error?: string; errorField?: PostField }>,
) {
  return () => {
    let { channel, person, values, error, errorField } = handle.props
    let invalid = (field: PostField) => (error && errorField === field ? 'true' : undefined)
    let errorMessage = error ? (
      <p class="field-error" id="post-error" role="alert">
        {error}
      </p>
    ) : null
    let home = channel.kind === 'person'
    return (
      <form
        class="pcompose"
        method="post"
        action={routes.channelPosts.action.href({ channelId: channel.id })}
        enctype="multipart/form-data"
        aria-label={`Write a post on ${channel.name}`}
      >
        <div class="pcompose-row">
          <Avatar channel={asChannel(person)} size="md" />
          <div class="pcompose-main">
            <label class="visually-hidden" for="post-body">
              Post
            </label>
            <textarea
              id="post-body"
              class="field field-area pcompose-body"
              name="body"
              rows={3}
              maxlength={postLimits.body}
              placeholder={home ? 'Share something with the house' : `Share an update on ${channel.name}`}
              required
              autofocus={errorField === 'body' ? true : undefined}
              aria-invalid={invalid('body')}
              aria-describedby={invalid('body') ? 'post-error' : undefined}
              value={values?.body ?? ''}
            />
            {errorField === 'body' ? errorMessage : null}
            <PostPictures
              max={postLimits.pictures}
              invalid={invalid('pictures')}
              describedBy={invalid('pictures') ? 'post-error post-pictures-hint' : 'post-pictures-hint'}
            />
            {errorField === 'pictures' ? errorMessage : null}
            <div class="pcompose-foot">
              <p class="pcompose-hint" id="post-pictures-hint">
                Up to {postLimits.pictures} pictures, 10 MB each.
              </p>
              <button class="btn btn-primary" type="submit">
                Post
              </button>
            </div>
          </div>
        </div>
      </form>
    )
  }
}

/** Picture tiles. One keeps its own shape within limits; two to four share a fixed frame. */
function PostMosaic(handle: Handle<{ channel: Channel; post: Post; authorName: string }>) {
  return () => {
    let { channel, post, authorName } = handle.props
    let count = post.pictures.length
    if (count === 0) return null
    let single = post.pictures[0]
    let ratio =
      count === 1 && single.width && single.height ? Math.min(Math.max(single.width / single.height, 0.8), 1.91) : undefined
    return (
      <div class={`post-pics post-pics-${count}`} style={ratio ? `--ratio:${ratio.toFixed(4)}` : undefined}>
        {post.pictures.map((picture, index) => {
          let href = routes.postPicture.href({ channelId: channel.id, postId: post.id, n: String(index + 1) })
          return (
            <a class="post-pic" href={href} data-rmx-document>
              <img
                src={href}
                alt={count === 1 ? `Picture from ${authorName}’s post` : `Picture ${index + 1} of ${count} from ${authorName}’s post`}
                width={picture.width}
                height={picture.height}
                loading="lazy"
                decoding="async"
              />
            </a>
          )
        })}
      </div>
    )
  }
}

function PostDelete(handle: Handle<{ channel: Channel; post: Post; error?: string }>) {
  return () => {
    let { channel, post, error } = handle.props
    let errorId = `post-${post.id}-delete-error`
    let titleId = `post-${post.id}-delete-title`
    return (
      <details class="post-delete" name="post-delete" open={error ? true : undefined}>
        <summary class="post-delete-toggle" title="Delete post">
          <Icon name="trash" size={18} />
          <span class="visually-hidden">Delete post</span>
        </summary>
        <form
          class="post-delete-form"
          method="post"
          action={routes.channelPostDelete.href({ channelId: channel.id, postId: post.id })}
          aria-labelledby={titleId}
        >
          <p class="post-delete-title" id={titleId}>
            Delete this post?
          </p>
          <p class="post-delete-hint">
            {post.pictures.length ? 'It can’t be brought back, and its pictures leave the Media share.' : 'It can’t be brought back.'}
          </p>
          <label class="chform-remove">
            <input
              type="checkbox"
              name="confirm"
              value="1"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <span class="check" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            Yes, delete this post
          </label>
          {error ? (
            <p class="field-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          <button class="btn btn-secondary" type="submit">
            <Icon name="trash" size={18} />
            Delete post
          </button>
        </form>
      </details>
    )
  }
}

function PostEntry(handle: Handle<{ channel: Channel; post: Post; person: Person | null; deleteError?: string }>) {
  return () => {
    let { channel, post, person, deleteError } = handle.props
    let author = posterChannel(post.authorId)
    let authorName = author?.name ?? 'Someone who left'
    let created = new Date(post.createdAt)
    let relative = formatAdded(Math.max(0, (Date.now() - post.createdAt) / 86_400_000))
    let titleId = `post-${post.id}-by`
    let authorHref = author && getChannel(author.id) ? routes.channel.href({ channelId: author.id }) : undefined
    return (
      <article class="post" id={`post-${post.id}`} aria-labelledby={titleId}>
        <header class="post-head">
          {author ? <Avatar channel={author} size="md" /> : <span class="avatar avatar-md avatar-blank" aria-hidden="true" />}
          <p class="post-by" id={titleId}>
            {authorHref ? (
              <a class="post-author" href={authorHref}>
                {authorName}
              </a>
            ) : (
              <span class="post-author">{authorName}</span>
            )}
            <span class="visually-hidden">, </span>
            <time class="post-time" datetime={created.toISOString()} title={fullDate.format(created)}>
              {relative}
            </time>
          </p>
          {canDeletePost(post, channel, person?.id) ? <PostDelete channel={channel} post={post} error={deleteError} /> : null}
        </header>
        <p class="post-body">{post.body}</p>
        <PostMosaic channel={channel} post={post} authorName={authorName} />
      </article>
    )
  }
}

export interface PostsPanelProps {
  channel: Channel
  person: Person | null
  posts: Post[]
  shown: number
  values?: ComposerValues
  error?: string
  errorField?: PostField
  /** A delete that came back unconfirmed. */
  deleteError?: { postId: string; error: string }
}

export function PostsPanel(handle: Handle<PostsPanelProps>) {
  return () => {
    let { channel, person, posts, shown, values, error, errorField, deleteError } = handle.props
    let writer = person && canWritePost(channel, person.id) ? person : null
    let visible = posts.slice(0, shown)
    let more = posts.length > visible.length
    let names = (
      channel.kind === 'custom' ? [channel.ownerId, ...(channel.managerIds ?? [])] : [channel.id]
    )
      .map((id) => (id ? getChannel(id)?.name : undefined))
      .filter((name): name is string => !!name)

    return (
      <section class="posts" aria-labelledby="channel-posts">
        <h2 class="visually-hidden" id="channel-posts">
          Posts
        </h2>
        {writer ? <Composer channel={channel} person={writer} values={values} error={error} errorField={errorField} /> : null}
        <PostsVisibility channel={channel} person={person} />

        {posts.length === 0 ? (
          writer ? (
            <p class="posts-none">Nothing posted yet. Posts show here, newest first.</p>
          ) : (
            <div class="empty empty-posts">
              <Icon name="notebook" size={40} />
              <h3>No posts on {channel.name} yet</h3>
              <p>When {listNames(names)} {names.length > 1 ? 'post' : 'posts'} something, it will show up here.</p>
            </div>
          )
        ) : (
          <ol class="post-list">
            {visible.map((post) => (
              <li>
                <PostEntry
                  channel={channel}
                  post={post}
                  person={person}
                  deleteError={deleteError?.postId === post.id ? deleteError.error : undefined}
                />
              </li>
            ))}
          </ol>
        )}
        {posts.length > 0 && person ? <PostDeleteDismiss /> : null}
        {visible.some((post) => post.pictures.length > 0) ? <PostLightbox /> : null}
        {more ? (
          <a class="btn btn-secondary posts-more" href={`${routes.channelPosts.index.href({ channelId: channel.id })}?n=${shown + POSTS_PAGE}`}>
            Show older posts
          </a>
        ) : null}
      </section>
    )
  }
}

export interface PostVisibilityValues {
  postsPrivate: boolean
  postsAudience: string[]
}

/** "Who can see posts" for a whole channel: the Custom channel edit form and the Home channel's settings. */
export function PostVisibilityFieldset(
  handle: Handle<{ channel: Channel; person: Person; values: PostVisibilityValues; people?: Person[] }>,
) {
  return () => {
    let { channel, person, values } = handle.props
    let people = handle.props.people ?? listPeople()
    let home = channel.kind === 'person'
    let ownerId = home ? person.id : channel.ownerId
    let owner = ownerId ? people.find((entry) => entry.id === ownerId) : undefined
    let ownerIsViewer = ownerId === person.id
    let managers = home ? [] : (channel.managerIds ?? [])
    let others = people.filter((other) => other.id !== ownerId && !managers.includes(other.id))
    let always = home
      ? 'You and Parents always see them. Pick anyone else in the house.'
      : `${ownerIsViewer ? 'You' : (owner?.name ?? 'The owner')}, Managers, and Parents always see them. Pick anyone else in the house.`

    return (
      <fieldset class="chform-posters upload-who posts-who" id="posts-visibility">
        <legend class="field-label">Who can see posts</legend>
        <p class="field-hint">This applies to every post on {home ? 'your channel' : channel.name}, old and new.</p>
        <div class="pvis-options">
          <label class="poster pvis-option">
            <input class="poster-input" type="radio" name="postsVisibility" value="house" checked={!values.postsPrivate} />
            <Icon name="channels" size={20} />
            <span class="pvis-option-text">
              <span class="poster-name">Everyone in the house</span>
              <span class="poster-role">Anyone who opens the channel</span>
            </span>
            <span class="radio" aria-hidden="true" />
          </label>
          <label class="poster pvis-option">
            <input class="poster-input" type="radio" name="postsVisibility" value="private" checked={values.postsPrivate} />
            <Icon name="lock" size={20} />
            <span class="pvis-option-text">
              <span class="poster-name">Private</span>
              <span class="poster-role">You choose who else can see them</span>
            </span>
            <span class="radio" aria-hidden="true" />
          </label>
        </div>
        <div class="audience-picker">
          <p class="field-hint">{always}</p>
          <ul class="poster-list">
            {owner ? (
              <li>
                <span class="poster poster-owner">
                  <Avatar channel={asChannel(owner)} size="md" />
                  <span class="poster-name">{owner.name}</span>
                  <span class="poster-role">{ownerIsViewer ? 'You · owner' : 'Owner'}</span>
                </span>
              </li>
            ) : null}
            {others.map((other) => (
              <li>
                <label class="poster">
                  <input class="poster-input" type="checkbox" name="postsAudience" value={other.id} checked={values.postsAudience.includes(other.id)} />
                  <Avatar channel={asChannel(other)} size="md" />
                  <span class="poster-name">{other.name}</span>
                  <span class="check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {others.length === 0 ? <p class="field-hint">Nobody else to add yet.</p> : null}
        </div>
      </fieldset>
    )
  }
}

/** Reads the fieldset above from a submitted form. */
export function readPostVisibility(formData: FormData): PostVisibilityValues {
  return {
    postsPrivate: formData.get('postsVisibility') === 'private',
    postsAudience: formData.getAll('postsAudience').filter((value): value is string => typeof value === 'string'),
  }
}

export function currentPostVisibility(channel: Channel): PostVisibilityValues {
  let settings = postSettings(channel.id)
  return { postsPrivate: settings.private, postsAudience: settings.audience }
}
