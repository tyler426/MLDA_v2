import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyDancer } from '@/lib/useMyDancer';
import PickupTimeHero from '@/components/shared/PickupTimeHero';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import EventSheet from '@/components/shared/EventSheet';
import { getTodayDow, getLatestEndTime, formatTime, todayDateStr, isDancerPulled } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { Music, ChevronRight } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DancerToday() {
  const [selectedDow, setSelectedDow] = useState(null); // null = today
  const [eventSheet, setEventSheet] = useState(null);
  const { data: dancer } = useMyDancer();

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: exceptions = [] } = useQuery({ queryKey: ['allExceptions'], queryFn: () => base44.entities.ScheduleException.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });

  const todayDow = getTodayDow();
  const today = todayDateStr();
  const activeDow = selectedDow !== null ? selectedDow : todayDow;
  const isToday = activeDow === todayDow;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const activeDate = new Date(weekStart);
  activeDate.setDate(weekStart.getDate() + activeDow);
  const activeDateStr = format(activeDate, 'yyyy-MM-dd');

  // Classes for this dancer on the active day.
  const myClassIds = enrollments.filter(e => e.dancer_id === dancer?.id).map(e => e.class_id);
  const dayClasses = allClasses
    .filter(c => myClassIds.includes(c.id) && c.day_of_week === activeDow)
    .map(c => ({
      ...c,
      studioName: studios.find(s => s.id === c.studio_id)?.name,
      teacherName: (() => { const t = teachers.find(t => t.id === c.teacher_id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; })(),
      isPulled: isToday ? isDancerPulled(dancer?.id, c.id, today, exceptions) : false,
    }))
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const pickupTime = getLatestEndTime(dayClasses.filter(c => !c.isPulled));

  // Rehearsals on the active date involving this dancer (skip those shown as pulls).
  const pulledRehearsalIds = new Set(
    exceptions.filter(e => e.type === 'dancer_pulled' && e.rehearsal_block_id).map(e => e.rehearsal_block_id)
  );
  const dayRehearsals = rehearsals.filter(r => {
    if (pulledRehearsalIds.has(r.id)) return false;
    if (r.date !== activeDateStr) return false;
    if ((r.dancer_ids || []).includes(dancer?.id)) return true;
    const castIds = new Set((r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)));
    return castIds.has(dancer?.id);
  }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="flex items-baseline justify-between pt-4 mb-1">
        <SectionLabel>{isToday ? 'Today' : DAYS[activeDow]}</SectionLabel>
        {dancer && <span className="text-xs text-muted-foreground">{dancer.first_name}</span>}
      </div>

      {/* Day selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {DAYS.map((label, dow) => (
          <button
            key={dow}
            onClick={() => setSelectedDow(dow === todayDow ? null : dow)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors ${
              activeDow === dow ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {dow === todayDow && <span className="ml-1 text-[8px] opacity-60">•</span>}
          </button>
        ))}
      </div>

      <PickupTimeHero time={pickupTime} dancerName={dancer?.first_name} />

      <div className="space-y-3">
        {dayClasses.length === 0 && dayRehearsals.length === 0 ? (
          <EmptyState message={`No classes ${isToday ? 'today' : 'on ' + DAYS[activeDow]}`} />
        ) : (
          <>
            {dayClasses.map(c => (
              <ClassCard
                key={c.id}
                title={c.title}
                startTime={formatTime(c.start_time)}
                endTime={formatTime(c.end_time)}
                studioName={c.studioName}
                teacherName={c.teacherName}
                level={c.level}
                isPulled={c.isPulled}
                pullReason={c.isPulled ? 'Pulled to rehearsal' : null}
              />
            ))}
            {dayRehearsals.map(r => {
              const studioName = studios.find(s => s.id === r.studio_id)?.name;
              return (
                <button key={r.id} onClick={() => setEventSheet(r)} className="w-full text-left flex gap-3 items-center bg-primary/10 border border-primary/30 rounded-lg p-4">
                  <Music className="w-4 h-4 text-primary flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="font-caps text-[10px] uppercase tracking-[0.15em] text-primary">Rehearsal · tap for details</div>
                    <div className="text-sm font-medium mt-0.5">{formatTime(r.start_time)} – {formatTime(r.end_time)}{studioName ? ` · Studio ${studioName}` : ''}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </>
        )}
      </div>

      {eventSheet && <EventSheet event={eventSheet} kind="rehearsal" onClose={() => setEventSheet(null)} />}
    </div>
  );
}
