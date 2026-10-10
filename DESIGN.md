---
name: LanTube
description: A private, LAN-only video site for one household, built to category-standard video-site conventions.
colors:
  graphite-ground: "#0f1012"
  graphite-surface: "#17181b"
  graphite-raised: "#222428"
  graphite-raised-hover: "#2d2f34"
  graphite-line: "#26282c"
  field-well: "#121316"
  field-line-hover: "#33363b"
  paper-text: "#f1f1f1"
  ash-text: "#a0a3a9"
  house-blue: "#3d8bff"
  house-blue-ink: "#2b72e0"
  house-blue-ink-hover: "#2466cc"
  house-blue-soft: "#8cbcff"
  on-chip: "#0f1012"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  card-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'cv11', 'ss01'"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
  who-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  who-lede:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.45
  who-name:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  badge: "4px"
  duration: "5px"
  chip: "8px"
  nav: "10px"
  card: "12px"
  pill: "999px"
  circle: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  topbar: "56px"
  rail-mini: "72px"
  rail-full: "240px"
components:
  button-primary:
    backgroundColor: "{colors.house-blue-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.house-blue-ink-hover}"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.graphite-raised-hover}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.circle}"
    size: "40px"
  icon-button-hover:
    backgroundColor: "{colors.graphite-raised}"
  search-input:
    backgroundColor: "{colors.field-well}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 20px"
    height: "40px"
  chip:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "32px"
  chip-hover:
    backgroundColor: "{colors.graphite-raised-hover}"
  chip-active:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.on-chip}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.nav}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.graphite-raised}"
  video-thumb:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.card}"
  duration-badge:
    backgroundColor: "rgb(0 0 0 / 0.78)"
    textColor: "#ffffff"
    rounded: "{rounded.duration}"
    padding: "2px 5px"
    typography: "{typography.caption}"
  badge-new:
    textColor: "{colors.house-blue-soft}"
    rounded: "{rounded.badge}"
    padding: "1px 6px"
    typography: "{typography.caption}"
  avatar-md:
    rounded: "{rounded.circle}"
    size: "36px"
  avatar-card:
    rounded: "{rounded.circle}"
    size: "56px"
  channel-card:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "20px 12px 18px"
  channel-card-hover:
    backgroundColor: "{colors.graphite-raised}"
  signin-btn:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 12px"
    height: "40px"
  account-btn:
    backgroundColor: "transparent"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 4px"
    height: "40px"
  account-btn-hover:
    backgroundColor: "{colors.graphite-raised}"
  account-menu:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "8px"
    width: "240px"
  who-card:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
  who-card-open:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.card}"
  who-new:
    backgroundColor: "transparent"
    rounded: "{rounded.card}"
  field:
    backgroundColor: "{colors.field-well}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
---

# Design System: LanTube

## Overview

**Creative North Star: "The House Channel"**

LanTube looks like the video site everyone in the house already knows how to use, because that is the point. A sticky top bar with a centred pill search, a left navigation that collapses from full sidebar to mini rail to drawer, topic chips, and a dense grid of 16:9 thumbnails: the category-standard grammar, executed at the craft level of YouTube and Rumble. Novelty lives nowhere in the layout. What makes it LanTube is the material: a graphite dark ground, quiet tonal surfaces, one household blue, and a house-with-a-play-doorway mark.

The system is content-first and calm. Thumbnails carry all the colour on screen; chrome is neutral graphite so family footage reads as the brightest thing in the room. The single blue accent is rare by design: it marks where you left off (progress), where you are (focus, active nav icon), what is new, and the one primary action. Everything else is graphite, off-white, or ash grey.

The product is household-only and never needs the public internet, so the design ships its own assets: Inter is self-hosted, icons are inline SVG (Lucide paths, ISC licence), avatars are hue-tinted initials or an optional local photo stored on the host, never fetched from the WAN. LanTube must not look like YouTube's brand: no red, no red-on-white or red-on-black identity.

**Key Characteristics:**
- Category-standard video-site layout; trust through familiarity, not novelty.
- Dark-only graphite palette with tonal layering instead of shadows.
- One accent (house blue), used sparingly and functionally.
- Inter as the single family; weight, not size jumps, carries hierarchy.
- Soft 12px thumbnails, pill buttons, 8px chips, circular avatars tinted per person (initials, or a local photo).
- Fully local assets: fonts, icons, and imagery never come from the WAN.
- Honest states: empty and not-yet-built screens say plainly what is missing.

## Colors

A near-black graphite ramp with off-white text and a single cool blue; the thumbnails provide the colour.

### Primary
- **House Blue** (`house-blue`): the accent. Watch-progress bars, focus outlines, the active nav item's icon, the new-video dot in navigation, the "All channels" style text links, the logo house, and text selection (at 45% mix). Never a fill behind white text.
- **House Blue Ink** (`house-blue-ink`): the deeper blue used as a fill for the primary button and skip link, so white label text meets contrast. Hovers to **House Blue Ink Deep** (`house-blue-ink-hover`).
- **House Blue Soft** (`house-blue-soft`): light blue text for "New" badges and "n new" counts, sitting on an 18% House Blue tint.

### Neutral
- **Graphite Ground** (`graphite-ground`): page background, top bar, sticky chip row. Also the dark text on active chips (`on-chip`).
- **Graphite Surface** (`graphite-surface`): one step up; channel cards, who cards, the account popover, and the mobile navigation drawer.
- **Graphite Raised** (`graphite-raised`): interactive fills at rest (chips, secondary buttons, search button), hover fill for nav items, icon buttons and the account control, active nav row, open who-cards, and the placeholder colour behind loading thumbnails.
- **Graphite Raised Hover** (`graphite-raised-hover`): hover state for raised fills; also the scrollbar thumb.
- **Graphite Line** (`graphite-line`): 1px dividers between nav groups and field outlines (search, password, join).
- **Field Well** (`field-well`) and **Field Line Hover** (`field-line-hover`): recessed search and password/join fields, the search hover border, and the dashed outline on the join card and photo well.
- **Paper** (`paper-text`): primary text, titles, and the active chip fill.
- **Ash** (`ash-text`): secondary text: channel bylines, relative times, counts, folder paths, empty-state body copy, placeholder text.

Avatar colours are not tokens: each person has a hue, rendered as `hsl(hue 42% 30%)` fill with `hsl(hue 70% 88%)` initial.

### Named Rules
**The One Accent Rule.** House Blue appears only for progress, focus, the active nav icon, new-indicators, and the primary action. If a new element wants blue and is none of those, it gets graphite instead.

**The Ink Rule.** White text never sits on House Blue (#3d8bff). Any blue fill that carries white text uses House Blue Ink (#2b72e0), hovering to #2466cc.

**The No-Red Rule.** No red brand colour, anywhere in the chrome. LanTube shares YouTube's grammar, not its identity.

## Typography

**Display Font:** Inter (variable, 100–900, self-hosted woff2), falling back to ui-sans-serif, system-ui, Segoe UI, Roboto
**Body Font:** Inter
**Label/Mono Font:** Inter, with tabular numerals for durations, counts and times

**Character:** One neutral, highly legible family tuned with `cv11` and `ss01` (single-storey a, open digits). Hierarchy comes from weight (400 / 500 / 600 / 700) and tight negative tracking on headings, over a compact rem scale (12 / 13 / 14 / 16 / 20 / 24px).

### Hierarchy
- **Who Title** (700, 2.25rem, 1.15, −0.025em): "Who's using LanTube?" on the sign-in route. Steps to 1.75rem at ≤900px and to Headline (1.5rem) at ≤639px.
- **Headline** (700, 1.5rem, 1.25, −0.02em): empty-state and placeholder page headings only.
- **Brand** (700, 1.1875rem, −0.025em): the "LanTube" wordmark beside the mark.
- **Title** (700, 1.25rem, 1.25, −0.015em, balanced wrap): shelf headings ("Continue watching", "Latest in the house").
- **Who Name** (600, 1.375rem, 1.2): person names on who cards.
- **Who Lede** (400, 1.125rem, 1.45): the Ash intro under the who title.
- **Card Title** (600, 1rem, 1.375): video titles, clamped to two lines; channel-card names; nav group headings.
- **Body** (400, 0.875rem, 1.45): the base size; nav labels, bylines, relative times, chip and button labels (chips 500, buttons 600). Empty-state paragraphs step up to 1rem and cap at 44ch. Account names in the header are Body at 600.
- **Label** (500, 0.8125rem): channel-card subtitles and counts. Password and join field labels use the same size at 600 Ash.
- **Caption** (600, 0.75rem, 1.35, tabular): duration badges, "New" badges, "Watched", folder paths, host note (folder paths and host note at 400). The mini rail uses 0.625rem labels under icons.

### Named Rules
**The Tabular Numbers Rule.** Any number that changes or lines up (durations, counts, "15 min left", "2 days ago") uses `font-variant-numeric: tabular-nums`.

## Layout

The shell is a sticky 56px top bar over a fixed left navigation and a scrolling content column. The top bar is a three-column grid: menu button + logo, centred search (max 600px), Upload and household identity on the right (Sign in when unsigned; name + Avatar when signed in).

Navigation adapts in three steps:
- **≥ 1312px:** full 240px sidebar: primary nav (Home, Channels, Playlists, History), then "In this house" people with initial avatars and a blue new-dot, then "Folders" with their paths, then a host note ("Streaming from <host> on your home network"). The menu button hides.
- **792–1311px:** 72px mini rail; primary nav only, icon stacked over a 0.625rem label, 74px tall targets. Full nav lives in the drawer.
- **< 792px:** no rail; the menu button opens a 300px (max 86vw) popover drawer on Graphite Surface with a 55% black backdrop.
- **< 640px:** the top bar becomes two rows (56px + 52px, total 108px): logo and icon-only Upload plus Sign in or account on top, full-width search below. Gutter drops from 24px to 16px and shelf spacing from 40px to 28px.

Content is a size container. Video shelves use container queries, not viewport media queries, to pick columns: 1 column below 540px, 2 at 540px, 3 at 880px, 4 at 1120px, 5 at 1760px. Grid gaps are 16px horizontal, 40px vertical (28px on phones).

The topic chip row is sticky directly under the top bar, scrolls sideways with hidden scrollbars, and sits on Graphite Ground so content slides under it cleanly.

Home shelves, in order:
1. **Continue watching**: one row that scrolls sideways with scroll-snap; on narrow containers each card is 84% wide and bleeds to the screen edge so the next card peeks.
2. **Latest in the house**: a wrapping grid.
3. **Channels in this house**: a sideways-scrolling strip of channel cards (min 150px; 136px on narrow containers), with an "All channels" link.
4. **Earlier**: rendered only when the overflow fills at least one row (four or more videos); otherwise those videos stay in Latest.

Search and topic results replace the shelves with one titled grid and a count.

The sign-in route hides the sidebar (`--rail-w: 0`) and uses a 3-column who-grid that collapses to 2 at 900px and 1 at 639px.

## Elevation & Depth

LanTube is flat. Depth comes from tonal steps on the graphite ramp (Ground → Surface → Raised → Raised Hover), never from drop shadows. The only overlays are functional: the 78% black duration badge on thumbnails, the 28% white track under progress bars, the 55% black backdrop behind the mobile drawer, and the account popover sitting on Graphite Surface. The sticky top bar and chip row stay on Graphite Ground with no border or shadow; content simply passes beneath.

### Named Rules
**The Tonal Step Rule.** To lift something, move it one step up the graphite ramp. Do not add a box-shadow.

## Shapes

Soft, friendly geometry. Thumbnails, channel cards, who cards, and the account popover round to 12px; chips to 8px; nav rows and account-menu rows to 10px; small badges to 4–5px. Every button, the search field, password/join fields, and inline text links are full pills; icon buttons and avatars are circles. Borders are rare: 1px Graphite Line on fields, 1px dividers between nav groups, and a dashed Field Line Hover outline on the join card and photo well. The open who-card uses a 2px House Blue outline (offset 0); the current-page Sign in control uses the same 2px ring at offset 2px. Icons are Lucide outlines drawn at 24px with a 1.75 stroke, round caps and joins (16–20px in dense spots, 40px in empty states).

The logo mark is a rounded house in House Blue whose doorway is a white play triangle, shown at 28px beside the wordmark.

## Components

### Buttons
Confident pills; a single primary per view.
- **Shape:** full pill, 40px tall, 18px side padding, 600 weight, 8px gap to a 20px icon.
- **Primary:** House Blue Ink fill with white text (Upload, "Upload a video"). Hover deepens to House Blue Ink Deep.
- **Secondary:** Graphite Raised fill with Paper text ("Show all videos", "Back to home"); hover to Raised Hover.
- **Icon button:** 40px transparent circle; Raised fill on hover.
- **Hover / Focus / Active:** background transitions in 150ms on the standard ease; focus is a 2px House Blue outline offset 2px; press scales to 0.97.
- **Upload on phones:** collapses to a 40px icon-only pill with a visually hidden label.
- **Header Sign in:** secondary pill with a 20px user icon and "Sign in" label, padding 12px left / 16px right. On the sign-in route it is the current page and keeps a 2px House Blue outline offset 2px. On ≤639px it collapses to a 40px icon-only pill, same as Upload.
- **Account button:** transparent 40px pill; 24px Avatar + name (600, truncated to 12ch). Hover fills Graphite Raised. Opens a 240px Graphite Surface popover (12px radius) with "Signed in as", Your channel, and Sign out. On ≤639px it is 40px icon-only (avatar only).

### Chips
- **Style:** 32px tall, 8px radius, Graphite Raised fill, Paper text at 500, 12px gaps.
- **State:** hover to Raised Hover. Active ("All" by default) inverts to a Paper fill with Graphite Ground text, not blue.

### Cards / Containers
**Video card** (the signature component):
- 16:9 thumbnail, 12px radius, Graphite Raised placeholder behind the image; image scales to 1.03 on hover over 240ms (off on touch and reduced motion).
- Duration badge bottom-right (78% black, white tabular caption, 5px radius); it lifts 4px when a progress bar is present.
- Progress bar: 4px House Blue on a 28% white track along the thumbnail's bottom edge.
- Meta row: 36px circular initial avatar (hue per person, folder icon for indexed folders), then a two-line-clamped card title, the channel name in Ash, and a relative time ("19 hours ago", or "15 min left" on Continue watching), with an optional "New" badge (House Blue Soft on an 18% House Blue tint) or an Ash "Watched" note.
- The whole card is one click target: the title link stretches over the card; the avatar and channel name sit above it as their own links. Keyboard focus on the title outlines the thumbnail.

**Channel card:** Graphite Surface, 12px radius, centred 88px initial avatar (72px on narrow containers), name, Ash "n videos" (plus "· folder"), and a House Blue Soft "n new" when relevant. Hover to Graphite Raised.

**Who card** (household identity on the sign-in route):
- Graphite Surface, 12px radius, min 168px tall. Hover to Graphite Raised.
- Open: Graphite Raised with a 2px House Blue outline (offset 0). Hue-tinted 56px initials (or local photo), name at 1.375rem/600, Ash video count. The password field and House Blue Ink Sign in sit on the same card.
- **Join card:** transparent ground, dashed Field Line Hover (#33363b) outline. Open expands in its grid cell (not full-row) with name, password, confirm, optional photo well, and "Create my channel".

### Inputs / Fields
- **Search:** a pill split in two: a recessed Field Well input with a 1px Graphite Line border and Ash placeholder ("Search the house"), joined to a 64px Graphite Raised search button.
- **Password / join fields:** 44px pills, Field Well fill, 1px Graphite Line, 18px side padding. Labels are 0.8125rem/600 Ash. Invalid uses Paper, not red. The optional photo well is a 44px dashed pill.
- **Hover:** border lightens to Field Line Hover.
- **Focus:** border turns House Blue with a 1px inset House Blue ring (no outer outline).

### Navigation
- **Rows:** 40px min height, 10px radius, 20px icon-to-label gap, 14px Paper text. Hover fills Graphite Raised.
- **Active:** Graphite Raised fill, 600 weight, and the icon turns House Blue. On the mini rail the active row has no fill until hovered.
- **People:** 24px initial avatars; a 6px House Blue dot marks people with new videos (with a hidden "n new" for screen readers).
- **Folders:** folder icon, name, and the path in 12px Ash, ellipsised.
- **Drawer:** slides in from the left over 220ms on the standard ease, with a sticky head holding close and logo.
- **Account menu:** 240px Graphite Surface popover, 12px radius, 8px padding. "Signed in as" in Ash; rows are 40px, 10px radius, 500 weight; hover Graphite Raised. Sign out is a row with a logout icon, not a destructive red.

### Empty and placeholder states
Centred, max 480px, 12vh from the top: a 40px Ash outline icon, a Headline, an Ash paragraph capped at 44ch, and one button. The copy says plainly what is missing and what to do ("No videos in the house yet", "Nothing in the house matches…"). Unbuilt routes use the same frame with "Back to home".

## Do's and Don'ts

### Do:
- **Do** keep House Blue to progress, focus, active nav icon, new-indicators, and the single primary action.
- **Do** use House Blue Ink (#2b72e0, hover #2466cc) for any blue fill carrying white text.
- **Do** show the active chip as a Paper fill with dark text.
- **Do** build every video tile from the video card: 16:9 thumb at 12px radius, duration badge, accent progress bar, 36px hue-tinted initial avatar, two-line title, channel, relative time, optional "New".
- **Do** make the whole video card one click target through the title link overlay.
- **Do** pick grid columns with container queries on the content area (1 to 5 columns).
- **Do** convey depth by stepping up the graphite ramp.
- **Do** time transitions between 120ms and 240ms on cubic-bezier(0.2, 0, 0, 1), and honour prefers-reduced-motion.
- **Do** self-host every font, icon, and image; nothing on the watch path may require the WAN.
- **Do** write honest empty and placeholder states that name what is missing.
- **Do** put household identity in the header: a secondary Sign in when unsigned; name + Avatar opening Your channel and Sign out when signed in.

### Don't:
- **Don't** use red, or any red-on-white or red-on-black brand look.
- **Don't** put white text on House Blue (#3d8bff).
- **Don't** introduce a second accent colour or use blue for decoration.
- **Don't** add drop shadows to cards, bars, or chips.
- **Don't** ship a light theme yet; LanTube is dark-only for now.
- **Don't** invent a second household-identity pattern: unsigned visitors get a header Sign in; signed-in visitors get name + Avatar with an account popover (Your channel, Sign out).
- **Don't** render an "Earlier" shelf with less than one full row of videos.
- **Don't** load fonts, icons, or avatars from a CDN or external service.
- **Don't** invent novelty layouts where the video-site convention already answers the question.
