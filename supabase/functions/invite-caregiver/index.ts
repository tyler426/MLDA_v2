// Supabase Edge Function: invite-caregiver
// Admin-only. Invites a caregiver, creates their login, links them to a household.
// Deploy: supabase functions deploy invite-caregiver
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // 1. Verify caller is an admin (uses their forwarded JWT).
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

    const { data: me } = await caller.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });

    // 2. Inputs.
    const { email, household_id, full_name, relationship = 'guardian', is_primary = false } = await req.json();
    if (!email || !household_id) {
      return Response.json({ error: 'email and household_id required' }, { status: 400, headers: cors });
    }

    // 3. Service-role client for privileged work.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 4. Find or invite the auth user.
    let authUserId: string | null = null;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/login`,
    });
    if (inviteErr) {
      // Already registered → look up existing id instead of failing.
      const { data: list } = await admin.auth.admin.listUsers();
      authUserId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      if (!authUserId) return Response.json({ error: inviteErr.message }, { status: 400, headers: cors });
    } else {
      authUserId = invited.user.id;
    }

    // 5. Ensure profile exists (trigger usually handles it) and is role 'parent'.
    await admin.from('profiles').upsert({
      id: authUserId, email, full_name, role: 'parent',
    }, { onConflict: 'id' });

    // 6. Link to household (idempotent).
    const { error: linkErr } = await admin.from('household_members').upsert({
      household_id, profile_id: authUserId, relationship, is_primary,
    }, { onConflict: 'household_id,profile_id' });
    if (linkErr) return Response.json({ error: linkErr.message }, { status: 400, headers: cors });

    return Response.json({ success: true, profile_id: authUserId }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
