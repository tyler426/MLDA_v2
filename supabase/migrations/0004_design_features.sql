-- =============================================================================
-- Design-handoff features: Compete (costumes/call-times/music), dancer notes,
-- private-lesson requests + availability, parent↔teacher messaging,
-- dancer photos, per-class "bring to class" items.
-- =============================================================================

-- --- columns on existing tables ---
alter table dancers       add column if not exists photo_url text;
alter table dance_classes add column if not exists bring_items text[] not null default '{}';
alter table pieces        add column if not exists music_url text;
alter table pieces        add column if not exists duration  text;   -- '2:45'

-- --- costumes (per dancer per routine) ---
create table if not exists costumes (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid references pieces(id) on delete cascade,
  dancer_id uuid references dancers(id) on delete cascade,
  name text,
  paid boolean not null default false,
  fitted boolean not null default false,
  balance_cents int not null default 0,
  due_date date,
  created_at timestamptz not null default now()
);

-- --- competition entries (a routine in a competition, with its call time) ---
create table if not exists competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_weekend_id uuid references competition_weekends(id) on delete cascade,
  piece_id uuid references pieces(id) on delete cascade,
  call_time time,
  entry_number text,
  created_at timestamptz not null default now()
);

-- --- dancer notes (teacher → dancer; not visible to families) ---
create table if not exists dancer_notes (
  id uuid primary key default gen_random_uuid(),
  dancer_id uuid references dancers(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  author_profile_id uuid references profiles(id) on delete set null,
  tag text,
  body text not null,
  created_at timestamptz not null default now()
);

-- --- private lesson requests ---
create table if not exists private_requests (
  id uuid primary key default gen_random_uuid(),
  dancer_id uuid references dancers(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  date date, start_time time,
  when_text text,
  focus text,
  status text not null default 'pending',  -- pending | approved | declined
  space_booking_id uuid references space_bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

-- --- teacher availability slots for privates ---
create table if not exists availability_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  date date, day_of_week smallint,
  start_time time, end_time time,
  status text not null default 'open',     -- open | booked
  created_at timestamptz not null default now()
);

-- --- messaging (family ↔ teacher) ---
create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete cascade,
  subject text,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references message_threads(id) on delete cascade,
  sender_profile_id uuid references profiles(id) on delete set null,
  sender_role text,                        -- family | teacher
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_costumes_dancer on costumes(dancer_id);
create index if not exists idx_notes_dancer on dancer_notes(dancer_id);
create index if not exists idx_privreq_household on private_requests(household_id);
create index if not exists idx_privreq_teacher on private_requests(teacher_id);
create index if not exists idx_msg_thread on messages(thread_id);
create index if not exists idx_threads_household on message_threads(household_id);

-- =============================================================================
-- RLS
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['costumes','competition_entries','dancer_notes',
    'private_requests','availability_slots','message_threads','messages'] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- costumes: caregivers see their dancers'; teachers/admin all
drop policy if exists costumes_read on costumes;
create policy costumes_read on costumes for select
  using (is_teacher() or dancer_id in (select my_dancer_ids()));
drop policy if exists costumes_write on costumes;
create policy costumes_write on costumes for all using (is_teacher()) with check (is_teacher());

-- competition entries: any authed read; teacher/admin write
drop policy if exists compent_read on competition_entries;
create policy compent_read on competition_entries for select using (auth.uid() is not null);
drop policy if exists compent_write on competition_entries;
create policy compent_write on competition_entries for all using (is_teacher()) with check (is_teacher());

-- dancer notes: teachers + admin only
drop policy if exists notes_rw on dancer_notes;
create policy notes_rw on dancer_notes for all using (is_teacher()) with check (is_teacher());

-- private requests: families manage own; teachers/admin read+update
drop policy if exists privreq_read on private_requests;
create policy privreq_read on private_requests for select
  using (is_teacher() or household_id in (select my_household_ids()));
drop policy if exists privreq_insert on private_requests;
create policy privreq_insert on private_requests for insert
  with check (is_admin() or household_id in (select my_household_ids()));
drop policy if exists privreq_update on private_requests;
create policy privreq_update on private_requests for update using (is_teacher()) with check (is_teacher());
drop policy if exists privreq_admin on private_requests;
create policy privreq_admin on private_requests for all using (is_admin()) with check (is_admin());

-- availability: any authed read; teacher/admin write
drop policy if exists avail_read on availability_slots;
create policy avail_read on availability_slots for select using (auth.uid() is not null);
drop policy if exists avail_write on availability_slots;
create policy avail_write on availability_slots for all using (is_teacher()) with check (is_teacher());

-- message threads: family members + teachers + admin
drop policy if exists threads_read on message_threads;
create policy threads_read on message_threads for select
  using (is_teacher() or household_id in (select my_household_ids()));
drop policy if exists threads_write on message_threads;
create policy threads_write on message_threads for all
  using (is_teacher() or household_id in (select my_household_ids()))
  with check (is_teacher() or household_id in (select my_household_ids()));

-- messages: participants of the thread
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (
  is_teacher() or exists (
    select 1 from message_threads t where t.id = thread_id and t.household_id in (select my_household_ids())
  )
);
drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert with check (
  is_teacher() or exists (
    select 1 from message_threads t where t.id = thread_id and t.household_id in (select my_household_ids())
  )
);

-- =============================================================================
-- Storage buckets for photos + music (public read)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('photos','photos',true), ('music','music',true)
on conflict (id) do nothing;

drop policy if exists "mlda public read" on storage.objects;
create policy "mlda public read" on storage.objects for select
  using (bucket_id in ('photos','music','uploads'));
drop policy if exists "mlda auth upload" on storage.objects;
create policy "mlda auth upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','music','uploads'));
drop policy if exists "mlda auth update" on storage.objects;
create policy "mlda auth update" on storage.objects for update to authenticated
  using (bucket_id in ('photos','music','uploads'));
