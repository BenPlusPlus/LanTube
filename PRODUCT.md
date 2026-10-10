# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Remix 3. Self-hosted on a home machine; opened in browsers on the LAN. No cloud deploy target.

## Users

People in one household on the home LAN — family or housemates — opening LanTube on a phone, TV, laptop, or tablet to watch and to publish. Anyone on the network can watch. Each person can have a channel and upload. The host machine is a home PC, NAS, or homelab box on that same network.

## Product Purpose

LanTube is a private YouTube for a household. It turns a home video library into a site people actually watch and publish on: a home feed, channels, playlists, and watch history, served from a machine the family already has. Success is the house using LanTube instead of passing around files, hunting a NAS folder, or putting household video on the public internet.

## Positioning

Distribution is the household LAN. Channels, playlists, and history exist without a cloud account, CDN, or public site. A media server is a library and a player; a folder is storage; YouTube is public and needs the WAN. LanTube is a household video site whose network is the house.

## Operating Context

- A always-on or on-demand host on the LAN runs LanTube and holds the files.
- Viewers open a browser on phones, tablets, TVs, and computers on the same Wi‑Fi (or local network).
- Once the host and the files are local, watching does not use the public internet.
- Video enters two ways: LanTube indexes an existing folder or share, and people upload new files in the app.
- Publishing is per person via a simple household identity. Watching does not require being a publisher.

## Capabilities and Constraints

Confirmed:

- Library, channels, playlists, and watch history.
- Ingest is both folder/share indexing and in-app upload.
- Self-hosted on a machine the household controls. Viewers are on the local network. No SaaS and no public-hosting assumption.
- The watch path works without the public internet, CDNs, or cloud APIs.
- Anyone on the LAN can open it and play. Each person can upload and own a channel. Publishing is tied to a simple household identity.

Undecided (do not invent):

- Exact identity mechanism (names, PINs, passwords, device-level, or something else).
- Whether a watcher must identify to play, or only to keep per-person history.
- Transcoding, live broadcast, comments, likes, or a recommendation model.
- Remote access or VPN from outside the LAN.
- Native TV or phone apps (the product is a web app in the browser).
- Parental controls, roles beyond “can publish,” or multi-household use.

## Brand Commitments

The product name is LanTube. Keep it in UI, copy, and identity.

LanTube follows established video-site conventions (top bar with search, left nav, thumbnail grid) at the craft level of YouTube and Rumble, rather than a novel visual world. It must not copy YouTube's colour scheme (no red-on-white/black brand look).

## Evidence on Hand

This repository is empty of product artifacts: no logo, screenshots, footage, testimonials, usage data, or press. Future work must not fabricate social proof, user counts, customer names, benchmarks, or reviews.

## Product Principles

1. The house is the network. Distribution stops at the LAN.
2. Watch without friction; publish with a name. Anyone on the network can play; channels belong to people in the house.
3. The library is what you already have and what you add. Folder and upload are both first-class.
4. The watch path cannot depend on the WAN. Cloud APIs are not part of playing a video.
5. It is a video site, not a file browser. Channels, playlists, and history are the product.
