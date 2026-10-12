---
version: 1
slug: "app-actions-channels-page-tsx"
primary_target: "app/actions/channels-page.tsx"
related_targets: ["app/actions/channel-page.tsx","app/actions/channel-form-page.tsx"]
---

# Surface brief: LanTube channels (/channels, /channel/:id, /channels/new, /channel/:id/edit)

Scope: the channel directory, a single channel's page, and the create/edit channel form. Mode: Operate (the visitor's task is finding a channel and what's new on it, or starting one).
Audience/job: anyone in the house browses; signed-in people start channels. Every person has a home channel named after them. People can also run custom channels with their own names ("Twice", "Skillet", "Video Games"). Each custom channel has one owner, who picks other people allowed to post. Indexed folders are channels too.
Constraints: sidebar "In this house" stays people-only (custom channels live in the directory); upload isn't built, so posting rights are recorded but not yet exercised; no subscribe, likes, or comments; no banners (no banner assets exist).
Chosen: category standard (YouTube/Rumble channel list + channel page), pinned by PRODUCT.md brand commitment (no concept roll).

## Direction contract

THESIS: A channel directory and channel page anyone who has used YouTube operates without thinking, which answers "what's new where?" rather than only "who exists?". It refuses subscriber furniture and refuses to make custom channels look like people.

OWN-WORLD: Graphite ground, tonal rows (hover to Surface), Inter, House Blue only for "n new", focus, and the form's one primary. People are circles; custom channels are rounded squares in their hue; folders keep the folder glyph. Paper-filled checks, never blue.

STORY: The visitor scans People, More channels, and Folders, sees each channel's three newest thumbnails and who runs it, opens one, sorts its videos, and if signed in starts a channel and picks who can post.

FIRST VIEWPORT: Directory: Headline "Channels" + count, secondary "New channel" at right; section rows of 88px avatar, name, Ash meta (videos, updated, n new), runner/posters line, then a 3-thumbnail peek at the row's right on wide containers. Channel page: 120px avatar, 2rem name, meta, runner + posters avatars, description, owner's "Edit channel"; sticky Latest/Most played/Oldest chips; video grid.

FORM: Category standard (canon), pinned by PRODUCT.md; position n/a; seed key: none (pinned direction, roll skipped).

Signature move: the peek row, where each directory row carries its three newest thumbnails as direct watch links, so the directory doubles as a "what's new per channel" view.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
