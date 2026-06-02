#!/usr/bin/env node
// =============================================================================
// Base44 → Supabase data migration
// =============================================================================
// Reads exported Base44 JSON (one file per entity in ./base44-export/) and loads
// it into Supabase, remapping Base44's 24-hex ids to fresh UUIDs and rewriting
// every foreign key. Optionally creates a login per household so caregivers can
// sign in. See docs/DATA_IMPORT.md.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-base44.mjs
//   add  --invite-households  to also create caregiver logins from household emails
//
// Requires: npm i @supabase/supabase-js   (and Node 18+)
// =============================================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const INVITE = process.argv.includes('--invite-households');
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const DIR = './base44-export';
const idMap = {};   // idMap[table][oldId] = newUuid

// Per-table: source file (Base44 entity name), column whitelist, FK + array-FK maps.
const PLAN = [
  { t: 'studios', src: 'Studio', cols: ['name'] },
  { t: 'teachers', src: 'Teacher', cols: ['first_name','last_name','initials','email','phone','notification_prefs','archived'], freshIcs: true },
  { t: 'households', src: 'ParentHousehold', cols: ['primary_contact_name','email','phone','notification_prefs'], freshIcs: true },
  { t: 'pieces', src: 'Piece', cols: ['title','choreographer','season','level'] },
  { t: 'competition_weekends', src: 'CompetitionWeekend', cols: ['name','start_date','end_date','venue','notes','competing_entries'] },
  { t: 'dancers', src: 'Dancer', cols: ['first_name','last_name','dob','program','level','jackrabbit_student_id','archived'],
    fk: { parent_household_id: 'households' } },
  { t: 'dance_classes', src: 'DanceClass', cols: ['title','day_of_week','one_time_date','start_time','end_time','guest_artist','guest_artist_name','level','age_range','week_variant'],
    fk: { studio_id: 'studios', teacher_id: 'teachers' } },
  { t: 'rehearsal_blocks', src: 'RehearsalBlock', cols: ['date','start_time','end_time','notes'],
    fk: { studio_id: 'studios', teacher_id: 'teachers' }, arrfk: { piece_ids: 'pieces', dancer_ids: 'dancers' } },
  { t: 'class_enrollments', src: 'ClassEnrollment', cols: ['active'],
    fk: { class_id: 'dance_classes', dancer_id: 'dancers' } },
  { t: 'piece_casts', src: 'PieceCast', cols: [],
    fk: { piece_id: 'pieces', dancer_id: 'dancers' } },
  { t: 'space_bookings', src: 'SpaceBooking', cols: ['type','date','start_time','duration_hours','hour_slots','notes'],
    fk: { studio_id: 'studios', teacher_id: 'teachers' }, arrfk: { piece_ids: 'pieces', dancer_ids: 'dancers' } },
  { t: 'competition_shifts', src: 'CompetitionShift', cols: ['date','start_time','end_time','role'],
    fk: { competition_weekend_id: 'competition_weekends', teacher_id: 'teachers' } },
  { t: 'schedule_exceptions', src: 'ScheduleException', cols: ['date','type','new_time','reason'],
    fk: { class_id: 'dance_classes', dancer_id: 'dancers', rehearsal_block_id: 'rehearsal_blocks', new_studio_id: 'studios', new_teacher_id: 'teachers' } },
  { t: 'attendance_records', src: 'AttendanceRecord', cols: ['date','status','notes'],
    fk: { class_id: 'dance_classes', dancer_id: 'dancers', taken_by_teacher_id: 'teachers' } },
  { t: 'absence_reports', src: 'AbsenceReport', cols: ['start_date','end_date','reason','excused','document_url','status','admin_notes','messages'],
    fk: { dancer_id: 'dancers', household_id: 'households' }, arrfk: { class_ids: 'dance_classes' } },
  { t: 'schedule_notifications', src: 'ScheduleNotification', cols: ['recipient_email','recipient_type','type','title','message','payload','read'] },
];

function load(src) {
  const path = `${DIR}/${src}.json`;
  if (!existsSync(path)) { console.warn(`  (skip) no ${path}`); return []; }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.data ?? raw.records ?? []);
}

function mapFk(table, oldId) {
  if (!oldId) return null;
  return idMap[table]?.[oldId] ?? null;   // unresolved → null (logged)
}

async function importTable(p) {
  const rows = load(p.src);
  if (!rows.length) { console.log(`${p.t}: 0`); return; }
  idMap[p.t] = idMap[p.t] || {};
  let unresolved = 0;

  const out = rows.map((r) => {
    const id = randomUUID();
    idMap[p.t][r.id] = id;
    const row = { id };
    for (const c of p.cols) if (r[c] !== undefined) row[c] = r[c];
    for (const [col, tbl] of Object.entries(p.fk || {})) {
      row[col] = mapFk(tbl, r[col]);
      if (r[col] && !row[col]) unresolved++;
    }
    for (const [col, tbl] of Object.entries(p.arrfk || {})) {
      row[col] = (r[col] || []).map((x) => mapFk(tbl, x)).filter(Boolean);
    }
    if (p.freshIcs) row.ics_token = randomUUID();
    return row;
  });

  // Insert in batches of 500.
  for (let i = 0; i < out.length; i += 500) {
    const batch = out.slice(i, i + 500);
    const { error } = await supabase.from(p.t).insert(batch);
    if (error) { console.error(`${p.t} batch ${i}: ${error.message}`); process.exit(1); }
  }
  console.log(`${p.t}: ${out.length}${unresolved ? `  (${unresolved} unresolved FK → null)` : ''}`);
}

async function inviteHouseholds() {
  const households = load('ParentHousehold');
  let n = 0;
  for (const h of households) {
    if (!h.email) continue;
    const newHid = idMap.households[h.id];
    let uid;
    const { data: inv, error } = await supabase.auth.admin.inviteUserByEmail(h.email, {
      data: { full_name: h.primary_contact_name },
    });
    if (error) {
      const { data: list } = await supabase.auth.admin.listUsers();
      uid = list.users.find((u) => u.email?.toLowerCase() === h.email.toLowerCase())?.id;
      if (!uid) { console.warn(`  invite failed ${h.email}: ${error.message}`); continue; }
    } else uid = inv.user.id;

    await supabase.from('profiles').upsert({ id: uid, email: h.email, full_name: h.primary_contact_name, role: 'parent' }, { onConflict: 'id' });
    await supabase.from('household_members').upsert({ household_id: newHid, profile_id: uid, relationship: 'guardian', is_primary: true }, { onConflict: 'household_id,profile_id' });
    n++;
  }
  console.log(`household logins: ${n}`);
}

console.log('Importing Base44 export → Supabase…');
for (const p of PLAN) await importTable(p);
if (INVITE) { console.log('Creating household logins…'); await inviteHouseholds(); }
console.log('Done.');
