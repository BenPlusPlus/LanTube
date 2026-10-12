---
version: 1
slug: "app-actions-playlists-page-tsx"
primary_target: "app/actions/playlists-page.tsx"
related_targets: ["app/actions/playlist-page.tsx","app/actions/playlist-form-page.tsx","app/actions/watch-page.tsx"]
---

# Surface brief: LanTube playlists (/playlists, /playlist/:id, /playlists/new, /playlist/:id/edit, Save on /watch)

Scope: the playlists directory, a playlist's page, the create/edit playlist form, the watch page's Save-to-playlist popover, and playlist play-through on the watch page (?list=). Mode: Operate (the visitor's task is getting back to their own lists, seeing what the house has been collecting, and playing a list through).
Audience/job: signed-in people make playlists from any video in the house, private or public (house-wide). Unsigned visitors see only public playlists. Only a playlist's owner changes it.
Constraints: no autoplay (play-through is next/previous links, never an automatic jump); no likes, follows, or collaborators; playlists hold videos already in the house; private playlists 404 for everyone but the owner.
Chosen: "Your shelf + house activity" (roll lead, seed 0a6bc9bc), category grammar inside the established LanTube world.

## Direction contract

THESIS: Playlists answers "where are mine?" first and "what has the house been collecting?" second. It refuses the category's undifferentiated grid of everyone's playlists, and refuses silent reordering: a house playlist moves up because someone did something, and the row says what.

OWN-WORLD: Graphite ground, Inter, tonal rows hovering to Surface. Covers are 16:9 thumbs stacked over two slivers cut from the playlist's next videos, a count chip bottom-right. Private carries an Ash lock, never colour. House Blue only for New, focus, and the form's one primary.

STORY: The visitor sees their own playlists, opens one or makes a new one; scans the house feed ("Leo added 2 videos · 3 hours ago") with the added thumbs marked New; opens a playlist, hits Play all, and steps through it on the watch page. From any video, Save adds it to a list.

FIRST VIEWPORT: Page head "Playlists" + Ash count, secondary "New playlist" right. "Yours": up to five-across stacked-cover cards (name, Public/Private, Updated). "From the house": activity rows, 240px cover | owner avatar + what changed + name + meta | three 152px thumbs of what changed.

FORM: Your shelf + house activity; position 5 of 7 on the ordered list; seed key 0a6bc9bc.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
