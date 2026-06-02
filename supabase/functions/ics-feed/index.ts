// Supabase Edge Function: ics-feed  🔴 (rebuilt from scratch — Base44 hosted this)
// Serves a subscribable .ics calendar for a household or teacher by token.
// URL: https://<project>.functions.supabase.co/ics-feed?type=parent&token=<ics_token>
// Update CalendarSync.jsx's icsUrl to point here.
import { createClient } from 'jsr:@supabase/supabase-js@2';

function pad(n: number) { return String(n).padStart(2, '0'); }
function toICSDate(date: string, time: string | null) {
  // date = 'YYYY-MM-DD', time = 'HH:MM'(:SS) — emit floating local time.
  const [y, m, d] = date.split('-');
  const [hh = '00', mm = '00'] = (time ?? '00:00').split(':');
  return `${y}${m}${d}T${pad(+hh)}${pad(+mm)}00`;
}
function esc(s: string) { return (s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }

// Map weekday number → next N dated occurrences for recurring classes.
function upcomingDatesForDow(dow: number, weeks = 12): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < weeks * 7; i++) {
    const dt = new Date(today.getTime() + i * 86400000);
    if (dt.getDay() === dow) out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const type = u.searchParams.get('type') ?? 'parent';
  const token = u.searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const events: string[] = [];
  const [studios, classes, teachers] = await Promise.all([
    admin.from('studios').select('*'),
    admin.from('dance_classes').select('*'),
    admin.from('teachers').select('*'),
  ]).then(rs => rs.map(r => r.data ?? []));

  const studioName = (id: string) => studios.find((s: any) => s.id === id)?.name ?? '';

  if (type === 'parent') {
    const { data: household } = await admin.from('households').select('*').eq('ics_token', token).single();
    if (!household) return new Response('Not found', { status: 404 });
    const { data: dancers } = await admin.from('dancers').select('*').eq('parent_household_id', household.id);
    const dancerIds = (dancers ?? []).map((d: any) => d.id);
    const { data: enrollments } = await admin.from('class_enrollments')
      .select('*').in('dancer_id', dancerIds.length ? dancerIds : ['00000000-0000-0000-0000-000000000000']).eq('active', true);
    const classIds = new Set((enrollments ?? []).map((e: any) => e.class_id));

    for (const c of classes.filter((c: any) => classIds.has(c.id))) {
      const dates = c.one_time_date ? [c.one_time_date] : upcomingDatesForDow(c.day_of_week);
      for (const date of dates) {
        events.push([
          'BEGIN:VEVENT',
          `UID:${c.id}-${date}@mlda`,
          `DTSTART:${toICSDate(date, c.start_time)}`,
          `DTEND:${toICSDate(date, c.end_time)}`,
          `SUMMARY:${esc(c.title)}`,
          `LOCATION:${esc('Studio ' + studioName(c.studio_id))}`,
          'END:VEVENT',
        ].join('\r\n'));
      }
    }
  } else {
    const { data: teacher } = await admin.from('teachers').select('*').eq('ics_token', token).single();
    if (!teacher) return new Response('Not found', { status: 404 });
    for (const c of classes.filter((c: any) => c.teacher_id === teacher.id)) {
      const dates = c.one_time_date ? [c.one_time_date] : upcomingDatesForDow(c.day_of_week);
      for (const date of dates) {
        events.push([
          'BEGIN:VEVENT',
          `UID:${c.id}-${date}@mlda`,
          `DTSTART:${toICSDate(date, c.start_time)}`,
          `DTEND:${toICSDate(date, c.end_time)}`,
          `SUMMARY:${esc(c.title)}`,
          `LOCATION:${esc('Studio ' + studioName(c.studio_id))}`,
          'END:VEVENT',
        ].join('\r\n'));
      }
    }
  }

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MLDA Collective//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:MLDA Schedule',
    ...events, 'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'max-age=3600' },
  });
});
