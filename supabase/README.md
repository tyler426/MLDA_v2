# Supabase backend — setup & deploy

## 1. Create the project
Create a project at https://supabase.com → copy the URL + anon key into `.env.local`
(see `.env.example`). Copy the **service-role** key somewhere safe (server-only).

## 2. Push the database
```bash
npm install -g supabase           # one-time
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                  # runs migrations/0001 + 0002
```

## 3. Storage (absence documents)
In the dashboard → Storage → create a bucket named **`uploads`** (public read is fine
for now; tighten with signed URLs later).

## 4. Edge Functions
```bash
supabase functions deploy send-email
supabase functions deploy daily-digest
supabase functions deploy ics-feed
supabase functions deploy invite-member

supabase secrets set RESEND_API_KEY=...  FROM_EMAIL="MLDA Collective <noreply@yourdomain>" \
  SITE_URL="https://your-app.vercel.app"
```
`invite-member` creates a login and links it as a **parent**, **teacher**, or **dancer**.
Authz: admins can invite anyone; a household manager (a caregiver with `can_manage`) can
invite another caregiver or a dancer login to their own household; teacher invites are
admin-only. `SITE_URL` sets where invite emails redirect.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 5. Schedule the daily digest (cron)
In the SQL editor, enable pg_cron + pg_net and schedule a call to the function, e.g. 6am Denver:
```sql
select cron.schedule(
  'daily-digest', '0 13 * * *',   -- 13:00 UTC ≈ 06:00 MST (adjust for DST)
  $$ select net.http_post(
       url:='https://<project-ref>.functions.supabase.co/daily-digest',
       headers:=jsonb_build_object('Authorization','Bearer <service-role-key>')
  ) $$
);
```

## 6. First admin user
Sign up once through the app's `/login`, then in SQL:
```sql
update profiles set role = 'admin' where email = 'you@yourdomain.com';
```

## Notes
- RLS is ON for every table. The service-role key (functions/cron) bypasses it.
- Update `CalendarSync.jsx` / `TeacherCalendarSync.jsx` to build the ICS URL from
  `https://<project-ref>.functions.supabase.co/ics-feed?type=parent&token=<ics_token>`.
