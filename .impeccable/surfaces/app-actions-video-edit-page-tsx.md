---
version: 1
slug: "app-actions-video-edit-page-tsx"
primary_target: "app/actions/video-edit-page.tsx"
related_targets: ["app/actions/watch-page.tsx","app/actions/public/video-edit-preview.tsx","app/actions/public/player.tsx"]
---

# Surface brief: LanTube edit video (/watch/:videoId/edit)

Scope: the edit view for one Video, reached from the "Edit" pill on its watch page. Mode: Operate (the visitor's task is changing a Video's properties, then going back to watch it).
Audience/job: a Video owner, a Custom channel's owner or Managers (uploaded Videos), or an Admin (indexed Folder Videos). They rename, re-tag, attach or replace subtitles, and change who can see a Video. They also delete an upload or drop a Folder Video. Low frequency, deliberate.
Constraints: one form, one primary (Save changes), ghost Cancel back to watch. Save returns to the watch page. Indexed Folder Videos keep inline tagging on the watch page for every signed-in Person, and only an Admin gets this view. Visibility controls exist only for uploads. Playback is available but secondary.
Chosen: established-world form page (channel/playlist/upload form grammar), no concept roll.

## Direction contract

THESIS: Editing is its own room. The watch page goes back to watching, and this page is a form with the video kept in view as a reference, not as the stage. It refuses the inline-edit-on-the-player arrangement.

OWN-WORLD: Graphite ground, Field Well pills, label-over-field rows, Paper-checked pickers, the pldelete foot. House Blue only on focus, the primary Save, and the player's progress. Inter, tabular numerals.

STORY: The owner presses Edit, sees the form beside a small player and a preview of the watch page's title block. Typing the title, adding topics, or flipping privacy updates the preview live. They press Save changes and land back on the watch page.

FIRST VIEWPORT: Page head (Page Title "Edit video" plus Ash lede). Left: the 640px form (Title, Tags, Subtitles, Who can see it, actions). Right: a sticky aside up to 480px, holding the compact player (no theater, shortcuts only while focused) over the live watch-info preview. Below 1100px, the aside drops under the form.

FORM: Category standard form page; position n/a; seed key: none (established world, narrow request).

Signature move: the live watch-info preview under the player follows each keystroke and toggle before you save.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
