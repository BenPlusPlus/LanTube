create table people (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  hue integer not null,
  photo_path text,
  password_hash text not null,
  is_admin boolean not null default false,
  is_parent boolean not null default false,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create table channels (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('person', 'custom', 'folder')),
  path text,
  hue integer not null,
  photo_path text,
  owner_id uuid references people (id),
  description text,
  created_at timestamptz not null default now()
);

create table videos (
  id uuid primary key,
  slug text not null unique,
  title text not null,
  channel_id uuid not null references channels (id),
  duration_sec integer,
  published_at timestamptz not null default now(),
  poster_path text,
  plays integer not null default 0,
  file_path text not null,
  owner_id uuid references people (id),
  visibility text not null default 'house' check (visibility in ('house', 'private')),
  created_at timestamptz not null default now()
);
