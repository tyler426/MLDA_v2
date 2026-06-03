import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Wand2, Send } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import { formatTime, weekStartStr } from '@/lib/scheduleUtils';
import { useSeasonWeeks } from '@/lib/useSeasonWeeks';
import { useStudioConfig } from '@/lib/useStudioConfig';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Color coding for event types
const EVENT_STYLES = {
  rehearsal_block: 'bg-primary/20 text-primary border-primary/30',
  space_rehearsal: 'bg-primary/20 text-primary border-primary/30',
  space_private: 'bg-gold/20 text-gold border-gold/30',
  guest_artist: 'bg-terracotta/20 text-terracotta border-terracotta/30',
  competition: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  one_time_class: 'bg-accent/20 text-accent border-accent/30',
  tribe_vibe: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  travel_approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const VARIANT_BADGE = {
  Black: 'bg-zinc-700 text-zinc-200',
  Teal: 'bg-teal/20 text-teal border border-teal/40',
};

function buildCalendarWeeks(year, month) {
  const first = startOfMonth(new Date(year, month, 1));
  const last = endOfMonth(first);
  const start = startOfWeek(first, { weekStartsOn: 0 });
  const weeks = [];
  let day = start;
  while (day <= last || weeks.length < 6) {
    if (weeks.length > 0 && day > last && weeks[weeks.length - 1].length === 7) break;
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
    if (weeks.length >= 6) break;
  }
  return weeks;
}

export default function MonthlyCalendar({ role = 'parent' }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [programFilter, setProgramFilter] = useState('all');
  const [markProgram, setMarkProgram] = useState('all'); // program a new designation applies to
  const [selectedDancerId, setSelectedDancerId] = useState(null);
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const { data: cfg } = useStudioConfig();
  // Black/Teal week allocation (drives the gutter; classes live on day/week views)
  const { weekTypeFor } = useSeasonWeeks();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = buildCalendarWeeks(year, month);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: async () => base44.auth.me() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list('-date', 500) });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });
  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.list() });
  const { data: competitions = [] } = useQuery({ queryKey: ['competitions'], queryFn: () => base44.entities.CompetitionWeekend.list() });
  const { data: calendarMarks = [] } = useQuery({ queryKey: ['calendarMarks'], queryFn: () => base44.entities.CalendarMark.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: households = [] } = useQuery({ queryKey: ['households'], queryFn: () => base44.entities.ParentHousehold.list(), enabled: role === 'parent' || role === 'admin' });

  // Derive household dancers for parent view
  const householdDancers = (() => {
    if (role !== 'parent' || !user?.email) return [];
    const household = households.find(h => h.email === user.email);
    return household ? dancers.filter(d => d.parent_household_id === household.id) : [];
  })();

  // Auto-select first dancer once loaded
  useEffect(() => {
    if (role === 'parent' && !selectedDancerId && householdDancers.length > 0) {
      setSelectedDancerId(householdDancers[0].id);
    }
  }, [householdDancers.length, role]);

  // Program scope: parents auto-scope to their selected dancer's program; admin/
  // teacher use the program filter. null = show every program (whole studio).
  const activeProgram = role === 'parent'
    ? (householdDancers.find(d => d.id === selectedDancerId)?.program || null)
    : (programFilter === 'all' ? null : programFilter);
  // An item shows when it's studio-wide, or when its program matches the active scope.
  const matchesProgram = (item) => !item.program || item.program === 'all' || activeProgram === null || item.program === activeProgram;

  const deleteBookingMutation = useMutation({
    mutationFn: (id) => base44.entities.SpaceBooking.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spaceBookings'] }); toast.success('Booking cancelled'); },
  });

  // Set/clear a single week's Black/Teal allocation (admin paints weeks).
  const setWeekTypeMutation = useMutation({
    mutationFn: async ({ weekStart, type }) => {
      if (!type) {
        const { error } = await supabase.from('season_weeks').delete().eq('week_start', weekStart);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('season_weeks').upsert({ week_start: weekStart, week_type: type }, { onConflict: 'week_start' });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonWeeks'] }),
    onError: (e) => toast.error(e.message),
  });
  const cycleWeek = (weekStart, current) => {
    const next = current === 'Black' ? 'Teal' : current === 'Teal' ? null : 'Black';
    setWeekTypeMutation.mutate({ weekStart, type: next });
  };

  // Fill 52 weeks alternating, starting from the first week shown this month.
  const fillYearMutation = useMutation({
    mutationFn: async ({ startWeek, firstType }) => {
      const [y, m, d] = startWeek.split('-').map(Number);
      const base = new Date(y, m - 1, d);
      const rows = Array.from({ length: 52 }, (_, i) => ({
        week_start: format(addDays(base, i * 7), 'yyyy-MM-dd'),
        week_type: i % 2 === 0 ? firstType : (firstType === 'Black' ? 'Teal' : 'Black'),
      }));
      const { error } = await supabase.from('season_weeks').upsert(rows, { onConflict: 'week_start' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seasonWeeks'] }); toast.success('Filled 52 weeks alternating'); },
    onError: (e) => toast.error(e.message),
  });

  // Calendar designations: Tribe Vibe weeks (mandatory studio presence) and
  // Approved Travel weekends (no comp/Tribe Vibe → families free to travel).
  // Find an existing designation of `kind` whose range intersects the Sun–Sat
  // week of `dateStr` (so the toggle works no matter which weekday is selected).
  const markForWeek = (kind, dateStr) => {
    const sun = weekStartStr(dateStr);
    const sat = format(addDays(parseISO(sun), 6), 'yyyy-MM-dd');
    return calendarMarks.find(m => m.kind === kind && m.start_date <= sat && m.end_date >= sun);
  };
  const toggleMarkMutation = useMutation({
    mutationFn: async ({ kind, dateStr }) => {
      const existing = markForWeek(kind, dateStr);
      if (existing) { await base44.entities.CalendarMark.delete(existing.id); return { removed: true }; }
      const sun = weekStartStr(dateStr);
      let start, end;
      if (kind === 'tribe_vibe') {
        start = sun;
        end = format(addDays(parseISO(sun), 6), 'yyyy-MM-dd');       // the full Sun–Sat week
      } else {
        start = format(addDays(parseISO(sun), 6), 'yyyy-MM-dd');     // Saturday…
        end = format(addDays(parseISO(sun), 7), 'yyyy-MM-dd');       // …through Sunday
      }
      await base44.entities.CalendarMark.create({ kind, start_date: start, end_date: end, program: markProgram === 'all' ? null : markProgram });
      return { removed: false };
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['calendarMarks'] }); toast.success(r.removed ? 'Designation removed' : 'Marked on calendar'); },
    onError: (e) => toast.error(e.message),
  });

  // Push a designation to families' and teachers' in-app inboxes.
  const notifyMark = useMutation({
    mutationFn: async (m) => {
      const isTV = m.kind === 'tribe_vibe';
      const title = isTV ? 'Tribe Vibe week' : 'Approved travel weekend';
      const range = m.start_date === m.end_date ? m.start_date : `${m.start_date} – ${m.end_date}`;
      const message = (isTV
        ? `Tribe Vibe (${range}): dancers are expected at the studio for rehearsals this week.`
        : `Approved travel weekend (${range}): no competition or Tribe Vibe — families are clear to travel.`)
        + (m.label ? ` ${m.label}` : '');
      // Scope families to the designation's program; teachers always hear about it.
      const targetHouseholds = (!m.program || m.program === 'all')
        ? households.filter(h => h.email)
        : households.filter(h => h.email && dancers.some(d => d.parent_household_id === h.id && d.program === m.program));
      let n = 0;
      for (const h of targetHouseholds) {
        await base44.entities.ScheduleNotification.create({ recipient_email: h.email, recipient_type: 'parent', type: 'announcement', title, message }); n++;
      }
      for (const t of teachers.filter(t => t.email)) {
        await base44.entities.ScheduleNotification.create({ recipient_email: t.email, recipient_type: 'teacher', type: 'announcement', title, message }); n++;
      }
      return n;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success(`Pushed to ${n} inbox${n === 1 ? '' : 'es'}`); },
    onError: (e) => toast.error(e.message),
  });

  const monthStart = format(new Date(year, month, 1), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');

  // The month is a planning view: guest artists, competitions, Tribe Vibe weeks
  // and travel weekends only — program-scoped. Recurring classes, rehearsals and
  // private lessons live on the day & week views.
  function getEventsForDate(dateStr) {
    const events = [];

    // Guest artists (special one-time sessions)
    allClasses.filter(c => c.one_time_date === dateStr && c.guest_artist).forEach(c => {
      const teacher = teachers.find(t => t.id === c.teacher_id);
      events.push({
        type: 'guest_artist',
        label: `Guest: ${c.guest_artist_name || c.title}`,
        sub: c.level || '',
        id: c.id, data: c, teacher,
        style: EVENT_STYLES.guest_artist,
      });
    });

    // Competitions (program-scoped)
    competitions.filter(comp => comp.start_date <= dateStr && comp.end_date >= dateStr && matchesProgram(comp)).forEach(comp => {
      events.push({ type: 'competition', label: comp.name, sub: comp.venue || '', id: comp.id, data: comp, style: EVENT_STYLES.competition });
    });

    events.push(...marksForDate(dateStr));
    return events;
  }

  // Tribe Vibe / Approved Travel designations covering a date, as calendar events.
  function marksForDate(dateStr) {
    return calendarMarks
      .filter(m => m.start_date <= dateStr && m.end_date >= dateStr && matchesProgram(m))
      .map(m => ({
        type: m.kind,
        label: m.kind === 'tribe_vibe' ? 'Tribe Vibe' : 'Travel OK',
        sub: m.label || '',
        id: m.id,
        data: m,
        style: EVENT_STYLES[m.kind],
        canDelete: false,
      }));
  }

  const selectedDateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedEvents = selectedDateStr ? getEventsForDate(selectedDateStr) : [];

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 mb-3">
        <SectionLabel>{format(new Date(year, month, 1), 'MMMM yyyy')}</SectionLabel>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="font-caps text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors border border-border">
            Today
          </button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Parent dancer selector */}
      {role === 'parent' && householdDancers.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Dancer:</span>
          {householdDancers.map(d => (
            <button
              key={d.id}
              onClick={() => { setSelectedDancerId(d.id); setSelectedDay(null); }}
              className={`px-2.5 py-0.5 rounded font-caps text-[11px] uppercase tracking-[0.1em] border transition-colors ${
                selectedDancerId === d.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {d.first_name}
            </button>
          ))}
        </div>
      )}

      {/* Program filter (admin & teacher); parents are auto-scoped to their dancer) */}
      {role !== 'parent' && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Program:</span>
          {['all', ...(cfg?.programs || [])].map(p => (
            <button
              key={p}
              onClick={() => setProgramFilter(p)}
              className={`px-2.5 py-0.5 rounded font-caps text-[11px] uppercase tracking-[0.1em] border transition-colors ${
                programFilter === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {p === 'all' ? 'All studio' : p}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => fillYearMutation.mutate({ startWeek: weekStartStr(weeks[0][0]), firstType: weekTypeFor(weeks[0][0]) || 'Black' })}
              disabled={fillYearMutation.isPending}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded font-caps text-[11px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              title="Fill 52 weeks alternating, starting from the first week shown"
            >
              <Wand2 className="w-3.5 h-3.5" /> Auto-fill weeks
            </button>
          )}
        </div>
      )}
      {isAdmin && (
        <p className="text-[11px] text-muted-2 -mt-1 mb-3">
          Tap the <span className="text-foreground">B/T label</span> beside each week to set it Black or Teal (this drives which classes show on the day &amp; week views). Tap a day to mark a Tribe Vibe / travel week.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { label: 'Guest Artist', style: EVENT_STYLES.guest_artist },
          { label: 'Competition', style: EVENT_STYLES.competition },
          { label: 'Tribe Vibe', style: EVENT_STYLES.tribe_vibe },
          { label: 'Travel OK', style: EVENT_STYLES.travel_approved },
        ].map(l => (
          <span key={l.label} className={`font-caps text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 rounded border ${l.style}`}>{l.label}</span>
        ))}
      </div>

      {/* Day-of-week headers (with week-type gutter spacer) */}
      <div className="flex mb-1">
        <div className="w-9 flex-none" />
        <div className="grid grid-cols-7 gap-px flex-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground py-1">{d}</div>
          ))}
        </div>
      </div>

      {/* Calendar grid — one row per week with a Black/Teal gutter */}
      <div className="flex flex-col gap-px bg-border rounded-lg overflow-hidden border border-border">
        {weeks.map((week, wi) => {
          const wStart = weekStartStr(week[0]);
          const wType = weekTypeFor(week[0]);
          const gutterTone = wType === 'Black' ? 'bg-zinc-700 text-zinc-200'
            : wType === 'Teal' ? 'bg-teal/25 text-teal'
            : 'bg-card text-muted-2';
          return (
            <div key={wi} className="flex gap-px bg-border">
              {/* Week-type gutter */}
              {isAdmin ? (
                <button
                  onClick={() => cycleWeek(wStart, wType)}
                  title={wType ? `${wType} week — tap to change` : 'Set this week Black or Teal'}
                  className={`w-9 flex-none flex flex-col items-center justify-center font-caps text-[11px] uppercase tracking-[0.06em] transition-colors hover:brightness-125 ${gutterTone}`}
                >
                  {wType ? wType[0] : '+'}
                </button>
              ) : (
                <div className={`w-9 flex-none flex items-center justify-center font-caps text-[11px] uppercase tracking-[0.06em] ${gutterTone}`}>
                  {wType ? wType[0] : ''}
                </div>
              )}

              {/* Seven days */}
              <div className="grid grid-cols-7 gap-px flex-1 bg-border">
                {week.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, new Date(year, month, 1));
                  const today = isToday(day);
                  const events = inMonth ? getEventsForDate(dateStr) : [];
                  const isSelected = selectedDateStr === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => inMonth ? setSelectedDay(isSelected ? null : day) : null}
                      className={`relative bg-card min-h-[72px] p-1.5 text-left transition-colors hover:bg-secondary/40 ${
                        !inMonth ? 'opacity-25 pointer-events-none' : ''
                      } ${isSelected ? 'ring-1 ring-inset ring-primary' : ''}`}
                    >
                      {/* Date number */}
                      <div className={`w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                        today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      } font-body text-[11px] font-medium`}>
                        {day.getDate()}
                      </div>

                      {/* Events */}
                      <div className="space-y-0.5">
                        {events.slice(0, 3).map(ev => (
                          <div key={ev.id} className={`text-[8px] font-caps uppercase tracking-[0.05em] px-1 py-0.5 rounded border truncate ${ev.style}`}>
                            {ev.label}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-[8px] text-muted-foreground text-center">+{events.length - 3}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day detail panel */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mt-4 bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-body font-semibold text-foreground">
                {format(selectedDay, 'EEEE, MMMM d')}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Admin: Tribe Vibe / Approved Travel designations */}
            {isAdmin && selectedDateStr && (
              <div className="mb-4 bg-secondary/30 border border-border rounded-lg p-3">
                <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Studio designation</p>
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className="text-[11px] text-muted-2">Applies to:</span>
                  {['all', ...(cfg?.programs || [])].map(p => (
                    <button key={p} onClick={() => setMarkProgram(p)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${markProgram === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {p === 'all' ? 'Whole studio' : p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { kind: 'tribe_vibe', on: 'Tribe Vibe week', off: 'Mark Tribe Vibe week' },
                    { kind: 'travel_approved', on: 'Approved travel weekend', off: 'Mark travel weekend' },
                  ].map(({ kind, on, off }) => {
                    const active = markForWeek(kind, selectedDateStr);
                    return (
                      <button
                        key={kind}
                        onClick={() => toggleMarkMutation.mutate({ kind, dateStr: selectedDateStr })}
                        disabled={toggleMarkMutation.isPending}
                        className={`px-2.5 py-1 rounded font-caps text-[11px] uppercase tracking-[0.1em] border transition-colors ${active ? EVENT_STYLES[kind] : 'border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {active ? `✓ ${on}` : off}
                      </button>
                    );
                  })}
                </div>
                {(markForWeek('tribe_vibe', selectedDateStr) || markForWeek('travel_approved', selectedDateStr)) && (
                  <button
                    onClick={() => notifyMark.mutate(markForWeek('tribe_vibe', selectedDateStr) || markForWeek('travel_approved', selectedDateStr))}
                    disabled={notifyMark.isPending}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-teal-bright hover:underline"
                  >
                    <Send className="w-3.5 h-3.5" /> {notifyMark.isPending ? 'Pushing…' : 'Notify families & teachers'}
                  </button>
                )}
              </div>
            )}

            {/* Special events */}
            {selectedEvents.length > 0 && (
              <div className="mb-4">
                <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">On this day</p>
                <div className="space-y-2">
                  {selectedEvents.map(ev => (
                    <div key={ev.id + ev.type} className={`rounded-lg border p-3 ${ev.style}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-caps text-[10px] uppercase tracking-[0.1em] font-medium">{ev.label}</p>
                          {ev.data?.start_time && (
                            <p className="text-[10px] mt-0.5 opacity-80">
                              {formatTime(ev.data.start_time)} – {formatTime(ev.data.end_time || (ev.data.start_time && computeEndTime(ev.data.start_time, ev.data.duration_hours)))}
                            </p>
                          )}
                          {ev.data?.start_date && ev.data?.end_date && (
                            <p className="text-[10px] mt-0.5 opacity-80">{ev.data.start_date} – {ev.data.end_date}</p>
                          )}
                          {ev.studio && <p className="text-[10px] opacity-70 mt-0.5">Studio {ev.studio.name}</p>}
                          {ev.teacher && <p className="text-[10px] opacity-70 mt-0.5">{ev.teacher.first_name} {ev.teacher.last_name}</p>}
                          {ev.sub && ev.sub !== (ev.studio ? `Studio ${ev.studio.name}` : '') && (
                            <p className="text-[10px] opacity-70 mt-0.5">{ev.sub}</p>
                          )}
                          {/* Dancers on booking (admin/teacher view) */}
                          {(ev.dancers?.length > 0 || ev.data?.dancer_ids?.length > 0) && (
                            <div>
                              <p className="text-[11px] font-caps uppercase tracking-[0.08em] text-warm-gray mt-1.5 mb-0.5">Dancers</p>
                              <div className="flex flex-wrap gap-1">
                                {(ev.dancers || []).map(d => (
                                  <span key={d.id} className="bg-black/20 px-1.5 py-0.5 rounded text-[11px]">{d.first_name} {d.last_name}</span>
                                ))}
                                {!ev.dancers && ev.data?.dancer_ids?.map(did => {
                                  const d = dancers.find(x => x.id === did);
                                  return d ? <span key={did} className="bg-black/20 px-1.5 py-0.5 rounded text-[11px]">{d.first_name} {d.last_name}</span> : null;
                                })}
                              </div>
                            </div>
                          )}
                          {/* Pieces on booking (admin/teacher view) */}
                          {(ev.pieces?.length > 0 || ev.data?.piece_ids?.length > 0) && (
                            <div>
                              <p className="text-[11px] font-caps uppercase tracking-[0.08em] text-warm-gray mt-1.5 mb-0.5">Pieces</p>
                              <div className="flex flex-wrap gap-1">
                                {(ev.pieces || []).map(p => (
                                  <span key={p.id} className="bg-black/20 px-1.5 py-0.5 rounded text-[11px] italic">{p.title}</span>
                                ))}
                                {!ev.pieces && ev.data?.piece_ids?.map(pid => {
                                  const p = pieces.find(x => x.id === pid);
                                  return p ? <span key={pid} className="bg-black/20 px-1.5 py-0.5 rounded text-[11px] italic">{p.title}</span> : null;
                                })}
                              </div>
                            </div>
                          )}
                          {ev.data?.notes && <p className="text-[10px] italic mt-1 opacity-60">{ev.data.notes}</p>}
                        </div>
                        {ev.canDelete && (
                          <button
                            onClick={() => deleteBookingMutation.mutate(ev.id)}
                            className="text-destructive hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5"
                            title="Cancel booking"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEvents.length === 0 && !isAdmin && (
              <p className="text-xs text-muted-foreground text-center py-4 italic">Nothing on the calendar this day.</p>
            )}
            <p className="text-[11px] text-muted-2 mt-1">Classes are on the day &amp; week views.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}