create table playlists (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  owner_id uuid not null references people (id),
  visibility text not null check (visibility in ('public', 'private')),
  description text,
  activity_kind text not null check (activity_kind in ('created', 'added', 'removed', 'reordered', 'renamed', 'shared', 'unshared', 'described')),
  activity_at timestamptz not null,
  activity_video_ids text not null default '',
  created_at timestamptz not null default now(),
  constraint playlists_name_length check (char_length(name) between 1 and 60),
  constraint playlists_description_length check (description is null or char_length(description) <= 280)
);

create table playlist_videos (
  playlist_id uuid not null references playlists (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  position integer not null,
  primary key (playlist_id, video_id),
  unique (playlist_id, position)
);
