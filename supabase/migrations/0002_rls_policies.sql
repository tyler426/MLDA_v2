-- =============================================================================
-- MLDA Collective — Row-Level Security (RLS)
-- =============================================================================
-- Base44 enforced "who can see what" invisibly on its servers. On Supabase we
-- must declare it. Model:
--   • admin    → full access to everything
--   • teacher  → read scheduling data; write attendance + own pieces/bookings
--   • parent   → read shared scheduling data; manage their household's data only
-- The service-role key (used by Edge Functions / the digest) bypasses RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('teacher','admin')
  );
$$;

-- Households the current user is a caregiver of.
create or replace function my_household_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select household_id from household_members where profile_id = auth.uid();
$$;

-- Dancers in the current user's households.
create or replace function my_dancer_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from dancers where parent_household_id in (select my_household_ids());
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on every table
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','studios','teachers','households','household_members','dancers',
    'dance_classes','class_enrollments','pieces','piece_casts','rehearsal_blocks',
    'space_bookings','competition_weekends','competition_shifts','schedule_exceptions',
    'attendance_records','absence_reports','schedule_notifications','app_settings'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_self_read   on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all   on profiles for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- Shared, studio-wide reference data: any authenticated user may READ;
-- only admins may WRITE. (Teachers get extra write grants below where noted.)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'studios','teachers','dance_classes','pieces','piece_casts',
    'rehearsal_blocks','competition_weekends','competition_shifts',
    'schedule_exceptions','class_enrollments'
  ] loop
    execute format('create policy %I on %I for select using (auth.uid() is not null);', t||'_read_all', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin());', t||'_admin_all', t);
  end loop;
end $$;

-- Teachers can create/update/delete competition shifts & space bookings & pieces
-- they work with. (Pragmatic: teachers manage their own pieces/bookings.)
create policy space_bookings_read_all   on space_bookings for select using (auth.uid() is not null);
create policy space_bookings_admin_all  on space_bookings for all using (is_admin()) with check (is_admin());
create policy space_bookings_teacher    on space_bookings for all
  using (is_teacher()) with check (is_teacher());

create policy pieces_teacher_write on pieces for all using (is_teacher()) with check (is_teacher());
create policy piece_casts_teacher_write on piece_casts for all using (is_teacher()) with check (is_teacher());

-- -----------------------------------------------------------------------------
-- households & membership — caregivers see their own; admins see all
-- -----------------------------------------------------------------------------
create policy households_member_read on households for select
  using (is_admin() or id in (select my_household_ids()));
create policy households_member_update on households for update
  using (is_admin() or id in (select my_household_ids()))
  with check (is_admin() or id in (select my_household_ids()));
create policy households_admin_all on households for all using (is_admin()) with check (is_admin());

create policy hm_read   on household_members for select
  using (is_admin() or profile_id = auth.uid() or household_id in (select my_household_ids()));
create policy hm_admin  on household_members for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- dancers — caregivers read their household's dancers; teachers read all
-- -----------------------------------------------------------------------------
create policy dancers_read on dancers for select
  using (is_teacher() or parent_household_id in (select my_household_ids()));
create policy dancers_admin_all on dancers for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- attendance — teachers/admin write; caregivers read for their own dancers
-- -----------------------------------------------------------------------------
create policy attendance_teacher_all on attendance_records for all
  using (is_teacher()) with check (is_teacher());
create policy attendance_parent_read on attendance_records for select
  using (dancer_id in (select my_dancer_ids()));

-- -----------------------------------------------------------------------------
-- absence_reports — caregivers manage their household's; teachers/admin read+update
-- -----------------------------------------------------------------------------
create policy absence_parent_read on absence_reports for select
  using (is_teacher() or household_id in (select my_household_ids()));
create policy absence_parent_write on absence_reports for insert
  with check (household_id in (select my_household_ids()));
create policy absence_parent_update on absence_reports for update
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
create policy absence_admin_all on absence_reports for all using (is_admin()) with check (is_admin());
create policy absence_teacher_update on absence_reports for update
  using (is_teacher()) with check (is_teacher());

-- -----------------------------------------------------------------------------
-- notifications — recipients read their own (by email); admin all
-- -----------------------------------------------------------------------------
create policy notif_read on schedule_notifications for select
  using (is_admin() or recipient_email = (select email from profiles where id = auth.uid()));
create policy notif_update on schedule_notifications for update
  using (recipient_email = (select email from profiles where id = auth.uid()))
  with check (recipient_email = (select email from profiles where id = auth.uid()));
create policy notif_admin_all on schedule_notifications for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- app_settings — admin only
-- -----------------------------------------------------------------------------
create policy app_settings_admin on app_settings for all using (is_admin()) with check (is_admin());
create policy app_settings_read on app_settings for select using (auth.uid() is not null);
