create table assignments (
  person_id uuid not null references people (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  assigned_by uuid references people (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (person_id, video_id)
);

create index assignments_person on assignments (person_id, assigned_at desc);
