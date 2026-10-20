import type { Handle, RemixNode } from 'remix/component'

import type { ChannelSort } from '../data/library.ts'
import { VIDEO_FEED_PAGE } from '../data/video-feed.ts'
import { routes } from '../routes.ts'

export function FeedBatch(
  handle: Handle<{ nextHref?: string | null; moreHref?: string | null; list?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { nextHref, moreHref, list, children } = handle.props
    return list ? (
      <ol class="feed-batch" data-next={nextHref ?? ''} data-more={moreHref ?? ''}>
        {children}
      </ol>
    ) : (
      <div class="feed-batch" data-next={nextHref ?? ''} data-more={moreHref ?? ''}>
        {children}
      </div>
    )
  }
}

export function homeEarlierHrefs(shown: number) {
  return {
    nextHref: `${routes.homeEarlier.href()}?from=${shown}`,
    moreHref: `${routes.home.href()}?earlier=${shown + VIDEO_FEED_PAGE}`,
  }
}

export function channelFeedHrefs(channelId: string, sort: ChannelSort, shown: number) {
  let next = new URLSearchParams({ from: String(shown) })
  let more = new URLSearchParams({ n: String(shown + VIDEO_FEED_PAGE) })
  if (sort !== 'latest') {
    next.set('sort', sort)
    more.set('sort', sort)
  }
  return {
    nextHref: `${routes.channelVideos.href({ channelId })}?${next}`,
    moreHref: `${routes.channel.href({ channelId })}?${more}`,
  }
}

export function playlistFeedHrefs(playlistId: string, shown: number) {
  return {
    nextHref: `${routes.playlistVideos.href({ playlistId })}?from=${shown}`,
    moreHref: `${routes.playlist.href({ playlistId })}?n=${shown + VIDEO_FEED_PAGE}`,
  }
}
