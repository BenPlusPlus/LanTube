create table watch_sessions (
  id uuid primary key,
  person_id uuid not null references people (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  last_t integer not null,
  watched_sec integer not null
);

create table watch_progress (
  person_id uuid not null references people (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  position_sec integer not null,
  primary key (person_id, video_id)
);
