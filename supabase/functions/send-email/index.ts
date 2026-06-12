// Supabase Edge Function: send-email
// Replaces base44.integrations.Core.SendEmail. Uses Resend.
// Deploy: supabase functions deploy send-email
// Secrets: RESEND_API_KEY, FROM_EMAIL (SUPABASE_SERVICE_ROLE_KEY is auto-injected)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1) Require an authenticated caller (their JWT is forwarded by supabase-js).
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { to, subject, body } = await req.json();
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean).map((e) => String(e).trim().toLowerCase());
    if (recipients.length === 0) return Response.json({ error: 'No recipient' }, { status: 400, headers: corsHeaders });

    // 2) Restrict recipients to known household / teacher emails (service-role read).
    //    Stops this function being used as an open relay by any logged-in account.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: hh }, { data: tch }] = await Promise.all([
      admin.from('households').select('email'),
      admin.from('teachers').select('email'),
    ]);
    const allowed = new Set(
      [...(hh ?? []), ...(tch ?? [])]
        .map((r: { email?: string | null }) => (r.email ? String(r.email).trim().toLowerCase() : null))
        .filter(Boolean),
    );
    const blocked = recipients.filter((e) => !allowed.has(e));
    if (blocked.length) {
      return Response.json({ error: `Recipient not allowed: ${blocked.join(', ')}` }, { status: 403, headers: corsHeaders });
    }

    // 3) Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('FROM_EMAIL') ?? 'MLDA Collective <noreply@example.com>',
        to: recipients,
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 502, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
});
