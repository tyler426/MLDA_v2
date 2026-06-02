// =============================================================================
// Compatibility data layer — Base44 SDK surface, backed by Supabase.
//
// Lets existing screens keep calling `.entities.X.list()/.filter()/.create()/...`
// and `.auth.me()` etc., so migration is a one-line import swap:
//     import { base44 } from '@/api/base44Client';   // OLD
//     import { db as base44 } from '@/api/db';        // NEW
//
// NOTE: household/caregiver screens still need real edits for the new
// multi-login model (ParentHousehold → households + household_members).
// =============================================================================
import { supabase } from '@/lib/supabaseClient';

// Base44 entity name → Postgres table name
const TABLE = {
  Dancer: 'dancers',
  Teacher: 'teachers',
  ParentHousehold: 'households',
  Studio: 'studios',
  DanceClass: 'dance_classes',
  ClassEnrollment: 'class_enrollments',
  Piece: 'pieces',
  PieceCast: 'piece_casts',
  RehearsalBlock: 'rehearsal_blocks',
  SpaceBooking: 'space_bookings',
  CompetitionWeekend: 'competition_weekends',
  CompetitionShift: 'competition_shifts',
  ScheduleException: 'schedule_exceptions',
  AttendanceRecord: 'attendance_records',
  AbsenceReport: 'absence_reports',
  ScheduleNotification: 'schedule_notifications',
};

// Base44 used `created_date`; our columns use `created_at`. Translate sort keys
// and expose `created_date` on returned rows for backward compatibility.
function mapField(f) {
  return f === 'created_date' ? 'created_at' : f;
}
function withCreatedDate(row) {
  if (row && row.created_at && row.created_date === undefined) {
    return { ...row, created_date: row.created_at };
  }
  return row;
}

function applyOrder(query, order) {
  if (!order) return query;
  const desc = order.startsWith('-');
  const col = mapField(desc ? order.slice(1) : order);
  return query.order(col, { ascending: !desc });
}

function makeEntity(name) {
  const table = TABLE[name];
  return {
    async list(order, limit) {
      let q = supabase.from(table).select('*');
      q = applyOrder(q, order);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(withCreatedDate);
    },
    async filter(criteria = {}, order, limit) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(criteria)) {
        q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      }
      q = applyOrder(q, order);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(withCreatedDate);
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return withCreatedDate(data);
    },
    async create(values) {
      const { data, error } = await supabase.from(table).insert(values).select().single();
      if (error) throw error;
      return withCreatedDate(data);
    },
    async update(id, values) {
      const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single();
      if (error) throw error;
      return withCreatedDate(data);
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },
  };
}

const entities = Object.fromEntries(Object.keys(TABLE).map((n) => [n, makeEntity(n)]));

// ----------------------------------------------------------------------------
// auth — mirrors base44.auth, merges profile + (admin) app_settings
// ----------------------------------------------------------------------------
const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const e = new Error('Not authenticated');
      e.status = 401;
      throw e;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const merged = { ...user, ...(profile || {}) };

    // Admin-only global settings, surfaced on the user object like Base44 did.
    if (profile?.role === 'admin') {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('global_notifications_enabled, jackrabbit_api_key')
        .eq('id', 1)
        .single();
      Object.assign(merged, settings || {});
    }
    return merged;
  },

  async updateMe(values) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const settingsKeys = ['global_notifications_enabled', 'jackrabbit_api_key'];
    const settingsPatch = {};
    const profilePatch = {};
    for (const [k, v] of Object.entries(values)) {
      if (settingsKeys.includes(k)) settingsPatch[k] = v;
      else profilePatch[k] = v;
    }
    if (Object.keys(settingsPatch).length) {
      await supabase.from('app_settings').update(settingsPatch).eq('id', 1);
    }
    if (Object.keys(profilePatch).length) {
      await supabase.from('profiles').update(profilePatch).eq('id', user.id);
    }
    return this.me();
  },

  async logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  },

  redirectToLogin() {
    window.location.href = '/login';
  },
};

// ----------------------------------------------------------------------------
// integrations — SendEmail (via Edge Function) + UploadFile (Supabase Storage)
// ----------------------------------------------------------------------------
const integrations = {
  Core: {
    async SendEmail({ to, subject, body }) {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, body },
      });
      if (error) throw error;
      return data;
    },
    async UploadFile({ file }) {
      const path = `absence-docs/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

export const db = { entities, auth, integrations };
export default db;
