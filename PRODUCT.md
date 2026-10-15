# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Remix 3. Self-hosted on a Host on the LAN. Catalogue in Postgres on the LAN. Video files, posters, and photos on a mounted Media share (this house: a Synology share). Opened in browsers on the LAN. No cloud deploy target.

## Users

People in one household on the home LAN — family or housemates — opening LanTube on a phone, TV, laptop, or tablet to watch and to publish. Anyone on the network can watch house-visible video unsigned. Each Person can join with a display name and password, gets a Home channel, and can upload. Some People are Admins (they operate the house). Some are Parents (they can see private library items and non-Parent History). One Person may be both. The Host is a home PC, NAS, or homelab box on that same network; it may be a different machine than the one that holds the Media share.

## Product Purpose

LanTube is a private YouTube for a household. It turns a home video library into a site people actually watch and publish on: a home feed, channels, playlists, tags, and watch history, served from machines the family already has. Success is the house using LanTube instead of passing around files, hunting a NAS folder, or putting household video on the public internet.

## Positioning

Distribution is the household LAN. Channels, playlists, and history exist without a cloud account, CDN, or public site. A media server is a library and a player; a folder is storage; YouTube is public and needs the WAN. LanTube is a household video site whose network is the house, with house-visible and private items, and with operator and Parent as separate roles.

## Operating Context

- A Host on the LAN runs LanTube. Postgres on the LAN holds the catalogue. A mounted Media share holds the bytes.
- Viewers open a browser on phones, tablets, TVs, and computers on the same Wi‑Fi (or local network).
- Once the Host, Postgres, and the share are on the LAN, watching does not use the public internet.
- Video enters two ways: an Admin attaches a Folder on the Media share and LanTube indexes it (scan at startup and when an Admin asks), and People upload new files in the app onto that share.
- Publishing is per Person via a simple household identity. Watching house-visible video does not require being signed in.
- A production install starts empty. The mockup household is a fixture for tests and development, not a migration.

## Capabilities and Constraints

Confirmed:

- Library, Home channels, Custom channels, Folder channels, playlists, tags, and watch history.
- Ingest is both Folder indexing and in-app upload. Only an Admin attaches or removes a Folder from the catalogue. Indexed Folder videos are house-visible and have no Video owner. LanTube never deletes the house’s files on the Media share; it only deletes bytes it created (uploads and their posters).
- Catalogue in Postgres on the LAN. Bytes on the mounted Media share. The watch path works without the public internet, CDNs, or cloud APIs.
- Anyone on the LAN can open it and play house-visible video. Sign in is required to upload, own a channel, keep per-person History, and see private items you have a right to.
- Identity is a display name and password (stored hashed). A new Person can join from the logon page, with an optional photo on the Media share (initials if none). The first Person to join is an Admin and may also take Parent. A new Person after that is neither until an Admin names them. Display name and photo may change; the URL slug does not. A Person may change their own password; an Admin may set a new password for someone else. No email recovery.
- Visibility is house-visible or private, set separately on each Video and each Playlist. A private item does not exist for anyone without a right to it. Private items may name an Audience of specific People. A Playlist does not grant sight of a private Video in it.
- A Custom channel has one Channel owner and optional Managers. Owner and Managers post, edit the channel, see private Videos on it, and change those Videos’ visibility and Audience. Only the Channel owner names Managers. The Person who posted a Video stays its Video owner after they stop being a Manager.
- Admin operates the house: other Admins and Parents, removing People, passwords, Folders. Admin does not, by itself, see private Videos, Playlists, or anyone’s History. At least one Admin remains.
- Parent sees every Video and Playlist, including private ones, and the History of People who are not Parents. Parent does not change visibility or delete library items from that role. A house may have zero Parents.
- Removing a Person drops them from sign-in and pickers. Their Home channel stays frozen with its Videos. Custom channels they owned pass to the Admin who removed them. Their playlists and History go. They are dropped from Audiences and Manager lists. The last Admin cannot be removed.
- Tags are household-wide labels People invent by typing a name on a Video. Names are unique ignoring case. Folder videos start untagged.
- Deleting an uploaded Video is allowed for the Video owner, and on a Custom channel also the Channel owner and Managers. Only an Admin may drop an indexed Folder Video from the catalogue. Only the Channel owner may delete a Custom channel, which deletes the Videos on it.

Undecided (do not invent):

- Transcoding, live broadcast, comments, likes, or a recommendation model.
- Remote access or VPN from outside the LAN.
- Native TV or phone apps (the product is a web app in the browser).
- A live filesystem watcher (v1 scans at startup and when an Admin asks).
- Re-enabling a Removed Person.

## Brand Commitments

The product name is LanTube. Keep it in UI, copy, and identity unless an Admin has set a house site name on House; that name is what people see in the running app.

LanTube follows established video-site conventions (top bar with search, left nav, thumbnail grid) at the craft level of YouTube and Rumble, rather than a novel visual world. It must not copy YouTube's colour scheme (no red-on-white/black brand look).

## Evidence on Hand

This repository is empty of product artifacts: no logo, screenshots, footage, testimonials, usage data, or press. Future work must not fabricate social proof, user counts, customer names, benchmarks, or reviews.

The running mockup in this repo is the UI and interaction evidence. The mockup household (Mia, Leo, and the rest) is not production data.

## Product Principles

1. The house is the network. Distribution stops at the LAN.
2. Watch without friction; publish with a name. Anyone on the network can play house-visible video; channels belong to people in the house; private items stay private.
3. The library is what you already have and what you add. Folder and upload are both first-class; LanTube does not destroy the archive on the share.
4. The watch path cannot depend on the WAN. Cloud APIs are not part of playing a video.
5. It is a video site, not a file browser. Channels, playlists, tags, and history are the product.
