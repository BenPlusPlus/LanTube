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
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
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
  mini: "6px"
  chip: "8px"
  nav: "10px"
  card: "12px"
  pill: "999px"
  circle: "50%"
  channel: "26%"
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
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.graphite-raised}"
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
  avatar-xl:
    rounded: "{rounded.circle}"
    size: "120px"
  avatar-channel:
    rounded: "{rounded.channel}"
  avatar-blank:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.channel}"
  badge-new-solid:
    backgroundColor: "{colors.house-blue-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.badge}"
    padding: "1px 6px"
    typography: "{typography.caption}"
  channel-row:
    backgroundColor: "transparent"
    rounded: "{rounded.card}"
    padding: "16px"
  channel-row-hover:
    backgroundColor: "{colors.graphite-surface}"
  peek-thumb:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.chip}"
    width: "152px"
  lineage-chip:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 4px"
    height: "32px"
  lineage-chip-hover:
    backgroundColor: "{colors.graphite-raised-hover}"
  path-chip:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.mini}"
    padding: "2px 8px"
  field-area:
    backgroundColor: "{colors.field-well}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.card}"
    padding: "12px 18px"
  poster-row:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "10px 14px 10px 12px"
  poster-row-checked:
    backgroundColor: "{colors.graphite-raised}"
  check:
    backgroundColor: "transparent"
    rounded: "{rounded.mini}"
    size: "22px"
  check-checked:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.on-chip}"
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
  player:
    backgroundColor: "#000000"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
  player-big:
    backgroundColor: "{colors.house-blue-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.circle}"
    size: "72px"
  player-big-hover:
    backgroundColor: "{colors.house-blue-ink-hover}"
  player-button:
    backgroundColor: "transparent"
    textColor: "#ffffff"
    rounded: "8px"
    size: "40px"
  player-menu:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.card}"
    padding: "6px 0"
  watch-facts:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "12px 16px 14px"
  related-thumb:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.chip}"
    width: "168px"
  playlist-cover:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.card}"
  playlist-cover-sliver:
    backgroundColor: "#1c1d20"
    rounded: "10px 10px 0 0"
    height: "24px"
  playlist-cover-count:
    backgroundColor: "rgb(0 0 0 / 0.78)"
    textColor: "#ffffff"
    rounded: "{rounded.duration}"
    padding: "2px 6px 2px 5px"
    typography: "{typography.caption}"
  playlist-panel:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  playlist-entry:
    backgroundColor: "transparent"
    rounded: "{rounded.card}"
    padding: "8px 12px 8px 4px"
  playlist-entry-hover:
    backgroundColor: "{colors.graphite-surface}"
  playlist-entry-thumb:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.chip}"
    width: "168px"
  radio:
    backgroundColor: "transparent"
    rounded: "{rounded.circle}"
    size: "22px"
  radio-checked:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.on-chip}"
  save-menu:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.card}"
    padding: "8px"
    width: "296px"
  watch-list:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
  watch-list-item:
    backgroundColor: "transparent"
    rounded: "{rounded.chip}"
    padding: "6px 8px 6px 2px"
  watch-list-item-current:
    backgroundColor: "{colors.graphite-raised}"
  history-search:
    backgroundColor: "{colors.field-well}"
    rounded: "{rounded.pill}"
    height: "40px"
    width: "360px"
  sitting-bar:
    backgroundColor: "{colors.house-blue}"
    rounded: "{rounded.pill}"
    height: "4px"
  history-row:
    backgroundColor: "transparent"
    rounded: "{rounded.card}"
    padding: "8px 12px"
  history-row-hover:
    backgroundColor: "{colors.graphite-surface}"
  history-row-thumb:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.chip}"
    width: "168px"
  history-resume:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px 0 12px"
  button-sm:
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  field-select:
    backgroundColor: "{colors.field-well}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.pill}"
    padding: "0 48px 0 18px"
    height: "44px"
  upload-to-tile:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.card}"
    padding: "14px 8px 12px"
    width: "112px"
  upload-to-tile-selected:
    backgroundColor: "{colors.graphite-raised}"
  upload-well:
    backgroundColor: "transparent"
    textColor: "{colors.ash-text}"
    rounded: "{rounded.card}"
    padding: "32px 24px 28px"
  upload-well-hover:
    backgroundColor: "{colors.graphite-surface}"
  upload-preview:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.card}"
    width: "300px"
  upload-bar:
    backgroundColor: "{colors.house-blue}"
    rounded: "2px"
    height: "4px"
  upload-frame:
    backgroundColor: "{colors.graphite-raised}"
    rounded: "{rounded.mini}"
  upload-pass:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.card}"
    padding: "10px 16px"
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
- Soft 12px thumbnails, pill buttons, 8px chips, circular avatars tinted per person (initials, or a local photo); channels people start are rounded squares, folders keep the folder glyph.
- Fully local assets: fonts, icons, and imagery never come from the WAN.
- Honest states: empty and not-yet-built screens say plainly what is missing.

## Colors

A near-black graphite ramp with off-white text and a single cool blue; the thumbnails provide the colour.

### Primary
- **House Blue** (`house-blue`): the accent. Watch-progress bars (and History's sitting bar, which is watch time, and Upload's transfer bar, which is progress), focus outlines, the 2px ring on the chosen Post to tile, the active nav item's icon, the new-video dot in navigation, the "All channels" style text links, the logo house, and text selection (at 45% mix). Never a fill behind white text.
- **House Blue Ink** (`house-blue-ink`): the deeper blue used as a fill for the primary button and skip link, so white label text meets contrast. Hovers to **House Blue Ink Deep** (`house-blue-ink-hover`). Also the solid fill of the "New" badge laid over a peek thumbnail, where the tinted badge would vanish into the picture.
- **House Blue Soft** (`house-blue-soft`): light blue text for "New" badges and "n new" counts, sitting on an 18% House Blue tint.

### Neutral
- **Graphite Ground** (`graphite-ground`): page background, top bar, sticky chip row. Also the dark text on active chips (`on-chip`).
- **Graphite Surface** (`graphite-surface`): one step up; channel cards, who cards, the account popover, and the mobile navigation drawer. Also the hover fill of channel directory rows, the resting fill of poster-picker rows and Post to tiles, and the cells of Upload's summary pass.
- **Graphite Raised** (`graphite-raised`): interactive fills at rest (chips, secondary buttons, search button), hover fill for nav items, icon buttons, ghost buttons and the account control, active nav row, open who-cards, and the placeholder colour behind loading thumbnails. Also lineage chips, path chips, checked and owner poster rows, and the blank avatar tile shown before a new channel has a name. Also the chosen Post to tile, the transfer and scrubber tracks, empty poster-frame slots, and the plain tile an uploaded video shows when it has no poster.
- **Graphite Raised Hover** (`graphite-raised-hover`): hover state for raised fills; also the scrollbar thumb.
- **Graphite Line** (`graphite-line`): 1px dividers between nav groups and field outlines (search, password, join).
- **Field Well** (`field-well`) and **Field Line Hover** (`field-line-hover`): recessed search and password/join fields, the search hover border, and the dashed outline on the join card, photo well and Upload's file well.
- **Paper** (`paper-text`): primary text, titles, the active chip fill (and chosen topic chips on Upload), the fill of a checked checkbox (with an `on-chip` check), the 2px outline on the chosen poster frame, and the scrubber thumb. Upload's failure lines are Paper at 500, not red.
- **Ash** (`ash-text`): secondary text: channel bylines, relative times, counts, folder paths, empty-state body copy, placeholder text.

Avatar colours are not tokens: each person has a hue, rendered as `hsl(hue 42% 30%)` fill with `hsl(hue 70% 88%)` initial. Custom channels get the same treatment from their own hue (a new channel's hue is derived from its name, and kept once saved).

### Named Rules
**The One Accent Rule.** House Blue appears only for progress, focus, the active nav icon, new-indicators, and the primary action. If a new element wants blue and is none of those, it gets graphite instead. Selection controls follow the active chip, not the accent: checkboxes fill with Paper and a dark check, never blue. The one kind of choice that rings blue is a destination picked by avatar (the open who-card, the chosen Post to tile), because it says where you are going.

**The Ink Rule.** White text never sits on House Blue (#3d8bff). Any blue fill that carries white text uses House Blue Ink (#2b72e0), hovering to #2466cc.

**The No-Red Rule.** No red brand colour, anywhere in the chrome. LanTube shares YouTube's grammar, not its identity.

## Typography

**Display Font:** Inter (variable, 100–900, self-hosted woff2), falling back to ui-sans-serif, system-ui, Segoe UI, Roboto
**Body Font:** Inter
**Label/Mono Font:** Inter, with tabular numerals for durations, counts and times. A system monospace stack (`ui-monospace, Cascadia Mono, Consolas, monospace`) appears only for real filesystem paths and code.

**Character:** One neutral, highly legible family tuned with `cv11` and `ss01` (single-storey a, open digits). Hierarchy comes from weight (400 / 500 / 600 / 700) and tight negative tracking on headings, over a compact rem scale (12 / 13 / 14 / 16 / 20 / 24px), with a small set of display steps above it (26 / 28 / 32 / 36px) for page titles, channel names and the who title.

### Hierarchy
- **Who Title** (700, 2.25rem, 1.15, −0.025em): "Who's using LanTube?" on the sign-in route. Steps to 1.75rem at ≤900px and to Headline (1.5rem) at ≤639px.
- **Page Title** (700, 2rem, 1.15, −0.025em, balanced wrap): the h1 of directory and form pages ("Channels", "New channel", "Edit Twice"), steps to 1.625rem below a 540px container. The channel page's name uses the same style, stepping to 1.75rem below a 720px container and 1.5rem below 540px. A Page Title is followed by either a **page note** (Body 1rem, Ash, tabular: "9 channels in the house") or a **page lede** (1rem/1.5, Ash, capped at 56ch, pretty wrap) that says what the page is for.
- **Headline** (700, 1.5rem, 1.25, −0.02em): empty-state and placeholder page headings only.
- **Brand** (700, 1.1875rem, −0.025em): the "LanTube" wordmark beside the mark.
- **Title** (700, 1.25rem, 1.25, −0.015em, balanced wrap): shelf headings ("Continue watching", "Latest in the house").
- **Who Name** (600, 1.375rem, 1.2): person names on who cards.
- **Who Lede** (400, 1.125rem, 1.45): the Ash intro under the who title.
- **Card Title** (600, 1rem, 1.375): video titles, clamped to two lines; channel-card names; nav group headings.
- **Body** (400, 0.875rem, 1.45): the base size; nav labels, bylines, relative times, chip and button labels (chips 500, buttons 600). Empty-state paragraphs step up to 1rem and cap at 44ch. Account names in the header are Body at 600.
- **Label** (500, 0.8125rem): channel-card subtitles and counts. Password and join field labels use the same size at 600 Ash.
- **Caption** (600, 0.75rem, 1.35, tabular): duration badges, "New" badges, "Watched", folder paths, host note (folder paths and host note at 400). The mini rail uses 0.625rem labels under icons.
- **Avatar initial** (600, scaled to the avatar): 0.75rem at 24px, 0.875rem at 36px, 1.375rem at 56px, 2.25rem at 88px, 3rem at 120px (2.25rem and 1.625rem as the xl avatar shrinks to 88px and 64px).

### Named Rules
**The Tabular Numbers Rule.** Any number that changes or lines up (durations, counts, "15 min left", "2 days ago") uses `font-variant-numeric: tabular-nums`.

**The Real Path Rule.** Monospace is reserved for things that are literally paths or code: a folder's location ("/media/Home Movies"), a missing file's name. It is never a stylistic voice for labels, metadata or numbers.

## Layout

The shell is a sticky 56px top bar over a fixed left navigation and a scrolling content column. The top bar is a three-column grid: menu button + logo, centred search (max 600px), Upload and household identity on the right (Sign in when unsigned; name + Avatar when signed in).

Navigation adapts in three steps:
- **≥ 1312px:** full 240px sidebar: primary nav (Home, Channels, Playlists, History), then "In this house" people with initial avatars and a blue new-dot, then "Folders" with their paths, then a host note ("Streaming from <host> on your home network"). The menu button hides.
- **792–1311px:** 72px mini rail; primary nav only, icon stacked over a 0.625rem label, 74px tall targets. Full nav lives in the drawer.
- **< 792px:** no rail; the menu button opens a 300px (max 86vw) popover drawer on Graphite Surface with a 55% black backdrop.
- **< 640px:** the top bar becomes two rows (56px + 52px, total 108px): logo and icon-only Upload plus Sign in or account on top, full-width search below. Gutter drops from 24px to 16px and shelf spacing from 40px to 28px.

Content is a size container. Video shelves use container queries, not viewport media queries, to pick columns: 1 column below 540px, 2 at 540px, 3 at 880px, 4 at 1120px, 5 at 1760px. Grid gaps are 16px horizontal, 40px vertical (28px on phones).

The topic chip row is sticky directly under the top bar, scrolls sideways with hidden scrollbars, and sits on Graphite Ground so content slides under it cleanly. After All, Tags in use appear in a fresh random order on each visit.

Home shelves, in order:
1. **Continue watching**: one row that scrolls sideways with scroll-snap; on narrow containers each card is 84% wide and bleeds to the screen edge so the next card peeks.
2. **Latest in the house**: a wrapping grid.
3. **Channels in this house**: a sideways-scrolling strip of channel cards (min 150px; 136px on narrow containers), with an "All channels" link.
4. **Earlier**: rendered only when the overflow fills at least one row (four or more videos); otherwise those videos stay in Latest. The first Home paint leaves this shelf empty except for “Show earlier videos”; scrolling to it (or following that link) loads about two rows at a time, up to 48 videos. Older videos stay on channels and in search.

Search and topic results replace the shelves with one titled grid and a count.

The sign-in route hides the sidebar (`--rail-w: 0`) and uses a 3-column who-grid that collapses to 2 at 900px and 1 at 639px.

The watch route (`layout-watch`) also hides the rail at every width; the menu button stays visible (even at ≥1312px) and opens the drawer. The page is a two-column grid: a fluid main column (player, then title, channel row, facts box) and a related rail of `clamp(320px, 28%, 402px)`, with a 24px gap. The grid's max-width keeps a 16:9 player inside the viewport height (capped at 1720px, never below 960px). **Theater** (`lt_theater=1` cookie, toggled with `t`) moves the player into a full-bleed black band above both columns, as tall as `min(56.25% of width, viewport − top bar − 160px)` with a 360px floor. Below a 1000px content width the page is one column (player, info, then "More like this" as an auto-fill grid of 380px compact cards) and theater is unavailable. Below 540px compact cards stack thumb-over-text. On phones (<640px) the player bleeds to the screen edges with square corners.

Directory-style pages open with a **page head**: Page Title plus a page note on the left, the page's one action (a secondary button) on the right, bottom-aligned, wrapping under the title when space runs out (28px above, 20px below; 20px above below a 540px container).

The **channels directory** (`/channels`) is a page head over three titled sections in the shelf style (title + Ash note): **People** (everyone's home channel), **More channels** (custom channels, newest activity first), and **Folders** (only when some exist). Each section is a vertical list of peek rows (see Components) with 4px between rows; the list bleeds 16px into the gutter (12px below 540px) so row hover fills align their text with the page head. When no custom channel exists, More channels shows a dashed-outline (1px Field Line Hover, 12px radius) note with a secondary "New channel" instead of rows. Custom channels live here and on their own pages only; the sidebar's "In this house" stays people-only, and the Channels nav item is the current one on a custom channel's page.

The **channel page** (`/channel/:id`) is a header grid (xl avatar | text | owner actions; 32px above, 28px below, 28px column gap) over the sort chips (Latest / Most played / Oldest, only with two or more videos) and a standard video grid that first paints about two rows and loads more as the viewer scrolls (or follows “Show more videos”). Below a 720px container the actions drop to their own full-width row; below 540px the lineage groups stack. No banners: there are no banner assets, and the header carries the identity. The playlist page lists entries the same way: about two rows first, then more on scroll.

The **channel form** (`/channels/new`, `/channel/:id/edit`) is a single 640px column: Page Title + page lede, then label-over-field rows (Name, Description, Picture, Who can post), and an actions row 32px below the last field (primary submit, ghost Cancel, 12px apart).

The **upload page** (`/upload`) is a page head ("Upload a video" + page lede: "It goes to the host and plays for everyone you let see it. Nothing leaves the house.") over a two-column grid: the form in a 640px column and a sticky live-shelf aside up to 560px, 48px apart, the aside sticking 24px under the top bar. Below a 1100px container the aside drops under the form (40px gap) and stops sticking. Below 540px the head pads 20px above, Post to becomes one sideways-scrolling row, the chosen-file card stacks, and the frame strip and summary pass go to two rows.

## Elevation & Depth

LanTube is flat. Depth comes from tonal steps on the graphite ramp (Ground → Surface → Raised → Raised Hover), never from drop shadows. The only overlays are functional: the 78% black duration badge on thumbnails, the 28% white track under progress bars, the 55% black backdrop behind the mobile drawer, the account popover sitting on Graphite Surface, and the player's bottom scrim (72% black fading to transparent) that keeps controls legible over any frame. The sticky top bar and chip row stay on Graphite Ground with no border or shadow; content simply passes beneath.

### Named Rules
**The Tonal Step Rule.** To lift something, move it one step up the graphite ramp. Do not add a box-shadow.

## Shapes

Soft, friendly geometry. Thumbnails, channel cards, who cards, and the account popover round to 12px; chips to 8px; nav rows and account-menu rows to 10px; small badges to 4–5px. Every button, the search field, password/join fields, and inline text links are full pills; icon buttons and person avatars are circles. A multiline field gives up the pill for the 12px card radius, because a pill cannot hold paragraphs; path chips and checkboxes use a tighter 6px. Borders are rare: 1px Graphite Line on fields, 1px dividers between nav groups, and a dashed Field Line Hover outline on the join card, the photo well, Upload's file well, and the empty "More channels" note. A photo well that holds a chosen file turns its dashed outline solid. The open who-card uses a 2px House Blue outline (offset 0); the current-page Sign in control uses the same 2px ring at offset 2px; the chosen Post to tile draws it as a 2px box-shadow ring hugging the tile (a ring, not a shadow). Poster frames round to 6px and the chosen one takes a 2px Paper outline, offset 1px. Icons are Lucide outlines drawn at 24px with a 1.75 stroke, round caps and joins (16–20px in dense spots, 40px in empty states).

The logo mark is a rounded house in House Blue whose doorway is a white play triangle, shown at 28px beside the wordmark.

### Named Rules
**The Shape Is Kind Rule.** An avatar's silhouette says what kind of channel it is, at every size: a person's home channel is a circle; a custom channel that people started ("Twice", "Video Games") is a rounded square (26% radius, so it scales with the avatar); an indexed folder keeps the circle with a folder glyph instead of an initial. Never draw a custom channel as a circle or a person as a square.

## Components

### Buttons
Confident pills; a single primary per view.
- **Shape:** full pill, 40px tall, 18px side padding, 600 weight, 8px gap to a 20px icon.
- **Primary:** House Blue Ink fill with white text (Upload, "Upload a video"). Hover deepens to House Blue Ink Deep.
- **Secondary:** Graphite Raised fill with Paper text ("Show all videos", "Back to home"); hover to Raised Hover.
- **Ghost:** transparent with Paper text, Raised fill on hover. The quiet way out of a form ("Cancel"), always beside the primary, never alone.
- **One primary per view:** a page's standing actions ("New channel", "Edit channel") are secondary; the primary is kept for the act that completes the task ("Create channel", "Save changes", "Upload a video").
- **Icon button:** 40px transparent circle; Raised fill on hover.
- **Small:** `.btn-sm`, 36px tall with 14px side padding, for actions tucked inside a card ("Try again", "Choose another file" on Upload's chosen-file card).
- **Hover / Focus / Active:** background transitions in 150ms on the standard ease; focus is a 2px House Blue outline offset 2px; press scales to 0.97.
- **Upload on phones:** collapses to a 40px icon-only pill with a visually hidden label.
- **Header Sign in:** secondary pill with a 20px user icon and "Sign in" label, padding 12px left / 16px right. On the sign-in route it is the current page and keeps a 2px House Blue outline offset 2px. On ≤639px it collapses to a 40px icon-only pill, same as Upload.
- **Account button:** transparent 40px pill; 24px Avatar + name (600, truncated to 12ch). Hover fills Graphite Raised. Opens a 240px Graphite Surface popover (12px radius) with "Signed in as", Your channel, and Sign out. On ≤639px it is 40px icon-only (avatar only).

### Chips
- **Style:** 32px tall, 8px radius, Graphite Raised fill, Paper text at 500, 12px gaps.
- **State:** hover to Raised Hover. Active ("All" by default) inverts to a Paper fill with Graphite Ground text, not blue.

**Lineage chip:** who stands behind a channel, on the channel header ("Run by", "Also posting", "Runs", "Posts to", each an Ash label before its chips). A 32px Raised pill holding a 24px avatar (4px inset left, 12px right) and the channel name at 0.875rem/500; hover to Raised Hover. Each links to that channel.

**Path chip:** a real filesystem path set inline in prose ("Indexed from `/media/Home Movies`", or a missing file in the player). Raised fill, Paper text, 6px radius, 2px 8px padding, monospace at 0.8125rem, wrapping anywhere. Used only for paths (The Real Path Rule).

### Cards / Containers
**Video card** (the signature component):
- 16:9 thumbnail, 12px radius, Graphite Raised placeholder behind the image; image scales to 1.03 on hover over 240ms (off on touch and reduced motion).
- Duration badge bottom-right (78% black, white tabular caption, 5px radius); it lifts 4px when a progress bar is present.
- Progress bar: 4px House Blue on a 28% white track along the thumbnail's bottom edge.
- Meta row: 36px circular initial avatar (hue per person, folder icon for indexed folders), then a two-line-clamped card title, the channel name in Ash, and a relative time ("19 hours ago", or "15 min left" on Continue watching), with an optional "New" badge (House Blue Soft on an 18% House Blue tint) or an Ash "Watched" note.
- The whole card is one click target: the title link stretches over the card; the avatar and channel name sit above it as their own links. Keyboard focus on the title outlines the thumbnail.
- **On a channel page** the card drops its avatar (the header already says whose channel it is). The byline names the person who posted it only on a custom channel; the time line leads with plays ("12 plays · 3 days ago").
- **Private:** a video posted as "Only me" ends its time line with an Ash 14px lock and "Private" (`.pvis.vcard-private`), the same fact-not-warning treatment as private playlists. Only its uploader ever sees the card.
- **No poster:** an uploaded video without a poster is a plain Graphite Raised tile, no placeholder glyph; with an unknown length it has no duration badge.

**Channel card:** Graphite Surface, 12px radius, centred 88px initial avatar (72px on narrow containers), name, Ash "n videos" (plus "· folder"), and a House Blue Soft "n new" when relevant. Hover to Graphite Raised.

**Channel directory row** (the "peek row", the directory's signature): a transparent row, 12px radius, 16px padding, 20px gaps, hovering to Graphite Surface. The name link stretches over the row, so the whole row is one target; keyboard focus draws a 2px House Blue outline inset 2px around the row.
- **Left:** the lg avatar (88px; 56px below a 540px container), shaped by kind.
- **Text:** name (1.25rem/600, −0.01em; 1rem below 540px); an Ash meta line in tabular 0.875rem ("3 videos · Updated yesterday", or "No videos yet") with a tinted House Blue Soft "n new" badge; a people line (custom: a 24px owner avatar and "Run by Leo with Mia and Tomás"; person: "Runs Twice · Posts to Video Games"; folder: the path in Ash monospace 0.8125rem, ellipsised); then the description in Paper, 0.875rem/1.5, clamped to two lines and 64ch.
- **Peek:** on wide containers, a fixed three-slot column (two slots below a 1100px container, hidden below 880px) of the channel's newest videos as 152px 16:9 thumbs: 8px radius, Raised placeholder, a smaller duration badge, the House Blue progress bar, and a solid House Blue Ink "New" badge top-left. Slots are fixed, so rows with fewer videos leave the column ragged rather than reflowing. The thumbs sit above the row link as direct watch links for the pointer, but are `aria-hidden` with `tabindex="-1"`: keyboard and screen-reader users get one stop per row. The image scales slightly on hover.

**Channel header** (top of a channel page): the xl avatar (120px; 88px below a 720px container, 64px below 540px), then the name in Page Title style (wraps anywhere for long names), an Ash meta line ("Channel · 3 videos · 41 plays" with "Home channel" or "Folder" for the other kinds, plus "n new"), lineage chips (or "Indexed from" + a path chip for folders), and the description (1rem/1.5, 68ch). The owner of a custom channel gets a secondary "Edit channel"; a person on their own home channel gets a secondary "New channel". No subscribe, no banner.

**Who card** (household identity on the sign-in route):
- Graphite Surface, 12px radius, min 168px tall. Hover to Graphite Raised.
- Open: Graphite Raised with a 2px House Blue outline (offset 0). Hue-tinted 56px initials (or local photo), name at 1.375rem/600, Ash video count. The password field and House Blue Ink Sign in sit on the same card.
- **Join card:** transparent ground, dashed Field Line Hover (#33363b) outline. Open expands in its grid cell (not full-row) with name, password, confirm, optional photo well, and "Create my channel".

### Avatars
Every channel has one avatar, rendered from its kind (The Shape Is Kind Rule) and its hue, or from a local photo cropped to the same shape.
- **Kinds:** a person's home channel (circle, initial); a custom channel with one owner and optional posters (rounded square, 26% radius, initial); an indexed folder (circle, folder glyph: 16px at sm/md, 24px at card, 40px at lg, 52px at xl).
- **Sizes:** sm 24px (nav, lineage chips, people lines), md 36px (video cards, poster rows), card 56px (who cards, form preview), lg 88px (channel cards, directory rows), xl 120px (channel header).
- **Blank:** before a new channel has a name, its preview is an empty Graphite Raised tile in the channel shape, rather than a placeholder glyph.

### Inputs / Fields
- **Search:** a pill split in two: a recessed Field Well input with a 1px Graphite Line border and Ash placeholder ("Search the house"), joined to a 64px Graphite Raised search button.
- **Password / join fields:** 44px pills, Field Well fill, 1px Graphite Line, 18px side padding. Labels are 0.8125rem/600 Ash. Invalid uses Paper, not red. The optional photo well is a 44px dashed pill.
- **Hover:** border lightens to Field Line Hover.
- **Focus:** border turns House Blue with a 1px inset House Blue ring (no outer outline).
- **Multiline field:** the same well, border and focus as a field, but with the 12px card radius, 12px 18px padding, 1.5 line height, a 104px minimum height and vertical resize.
- **Select:** a native `<select>` in the 44px field pill (`.field-select`), appearance reset, 48px right padding for a 16px Ash chevron inset 18px; options on Graphite Surface.
- **Label and hint:** labels sit above the field (0.8125rem/600 Ash, with "(optional)" at 400). A hint follows the field in Ash at 0.8125rem, pulled 6px closer, saying the limit or what happens without a value.
- **Checkbox:** the native input is visually hidden behind a 22px box with a 6px radius and a 1.5px grey (#5a5d64) border. Checked, it fills Paper with a dark (`on-chip`) 14px check. Focus puts the 2px House Blue ring on the box. Never a blue fill.
- **Photo well with preview:** on the channel form the well sits beside a live 56px avatar preview that follows the Name field as you type (initial and hue), shows a chosen image immediately, and is a blank Raised tile (no glyph, no "?") until there is a name. Once a file is chosen, the well's outline turns solid and its label becomes the file name (ellipsised). With a saved picture, a "Remove picture" checkbox appears beside it.

**Poster picker** ("Who can post"): a fieldset of rows in an auto-fill grid (min 220px, 8px gap). Each row is a 60px Graphite Surface row, 12px radius: 36px avatar, name (1rem/500, ellipsised), and a checkbox at the end; the whole row is the label. Hover or checked lifts the row to Graphite Raised. The owner's row comes first, is already Raised, reads "You · owner" in Ash, and has no checkbox: it is a statement, not a control.

### Navigation
- **Rows:** 40px min height, 10px radius, 20px icon-to-label gap, 14px Paper text. Hover fills Graphite Raised.
- **Active:** Graphite Raised fill, 600 weight, and the icon turns House Blue. On the mini rail the active row has no fill until hovered.
- **People:** 24px initial avatars; a 6px House Blue dot marks people with new videos (with a hidden "n new" for screen readers). Only people's home channels appear here; custom channels are found through Channels.
- **Folders:** folder icon, name, and the path in 12px Ash, ellipsised.
- **Drawer:** slides in from the left over 220ms on the standard ease, with a sticky head holding close and logo.
- **Account menu:** 240px Graphite Surface popover, 12px radius, 8px padding. "Signed in as" in Ash; rows are 40px, 10px radius, 500 weight; hover Graphite Raised. Sign out is a row with a logout icon, not a destructive red.

### Empty and placeholder states
Centred, max 480px, 12vh from the top: a 40px Ash outline icon, a Headline, an Ash paragraph capped at 44ch, and one button. The copy says plainly what is missing and what to do ("No videos in the house yet", "Nothing in the house matches…"). Unbuilt routes use the same frame with "Back to home".

### Player
The custom player on the watch page (`app/actions/public/player.tsx`, a client entry). Native controls are never shown.
- **Stage:** black, 16:9, 12px radius (square in theater, fullscreen, and on phones); video `object-fit: contain`.
- **Big button:** a 72px House Blue Ink circle with a white filled play glyph, the page's one primary action, shown before the first play and at the end (replay glyph, "Watch again"). With saved progress it reads "Resume from m:ss" in a 72% black pill with a quiet "Start over" pill beside it. Progress under 5s, or within 15s of the end, is not offered.
- **Control bar:** sits on the bottom scrim. Seek bar: 4px track (28% white), buffered range (50% white), played in House Blue; on hover, scrub, or focus it grows to 6px and shows a 13px House Blue thumb plus a black time tip. Below it: play/pause, mute + a volume range that slides open to 72px on hover/focus (hidden on touch), tabular `0:13 / 0:40`, a spacer, speed (`1×`, House Blue when changed), picture-in-picture, theater, fullscreen. Buttons are 40px, 8px radius, white, with a 12% white hover and a House Blue focus ring.
- **Speed menu:** a Graphite Raised menu (12px radius) above the speed button; `menuitemradio` rows 36px with a House Blue check; arrow keys, Esc, and Tab work as a menu should.
- **Idle:** while playing, the bar and cursor hide after 2.6s without pointer movement, unless the pointer is over the bar, a menu is open, or a control has keyboard focus.
- **Key flash:** the one authored motion. Keyboard actions flash a 64px black pill in the centre with an icon and optional label ("+10 s", "60%", "1.5×") that scales 0.92 → 1.12 and fades over 700ms (opacity-only under reduced motion).
- **Shortcuts:** space/k play-pause, j/l ∓10s, ←/→ ∓5s, ↑/↓ volume (only with focus in the player), m mute, f fullscreen, t theater, i picture-in-picture, < > speed, 0–9 jump to tenths, Home/End.
- **Touch:** a tap on the picture shows or hides the controls; it never pauses. Double-tap does nothing (double-click toggles fullscreen with a mouse).
- **Spinner:** a 48px white ring after 300ms of buffering.
- **Honest failures** (black-tinted overlay, 40px file icon, Paper title, Ash copy, monospace path chip): file not on the host ("LanTube looks for `Home Movies/…` in its media folder"), format this browser can't play (no transcoding yet), and lost connection with a "Try again" button. Time up for a limited person uses the same frame with a timer icon (see Parental controls). Never red.
- **Memory:** volume and mute persist per device; plays are counted once per visit; progress is saved on pause, end, every 15s, tab hide, and page leave, for the signed-in person only (it also feeds their History). Unsigned playback saves nothing.

### Watch page info
- **Title:** 1.25rem/700, −0.015em, `text-wrap: pretty`.
- **Channel row:** 40px avatar, name (600, underlines on hover), Ash "n videos" (plus "· folder"); the whole row links to the channel.
- **Facts box:** Graphite Surface, 12px radius. "**N plays** · Published October 10, 2026 (5 hours ago)" in tabular 0.875rem, with "Added" instead of "Published" for indexed folders. A private video adds "· Private" with the 14px Ash lock (titled "Only you can see this video"). Topic chips (28px) link to the home topic filter. Folder videos add an Ash "Indexed from /media/…" line.
- **No social furniture:** no likes, subscribe, share, or comments.

### Compact related card
"More like this" ranks videos sharing the most tags first (newest breaks ties), then the same channel, then the rest by newest, up to 12. Each row is a 168px 16:9 thumb (8px radius) with a smaller duration badge and progress bar, then a two-line 0.875rem/600 title, the channel in Ash (its own link), and tabular "n plays · 3 days ago". The title link stretches over the card; keyboard focus outlines the thumb. Below a 540px content width it stacks like a video card.

### Playlists
A playlist is a stack of videos someone in the house keeps, private to them or shared with everyone. The playlists directory (`/playlists`) is a page head ("Playlists", page note "3 of yours · 5 from the house", secondary "New playlist" when signed in) over two shelves: **Yours**, a grid of playlist cards (with the shelf note "Only you can see the private ones" when one is private), and **From the house**, a list of activity rows (shelf note "Most recently changed first"). Unsigned visitors see only the house list. An empty Yours uses the dashed-outline note with a secondary "New playlist".

**Stacked playlist cover** (`.pcover`, the playlist's signature): a playlist reads as a stack, never as a single video.
- **Front:** the first video's 16:9 thumbnail, 12px radius, Graphite Raised behind it (an Ash 28px playlists icon when empty; 40px at lg). It scales to 1.03 on hover of its card or row over 240ms (off on touch and reduced motion), like a video card.
- **Slivers:** two 24px tabs peek above the front, cut from the second and third videos (falling back to the front when the list is short), top-rounded 10px on a #1c1d20 base. The middle sliver insets 4% and rises 4px; the back one insets 8% and rises 8px. Both are blurred 6px and darkened (brightness 0.62 middle, 0.42 back) so they read as tonal bands that echo the list without competing with the front.
- **Count chip:** bottom-right, the duration badge's 78% black scrim and 5px radius, with a 14px playlists icon and the tabular count in white Caption. It is a count, not a duration: never "1:23".
- **Sizes:** md (cards and rows; 8px reserved above for the slivers) and lg (the playlist page; 28px slivers rising 10px and 5px). The whole cover is decorative (`aria-hidden`); the name link carries the meaning.

**Playlist card** (`.pcard` in `.pgrid`, the Yours shelf): an auto-fill grid of min 232px (28px row gap); two columns at 20px / 12px below a 540px container. Cover, then the name (Card Title, two lines, 10px below the cover), then an Ash tabular meta line: visibility · "Updated yesterday". The name link stretches over the card; keyboard focus outlines the cover's front 2px House Blue, offset 2px. Below 540px the name steps to 0.875rem, the "·" separator is dropped and visibility and "Updated" stack on two 0.8125rem lines.

**House activity row** (`.plrow`, a peek row in `.chlist`): the channel directory row, re-cut so every row says what changed.
- **Cover:** a 240px md cover in place of the avatar (200px below a 1100px container, 176px below 880px, 120px below 540px).
- **Activity line:** a 24px owner avatar, the owner's name in Paper 600, then the change in Ash ("added 2 videos", "removed a video", "changed the order", "renamed this playlist", "shared this with the house", "made this private", "updated the description", "made this playlist") · when, tabular. Below 540px the avatar and separator drop and the time takes its own line.
- **Name and meta:** the row name (1.25rem/600; 1rem below 540px) and an Ash meta line ("6 videos · 54 min").
- **Peek:** up to three 152px thumbs of what the change brought: the newly added videos first, each with a solid House Blue Ink "New" badge while fresh, then the videos that follow the cover. The peek never repeats the cover. It is decorative and out of the tab order, as on channel rows.
- **Order:** newest activity first, always. A row moves only because something changed, and it says what.

**Playlist page** (`/playlist/:id`, `.pl`): a 32px-gap grid of the playlist's panel (300–380px) on the left and its running order on the right; one column below an 880px container.
- **Panel** (`.plhead`): Graphite Surface, 12px radius, 20px padding, sticky 24px under the top bar. The lg cover, then the name in the Page Title style at 1.5rem (`--fs-xl`, wraps anywhere), an owner chip (the channel header's link: 24px avatar + name, "You" for the owner), an Ash tabular meta line (visibility · "12 videos" · "1 hr 52 min"), a separate "Updated yesterday" line pulled 10px closer, the description (0.875rem/1.5, pretty wrap), and the actions: **Play all** (play icon) as the one primary, **Edit** (pencil) secondary and owner-only. Below 880px the panel stops sticking and sets the cover beside the text (200–280px); below 540px it stacks, bleeds half a gutter, and pads 16px.
- **Entries** (`ol.pentries` / `.pentry`): rows 2px apart on a 28px | 168px | text | tools grid, 12px radius, hovering (or when targeted by a fragment) to Graphite Surface. An Ash tabular index, a 168px thumb (8px radius, small duration badge, progress bar), a two-line Card Title that links to the video in this playlist and stretches over the row, and an Ash "Channel · 3 days ago". Keyboard focus outlines the row 2px House Blue inset.
- **Owner tools:** move up (arrow-up), move down (arrow-down), and remove (close) as 40px Ash icon buttons that brighten to Paper on a Raised hover; the first row's up and the last row's down are disabled at 30%. On hover devices they fade in (150ms) on row hover or focus-within; on touch they are always shown. Each is a plain form that returns to the same row. Below 540px the index hides, the thumb shrinks to 128px, and the tools (36px) sit under the text.
- **Empty:** the dashed-outline note: "Nothing in it yet. Open any video and use Save to put it here." with a secondary "Browse videos" for the owner; a plain sentence for everyone else.

**Visibility:** a fact, not a warning. **Private** is an Ash 14px lock icon followed by "Private"; **Public** is the word alone. Never coloured, never a badge. On the playlist form, "Who can see it" is two radio cards (`.pvis-option`) built from poster-picker rows in an auto-fill grid (min 240px): a 20px Ash icon (lock, or channels for Public), the label with an Ash detail ("Only you can see it", "Anyone in the house can see it"), and a radio at the end. The **radio** is the checkbox's round sibling: a 22px circle with a 1.5px #5a5d64 border; checked, it fills Paper around a dark (`on-chip`) dot. Checked rows lift to Graphite Raised. Never blue.

**Delete zone** (`.pldelete`, the edit form's foot): set 48px below the form behind a 1px Graphite Line, 28px padding above. A 1rem/600 "Delete this playlist", an Ash hint that says what happens ("The playlist goes away for everyone. The videos in it stay where they are."), a Paper checkbox "Yes, delete {name}", then a secondary "Delete playlist" with a trash icon. The confirm is the friction; a missing tick returns the form with a plain inline error. No red anywhere.

**Save** (`.save`, beside the channel row on the watch page): a secondary pill with a 20px list-plus icon reading "Save", or list-check and "Saved" when the video is in any of your playlists. Unsigned, it is a link to Sign in.
- **Popover** (`.save-menu`): `popover="auto"`, `role="dialog"`, labelled "Save to…" (0.875rem/600). 296px, max 440px tall (scrolls), 8px padding, Graphite Surface, 1px Graphite Line, 12px radius. It opens 8px below the trigger, flips above when there is no room below, and keeps 12px from the viewport edges. Focus moves to the first row on open; Esc and outside clicks close it.
- **Rows:** account-menu rows (min 44px, 10px radius, Raised hover), each a toggle button with `aria-pressed`: a Paper checkbox, the playlist name (ellipsised), and an Ash 16px lock for private playlists (with ", private" for screen readers). A Graphite Line divides the list from **New playlist** (plus icon), which starts a new playlist holding this video. With no playlists, an Ash "You don't have any playlists yet."
- **Saving:** optimistic. The check flips at once and saves in place, so a playing video never reloads; a failure flips it back and shows a Paper inline error ("Couldn't change Road trip. Check the connection to the host and try again."). A polite live region names where the video now is. Without JavaScript each row is a plain form that returns to the same page.

**Watch list panel** (`.wlist`): when a video is played from a playlist (`?list=`), the watch rail opens with the playlist, 24px above "More like this". Graphite Surface, 12px radius.
- **Head:** the playlist name (1rem/600, single line, ellipsised, underlines on hover) linking to the playlist page; an Ash 0.8125rem "Mia · 3 / 12" with the position in tabular numerals ("You" when it's yours); then previous and next as 40px icon links (skip-back, skip-forward). At either end the missing one stays in place at 30% and does nothing (`.is-off`).
- **Items:** a compact list (max 360px, scrolls without chaining) of 20px | 100px | text rows, 8px radius: an Ash tabular index, a 100px thumb (6px radius, small duration badge), a two-line 0.8125rem/600 title and an Ash 0.75rem channel. Hover and the current item lift to Graphite Raised; the current item swaps its index for a 12px Paper play marker and carries `aria-current`.

**Icons added for playlists** (Lucide outlines, same 1.75 stroke): lock, list-plus, list-check, arrow-up, arrow-down, skip-back, skip-forward, trash.

### History
History (`/history`, `.history`) is one person's watch history, grouped by the **sittings** people remember ("Last night", "Friday morning") rather than by calendar day. The page head is the Page Title "History" with a polite-live page note ("What you've watched · 7 videos this week", counting distinct videos in the last seven days) and, on the right, the page's only control: a search field. No remove, clear, or pause.

**Sittings** (`.sitting`, newest first, 36px apart; 28px below a 540px container):
- **Grouping:** each visit to a video is a session; a pause of more than 45 minutes between sessions starts a new sitting. Each video appears once, in the sitting where it was last watched, and rows within a sitting run newest first (the first row is the first segment of the bar).
- **Watch time:** only real playback counts. Forward motion no faster than real time adds seconds; seeks add nothing. A video watched for under 5s is a skim and is not shown.
- **Labels** follow how people talk, in the host's local time. Parts of the day: morning 5–12, afternoon 12–17, evening 17–21, night 21–5; hours before 5am belong to the night before. Today reads "This morning" / "Tonight"; yesterday "Yesterday afternoon" / "Last night"; within a week the weekday ("Friday morning"); older adds the date ("Friday afternoon, Oct 2", with the year when it differs).
- **Head:** the label in Title (1.25rem/700, −0.015em) with an Ash tabular meta line beside it at 0.875rem, wrapping under it when tight: time range · count · total length ("8:40–9:35 pm · 3 videos · 50 min"). The range names am/pm once when both ends share it.

**Sitting bar** (`.sitting-bar`, the page's signature): a 4px House Blue bar under the head, one pill-ended segment per video with 3px gaps. Each segment's flex-grow is the seconds watched, in the same newest-first order as the rows, so the bar is the sitting's shape at a glance. The bar's width is 7.2px per minute watched, so sittings compare by length; on narrow containers it scales against the longest visible sitting instead, with a 24px floor. It is decorative (`aria-hidden`); the meta line carries the facts. Hovering or focusing a row dims the other segments to 0.3 over 150ms, pointing at that video's share. It is watch progress at the scale of an evening, which is why it may be blue (The One Accent Rule).

**History row** (`.hrow` in `ol.hrows`): a tonal row, no border, 12px radius, 8px 12px padding, 2px apart, bleeding 12px into the gutter so its text aligns with the head. Hover lifts it to Graphite Surface; keyboard focus outlines the row 2px House Blue inset. A 168px | text | 180px status grid (144px thumb and an auto status column below an 880px container):
- **Thumb:** 16:9, 8px radius, Raised placeholder, the small duration badge and the viewer's progress bar.
- **Text:** Card Title (two lines) linking to the video and stretching over the row, so the whole row is one target; then a 24px avatar and the channel in Ash, with "· posted by Leo" ("you" for the viewer) on custom channels.
- **Status column:** one fixed, right-aligned column with exactly two states. Unfinished is a 32px Raised pill (Raised Hover on row hover) with a 14px play icon and "Resume from 2:10" at 0.875rem/600, or "Play from start" when no position is saved. Done is Ash "Finished". Under either, the Ash tabular clock time it was started ("8:40 pm", 0.75rem). Never blue, never a percentage.
- **Narrow (below 540px):** the thumb drops to 128px, the row pads 8px, the title steps to 0.875rem and the channel to 0.8125rem without its avatar, and the status column moves under the text as one wrapping line (a 28px pill, then the time).

**Search** (`.hfind`): a 40px pill, 360px at most (full width below 540px), on the Field Well with a 1px Graphite Line, an Ash 18px search icon inset 16px, placeholder "Search your history", hover and focus as other fields. With a query, a 32px clear icon link sits inside the right end. It filters rows by title or channel name, and each sitting's range, count, length and bar are recomputed from the matching rows alone; sittings left empty disappear. The page note then reads "2 videos match “bread”". No match is the empty state ("Nothing in your history matches “…”", a hint to try a shorter word, and a secondary "Clear search").

**Honest states:** unsigned visitors get the empty-state frame with a history icon, "Sign in to see your history", copy that says plainly "Videos watched without signing in aren’t recorded", and a primary Sign in (user icon). A signed-in person with no history gets "Nothing watched yet" and a secondary "Browse videos".

**Watch progress is per person**, everywhere: the progress bar on cards and rows, the Continue watching shelf, the player's "Resume from", the "New" badges and "n new" counts, and the sidebar's new-dot all read the signed-in viewer's own positions. A position under 5s is not kept; within 15s of the end counts as finished. Watching without signing in records nothing, so an unsigned visitor sees no progress, no Continue watching, and "New" falls back to "added within the last 3 days".

### Upload
Upload (`/upload`, `.upload`) starts with where the video goes, not with a file dialog: pick the channel, choose the file (it starts sending at once), pick a frame, title it, and watch the card land on that channel's shelf beside the form. Fields run Post to, Video, Poster frame, Title, Topics, Add to a playlist, Who can see it, 24px apart, labels in the field-label style.

**Post to** (`.upload-to-tile`, the page's signature): a wrapping row of 112px avatar tiles (10px gap), one per channel the person may post on. Graphite Surface, 12px radius, a centred card avatar (56px) shaped by kind (circle for a home channel, 26% square for a custom one), the name (0.8125rem/500, ellipsised) and an Ash 0.75rem role line ("Your channel", "You run it", "Leo’s"). Hover lifts to Raised; the chosen tile is Raised with a 2px House Blue ring; keyboard focus adds the accent outline offset 4px. Below 540px the row stops wrapping and scrolls sideways (104px tiles) out to the screen edges, its right edge fading under a mask so the next tile reads as more.

**File well** (`.upload-well`): before a file is chosen, a 12px-radius well with a 1px dashed #33363b outline: a 48px Raised circle holding the upload icon, "Choose a video, or drop it here" (1rem/600 Paper), an Ash note ("It starts sending to the host straight away." plus the accepted types), and the native file input left visible, its `::file-selector-button` styled as a 36px Raised pill, so it works without JavaScript. Hover lightens the outline to #5a5d64 over Graphite Surface; drag-over turns it a solid House Blue outline on a 7% accent tint.

**Chosen-file card** (`.upload-file`): a 300px | text grid (stacked below 540px). The 16:9 preview (12px radius, Raised, the duration badge once known; "No preview in this browser" in Ash when it can't decode), then the file name (1rem/600, ellipsised), an Ash tabular "98 MB · 4:12", and a status line in Ash, tabular, 0.8125rem.
- **Sending:** "Sending to the host · 36 of 98 MB · about 10 s left" over the **transfer bar** (`.upload-bar`): 4px House Blue on a Raised track, 2px radius, easing its width linearly over 240ms (no transition under reduced motion). It is a `progressbar`; a polite status region names the state.
- **Sent:** a Paper 16px check and "On the host. Add the details, then publish."
- **Failed:** the message in Paper at 500 ("Couldn’t reach the host. Check you’re on the home network, then try again."), with a secondary small "Try again" only when retrying can help. Never red.
- **Always:** a ghost small "Choose another file".

**Poster frame strip** (`.upload-strip`): a head with the label and an Ash tabular "at 1:24" ("Reading frames…" while sampling), then ten 16:9 frames taken in the browser at their true times through the video, in a 10-column grid with 4px gaps (two rows of five, 6px gaps, below 540px so each is a real tap target). Frames are 6px radius on Raised, shown at 0.62 opacity, full on hover; the chosen one is full opacity with a 2px Paper outline. Under the strip a **scrubber** (`.upload-scrub`) fine-tunes the exact frame: 4px Raised track, a 16px Paper thumb, and focus as a 2px House Blue ring around a 2px ground gap. When the browser can't read frames, an Ash hint says the video will get a plain tile and still uploads.

**Topics:** the house chips as checkboxes; a chosen topic takes the Paper fill with dark text, like the active filter on Home. **Add to a playlist** is a select in the field pill ("None" first, private playlists marked "(private)"). **Who can see it** reuses the playlist radio cards: "Everyone in the house" (channels icon, "On Home and on the channel") and "Only me" (lock, "Nobody else can find it").

**Live shelf** (`.upload-side`): the channel as it will look. A Title-style heading with a 24px avatar ("On your channel", or "On Video Games"), an Ash note ("How it will look, newest first"; "How it will look. Only you will see it here." when private), then a two-column grid of on-channel video cards: the new one first (the chosen frame fading in over 240ms, the title or an Ash "Your title goes here", "Just now", the New badge, and the lock + "Private" when private), then the channel's two latest at 0.45 opacity, hidden from assistive tech. Previews never zoom on hover.

**Summary pass** (`.upload-pass`, a `<dl>` labelled "Where it lands"): four cells (Channel, Who can see it, Playlist, Length) in a 4-column grid whose 1px gaps show Graphite Line through, 12px outer radius; each cell Graphite Surface, 10px 16px, an Ash 0.75rem term over a 600 ellipsised value, tabular. Privacy reads as the lock + "Only you", otherwise "Everyone". Two by two below 540px.

**Publish** (primary) and **Cancel** (ghost) sit under the pass. While the file is still sending, Publish reads "Publishes when sent" and publishes the moment it lands; once pressed it reads "Publishing…" (`aria-disabled`, progress cursor). The file is never sent twice.

**Private videos:** a video posted as "Only me" exists only for its uploader: on Home, search, channel pages, playlists and "More like this" it is missing for everyone else, and its watch page, media and poster return not-found. Wherever the uploader sees it, it carries the Ash lock + "Private".

**Honest states:** unsigned visitors get the empty-state frame with an upload icon, "Sign in to upload", and a secondary Sign in (user icon). Without JavaScript the form is one multipart post with no frame pick, and a too-large file returns plainly: "Without JavaScript, LanTube can take videos up to 512 MB in one go. Turn JavaScript on to send bigger ones."

### Parental controls
Parental controls (`/controls`, Parent-only, linked from the account menu as "Parental controls" with the timer icon) is **one roster**: a single semantic table, a row per Person, where a Parent sets each person's daily watch limit and gives extra time for today. Page head: the Page Title and the lede "How long each person can watch each day. Extra time lasts until 5 am." Non-Parents get the empty-state frame ("You need to be a Parent").

**Rules it shows:** Parents and Admins are never limited; they are named in an Ash footnote under the table ("Parents and Admins aren’t limited: Mia and Ruth.") rather than given rows. The watch day runs 5 am to 5 am in the host's local time. Limits are presets (5, 10, 15, 20, 30, 45 min, 1, 1½, 2, 3 hr, or No limit). Extra time comes in +5, +10, +20, +30 and +60 min, **adds up** (+5 twice reads "+10 min"), lapses at 5 am, and can be cleared. Only real playback counts against the day, up to 2× speed.

**Roster** (`table.controls`, a `tbody.controls-row` per person, `id="controls-{id}"` so every form returns to its row): Graphite Surface, 12px radius, tabular numerals, rows divided by Graphite Line, an Ash 0.875rem/600 header. Columns:
- **Person:** 36px avatar and name (600, ellipsised), 200px.
- **Today:** "**25 min left**" (600) with an Ash "5 min of 30 min" beside it, or "No limit" with "0 min watched"; at zero, "**Time’s up**". Under it the **meter** (`.controls-meter`): 4px, pill-ended, Raised track, max 260px, filled to the share used in House Blue (it is watch progress), turning Ash once time is up. Never red.
- **Daily limit:** a 168px × 40px field select that saves on change (a Save button appears only without JavaScript).
- **Extra today:** "**+10 min**" (600) with a quiet **Clear** text button (Ash, Paper on a Raised hover), or Ash "None" when the person is limited.
- **Extend** (end column, only when a limit is set): a small secondary pill with an Ash chevron-down.

**Extend menu** (`.extend-menu`, `popover`, `role="dialog"`): 248px, Graphite Raised, 12px radius, 6px padding, right-aligned under its trigger. An Ash title "More time for Ava today", then one form of 40px rows, each a submit button: "+5 min" (600) at the start and the result in Ash at the end ("45 min left"), so the Parent sees the outcome before choosing. Rows lift to Raised Hover.

**Errors** sit in a full-width row under the person (`role="alert"`, the field-error style) and keep the page at 400. **Narrow (below 900px):** the table becomes a block per person: who and Extend on the first line, today and the full-width meter, then the limit select and the extra time at the end.

**Time up in the player:** when a limited person has no time left, the stage shows the poster under the failure scrim with a 40px timer icon, Paper "That’s all the watching for today", Ash "More time starts at 5 am, or a parent can give you some now." (prefixed with "4:47 is saved, so you can pick up here." once the video has started) and a secondary "Check again" that reloads. Playing stops the moment time runs out (progress saved, fullscreen exited); an open player picks up a new limit, extra time, or "No limit" from its next progress report. The host refuses the media file and play counts while time is up, so the limit holds without JavaScript.

**Icons added for parental controls** (Lucide outlines, same 1.75 stroke): timer, chevron-down.

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
- **Do** build every playback surface from the custom player; never show native `controls`.
- **Do** stream real files with HTTP range support and say plainly when a file is missing or unplayable.
- **Do** shape every avatar by kind: circles for people, 26% rounded squares for custom channels, the folder glyph for folders.
- **Do** open directory and form pages with a 2rem Page Title and an Ash page note or lede; keep the page's standing action secondary.
- **Do** list channels as peek rows: lg avatar, name, Ash meta with "n new", people line, two-line description, and up to three 152px newest-video thumbs that stay out of the tab order.
- **Do** use the ghost button for Cancel beside a form's one primary.
- **Do** fill checked checkboxes with Paper and a dark check, and lift selected picker rows one step to Graphite Raised.
- **Do** group History by sittings with spoken labels ("Last night", "Friday morning"), each with an Ash range · count · length line and a House Blue bar whose segments are the seconds actually watched.
- **Do** give every History row the same status column: a Raised "Resume from m:ss" (or "Play from start") pill, or Ash "Finished", with the clock time under it.
- **Do** keep watch progress per person; unsigned viewing records nothing.
- **Do** start Upload with where the video goes (Post to tiles shaped by kind), send the file the moment it is chosen, and show the new card landing first on that channel's shelf.
- **Do** treat a private video as absent for everyone but its uploader, and mark it for them with the Ash lock + "Private".

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
- **Don't** autoplay, or add social furniture (likes, subscribe, comments) the house doesn't have.
- **Don't** put custom channels in the sidebar's "In this house"; it lists people.
- **Don't** colour checkboxes, toggles or selected rows House Blue.
- **Don't** set labels, metadata or numbers in monospace; it is for real paths and code only.
- **Don't** give a multiline field the pill radius.
- **Don't** put a placeholder glyph on a video without a poster, or a duration badge on one whose length is unknown; a plain Raised tile is honest.
- **Don't** colour upload failures red, or offer "Try again" when trying again cannot help.
