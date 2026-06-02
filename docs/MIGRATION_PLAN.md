# MLDA Collective — Base44 → Supabase + Vercel Migration Plan

Plain-English, step-by-step. Phases are ordered so the app keeps working as we go.

---

## Guiding strategy: a "compatibility adapter"

Instead of rewriting all 30 screens by hand, we build one small file that **speaks the same
language the screens already use** (`.list()`, `.filter()`, `.create()`, …) but talks to Supabase
underneath. The screens then change by a single import line instead of being rewritten. This makes
the riskiest, most repetitive part of the migration fast and safe.

---

## Phase 0 — Setup & accounts  ✅ (foundation built this session)

- [x] Get the code out of Base44 (done — downloaded as zip).
- [x] Initialize git for version control.
- [x] Write this plan + the dependency inventory.
- [ ] Create a **Supabase** project (free tier is fine to start). → you do this; gives us 3 keys.
- [ ] Create a **Vercel** account and connect the git repo.
- [ ] Create a **Resend** account for email (or pick SendGrid/Postmark).

## Phase 1 — Database  ✅ (schema built this session)

- [x] Translate the 18 Base44 entities into Postgres tables (`supabase/migrations/0001_*.sql`).
- [x] Add the **new multi-caregiver CRM model**: `households`, `household_members` (2–3 caregivers
      per family, each with their own login), `dancers`, plus `profiles` for every login.
- [x] Write **Row-Level Security** policies (`supabase/migrations/0002_*.sql`).
- [ ] Run the migrations against your Supabase project (`supabase db push`).
- [ ] Export live data from Base44 and import it (`docs/DATA_IMPORT.md` — to be written).

## Phase 2 — Auth & roles

- [x] New Supabase client (`src/lib/supabaseClient.js`).
- [x] New `AuthContext` backed by Supabase Auth + `profiles`.
- [x] New role logic reading the `role` column.
- [ ] Build the login screen (email magic-link + password).
- [ ] Caregiver invite flow (admin invites a parent → they get a login tied to a household).

## Phase 3 — Data layer (the adapter)

- [x] Build `src/api/db.js` — the compatibility adapter (entities + auth + integrations surface).
- [ ] Point every screen at the adapter (swap `@/api/base44Client` → `@/api/db`). Mechanical.
- [ ] Verify reads/writes per screen.

## Phase 4 — Integrations

- [ ] **File upload** (absence notes) → Supabase Storage bucket + signed URLs.
- [ ] **Email** → Resend, wrapped in a Supabase Edge Function.
- [ ] **Daily digest** → Edge Function + scheduled cron (replaces `dailyDigest`).
- [ ] **ICS calendar feed** → new serverless function generating `.ics` per token. 🔴 from scratch.

## Phase 5 — Deploy

- [ ] Deploy frontend to **Vercel**, wire env vars.
- [ ] Point Supabase Edge Functions / cron live.
- [ ] Custom domain + SSL.

## Phase 6 — Design refresh ("cloud designs")

- [ ] Pass the screens through a design upgrade (flow + feel), keeping the new data layer intact.

## Phase 7 — Decommission Base44

- [ ] Remove `@base44/*` packages, `base44/` folder, `app-params.js`.
- [ ] Final security review of RLS policies.
- [ ] Cancel Base44 once data + features are verified live.

---

## The new login model (what changed and why)

**Before (Base44):** one email per family; your role was guessed by matching your email to a table.

**After:** every person is a **login** (`profiles`) with a clear role. A **household** (family) can have
**multiple caregiver logins** via `household_members` — so a student's mum, dad, and a grandparent can
each have their own account and all see that student's schedule. Teachers and admins are logins too.

```
auth.users ─1:1─ profiles ──< household_members >── households ──< dancers
                    │                                              
                    └─ (role: admin | teacher | parent)           
teachers ─ optional link ─ profiles      dancers ──< class_enrollments >── dance_classes
```

See `docs/SCHEMA.md` for the full table list.
