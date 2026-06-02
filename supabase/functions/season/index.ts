// Supabase Edge Function: season — archive / list / restore a season.
// Snapshots the season-scoped tables (not dancers/teachers/studios/families),
// optionally clears them, and can reload any archived snapshot (ids preserved
// so all the internal links stay intact). Admin-only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: cors });

// FK-safe insert order (parents first). Delete uses the reverse.
const TABLES = [
  'pieces', 'dance_classes', 'rehearsal_blocks', 'competition_weekends',
  'class_enrollments', 'piece_casts', 'space_bookings', 'competition_shifts',
  'competition_entries', 'schedule_exceptions', 'costumes', 'schedule_notifications',
];
const NIL = '00000000-0000-0000-0000-000000000000';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: me } = await caller.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { action, name, id, clear } = await req.json();

    if (action === 'list') {
      const { data } = await admin.from('season_archives').select('id, name, table_counts, created_at').order('created_at', { ascending: false });
      return json({ archives: data ?? [] });
    }

    if (action === 'archive') {
      const data: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      for (const t of TABLES) {
        const { data: rows } = await admin.from(t).select('*');
        data[t] = rows ?? [];
        counts[t] = (rows ?? []).length;
      }
      const { data: arch, error } = await admin.from('season_archives')
        .insert({ name: name || `Season ${new Date().toISOString().slice(0, 10)}`, data, table_counts: counts })
        .select('id, name, table_counts, created_at').single();
      if (error) return json({ error: error.message }, 400);

      if (clear) {
        for (const t of [...TABLES].reverse()) {
          await admin.from(t).delete().neq('id', NIL);
        }
      }
      return json({ archive: arch, cleared: !!clear });
    }

    if (action === 'restore') {
      const { data: arch, error } = await admin.from('season_archives').select('data').eq('id', id).single();
      if (error || !arch) return json({ error: 'Archive not found' }, 404);
      const data = arch.data as Record<string, unknown[]>;
      const result: Record<string, string | number> = {};
      for (const t of TABLES) {
        const rows = data[t] ?? [];
        if (!rows.length) { result[t] = 0; continue; }
        const { error: e } = await admin.from(t).upsert(rows, { onConflict: 'id' });
        result[t] = e ? `error: ${e.message}` : rows.length;
      }
      return json({ restored: result });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
