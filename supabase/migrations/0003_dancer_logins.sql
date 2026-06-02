-- =============================================================================
-- Dancer logins — students (age 10+) get their own login to see their own info.
-- Also: link teachers to logins. Family self-invite is authz'd in the
-- invite-member edge function (no schema change needed there).
-- =============================================================================

-- 1. New role.
alter type app_role add value if not exists 'dancer';

-- 2. Link a dancer record to a login (nullable: admin can create before signup).
alter table dancers add column if not exists profile_id uuid unique references profiles(id) on delete set null;
create index if not exists idx_dancers_profile on dancers(profile_id);

-- 3. Helper: the dancer record that IS the current user.
create or replace function my_self_dancer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from dancers where profile_id = auth.uid() limit 1;
$$;

-- 4. A dancer may read their own dancer row (in addition to caregivers/teachers).
drop policy if exists dancers_read on dancers;
create policy dancers_read on dancers for select
  using (
    is_teacher()
    or parent_household_id in (select my_household_ids())
    or profile_id = auth.uid()
  );

-- 5. A dancer may read their own attendance + absence history.
create policy attendance_self_read on attendance_records for select
  using (dancer_id = (select my_self_dancer_id()));
create policy absence_self_read on absence_reports for select
  using (dancer_id = (select my_self_dancer_id()));

-- Shared scheduling tables (classes, enrollments, pieces, studios, teachers,
-- rehearsals, exceptions) are already readable by any authenticated user, so a
-- dancer login can resolve their own schedule with no further policy changes.
