-- 0005 — Security hardening (APPLIED 2026-06-12)

-- =====================================================================
-- #1 (HIGH) Prevent privilege escalation: block a user changing their own
--     profiles.role / email. A column-level REVOKE is a no-op here because a
--     table-level UPDATE grant covers all columns, so use a trigger instead.
--     Admins and the service-role (invite-member edge fn) may still set roles.
-- =====================================================================
create or replace function public.guard_profile_privfields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'service_role' or is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role or new.email is distinct from old.email then
    raise exception 'Not allowed to change role or email';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_privfields on public.profiles;
create trigger guard_profile_privfields before update on public.profiles
  for each row execute function public.guard_profile_privfields();

-- =====================================================================
-- #2 (HIGH) Move the Jackrabbit secret out of the world-readable app_settings
--     row into an admin-only table.
-- =====================================================================
create table if not exists public.app_secrets (
  id          int primary key default 1,
  jackrabbit_api_key text,
  updated_at  timestamptz default now()
);
insert into public.app_secrets (id, jackrabbit_api_key)
  select 1, jackrabbit_api_key from public.app_settings where id = 1
  on conflict (id) do update set jackrabbit_api_key = excluded.jackrabbit_api_key;
alter table public.app_secrets enable row level security;
drop policy if exists app_secrets_admin on public.app_secrets;
create policy app_secrets_admin on public.app_secrets
  for all using (is_admin()) with check (is_admin());
alter table public.app_settings drop column if exists jackrabbit_api_key;

-- =====================================================================
-- #4 (MED) Move teacher calendar-feed token out of the broadly-readable
--     teachers table into a scoped secrets table (the app reads teachers with
--     select *, so a column REVOKE would break it — move the column instead).
-- =====================================================================
create table if not exists public.teacher_secrets (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  ics_token  uuid not null default gen_random_uuid()
);
insert into public.teacher_secrets (teacher_id, ics_token)
  select id, ics_token from public.teachers
  on conflict (teacher_id) do nothing;
alter table public.teacher_secrets enable row level security;
drop policy if exists teacher_secrets_self on public.teacher_secrets;
create policy teacher_secrets_self on public.teacher_secrets for select using (
  is_admin() or teacher_id in (
    select t.id from public.teachers t
    join public.profiles p on lower(p.email) = lower(t.email)
    where p.id = auth.uid()
  )
);
drop policy if exists teacher_secrets_admin on public.teacher_secrets;
create policy teacher_secrets_admin on public.teacher_secrets for all using (is_admin()) with check (is_admin());

create or replace function public.my_ics_token() returns uuid
  language sql stable security definer set search_path = public as $$
    select ts.ics_token from public.teacher_secrets ts
    join public.teachers t on t.id = ts.teacher_id
    join public.profiles p on lower(p.email) = lower(t.email)
    where p.id = auth.uid() limit 1
  $$;
grant execute on function public.my_ics_token() to authenticated;

-- Drop only AFTER ics-feed + TeacherSettings are redeployed to read the new location.
alter table public.teachers drop column if exists ics_token;
