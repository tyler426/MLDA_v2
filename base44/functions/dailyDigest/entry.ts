import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Helper: convert HH:MM to readable time
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function can be called by scheduler (no user) or admin - handle both
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch (_) {
      // Called from scheduler without user auth - allow
      isAdmin = true;
    }

    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const todayDow = new Date().getDay();
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' });

    // Load all data via service role
    const [households, dancers, classes, enrollments, studios, teachers, exceptions] = await Promise.all([
      base44.asServiceRole.entities.ParentHousehold.list(),
      base44.asServiceRole.entities.Dancer.filter({ archived: false }),
      base44.asServiceRole.entities.DanceClass.list(),
      base44.asServiceRole.entities.ClassEnrollment.filter({ active: true }),
      base44.asServiceRole.entities.Studio.list(),
      base44.asServiceRole.entities.Teacher.list(),
      base44.asServiceRole.entities.ScheduleException.filter({ date: new Date().toISOString().slice(0, 10) }),
    ]);

    let sent = 0;
    const errors = [];

    for (const household of households) {
      const householdDancers = dancers.filter(d => d.parent_household_id === household.id && !d.archived);
      if (householdDancers.length === 0) continue;

      const lines = [];

      for (const dancer of householdDancers) {
        const dancerEnrollments = enrollments.filter(e => e.dancer_id === dancer.id);
        const todayClasses = classes
          .filter(c => dancerEnrollments.some(e => e.class_id === c.id) && c.day_of_week === todayDow)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        if (todayClasses.length === 0) continue;

        lines.push(`${dancer.first_name}:`);
        for (const cls of todayClasses) {
          const studio = studios.find(s => s.id === cls.studio_id);
          const teacher = teachers.find(t => t.id === cls.teacher_id);
          const isPulled = exceptions.some(e =>
            e.type === 'dancer_pulled' && e.dancer_id === dancer.id && e.class_id === cls.id
          );
          const label = isPulled ? ' ⚠ PULLED TO REHEARSAL' : '';
          lines.push(`  • ${cls.title} — ${formatTime(cls.start_time)}–${formatTime(cls.end_time)}${studio ? ` (Studio ${studio.name})` : ''}${teacher ? ` with ${teacher.first_name}` : ''}${label}`);
        }
      }

      if (lines.length === 0) continue;

      const body = `Hi ${household.primary_contact_name},\n\nHere is today's schedule for your dancer${householdDancers.length > 1 ? 's' : ''} — ${todayStr}:\n\n${lines.join('\n')}\n\nSee you at the studio!\n— MLDA Collective`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: household.email,
          subject: `MLDA Today — ${todayStr}`,
          body,
        });

        await base44.asServiceRole.entities.ScheduleNotification.create({
          recipient_email: household.email,
          recipient_type: 'parent',
          type: 'daily_digest',
          title: `Today's Schedule — ${todayStr}`,
          message: lines.slice(0, 3).join(' | '),
        });

        sent++;
      } catch (emailErr) {
        errors.push({ household: household.email, error: emailErr.message });
      }
    }

    return Response.json({ success: true, sent, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});