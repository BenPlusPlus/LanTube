# LanTube

A private video site for one household, served on the home LAN.

## Language

**Household**:
The people and devices on this home network. LanTube serves one household.
_Avoid_: Tenant, workspace, organization, family (the house may be housemates)

**Person**:
Someone in the household with a display name, a password, and a home channel. Anyone on the LAN may become a Person; a new Person is neither Admin nor Parent. The display name and photo may change; the slug does not.
_Avoid_: User, account, member, profile

**Home channel**:
The channel that belongs to a Person. It exists as soon as they join. If the Person is removed, it remains as a Frozen channel.
_Avoid_: Profile, user channel

**Removed Person**:
A Person an Admin has removed. They cannot sign in and they disappear from pickers; their name can still appear on Videos they posted.
_Avoid_: Deleted user, deactivated, banned, archived

**Frozen channel**:
A Home channel whose Person is removed. Its Videos stay; nobody posts to it.
_Avoid_: Archived, deleted, orphan

**Custom channel**:
A named channel a Person runs. That Person is the Channel owner and may name Managers. The Channel owner and its Managers post Videos to it.
_Avoid_: Community, group, brand channel

**Channel owner**:
The Person who runs a Custom channel. A Home channel’s owner is that Person.
_Avoid_: Admin (a different role), poster, host

**Manager**:
A Person the Channel owner names on a Custom channel to help run it — posting, editing the channel, and changing a Video’s visibility and Audience. The Channel owner is not a Manager; a Home channel has no Managers.
_Avoid_: Poster, contributor, collaborator, editor, member

**Folder**:
A directory on the Media share that LanTube indexes into house-visible Videos with no Video owner.
_Avoid_: Library, collection, directory (except when talking about the real filesystem path)

**Video**:
An item in the household library, posted to a Channel (home, custom, or folder). Each Video has its own visibility.
_Avoid_: Clip, media, asset, file (the file on disk is not the Video)

**Tag**:
A household-wide label on Videos. Anyone who can change a Video may attach an existing Tag or type a new name. Names are unique ignoring case.
_Avoid_: Topic (the mockup’s closed list), category, genre, keyword

**Video owner**:
The Person who posted the Video. They stay the Video owner after they stop being a Manager of the channel it lives on. Folder videos have no Video owner; they are house-visible.
_Avoid_: Uploader, poster

**Playlist**:
An ordered stack of Videos a Person keeps. Each Playlist has its own visibility, independent of the Videos in it.
_Avoid_: Collection, album, list, queue

**History**:
One Person’s record of Videos they watched, grouped into sittings. Unsigned watching is not History.
_Avoid_: Analytics, views, log, watch log

**Slug**:
The stable public name of a Person, Channel, Video, or Playlist in a URL. A Person and their Home channel share a slug. Removing a Person does not free the slug.
_Avoid_: Handle, username, key, id (the row identity is not the slug)

**Host**:
The machine on the LAN that runs LanTube.
_Avoid_: Server, backend, instance, NAS (the NAS holds bytes; it may or may not be the Host)

**Media share**:
The LAN filesystem that holds the bytes — video files, posters, and photos.
_Avoid_: Bucket, CDN, S3, volume (except as a mount)

**Catalogue**:
The household records of People, roles, channels, Videos, Playlists, Tags, Audience, and History. Distinct from the bytes on the Media share.
_Avoid_: Database, library (the Videos you watch), index

**Admin**:
A Person who operates LanTube for the household. The first Person to join is an Admin; only Admins grant or revoke Admin and Parent; at least one Admin remains. Admin does not, by itself, see private Videos or Playlists.
_Avoid_: Superuser, root, operator, parent

**Parent**:
A Person who can see every Video and Playlist, including private ones, and the History of People who are not Parents. Parent is a role, not a kinship term. A Person may hold Admin and Parent together.
_Avoid_: Guardian, overseer, super-viewer, admin

## Visibility

**Visibility**:
House-visible or private. Set separately on each Video and each Playlist.
_Avoid_: Public, unlisted, shared (as a visibility)

**House-visible**:
Anyone on the LAN can see it, signed in or not.
_Avoid_: Public, shared with the house (as the visibility name)

**Private**:
To everyone else the item does not exist. A private Playlist is visible to its owner, its Audience, and any Parent. A private Video is visible to its Video owner, its Audience, any Parent, and — on a Custom channel — the Channel owner and that channel’s Managers.
_Avoid_: Hidden, unlisted, only me (only me is private with an empty Audience)

**Audience**:
The extra People named on a private Video or Playlist as allowed to see it. Channel owner and Managers are not Audience; they already see private Videos on that channel.
_Avoid_: Viewers, guests, collaborators, subscribers, shared-with, managers

