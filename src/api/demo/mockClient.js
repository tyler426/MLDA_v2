// In-memory mock of the Supabase client used in DEMO MODE.
// Implements the subset of the supabase-js API this app actually calls:
// from().select/eq/in/order/limit/single/maybeSingle/insert/update/delete/upsert
// (incl. embedded `table(*)` joins), auth.*, functions.invoke, storage.
import { buildSeed, DEMO_USERS } from './seed';

const STORE_KEY = 'mlda_demo_store';
const UID_KEY = 'mlda_demo_uid';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seed = buildSeed();
  localStorage.setItem(STORE_KEY, JSON.stringify(seed));
  return seed;
}
let store = loadStore();
const persist = () => localStorage.setItem(STORE_KEY, JSON.stringify(store));

// Reset helper (exposed on window for convenience).
export function resetDemo() { localStorage.removeItem(STORE_KEY); store = loadStore(); }

// Foreign keys for embedded selects like `households(*)`, `profiles(...)`.
const EMBED_FK = {
  household_members: { households: 'household_id', profiles: 'profile_id' },
};

function parseEmbeds(selectStr) {
  // returns [{ name, cols }]
  const embeds = [];
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(selectStr))) embeds.push({ name: m[1], cols: m[2].trim() });
  return embeds;
}

class Query {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.selectStr = '*';
    this.filters = [];
    this._order = null;
    this._limit = null;
    this._single = null; // 'single' | 'maybe'
    this.payload = null;
    this.conflict = null;
  }
  select(str = '*') { if (this.op === 'select') this.op = 'select'; this.selectStr = str; return this; }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  in(col, arr) { this.filters.push((r) => (arr || []).includes(r[col])); return this; }
  order(col, opts = {}) { this._order = { col, asc: opts.ascending !== false }; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = 'single'; return this; }
  maybeSingle() { this._single = 'maybe'; return this; }
  insert(vals) { this.op = 'insert'; this.payload = vals; return this; }
  update(vals) { this.op = 'update'; this.payload = vals; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(vals, opts = {}) { this.op = 'upsert'; this.payload = vals; this.conflict = opts.onConflict; return this; }

  _rows() {
    let rows = (store[this.table] || []).slice();
    for (const f of this.filters) rows = rows.filter(f);
    if (this._order) {
      const { col, asc } = this._order;
      rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this._limit) rows = rows.slice(0, this._limit);
    const embeds = parseEmbeds(this.selectStr).filter((e) => EMBED_FK[this.table]?.[e.name]);
    if (embeds.length) {
      rows = rows.map((r) => {
        const out = { ...r };
        for (const e of embeds) {
          const fk = EMBED_FK[this.table][e.name];
          out[e.name] = (store[e.name] || []).find((x) => x.id === r[fk]) || null;
        }
        return out;
      });
    }
    return rows;
  }

  _result() {
    try {
      if (this.op === 'select') {
        const rows = this._rows();
        if (this._single === 'single') return rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'No rows' } };
        if (this._single === 'maybe') return { data: rows[0] || null, error: null };
        return { data: rows, error: null };
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved = list.map((v) => {
          store[this.table] = store[this.table] || [];
          if (this.op === 'upsert' && this.conflict) {
            const keys = this.conflict.split(',').map((k) => k.trim());
            const idx = store[this.table].findIndex((r) => keys.every((k) => r[k] === v[k]));
            if (idx >= 0) { store[this.table][idx] = { ...store[this.table][idx], ...v }; return store[this.table][idx]; }
          }
          const row = { id: v.id || uuid(), created_at: new Date().toISOString(), ...v };
          if (!v.id) row.id = uuid();
          store[this.table].push(row);
          return row;
        });
        persist();
        return { data: this._single ? saved[0] : saved, error: null };
      }
      if (this.op === 'update') {
        const rows = (store[this.table] || []).filter((r) => this.filters.every((f) => f(r)));
        rows.forEach((r) => Object.assign(r, this.payload));
        persist();
        return { data: this._single ? rows[0] : rows, error: null };
      }
      if (this.op === 'delete') {
        store[this.table] = (store[this.table] || []).filter((r) => !this.filters.every((f) => f(r)));
        persist();
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'unsupported op' } };
    } catch (e) {
      return { data: null, error: { message: String(e) } };
    }
  }
  then(resolve) { resolve(this._result()); }
}

// ---- auth ----
const listeners = [];
function currentUser() {
  const uid = localStorage.getItem(UID_KEY);
  if (!uid) return null;
  return (store.profiles || []).find((p) => p.id === uid) || null;
}
function notify() {
  const u = currentUser();
  listeners.forEach((cb) => cb(u ? 'SIGNED_IN' : 'SIGNED_OUT', u ? { user: { id: u.id, email: u.email } } : null));
}
const auth = {
  async getUser() {
    const u = currentUser();
    return u ? { data: { user: { id: u.id, email: u.email } }, error: null }
             : { data: { user: null }, error: { message: 'No session', status: 401 } };
  },
  async getSession() {
    const u = currentUser();
    return { data: { session: u ? { user: { id: u.id, email: u.email } } : null }, error: null };
  },
  async signInWithPassword({ email }) {
    const u = (store.profiles || []).find((p) => p.email?.toLowerCase() === email?.toLowerCase());
    if (!u) return { data: null, error: { message: 'No demo user with that email' } };
    localStorage.setItem(UID_KEY, u.id); notify();
    return { data: { user: { id: u.id, email: u.email } }, error: null };
  },
  async signInWithOtp({ email }) { return this.signInWithPassword({ email }); },
  async signOut() { localStorage.removeItem(UID_KEY); notify(); return { error: null }; },
  onAuthStateChange(cb) {
    listeners.push(cb);
    return { data: { subscription: { unsubscribe() { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
  },
};

// ---- functions (edge functions emulated against the store) ----
const functions = {
  async invoke(name, { body } = {}) {
    try {
      if (name === 'send-email') return { data: { success: true }, error: null };
      if (name === 'invite-member') {
        const { email, role, household_id, relationship = 'guardian', is_primary = false, dancer_id, teacher_id, full_name } = body;
        let prof = (store.profiles || []).find((p) => p.email?.toLowerCase() === email?.toLowerCase());
        if (!prof) { prof = { id: uuid(), email, full_name, role }; store.profiles.push(prof); }
        else prof.role = role;
        if (role === 'parent') {
          store.household_members = store.household_members || [];
          if (!store.household_members.find((m) => m.household_id === household_id && m.profile_id === prof.id))
            store.household_members.push({ id: uuid(), household_id, profile_id: prof.id, relationship, is_primary, can_manage: true });
        } else if (role === 'dancer') {
          const d = store.dancers.find((x) => x.id === dancer_id); if (d) d.profile_id = prof.id;
        } else if (role === 'teacher') {
          const t = store.teachers.find((x) => x.id === teacher_id) || store.teachers.find((x) => x.email === email);
          if (t) t.profile_id = prof.id;
        }
        persist();
        return { data: { success: true, profile_id: prof.id }, error: null };
      }
      return { data: null, error: { message: 'unknown function ' + name } };
    } catch (e) { return { data: null, error: { message: String(e) } }; }
  },
};

// ---- storage ----
const storage = {
  from() {
    return {
      async upload() { return { data: { path: 'demo' }, error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: `https://demo.local/${path}` } }; },
    };
  },
};

export const mockSupabase = {
  from: (table) => new Query(table),
  auth,
  functions,
  storage,
};

if (typeof window !== 'undefined') window.resetDemo = resetDemo;
