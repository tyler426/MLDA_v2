# Base44 Dependency Inventory

Every place the app touches Base44, what it does, and the Supabase replacement.
Difficulty legend: 🟢 mechanical · 🟡 needs thought · 🔴 build-from-scratch / risky.

---

## 1. Packages (package.json)

| Dependency | What it does | Replace with | Difficulty |
|---|---|---|---|
| `@base44/sdk` | The whole client SDK — database, auth, email, file upload | `@supabase/supabase-js` | 🟡 |
| `@base44/vite-plugin` | Base44 build-time plugin (injects app config) | Nothing — delete it; use Vite env vars | 🟢 |
| `@stripe/react-stripe-js`, `@stripe/stripe-js` | Installed but **never imported anywhere** | Delete (unused) | 🟢 |

---

## 2. Core wiring (the "plumbing" files)

| File | What it does | Replace with | Difficulty |
|---|---|---|---|
| `src/api/base44Client.js` | Creates the Base44 client used everywhere | `src/lib/supabaseClient.js` + a compatibility adapter | 🟡 |
| `src/lib/app-params.js` | Reads a login token out of the URL, stores `base44_*` keys in browser localStorage | Delete — Supabase manages its own session | 🟢 |
| `src/lib/AuthContext.jsx` | Login state; calls Base44's `/api/apps/public` endpoint and `base44.auth.me()` | New `AuthContext` backed by Supabase Auth | 🟡 |
| `src/lib/useUserRole.js` | Works out if you're admin / teacher / parent by **matching your email** against tables | Read a proper `role` column from `profiles` | 🟡 |

---

## 3. Database reads & writes (the bulk of the work)

Every page uses `base44.entities.<Name>.list() / .filter() / .create() / .update() / .delete()`.
These all become `supabase.from('<table>').select() / .insert() / .update() / .delete()`,
or — using the compatibility adapter we're building — they barely change at all.

**Files that read/write entities (~30):**

- `src/components/absence/AttendancePolicies.jsx` — AttendanceRecord
- `src/components/shared/StudioAvailability.jsx` — Studio, SpaceBooking, RehearsalBlock, DanceClass
- `src/components/teacher/BookSpaceDialog.jsx` — SpaceBooking (create)
- `src/pages/MonthlyCalendar.jsx` — 11 entities (the heaviest reader)
- `src/pages/admin/AdminRoster.jsx` — Dancer, ParentHousehold, Teacher (create/update)
- `src/pages/admin/AdminDigest.jsx` — 6 entities + SendEmail + ScheduleNotification
- `src/pages/admin/AdminPieces.jsx` — Piece, PieceCast, Dancer
- `src/pages/admin/AdminSettings.jsx` — bulk list/delete across 8 entities, updateMe
- `src/pages/admin/AdminEnrollment.jsx`, `AdminBulkEnroll.jsx` — DanceClass, ClassEnrollment, Dancer
- `src/pages/admin/AdminConflicts.jsx`, `AdminSchedule.jsx` — DanceClass, Studio, Teacher, SpaceBooking
- `src/pages/admin/AdminAttendance.jsx` — AbsenceReport, AttendanceRecord, Dancer, DanceClass, ParentHousehold
- `src/pages/admin/AdminNotifications.jsx` — auth/me
- `src/pages/parent/ParentToday.jsx`, `ParentWeek.jsx` — ~11 entities each
- `src/pages/parent/ParentAbsence.jsx` — AbsenceReport (+ UploadFile)
- `src/pages/parent/Notifications.jsx`, `ParentSettings.jsx`, `CalendarSync.jsx`
- `src/pages/teacher/*` — TeacherToday/Week/Pieces/Competitions/Attendance/BookSpace/Settings/CalendarSync

➡️ Each is 🟢 **mechanical** with the adapter; the only care needed is around `.filter()` ordering/limits and array fields.

---

## 4. Authentication calls

| Call | Where | Supabase replacement | Difficulty |
|---|---|---|---|
| `base44.auth.me()` | ~20 files (almost every page) | `supabase.auth.getUser()` → join to `profiles` | 🟡 |
| `base44.auth.logout()` | AppShell, AuthContext | `supabase.auth.signOut()` | 🟢 |
| `base44.auth.redirectToLogin()` | Landing, AuthContext | Supabase sign-in page / magic link | 🟡 |
| `base44.auth.updateMe(...)` | AdminSettings | `update` on `profiles` / `app_settings` | 🟢 |
| `/api/apps/public` axios call | AuthContext | Delete — no equivalent needed | 🟢 |

---

## 5. Integrations (third-party services Base44 bundled)

| Call | Where | Supabase / new replacement | Difficulty |
|---|---|---|---|
| `integrations.Core.SendEmail` | AdminDigest, dailyDigest function | **Resend** (or SendGrid/Postmark) via an Edge Function | 🔴 |
| `integrations.Core.UploadFile` | ParentAbsence (doctor's notes) | **Supabase Storage** | 🟡 |

---

## 6. Backend function

| File | What it does | Replace with | Difficulty |
|---|---|---|---|
| `base44/functions/dailyDigest/entry.ts` | Deno function; emails each family its daily schedule; uses `asServiceRole` (admin DB access) and runs on a schedule | **Supabase Edge Function** + **scheduled cron** (Supabase cron or Vercel Cron) | 🔴 |
| `base44.asServiceRole.*` | Bypasses permissions to read all data server-side | Supabase **service-role key** (server-only) | 🟡 |

---

## 7. The data model

| Source | What it is | Becomes | Difficulty |
|---|---|---|---|
| `base44/entities/*.jsonc` (18 files) | Entity/table definitions | Postgres tables (see `supabase/migrations/`) | 🟡 |
| `base44/config.jsonc`, `.app.jsonc` | Base44 app metadata | Delete | 🟢 |

---

## 🔴 Things flagged as complicated

1. **The ICS calendar feed** — `CalendarSync.jsx` / `TeacherCalendarSync.jsx` hand out a URL like
   `/api/ics/parent/{token}`. **That endpoint is NOT in this code** — Base44 hosted it invisibly.
   It must be **built from scratch** as a serverless function that generates a `.ics` calendar file
   for a given token. (Affects: parent + teacher Calendar Sync screens, the `ics_token` fields.)

2. **Permissions / data security** — There is **zero permission logic in the code**. Base44 silently
   enforced who-can-see-what on its servers. On Supabase this becomes **Row-Level Security (RLS)**,
   which we must write explicitly. If skipped, every logged-in user could read every family's data.
   This is the single most important thing to get right.

3. **Email (daily digest + notifications)** — needs a real email provider account + an Edge Function +
   a scheduler. The digest also needs server-side ("service role") access to all families.

4. **Role detection by email-matching** — fragile. The migration replaces it with a real `role` field
   and the new multi-caregiver membership model (so one student can have 2–3 caregiver logins).

5. **Jackrabbit integration** — only an API-key text box exists (`AdminSettings.jsx`); **no actual sync
   code**. Decide whether to actually build the Jackrabbit sync or drop the field.

6. **Live data export** — the dancers/classes/etc. currently *inside* Base44's database are **not in this
   repo**. They must be exported from Base44 and imported into Supabase separately.
