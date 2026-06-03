import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Wand2 } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import { formatTime, weekStartStr, classRunsOnWeekType } from '@/lib/scheduleUtils';
import { useSeasonWeeks } from '@/lib/useSeasonWeeks';
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
  const [weekVariant, setWeekVariant] = useState('All');
  const [selectedDancerId, setSelectedDancerId] = useState(null);
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  // Black/Teal week allocation
  const { weekTypeFor } = useSeasonWeeks();
  // The week type that should drive class filtering for a given date:
  // an explicit preview filter wins, otherwise the week's real allocation.
  const effectiveType = (dateStr) => (weekVariant === 'All' ? weekTypeFor(dateStr) : weekVariant);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = buildCalendarWeeks(year, month);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: async () => base44.auth.me() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list('-date', 500) });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });
  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.list() });
  const { data: competitions = [] } = useQuery({ queryKey: ['competitions'], queryFn: () => base44.entities.CompetitionWeekend.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: households = [] } = useQuery({ queryKey: ['households'], queryFn: () => base44.entities.ParentHousehold.list(), enabled: role === 'parent' });

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

  const monthStart = format(new Date(year, month, 1), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');

  function getEventsForDate(dateStr, dancerId = null) {
    const dow = parseISO(dateStr).getDay();
    const events = [];

    // For parent view with dancer filter
    if (role === 'parent' && dancerId) {
      // RehearsalBlock records for this dancer
      rehearsals.filter(r => {
        if (r.date !== dateStr) return false;
        if ((r.dancer_ids || []).includes(dancerId)) return true;
        const castIds = new Set((r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)));
        return castIds.has(dancerId);
      }).forEach(r => {
        const studio = studios.find(s => s.id === r.studio_id);
        events.push({
          type: 'rehearsal_block',
          label: 'Rehearsal',
          sub: r.notes || '',
          id: r.id,
          data: r,
          studio,
          style: EVENT_STYLES.rehearsal_block,
          canDelete: false,
        });
      });

      // Space bookings for this dancer
      spaceBookings.filter(b => b.date === dateStr && b.dancer_ids?.includes(dancerId)).forEach(b => {
        const studio = studios.find(s => s.id === b.studio_id);
        const teacher = teachers.find(t => t.id === b.teacher_id);
        events.push({
          type: b.type === 'private' ? 'space_private' : 'space_rehearsal',
          label: b.type === 'private' ? 'Private Lesson' : 'Rehearsal',
          sub: studio ? `Studio ${studio.name}` : '',
          id: b.id,
          data: b,
          teacher,
          studio,
          style: b.type === 'private' ? EVENT_STYLES.space_private : EVENT_STYLES.space_rehearsal,
          canDelete: false,
        });
      });

      // Regular classes for this dancer
      const dancerEnrollments = enrollments.filter(e => e.dancer_id === dancerId && e.active);
      const dancerClasses = allClasses.filter(c => {
        if (c.one_time_date === dateStr) {
          return c.day_of_week === null; // one-time only
        }
        if (c.day_of_week !== dow) return false;
        return dancerEnrollments.some(e => e.class_id === c.id);
      });
      
      dancerClasses.forEach(c => {
        const teacher = teachers.find(t => t.id === c.teacher_id);
        events.push({
          type: 'regular_class',
          label: c.title,
          sub: c.level || '',
          id: c.id,
          data: c,
          teacher,
          style: 'bg-secondary/40 text-foreground border-border',
        });
      });

      // Major studio events: competitions only
      competitions.filter(comp => comp.start_date <= dateStr && comp.end_date >= dateStr).forEach(comp => {
        events.push({ type: 'competition', label: comp.name, sub: comp.venue || '', id: comp.id, data: comp, style: EVENT_STYLES.competition });
      });

      return events;
    }

    // For admin/teacher view: show all events
    // Rehearsal blocks
    rehearsals.filter(r => r.date === dateStr).forEach(r => {
      events.push({ type: 'rehearsal_block', label: 'Rehearsal', sub: r.notes || '', id: r.id, data: r, style: EVENT_STYLES.rehearsal_block });
    });

    // Space bookings
    spaceBookings.filter(b => b.date === dateStr).forEach(b => {
      const studio = studios.find(s => s.id === b.studio_id);
      const teacher = teachers.find(t => t.id === b.teacher_id);
      const bDancers = (b.dancer_ids || []).map(did => dancers.find(d => d.id === did)).filter(Boolean);
      const bPieces = (b.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);
      events.push({
        type: b.type === 'private' ? 'space_private' : 'space_rehearsal',
        label: b.type === 'private' ? 'Private Lesson' : 'Rehearsal Booking',
        sub: studio ? `Studio ${studio.name}` : '',
        id: b.id,
        data: b,
        teacher,
        studio,
        dancers: bDancers,
        pieces: bPieces,
        style: b.type === 'private' ? EVENT_STYLES.space_private : EVENT_STYLES.space_rehearsal,
        canDelete: true,
      });
    });

    // One-time classes (guest artists, special sessions)
    allClasses.filter(c => c.one_time_date === dateStr).forEach(c => {
      const teacher = teachers.find(t => t.id === c.teacher_id);
      events.push({
        type: c.guest_artist ? 'guest_artist' : 'one_time_class',
        label: c.guest_artist ? `Guest: ${c.guest_artist_name || c.title}` : c.title,
        sub: c.level || '',
        id: c.id,
        data: c,
        teacher,
        style: c.guest_artist ? EVENT_STYLES.guest_artist : EVENT_STYLES.one_time_class,
      });
    });

    // Competitions
    competitions.filter(comp => comp.start_date <= dateStr && comp.end_date >= dateStr).forEach(comp => {
      events.push({ type: 'competition', label: comp.name, sub: comp.venue || '', id: comp.id, data: comp, style: EVENT_STYLES.competition });
    });

    return events;
  }

  function getDayClasses(dateStr) {
    const dow = parseISO(dateStr).getDay();
    return allClasses
      .filter(c => !c.one_time_date && c.day_of_week === dow)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const selectedDateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedEvents = selectedDateStr ? getEventsForDate(selectedDateStr, selectedDancerId) : [];
  const selectedClasses = selectedDateStr ? getDayClasses(selectedDateStr) : [];

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

      {/* Week variant filter */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{isAdmin ? 'Preview:' : 'Week:'}</span>
        {['All', 'Black', 'Teal'].map(v => (
          <button
            key={v}
            onClick={() => setWeekVariant(v)}
            className={`px-2.5 py-0.5 rounded font-caps text-[11px] uppercase tracking-[0.1em] border transition-colors ${
              weekVariant === v
                ? v === 'Teal' ? 'bg-teal/20 text-teal border-teal/40'
                  : v === 'Black' ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                  : 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {v === 'All' ? (isAdmin ? 'As allocated' : 'All') : `${v}`}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => fillYearMutation.mutate({ startWeek: weekStartStr(weeks[0][0]), firstType: weekTypeFor(weeks[0][0]) || 'Black' })}
            disabled={fillYearMutation.isPending}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded font-caps text-[11px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            title="Fill 52 weeks alternating, starting from the first week shown"
          >
            <Wand2 className="w-3.5 h-3.5" /> Auto-fill year
          </button>
        )}
      </div>
      {isAdmin && (
        <p className="text-[11px] text-muted-2 -mt-1 mb-3">
          Tap the <span className="text-foreground">B/T label</span> at the start of each week to set it Black or Teal (tap again to cycle, third tap clears). Parents, teachers &amp; dancers then see only that week’s classes.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { label: 'Rehearsal', style: EVENT_STYLES.space_rehearsal },
          { label: 'Private Lesson', style: EVENT_STYLES.space_private },
          { label: 'Guest Artist', style: EVENT_STYLES.guest_artist },
          { label: 'Competition', style: EVENT_STYLES.competition },
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
                  const events = inMonth ? getEventsForDate(dateStr, selectedDancerId) : [];
                  const isSelected = selectedDateStr === dateStr;
                  const dow = day.getDay();

                  // Classes for this day, filtered by the week's Black/Teal allocation
                  let dayRegularClasses = [];
                  if (!inMonth) {
                    dayRegularClasses = [];
                  } else if (role === 'parent' && selectedDancerId) {
                    const dancerEnrollments = enrollments.filter(e => e.dancer_id === selectedDancerId && e.active);
                    dayRegularClasses = allClasses.filter(c => {
                      if (c.one_time_date === dateStr) return true;
                      if (c.day_of_week !== dow) return false;
                      if (!dancerEnrollments.some(e => e.class_id === c.id)) return false;
                      return classRunsOnWeekType(c, effectiveType(dateStr));
                    });
                  } else {
                    dayRegularClasses = allClasses.filter(c => {
                      if (c.one_time_date) return c.one_time_date === dateStr;
                      if (c.day_of_week !== dow) return false;
                      return classRunsOnWeekType(c, effectiveType(dateStr));
                    });
                  }

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

                      {/* Class count pill if classes exist */}
                      {dayRegularClasses.length > 0 && (
                        <div className="text-[8px] font-caps uppercase tracking-[0.08em] text-muted-foreground mb-0.5">
                          {dayRegularClasses.length} class{dayRegularClasses.length > 1 ? 'es' : ''}
                        </div>
                      )}

                      {/* Special events */}
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

            {/* Special events */}
            {selectedEvents.length > 0 && (
              <div className="mb-4">
                <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Special Events & Bookings</p>
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

            {/* Regular classes — grouped by studio */}
            {(() => {
              const dow = selectedDay.getDay();
              const dateStr = format(selectedDay, 'yyyy-MM-dd');

              const selWt = effectiveType(dateStr);
              let regularClasses;
              if (role === 'parent' && selectedDancerId) {
                const dancerEnrollments = enrollments.filter(e => e.dancer_id === selectedDancerId && e.active);
                regularClasses = allClasses.filter(c => {
                  if (c.one_time_date) return false;
                  if (c.day_of_week !== dow) return false;
                  if (!dancerEnrollments.some(e => e.class_id === c.id)) return false;
                  return classRunsOnWeekType(c, selWt);
                });
              } else {
                regularClasses = allClasses.filter(c => {
                  if (c.one_time_date) return false;
                  if (c.day_of_week !== dow) return false;
                  return classRunsOnWeekType(c, selWt);
                });
              }

              if (regularClasses.length === 0 && selectedEvents.length === 0) {
                return <p className="text-xs text-muted-foreground text-center py-4 italic">No classes or events scheduled</p>;
              }
              if (regularClasses.length === 0) return null;

              // Group by studio
              const studioGroups = studios.map(studio => ({
                studio,
                classes: regularClasses
                  .filter(c => c.studio_id === studio.id)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time)),
              })).filter(g => g.classes.length > 0);

              // Classes with no studio assigned
              const unassigned = regularClasses
                .filter(c => !studios.some(s => s.id === c.studio_id))
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              if (unassigned.length > 0) studioGroups.push({ studio: null, classes: unassigned });

              return (
                <div>
                  <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                    Classes by Studio
                    {selWt && <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] ${VARIANT_BADGE[selWt]}`}>{selWt} Week</span>}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {studioGroups.map(({ studio, classes }) => (
                      <div key={studio?.id || 'unassigned'} className="bg-secondary/30 rounded-lg overflow-hidden border border-border">
                        <div className="px-2.5 py-1.5 bg-secondary/60 border-b border-border">
                          <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-warm-gray">
                            {studio ? `Studio ${studio.name}` : 'Unassigned'}
                          </p>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {classes.map(c => {
                            const teacher = teachers.find(t => t.id === c.teacher_id);
                            return (
                              <div key={c.id} className="bg-secondary/40 rounded-md p-2 border border-transparent">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-body text-xs font-medium text-foreground leading-tight">{c.title}</p>
                                  {c.week_variant && (
                                    <span className={`flex-shrink-0 text-[7px] font-caps uppercase tracking-[0.1em] px-1 py-0.5 rounded ${VARIANT_BADGE[c.week_variant]}`}>
                                      {c.week_variant}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(c.start_time)} – {formatTime(c.end_time)}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {teacher && <span className="text-[10px] text-warm-gray">{teacher.first_name} {teacher.last_name?.[0]}.</span>}
                                  {c.level && <span className="text-[10px] text-gold/70">{c.level}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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