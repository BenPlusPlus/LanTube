---
version: 1
slug: "app-actions-controls-page-tsx"
primary_target: "app/actions/controls/page.tsx"
related_targets: ["app/actions/controls/controller.tsx","app/data/watch-limits.ts","app/actions/public/player.tsx"]
---

# Surface brief: LanTube Parental controls (/controls)

Scope: a Parent sets a daily watch limit per limited person and grants extra time for today only. Mode: Operate (the Parent answers "how much can each kid watch, and can I give them a bit more now").
Audience/job: Parents only. Admin-only people get an honest forbidden state. People who are Parents or Admins are never limited and are named in a footnote.
Constraints: preset limits only (No limit, 5, 10, 15, 20, 30, 45 min, 1, 1.5, 2, 3 hr); extensions +5/+10/+20/+30/+60 accumulate per person per day; Clear removes today's extra time; the day resets at 5 am host local time; used time is real forward play summed from History sessions; the player stops when time runs out; every form works without JS.
Chosen: "One roster" (user pick, seed 65cd73a9), category grammar inside the established LanTube world.

## Direction contract

THESIS: One roster answers the whole job in a single scan: each limited person is one row reading today's time left, their everyday limit, and today's extra time, with Extend at the row's end. It refuses the settings-page pattern of a separate page or modal per child.

OWN-WORLD: Graphite Surface table, Inter, 1px Rule dividers, no red anywhere. Today column leads with "18 min left" in Paper, an Ash "22 of 40 min" under it and a 4px House Blue meter on a Raised track; when time is up the meter fills Ash and the label reads "Time's up". Extend is a secondary pill opening a Raised menu shaped like the player's speed menu.

STORY: The Parent opens the page, reads who has time left, changes a limit with the row's select, or opens Extend and picks +10; the row's extra time and time left update after the redirect. Clear undoes today's extra time.

FIRST VIEWPORT: Page head "Parental controls" + lede "How long each person can watch each day. Extra time lasts until 5 am." Then the roster table: Person (36px avatar, name), Today (left/used/meter), Daily limit (select pill), Extra today (+N min, Clear), Extend. Footnote names the unlimited Parents and Admins. Phones restack each row as a card-less block.

FORM: One roster; position 1 of 7 on the ordered list; seed key 65cd73a9.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
