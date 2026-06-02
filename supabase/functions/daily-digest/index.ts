// Supabase Edge Function: daily-digest
// Port of base44/functions/dailyDigest. Emails each family its day's schedule.
// Runs on a schedule (see supabase/README.md → cron) using the service-role key
// to read across all households (bypasses RLS — server-side only).
import { createClient } from 'jsr:@supabase/supabase-js@2';

function formatTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

Deno.serve(async () => {
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const todayDow = new Date().getDay();
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver',
    });

    const [households, dancers, classes, enrollments, studios, teachers, exceptions] = await Promise.all([
      admin.from('households').select('*'),
      admin.from('dancers').select('*').eq('archived', false),
      admin.from('dance_classes').select('*'),
      admin.from('class_enrollments').select('*').eq('active', true),
      admin.from('studios').select('*'),
      admin.from('teachers').select('*'),
      admin.from('schedule_exceptions').select('*').eq('date', todayIso),
    ]).then(rs => rs.map(r => r.data ?? []));

    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'MLDA Collective <noreply@example.com>';
    const resendKey = Deno.env.get('RESEND_API_KEY')!;
    let sent = 0;
    const errors: unknown[] = [];

    for (const household of households) {
      const kids = dancers.filter((d: any) => d.parent_household_id === household.id && !d.archived);
      if (!kids.length) continue;

      const lines: string[] = [];
      for (const dancer of kids) {
        const myEnroll = enrollments.filter((e: any) => e.dancer_id === dancer.id);
        const todayClasses = classes
          .filter((c: any) => myEnroll.some((e: any) => e.class_id === c.id) && c.day_of_week === todayDow)
          .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
        if (!todayClasses.length) continue;

        lines.push(`${dancer.first_name}:`);
        for (const cls of todayClasses) {
          const studio = studios.find((s: any) => s.id === cls.studio_id);
          const teacher = teachers.find((t: any) => t.id === cls.teacher_id);
          const pulled = exceptions.some((e: any) =>
            e.type === 'dancer_pulled' && e.dancer_id === dancer.id && e.class_id === cls.id);
          const label = pulled ? ' ⚠ PULLED TO REHEARSAL' : '';
          lines.push(`  • ${cls.title} — ${formatTime(cls.start_time)}–${formatTime(cls.end_time)}` +
            `${studio ? ` (Studio ${studio.name})` : ''}${teacher ? ` with ${teacher.first_name}` : ''}${label}`);
        }
      }
      if (!lines.length || !household.email) continue;

      const body = `Hi ${household.primary_contact_name},\n\nHere is today's schedule for your dancer${kids.length > 1 ? 's' : ''} — ${todayStr}:\n\n${lines.join('\n')}\n\nSee you at the studio!\n— MLDA Collective`;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromEmail, to: household.email, subject: `MLDA Today — ${todayStr}`, text: body }),
        });
        if (!res.ok) throw new Error(await res.text());

        await admin.from('schedule_notifications').insert({
          recipient_email: household.email,
          recipient_type: 'parent',
          type: 'daily_digest',
          title: `Today's Schedule — ${todayStr}`,
          message: lines.slice(0, 3).join(' | '),
        });
        sent++;
      } catch (e) {
        errors.push({ household: household.email, error: String(e) });
      }
    }
    return Response.json({ success: true, sent, errors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
