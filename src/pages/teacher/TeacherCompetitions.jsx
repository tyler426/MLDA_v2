import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';
import { fmtDate } from '@/lib/dateUtils';
import { MapPin, Clock, Calendar, Music2 } from 'lucide-react';
import { formatTime } from '@/lib/scheduleUtils';
import { motion } from 'framer-motion';

export default function TeacherCompetitions() {
  const [userEmail, setUserEmail] = useState(null);
  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['myShifts', teacher?.id],
    queryFn: () => base44.entities.CompetitionShift.filter({ teacher_id: teacher.id }),
    enabled: !!teacher?.id,
  });

  const { data: weekends = [] } = useQuery({
    queryKey: ['compWeekends'],
    queryFn: () => base44.entities.CompetitionWeekend.list(),
  });

  // Show all weekends (not just ones with shifts), grouped with their shifts + entries
  const groupedWeekends = weekends
    .filter(w => shifts.some(s => s.competition_weekend_id === w.id) || w.competing_entries?.length > 0)
    .map(w => ({
      ...w,
      shifts: shifts.filter(s => s.competition_weekend_id === w.id).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)),
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[25px] font-semibold mb-4 -tracking-[0.01em]">Competitions</h1>

      {groupedWeekends.length === 0 ? (
        <EmptyState message="No upcoming competitions" sub="Shifts and numbers will appear here when added" />
      ) : (
        <div className="space-y-6">
          {groupedWeekends.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-border">
                <h3 className="font-body font-semibold text-foreground">{w.name}</h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {fmtDate(w.start_date, 'MMM d')} – {fmtDate(w.end_date, 'MMM d')}
                  </span>
                  {w.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.venue}</span>}
                </div>
              </div>

              {/* Competing numbers */}
              {w.competing_entries?.length > 0 && (
                <div className="p-4 border-b border-border">
                  <p className="font-caps text-[9px] uppercase tracking-[0.18em] text-gold mb-2 flex items-center gap-1">
                    <Music2 className="w-3 h-3" /> Competing Numbers
                  </p>
                  <div className="space-y-1.5">
                    {[...w.competing_entries].sort((a, b) => {
                      const d = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                      return d !== 0 ? d : (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                    }).map((entry, ei) => (
                      <div key={ei} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-foreground">{entry.title}</span>
                          {entry.category && (
                            <span className="ml-2 font-caps text-[10px] uppercase tracking-[0.08em] text-gold/80">{entry.category}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {entry.scheduled_date && <span>{fmtDate(entry.scheduled_date, 'MMM d')}</span>}
                          {entry.scheduled_time && (
                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatTime(entry.scheduled_time)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My shifts */}
              {w.shifts.length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="font-caps text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-2">My Shifts</p>
                  {w.shifts.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-foreground">{fmtDate(s.date, 'EEE, MMM d')}</span>
                        {s.role && <span className="ml-2 font-caps text-[10px] uppercase tracking-[0.1em] text-gold">{s.role}</span>}
                      </div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}