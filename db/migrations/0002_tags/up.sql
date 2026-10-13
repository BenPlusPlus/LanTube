create table tags (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  hue integer not null,
  created_at timestamptz not null default now(),
  constraint tags_name_length check (char_length(name) between 1 and 40)
);

create unique index tags_name_lower on tags (lower(name));

create table video_tags (
  video_id uuid not null references videos (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (video_id, tag_id)
);
