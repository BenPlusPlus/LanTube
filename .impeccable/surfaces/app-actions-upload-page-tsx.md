---
version: 1
slug: "app-actions-upload-page-tsx"
primary_target: "app/actions/upload-page.tsx"
related_targets: ["app/actions/upload/controller.tsx","app/actions/public/upload-form.tsx","app/data/uploads.ts"]
---

# Surface brief: LanTube Upload (/upload)

Scope: one signed-in person publishes one video file from their device to the host. Mode: Operate (the visitor gets a video onto the right channel, titled, with a good poster, seen by the right people).
Audience/job: anyone in the house, signed in, often on a phone or laptop over Wi‑Fi with a large camera file. Unsigned visitors get an honest sign-in prompt.
Per video: file, channel (home or a custom channel they run or may post to), title, poster frame picked from the video in the browser (no ffmpeg), topics, optional playlist of theirs, and who can see it (Everyone in the house / Only me).
Constraints: no transcoding; files the browser can't play are accepted but said plainly; the file never leaves the LAN; nothing fetched from the WAN; works without JavaScript (single multipart post, no poster pick).
Chosen: "Post to" (roll lead, seed 276e08f3), category grammar inside the established LanTube world.

## Direction contract

THESIS: Upload starts with where the video goes, picked by channel avatar, and a live shelf beside the form shows the new card landing first on that channel as you type. It refuses the category's file-dialog-then-details wizard.

OWN-WORLD: Graphite ground, Inter, pill fields, tonal tiles. "Post to" is a row of avatar tiles shaped by kind (circle home, 26% squares for custom channels), the chosen one Raised with a House Blue ring. Transfer progress is a House Blue bar. Poster strip frames sit at their true time in the video (raise: Labanotation, length is duration). A segmented "where it lands" line (Channel · Who can see it · Playlist · Length, tabular) sits above Publish (raise: boarding pass).

STORY: The visitor picks a channel, chooses a file which starts sending to the host at once, picks a frame, types a title, ticks topics, sees the card land on the channel shelf, checks the segmented line, and publishes onto the new watch page.

FIRST VIEWPORT: Page head "Upload a video" + lede. Left 640px column: Post to tiles, file well that becomes preview + transfer bar, frame strip, Title, Topics, Playlist, Who can see it. Right: sticky "On Mia's channel" shelf (new card first, two older dimmed), segmented line, Publish (primary) + Cancel (ghost).

FORM: Post to (destination-led); position 5 of 7 on the ordered list; seed key 276e08f3.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
