create table playlist_audience (
  playlist_id uuid not null references playlists (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (playlist_id, person_id)
);
