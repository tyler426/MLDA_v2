-- =============================================================================
-- MLDA Collective — Initial schema (Base44 → Supabase)
-- Postgres / Supabase. Run with: supabase db push
-- =============================================================================
-- Translates the 18 Base44 entities into Postgres tables and introduces the new
-- multi-caregiver CRM model: every person is a login (profiles); a household
-- (family) can have 2–3 caregiver logins, each able to see that family's dancers.
-- =============================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type app_role as enum ('admin', 'teacher', 'parent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dance_program as enum ('PrePro', 'Competitive', 'Educational');
exception when duplicate_object then null; end $$;

do $$ begin
  create type caregiver_relationship as enum ('mother','father','guardian','grandparent','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type absence_status as enum ('pending','approved','denied');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- profiles — one row per login, linked 1:1 to auth.users
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text,
  phone       text,
  role        app_role not null default 'parent',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -----------------------------------------------------------------------------
-- Studios (rooms)
-- -----------------------------------------------------------------------------
create table if not exists studios (
  id    uuid primary key default gen_random_uuid(),
  name  text not null
);

-- -----------------------------------------------------------------------------
-- Teachers — optional link to a login (admin can create before they sign up)
-- -----------------------------------------------------------------------------
create table if not exists teachers (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references profiles(id) on delete set null,
  first_name         text not null,
  last_name          text,
  initials           text,
  email              text,
  phone              text,
  ics_token          uuid not null default gen_random_uuid(),
  notification_prefs jsonb not null default '{}'::jsonb,
  archived           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Households (a family unit) + caregiver memberships (the NEW multi-login model)
-- -----------------------------------------------------------------------------
create table if not exists households (
  id                    uuid primary key default gen_random_uuid(),
  primary_contact_name  text not null,         -- display label for the family (kept from Base44)
  email                 text,                  -- optional contact email
  phone                 text,
  ics_token          uuid not null default gen_random_uuid(),
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- One household has many caregiver logins (2–3 parents/guardians).
-- One login could belong to more than one household (rare, but supported).
create table if not exists household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  profile_id    uuid not null references profiles(id)   on delete cascade,
  relationship  caregiver_relationship not null default 'guardian',
  is_primary    boolean not null default false,
  can_manage    boolean not null default true,   -- can edit household / report absences
  created_at    timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- -----------------------------------------------------------------------------
-- Dancers (students). Belong to a household → inherit that family's caregivers.
-- -----------------------------------------------------------------------------
create table if not exists dancers (
  id                    uuid primary key default gen_random_uuid(),
  first_name            text not null,
  last_name             text not null,
  dob                   date,
  program               dance_program,
  level                 text,
  parent_household_id   uuid references households(id) on delete set null,
  jackrabbit_student_id text,
  archived              boolean not null default false,
  created_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Classes & enrollment
-- -----------------------------------------------------------------------------
create table if not exists dance_classes (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  day_of_week        smallint,          -- 0=Sun … 6=Sat
  one_time_date      date,
  start_time         time,
  end_time           time,
  studio_id          uuid references studios(id) on delete set null,
  teacher_id         uuid references teachers(id) on delete set null,
  guest_artist       boolean not null default false,
  guest_artist_name  text,
  level              text,
  age_range          text,
  week_variant       text,
  created_at         timestamptz not null default now()
);

create table if not exists class_enrollments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references dance_classes(id) on delete cascade,
  dancer_id   uuid not null references dancers(id) on delete cascade,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (class_id, dancer_id)
);

-- -----------------------------------------------------------------------------
-- Pieces (competition routines) & casting
-- -----------------------------------------------------------------------------
create table if not exists pieces (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  choreographer text,
  season       text,
  level        text,
  created_at   timestamptz not null default now()
);

create table if not exists piece_casts (
  id          uuid primary key default gen_random_uuid(),
  piece_id    uuid not null references pieces(id) on delete cascade,
  dancer_id   uuid not null references dancers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (piece_id, dancer_id)
);

-- -----------------------------------------------------------------------------
-- Rehearsals & space bookings (piece_ids / dancer_ids kept as arrays to match
-- existing app logic, which filters in JS)
-- -----------------------------------------------------------------------------
create table if not exists rehearsal_blocks (
  id          uuid primary key default gen_random_uuid(),
  date        date,
  start_time  time,
  end_time    time,
  studio_id   uuid references studios(id) on delete set null,
  teacher_id  uuid references teachers(id) on delete set null,
  notes       text,
  piece_ids   uuid[] not null default '{}',
  dancer_ids  uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists space_bookings (
  id             uuid primary key default gen_random_uuid(),
  type           text,
  date           date,
  start_time     time,
  duration_hours numeric,
  studio_id      uuid references studios(id) on delete set null,
  teacher_id     uuid references teachers(id) on delete set null,
  piece_ids      uuid[] not null default '{}',
  dancer_ids     uuid[] not null default '{}',
  hour_slots     jsonb,
  notes          text,
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Competitions
-- -----------------------------------------------------------------------------
create table if not exists competition_weekends (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  start_date       date,
  end_date         date,
  venue            text,
  notes            text,
  competing_entries jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists competition_shifts (
  id                     uuid primary key default gen_random_uuid(),
  competition_weekend_id uuid references competition_weekends(id) on delete cascade,
  date                   date,
  start_time             time,
  end_time               time,
  teacher_id             uuid references teachers(id) on delete set null,
  role                   text,
  created_at             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Schedule exceptions (cancellations, pulls, room/time changes)
-- -----------------------------------------------------------------------------
create table if not exists schedule_exceptions (
  id                  uuid primary key default gen_random_uuid(),
  class_id            uuid references dance_classes(id) on delete cascade,
  date                date,
  type                text,   -- e.g. 'cancelled', 'dancer_pulled', 'time_change'
  dancer_id           uuid references dancers(id) on delete cascade,
  rehearsal_block_id  uuid references rehearsal_blocks(id) on delete set null,
  new_time            time,
  new_studio_id       uuid references studios(id) on delete set null,
  new_teacher_id      uuid references teachers(id) on delete set null,
  reason              text,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Attendance & absences
-- -----------------------------------------------------------------------------
create table if not exists attendance_records (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid references dance_classes(id) on delete cascade,
  date               date not null,
  dancer_id          uuid references dancers(id) on delete cascade,
  status             text,   -- present / absent / late / excused
  taken_by_teacher_id uuid references teachers(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (class_id, date, dancer_id)
);

create table if not exists absence_reports (
  id            uuid primary key default gen_random_uuid(),
  dancer_id     uuid not null references dancers(id) on delete cascade,
  household_id  uuid references households(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  class_ids     uuid[] not null default '{}',
  reason        text,
  excused       boolean not null default false,
  document_url  text,
  status        absence_status not null default 'pending',
  admin_notes   text,
  messages      jsonb not null default '[]'::jsonb,  -- studio↔family thread
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table if not exists schedule_notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text,
  recipient_type  text,   -- 'parent' | 'teacher'
  type            text,
  title           text,
  message         text,
  payload         jsonb,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- App settings (singleton) — replaces config stored on the Base44 User
-- -----------------------------------------------------------------------------
create table if not exists app_settings (
  id                          int primary key default 1,
  jackrabbit_api_key          text,
  global_notifications_enabled boolean not null default true,
  updated_at                  timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Helpful indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_household_members_profile on household_members(profile_id);
create index if not exists idx_household_members_household on household_members(household_id);
create index if not exists idx_dancers_household on dancers(parent_household_id);
create index if not exists idx_enrollments_dancer on class_enrollments(dancer_id);
create index if not exists idx_enrollments_class on class_enrollments(class_id);
create index if not exists idx_classes_day on dance_classes(day_of_week);
create index if not exists idx_attendance_date on attendance_records(date);
create index if not exists idx_absence_household on absence_reports(household_id);
create index if not exists idx_notifications_recipient on schedule_notifications(recipient_email);
