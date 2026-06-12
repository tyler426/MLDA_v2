-- 0005 — Security hardening
-- Apply with a valid Supabase access token (Management API) or via `supabase db push`.
-- Safe to run once; idempotent where practical.

-- =====================================================================
-- #1 (HIGH) Prevent privilege escalation: users can no longer write their
--     own profiles.role. Role assignment happens via the service-role key
--     (invite-member edge function / admin tooling), which bypasses grants.
-- =====================================================================
revoke update (role) on public.profiles from authenticated, anon;
-- (email is also identity-ish; lock it too so a user can't hijack a known address)
revoke update (email) on public.profiles from authenticated, anon;

-- =====================================================================
-- #2 (HIGH) Move the Jackrabbit secret out of the broadly-readable
--     app_settings row into an admin-only table. Every authenticated user
--     could previously `select jackrabbit_api_key from app_settings`.
-- =====================================================================
create table if not exists public.app_secrets (
  id          int primary key default 1,
  jackrabbit_api_key text,
  updated_at  timestamptz default now()
);

-- carry the existing value over (if any) before dropping the old column
insert into public.app_secrets (id, jackrabbit_api_key)
  select 1, jackrabbit_api_key from public.app_settings where id = 1
  on conflict (id) do update set jackrabbit_api_key = excluded.jackrabbit_api_key;

alter table public.app_secrets enable row level security;
drop policy if exists app_secrets_admin on public.app_secrets;
create policy app_secrets_admin on public.app_secrets
  for all using (is_admin()) with check (is_admin());

-- remove the secret from the world-readable settings row
alter table public.app_settings drop column if exists jackrabbit_api_key;

-- =====================================================================
-- Verify after running:
--   select 1 from information_schema.column_privileges
--     where table_name='profiles' and column_name='role' and grantee='authenticated';
--   -- expect 0 rows (no update grant)
--   select * from app_secrets;            -- admin only
--   select jackrabbit_api_key from app_settings;  -- expect: column does not exist
-- =====================================================================
