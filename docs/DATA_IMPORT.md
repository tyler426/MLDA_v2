# Base44 → Supabase: data export & import

Move live records (dancers, classes, families…) from Base44 into Supabase.
Run **after** the schema migrations (`supabase db push`) succeed.

---

## Why a script (not copy-paste)

Base44 ids look like `6a04c977e9628085a3a28c57` (24-hex Mongo style). Supabase uses
**UUIDs**. So every id changes, and every link between tables (a dancer → its family,
a class → its teacher) must be **rewired** to the new ids. `scripts/migrate-from-base44.mjs`
does this automatically: it assigns fresh UUIDs and rewrites all foreign keys.

---

## Step 1 — Export from Base44

Get one JSON file per entity into a folder named `base44-export/` at the project root.
Each file is an **array of records**, named exactly after the entity.

```
base44-export/
  Studio.json  Teacher.json  ParentHousehold.json  Dancer.json
  DanceClass.json  ClassEnrollment.json  Piece.json  PieceCast.json
  RehearsalBlock.json  SpaceBooking.json  CompetitionWeekend.json
  CompetitionShift.json  ScheduleException.json  AttendanceRecord.json
  AbsenceReport.json  ScheduleNotification.json
```

Two ways to get them:
- **Base44 dashboard** → each entity → Export → JSON, OR
- **Base44 API/SDK**: list each entity and write the array to `base44-export/<Entity>.json`.

(Missing files are skipped, so partial exports are fine.)

## Step 2 — Run the import

```bash
npm install                       # needs @supabase/supabase-js (already in deps)

SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
node scripts/migrate-from-base44.mjs
```

It prints a per-table count, e.g.:
```
studios: 4
teachers: 11
households: 86   ...
dancers: 142  (3 unresolved FK → null)
```
"Unresolved FK → null" = a record pointed at something not in the export (e.g. a dancer
whose family wasn't exported). Re-export the missing entity and re-run if needed.

> ⚠️ Run against an **empty** database. Re-running **adds duplicates** — to redo, truncate
> the tables first (or reset the DB) before running again.

## Step 3 — Create caregiver logins (optional, recommended)

To give each existing family a login (using the email already on the household):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/migrate-from-base44.mjs --invite-households
```

This invites one caregiver per household (the primary contact) and links them via
`household_members`. Additional caregivers (the 2nd/3rd parent) are added later from the
**Admin → Roster → [family] → Caregivers** panel, which sends its own invites.

## Step 4 — Make yourself admin

```sql
update profiles set role = 'admin' where email = 'you@yourdomain.com';
```

---

## What the script handles vs. doesn't

**Handled:** id remapping, all foreign keys, array links (`piece_ids`, `dancer_ids`,
`class_ids`), JSON fields (`messages`, `notification_prefs`, `competing_entries`,
`payload`, `hour_slots`), enum values, fresh `ics_token`s, batched inserts, table order.

**Check by hand:**
- **`competing_entries`** (on competitions) is freeform JSON — if it embeds dancer/piece
  ids internally, those are copied as-is, not remapped.
- **Uploaded files** (absence `document_url`) still point at Base44's storage. Re-host them
  in Supabase Storage and update the URLs if you need them long-term.
- **Attendance/notification history** imports, but old `recipient_email` values are kept
  verbatim (they're matched to logins by email at read time).
