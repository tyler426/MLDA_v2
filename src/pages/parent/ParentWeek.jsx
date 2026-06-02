import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { format, isToday } from 'date-fns';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { getWeekDates, formatTime, isDancerPulled, DAY_NAMES } from '@/lib/scheduleUtils';
import RehearsalDetailCard from '@/components/shared/RehearsalDetailCard';
import { Clock, MapPin } from 'lucide-react';

function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

export default function ParentWeek() {
  const { data: household } = useMyHousehold();

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: exceptions = [] } = useQuery({ queryKey: ['allExceptions'], queryFn: () => base44.entities.ScheduleException.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: allDancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 60) });

  const weekDates = getWeekDates();

  const getRehearsalForPull = (dancerId, classId, dateStr) => {
    const ex = exceptions.find(e => e.type === 'dancer_pulled' && e.dancer_id === dancerId && e.class_id === classId && e.date === dateStr);
    if (!ex?.rehearsal_block_id) return null;
    return rehearsals.find(r => r.id === ex.rehearsal_block_id) || null;
  };

  const getCalledDancers = (rehearsal) => {
    if (!rehearsal) return [];
    // Prefer explicitly called dancer_ids, fall back to piece cast lookup
    if (rehearsal.dancer_ids?.length > 0) {
      return allDancers.filter(d => rehearsal.dancer_ids.includes(d.id));
    }
    const ids = [...new Set((rehearsal.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)))];
    return allDancers.filter(d => ids.includes(d.id));
  };
  const dancerIds = dancers.map(d => d.id);
  const dancerEnrollments = enrollments.filter(e => dancerIds.includes(e.dancer_id));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <SectionLabel className="pt-4 mb-4">This Week</SectionLabel>

      {weekDates.map(date => {
        const dow = date.getDay();
        const dateStr = format(date, 'yyyy-MM-dd');

        // RehearsalBlock records that directly involve any of our dancers
        const dancerIdSet = new Set(dancers.map(d => d.id));
        const pulledRehearsalIds = new Set(
          exceptions.filter(e => e.type === 'dancer_pulled' && e.rehearsal_block_id).map(e => e.rehearsal_block_id)
        );
        const dayRehearsals = rehearsals.filter(r => {
          if (pulledRehearsalIds.has(r.id)) return false;
          if (r.date !== dateStr) return false;
          if ((r.dancer_ids || []).some(id => dancerIdSet.has(id))) return true;
          const castIds = new Set(
            (r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id))
          );
          return [...dancerIdSet].some(id => castIds.has(id));
        }).sort((a, b) => a.start_time.localeCompare(b.start_time));

        const dayClasses = allClasses.filter(c => {
          const enrolled = dancerEnrollments.some(e => e.class_id === c.id);
          return enrolled && c.day_of_week === dow;
        }).map(c => {
          const dancer = dancers.find(d => dancerEnrollments.some(e => e.class_id === c.id && e.dancer_id === d.id));
          const isPulled = dancer ? isDancerPulled(dancer.id, c.id, dateStr, exceptions) : false;
          const rehearsal = isPulled ? getRehearsalForPull(dancer?.id, c.id, dateStr) : null;
          return {
            ...c,
            studioName: studios.find(s => s.id === c.studio_id)?.name,
            teacherName: (() => { const t = teachers.find(t => t.id === c.teacher_id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; })(),
            isPulled,
            rehearsal,
            rehearsalDancers: getCalledDancers(rehearsal),
          };
        }).sort((a, b) => a.start_time.localeCompare(b.start_time));

        return (
          <div key={dateStr} className="mb-6">
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className={`font-body font-medium text-sm ${isToday(date) ? 'text-primary' : 'text-foreground'}`}>
                {DAY_NAMES[dow]}
              </h3>
              <span className="text-xs text-muted-foreground">{format(date, 'MMM d')}</span>
              {isToday(date) && <span className="text-[10px] font-caps uppercase tracking-[0.15em] text-primary">Today</span>}
            </div>
            {(() => {
              const dancerIdSet = new Set(dancers.map(d => d.id));
              const dayPrivateLessons = spaceBookings.filter(b =>
                b.date === dateStr &&
                (
                  (b.dancer_ids || []).some(id => dancerIdSet.has(id)) ||
                  (b.hour_slots || []).some(s => dancerIdSet.has(s.dancer_id))
                )
              ).sort((a, b) => a.start_time.localeCompare(b.start_time));

              if (dayClasses.length === 0 && dayPrivateLessons.length === 0 && dayRehearsals.length === 0) {
                return <p className="text-xs text-muted-foreground pl-1">No classes</p>;
              }
              return (
                <div className="space-y-2">
                  {dayRehearsals.map(r => (
                    <RehearsalDetailCard
                      key={r.id}
                      rehearsal={r}
                      pieces={pieces}
                      dancers={allDancers.filter(d => {
                        if ((r.dancer_ids || []).includes(d.id)) return true;
                        const castIds = new Set((r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)));
                        return castIds.has(d.id);
                      })}
                      studios={studios}
                    />
                  ))}
                  {dayClasses.map(c => (
                    <div key={`${c.id}-${dateStr}`}>
                      <ClassCard
                        title={c.title}
                        startTime={formatTime(c.start_time)}
                        endTime={formatTime(c.end_time)}
                        studioName={c.studioName}
                        teacherName={c.teacherName}
                        level={c.level}
                        isPulled={c.isPulled}
                        pullReason={c.isPulled ? 'Pulled to rehearsal' : null}
                      />
                      {c.isPulled && c.rehearsal && (
                        <RehearsalDetailCard
                          rehearsal={c.rehearsal}
                          pieces={pieces}
                          dancers={c.rehearsalDancers}
                          studios={studios}
                        />
                      )}
                    </div>
                  ))}
                  {dayPrivateLessons.flatMap(b => {
                    const studio = studios.find(s => s.id === b.studio_id);
                    const t = teachers.find(t => t.id === b.teacher_id);
                    const isPrivate = b.type === 'private';
                    // If there are per-slot assignments, render one card per household dancer slot
                    if (b.hour_slots?.length > 0) {
                      return dancers
                        .filter(d => b.hour_slots.some(s => s.dancer_id === d.id))
                        .sort((a, b2) => {
                          const sa = b.hour_slots.find(s => s.dancer_id === a.id)?.hour_index ?? 0;
                          const sb = b.hour_slots.find(s => s.dancer_id === b2.id)?.hour_index ?? 0;
                          return sa - sb;
                        })
                        .map(dancer => {
                          const slot = b.hour_slots.find(s => s.dancer_id === dancer.id);
                          const slotStart = computeEndTime(b.start_time, slot.hour_index);
                          const slotEnd = computeEndTime(slotStart, 1);
                          return (
                            <div key={`${b.id}-${dancer.id}`} className={`bg-card border rounded-lg p-3 ${isPrivate ? 'border-gold/30' : 'border-primary/30'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${isPrivate ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                                  Private Lesson
                                </span>
                                <span className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">{dancer.first_name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(slotStart)} – {formatTime(slotEnd)}</span>
                                {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                                {t && <span>{t.first_name} {t.last_name}</span>}
                              </div>
                            </div>
                          );
                        });
                    }
                    // No slots — show whole block
                    return [(
                      <div key={b.id} className={`bg-card border rounded-lg p-3 ${isPrivate ? 'border-gold/30' : 'border-primary/30'}`}>
                        <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${isPrivate ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                          {isPrivate ? 'Private Lesson' : 'Rehearsal'}
                        </span>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)} – {formatTime(computeEndTime(b.start_time, b.duration_hours))}</span>
                          {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                          {t && <span>{t.first_name} {t.last_name}</span>}
                        </div>
                      </div>
                    )];
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}