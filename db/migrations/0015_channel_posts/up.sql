alter table channels add column posts_visibility text not null default 'house' check (posts_visibility in ('house', 'private'));

create table channel_post_audience (
  channel_id uuid not null references channels (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (channel_id, person_id)
);

create table posts (
  id uuid primary key,
  channel_id uuid not null references channels (id) on delete cascade,
  author_id uuid references people (id),
  body text not null,
  pictures_json text not null default '[]',
  created_at timestamptz not null default now()
);

create index posts_channel_created on posts (channel_id, created_at desc);