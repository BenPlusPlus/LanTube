---
version: 1
slug: "app-actions-history-page-tsx"
primary_target: "app/actions/history-page.tsx"
related_targets: ["app/data/history.ts"]
---

# Surface brief: LanTube History (/history)

Scope: a signed-in person's watch history, grouped by sitting; searchable. Mode: Operate (the visitor finds a video they watched, by memory of when or what, and picks up anything unfinished).
Audience/job: anyone in the house, signed in. History and watch progress are per person; an unsigned visitor watches unrecorded and sees an honest sign-in prompt here.
Constraints: search is the only control (no remove, clear, pause, or filter yet); no invented social data; times are the host's local time; the watch path stays LAN-only.
Chosen: "Sittings" (roll lead, seed 1115db9d), category grammar inside the established LanTube world.

## Direction contract

THESIS: History is grouped by the sittings people remember ("Last night", "Saturday morning"), not by calendar day, and every unfinished row says where to pick up. It refuses the category's flat newest-first list of identical rows with day headers.

OWN-WORLD: Graphite ground, Inter, tonal rows hovering to Surface. Each sitting heading carries a House Blue bar whose segments are exactly the minutes watched per video, in the order watched (raise: Labanotation, length is duration). One fixed status column on every row: Ash "Finished", or a Raised "Resume from m:ss" pill, with the watch time under it (raise: gate board).

STORY: The visitor sees their last sitting first, recognises the evening by its time range and bar, scans the status column for what's unfinished, and clicks a row to resume. Searching narrows every sitting to matching rows.

FIRST VIEWPORT: Page head "History" + Ash note ("What you've watched · 14 videos this week"), a 360px search field right. Sittings stacked newest-first: Title-size heading + Ash tabular range/count/length, the segmented bar, then 168px-thumb rows (title, channel, status column), chronological within a sitting.

FORM: Sittings; position 3 of 7 on the ordered list; seed key 1115db9d.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
