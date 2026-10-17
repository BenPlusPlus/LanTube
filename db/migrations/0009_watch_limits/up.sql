create table watch_limits (
  person_id uuid primary key references people (id) on delete cascade,
  daily_min integer not null check (daily_min > 0)
);

create table watch_extensions (
  id uuid primary key,
  person_id uuid not null references people (id) on delete cascade,
  day text not null,
  minutes integer not null check (minutes > 0),
  granted_by uuid references people (id) on delete set null,
  created_at timestamptz not null default now()
);

create index watch_extensions_person_day on watch_extensions (person_id, day);
