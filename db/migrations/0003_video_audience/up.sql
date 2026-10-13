create table video_audience (
  video_id uuid not null references videos (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (video_id, person_id)
);
