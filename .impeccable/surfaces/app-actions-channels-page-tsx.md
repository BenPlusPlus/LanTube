---
version: 1
slug: "app-actions-channels-page-tsx"
primary_target: "app/actions/channels-page.tsx"
related_targets: ["app/actions/channel-page.tsx","app/actions/channel-form-page.tsx","app/actions/channel-posts.tsx","app/actions/channel-settings-page.tsx"]
---

# Surface brief: LanTube channels (/channels, /channel/:id, /channel/:id/posts, /channel/:id/settings, /channels/new, /channel/:id/edit)

Scope: the channel directory, a single channel's page (Videos and Posts tabs), the Home channel's post settings, and the create/edit channel form. Mode: Operate (the visitor's task is finding a channel and what's new on it, reading its posts, or running one).
Audience/job: anyone in the house browses; signed-in people start channels. Every person has a home channel named after them. People can also run custom channels with their own names ("Twice", "Skillet", "Video Games"). Each custom channel has one owner, who names Managers. Indexed folders are channels too. Home and Custom channels carry Posts: short text notes with up to 4 pictures, written by the owner or Managers, deletable but not editable, visible per channel (house or Private with an Audience).
Constraints: sidebar "In this house" stays people-only (custom channels live in the directory); posts appear only on their channel page (not Home, search, or new-dots); no subscribe, likes, or comments on videos or posts; no banners (no banner assets exist). Folder and Frozen channels have no tabs. A private Posts tab does not exist for someone outside its Audience.
Chosen: category standard (YouTube/Rumble channel list + channel page + community posts), pinned by PRODUCT.md brand commitment (no concept roll).

## Direction contract

THESIS: A channel directory and channel page anyone who has used YouTube operates without thinking, which answers "what's new where?" rather than only "who exists?". Posts read like a quiet household notebook, not a social feed. It refuses subscriber furniture, reaction counts, and making custom channels look like people.

OWN-WORLD: Graphite ground, tonal rows (hover to Surface), Inter, House Blue only for "n new", focus, and the form's one primary (Post, on the Posts tab). People are circles; custom channels are rounded squares in their hue; folders keep the folder glyph. Paper-filled checks, never blue. Private is an Ash lock and the word, a fact not a warning.

STORY: The visitor scans People, More channels, and Folders, sees each channel's three newest thumbnails and who runs it, opens one, sorts its videos or switches to Posts and reads newest first; owners and Managers write a post with pictures, delete one with a tick-to-confirm, and set who can see posts once for the whole channel.

FIRST VIEWPORT: Directory: Headline "Channels" + count, secondary "New channel" at right; section rows of 88px avatar, name, Ash meta (videos, updated, n new), runner/posters line, then a 3-thumbnail peek at the row's right on wide containers. Channel page: 120px avatar, 2rem name, meta, runner + posters avatars, description, owner's "Edit channel"; an underline tab bar (Videos | Posts) under the header; Videos keeps sticky Latest/Most played/Oldest chips and the grid; Posts is a single 680px reading column: composer (textarea, picture well, primary Post) for those who can post, the visibility fact, then posts as hairline-separated entries (author avatar, name, relative time, pre-wrapped text, 1-4 picture mosaic).

FORM: Category standard (canon), pinned by PRODUCT.md; position n/a; seed key: none (pinned direction, roll skipped).

Signature move: the peek row, where each directory row carries its three newest thumbnails as direct watch links, so the directory doubles as a "what's new per channel" view.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
