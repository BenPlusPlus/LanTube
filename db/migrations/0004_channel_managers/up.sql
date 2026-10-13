create table channel_managers (
  channel_id uuid not null references channels (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (channel_id, person_id)
);
