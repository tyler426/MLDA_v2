// Supabase Edge Function: invite-member
// Invites a login and links it as a parent, teacher, or dancer.
// Authz:
//   • admin                         → invite anyone
//   • household manager (can_manage) → invite a parent or dancer to THEIR household
//   • teacher invites are admin-only
// Deploy: supabase functions deploy invite-member
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: me } = await caller.from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = me?.role === 'admin';

    const {
      email, full_name, role,
      household_id, relationship = 'guardian', is_primary = false,
      dancer_id, teacher_id,
    } = await req.json();
    if (!email || !role) return json({ error: 'email and role required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- Authorization per role ---
    const managesHousehold = async (hid: string) => {
      if (!hid) return false;
      const { data } = await admin.from('household_members')
        .select('id').eq('household_id', hid).eq('profile_id', user.id).eq('can_manage', true).maybeSingle();
      return !!data;
    };

    if (role === 'teacher') {
      if (!isAdmin) return json({ error: 'Forbidden' }, 403);
    } else if (role === 'parent') {
      if (!isAdmin && !(await managesHousehold(household_id))) return json({ error: 'Forbidden' }, 403);
    } else if (role === 'dancer') {
      const { data: dancer } = await admin.from('dancers').select('parent_household_id').eq('id', dancer_id).single();
      if (!dancer) return json({ error: 'dancer not found' }, 400);
      if (!isAdmin && !(await managesHousehold(dancer.parent_household_id))) return json({ error: 'Forbidden' }, 403);
    } else {
      return json({ error: 'invalid role' }, 400);
    }

    // --- Find or invite the auth user ---
    let uid: string | null = null;
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/login`,
    });
    if (invErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      uid = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      if (!uid) return json({ error: invErr.message }, 400);
    } else uid = inv.user.id;

    // --- Profile + linkage ---
    await admin.from('profiles').upsert({ id: uid, email, full_name, role }, { onConflict: 'id' });

    if (role === 'parent') {
      const { error } = await admin.from('household_members')
        .upsert({ household_id, profile_id: uid, relationship, is_primary }, { onConflict: 'household_id,profile_id' });
      if (error) return json({ error: error.message }, 400);
    } else if (role === 'dancer') {
      const { error } = await admin.from('dancers').update({ profile_id: uid }).eq('id', dancer_id);
      if (error) return json({ error: error.message }, 400);
    } else if (role === 'teacher') {
      // Link by explicit id, else match the teacher record by email.
      const q = admin.from('teachers').update({ profile_id: uid });
      const { error } = teacher_id ? await q.eq('id', teacher_id) : await q.eq('email', email);
      if (error) return json({ error: error.message }, 400);
    }

    return json({ success: true, profile_id: uid });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
