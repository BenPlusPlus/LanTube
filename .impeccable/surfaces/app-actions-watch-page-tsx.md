---
version: 1
slug: "app-actions-watch-page-tsx"
primary_target: "app/actions/watch-page.tsx"
related_targets: ["app/actions/public/player.tsx"]
---

# Surface brief: LanTube watch page (/watch/:videoId)

Scope: the watch page, where every thumbnail in the house lands. Mode: Operate (the visitor's task is watching one video, then picking the next).
Audience/job: anyone in the house on phone, laptop, tablet or TV. Watch with zero friction, resume where they left off, see when it was published and how much the house has played it, move to a similarly tagged video.
Constraints: real files streamed from a host folder (LANTUBE_MEDIA_DIR) with HTTP range support; no transcoding (browser-unsupported formats get an honest error); no comments, likes, or recommendation model; related = shared tags, then same channel, then newest.
Chosen: category standard, pinned by PRODUCT.md brand commitment (no concept roll). Benchmark craft = YouTube, Rumble watch pages.

## Direction contract

THESIS: A watch page anyone who has used YouTube or Rumble operates without thinking: player, title, channel, facts, related rail. It refuses YouTube's red chrome and refuses social furniture the house does not have (likes, subscribe, comments).

OWN-WORLD: Graphite ground, black stage, House Blue only for the seek progress, focus, and the single primary action (the big play/resume button in House Blue Ink with a white play glyph echoing the logo doorway). Inter, tabular numerals for every time and count. Filled play/pause, Lucide outline for the rest.

STORY: The visitor lands, sees the poster and a blue Resume (or Play) button, presses it, watches with familiar controls and keyboard shortcuts, reads who posted it, when, how many plays, which topics, and picks the next video from "More like this".

FIRST VIEWPORT: No persistent nav rail (drawer from the menu button). Left column: 16:9 player at 12px radius, then title (Title scale), channel row (40px avatar, name, video count), a Graphite Surface facts box (plays, published date, topic chips). Right column 400px: compact related cards. Theater mode moves the player to a full-width black band above both columns. Below 1000px the rail drops under the facts. Primary action = play.

FORM: Category standard (canon), pinned by PRODUCT.md; position n/a; seed key: none (pinned direction, roll skipped).

Signature move: resume-first stage plus key-flash feedback; a returning viewer sees their blue progress already on the seek bar and "Resume from 9:20" with a quiet "Start over".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
