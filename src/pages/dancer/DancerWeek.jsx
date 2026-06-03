import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyDancer } from '@/lib/useMyDancer';
import ClassCard from '@/components/shared/ClassCard';
import EventSheet from '@/components/shared/EventSheet';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { formatTime, DAY_NAMES, getWeekDates, classRunsOnWeekType, todayDateStr } from '@/lib/scheduleUtils';
import { useSeasonWeeks } from '@/lib/useSeasonWeeks';
import { format } from 'date-fns';
import { Music, ChevronRight } from 'lucide-react';

export default function DancerWeek() {
  const [eventSheet, setEventSheet] = useState(null);
  const { data: dancer } = useMyDancer();

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });

  const { weekTypeFor } = useSeasonWeeks();
  const thisWeekType = weekTypeFor(todayDateStr());
  const myClassIds = enrollments.filter(e => e.dancer_id === dancer?.id).map(e => e.class_id);
  const myClasses = allClasses.filter(c => myClassIds.includes(c.id) && classRunsOnWeekType(c, thisWeekType));
  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}` : ''; };

  // This dancer's rehearsals across the current week, bucketed by day-of-week.
  const weekDates = getWeekDates();
  const myCastPieceIds = new Set(pieceCasts.filter(pc => pc.dancer_id === dancer?.id).map(pc => pc.piece_id));
  const rehearsalsForDate = dateStr => rehearsals.filter(r => {
    if (r.date !== dateStr) return false;
    if ((r.dancer_ids || []).includes(dancer?.id)) return true;
    return (r.piece_ids || []).some(pid => myCastPieceIds.has(pid));
  }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const byDay = DAY_NAMES.map((name, dow) => ({
    name,
    classes: myClasses
      .filter(c => c.day_of_week === dow)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    rehearsals: rehearsalsForDate(format(weekDates[dow], 'yyyy-MM-dd')),
  })).filter(d => d.classes.length > 0 || d.rehearsals.length > 0);

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="pt-4 mb-4 flex items-center gap-2">
        <SectionLabel>My Week</SectionLabel>
        {thisWeekType && <span className={`text-[10px] font-caps uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${thisWeekType === 'Teal' ? 'bg-teal/20 text-teal' : 'bg-zinc-700 text-zinc-200'}`}>{thisWeekType} week</span>}
      </div>

      {byDay.length === 0 ? (
        <EmptyState message="No classes scheduled this week." />
      ) : (
        <div className="space-y-6">
          {byDay.map(day => (
            <div key={day.name}>
              <p className="font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray mb-2">{day.name}</p>
              <div className="space-y-2">
                {day.classes.map(c => (
                  <ClassCard
                    key={c.id}
                    title={c.title}
                    startTime={formatTime(c.start_time)}
                    endTime={formatTime(c.end_time)}
                    studioName={studioName(c.studio_id)}
                    teacherName={teacherName(c.teacher_id)}
                    level={c.level}
                  />
                ))}
                {day.rehearsals.map(r => (
                  <button key={r.id} onClick={() => setEventSheet(r)} className="w-full text-left flex gap-3 items-center bg-primary/10 border border-primary/30 rounded-lg p-4">
                    <Music className="w-4 h-4 text-primary flex-none" />
                    <div className="flex-1 min-w-0">
                      <div className="font-caps text-[10px] uppercase tracking-[0.15em] text-primary">Rehearsal · tap for details</div>
                      <div className="text-sm font-medium mt-0.5">{formatTime(r.start_time)} – {formatTime(r.end_time)}{studioName(r.studio_id) ? ` · Studio ${studioName(r.studio_id)}` : ''}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {eventSheet && <EventSheet event={eventSheet} kind="rehearsal" onClose={() => setEventSheet(null)} />}
    </div>
  );
}
