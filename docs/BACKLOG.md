# Backlog — future ideas / in-flight

## Requested (queued to build)
- **Teacher-side piece upload.** Teachers can create pieces, upload music, cast students
  (esp. solos) — make it less admin-heavy. Pieces stay shared; segregate Solos vs Groups in the UI.
- **Routine type: Solo vs Group.** Add a size/type to pieces; segregate the list.
- **Competition classifications (configurable).** Genre (lyrical, jazz…), Size (solo, small/large
  group, line, production), Age division (mini, junior, teen, senior). Editable in a Settings
  "Classifications" section; pieces reference them.
- **Test suite.** Unit + integration (Vitest) and end-to-end (Playwright) covering auth, RLS,
  the booking/enroll/broadcast flows.
- **Observability.** Error tracking (e.g. Sentry), structured logging on edge functions,
  uptime + an admin "what changed" audit trail.

## Security / privacy (important)
- **Private storage buckets + signed URLs.** `photos`, `uploads` (absence docs), `music` are
  currently public-read. Minors' photos + medical absence notes should be in PRIVATE buckets
  served via short-lived signed URLs. ← do before real families are added.
- **Rotate shared secrets** (Supabase access token, DB password) once the build settles.
- **Audit log** of access to PII.

## Smaller items
- **Dancer Week: date/month toggle** to match the parent experience.
- **Jackrabbit sync** — only an API-key field exists; build the real import.
- **ICS per-dancer feed.**
- **Caregiver/household switcher** for a caregiver in >1 household.
