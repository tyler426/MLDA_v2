import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { getTodayDow, formatTime, todayDateStr, getWeekDates } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { Clock, MapPin, User, Music } from 'lucide-react';
import { motion } from 'framer-motion';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

export default function TeacherToday() {
  const [userEmail, setUserEmail] = useState(null);
  const [selectedDow, setSelectedDow] = useState(null); // null = today

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: exceptions = [] } = useQuery({
    queryKey: ['exceptions', todayDateStr()],
    queryFn: () => base44.entities.ScheduleException.filter({ date: todayDateStr() }),
  });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });

  const todayDow = getTodayDow();
  const today = todayDateStr();
  const activeDow = selectedDow !== null ? selectedDow : todayDow;
  const isViewingToday = activeDow === todayDow;

  // Resolve actual date string for the selected day of week (within current week)
  const weekDates = getWeekDates();
  const activeDateStr = format(weekDates[activeDow], 'yyyy-MM-dd');

  // Space bookings for this teacher on the active date
  const dayBookings = spaceBookings
    .filter(b => b.date === activeDateStr && b.teacher_id === teacher?.id)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const myClasses = allClasses
    .filter(c => c.teacher_id === teacher?.id && c.day_of_week === activeDow)
    .map(c => {
      const classEnrollments = enrollments.filter(e => e.class_id === c.id);
      const totalDancers = classEnrollments.length;
      const pulledDancers = isViewingToday ? classEnrollments.filter(e =>
        exceptions.some(ex => ex.type === 'dancer_pulled' && ex.dancer_id === e.dancer_id && ex.class_id === c.id && ex.date === today)
      ).length : 0;
      const effectivelyCancelled = totalDancers > 0 && pulledDancers >= totalDancers;

      return {
        ...c,
        studioName: studios.find(s => s.id === c.studio_id)?.name,
        totalDancers,
        pulledDancers,
        effectivelyCancelled,
      };
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="flex items-baseline justify-between pt-4 mb-1">
        <SectionLabel>{isViewingToday ? 'Today' : DAYS[activeDow]}</SectionLabel>
      </div>

      {/* Day selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {DAYS.map((label, dow) => (
          <button
            key={dow}
            onClick={() => setSelectedDow(dow === todayDow && selectedDow === null ? null : dow === todayDow ? null : dow)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors ${
              activeDow === dow
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {dow === todayDow && <span className="ml-1 text-[8px] opacity-60">•</span>}
          </button>
        ))}
      </div>

      {teacher && (
        <p className="font-body text-sm text-muted-foreground mb-4">
          Hi, {teacher.first_name}
        </p>
      )}

      {myClasses.length === 0 && dayBookings.length === 0 ? (
        <EmptyState message={`No classes ${isViewingToday ? 'today' : 'on ' + DAYS[activeDow]}`} sub={isViewingToday ? 'Enjoy your day off' : ''} />
      ) : (
        <div className="space-y-3">
          {myClasses.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className={`bg-card border border-border rounded-lg p-4 ${c.effectivelyCancelled ? 'opacity-50 border-l-2 border-l-terracotta' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-body font-medium text-sm text-foreground">{c.title}</h3>
                    {c.level && <span className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">{c.level}</span>}
                  </div>
                  {c.effectivelyCancelled && (
                    <span className="font-caps text-[10px] uppercase tracking-[0.12em] text-terracotta bg-terracotta/10 px-2 py-0.5 rounded">
                      All Pulled
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatTime(c.start_time)} – {formatTime(c.end_time)}</span>
                  {c.studioName && <span>Studio {c.studioName}</span>}
                </div>
                {isViewingToday && c.pulledDancers > 0 && !c.effectivelyCancelled && (
                  <p className="mt-2 text-xs text-gold">
                    {c.pulledDancers} of {c.totalDancers} dancer{c.totalDancers > 1 ? 's' : ''} pulled to rehearsal
                  </p>
                )}
                {!isViewingToday && c.totalDancers > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{c.totalDancers} enrolled</p>
                )}
              </div>
            </motion.div>
          ))}

          {dayBookings.map((b, i) => {
            const studio = studios.find(s => s.id === b.studio_id);
            const bDancers = (b.dancer_ids || []).map(did => dancers.find(d => d.id === did)).filter(Boolean);
            const bPieces = (b.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (myClasses.length + i) * 0.06 }}
                className={`bg-card border rounded-lg p-4 ${b.type === 'private' ? 'border-gold/30' : 'border-primary/30'}`}
              >
                <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${b.type === 'private' ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                  {b.type === 'private' ? 'Private Lesson' : 'Rehearsal Booking'}
                </span>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)} – {formatTime(computeEndTime(b.start_time, b.duration_hours))}</span>
                  {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                </div>
                {bDancers.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {b.type === 'private' ? 'Student(s)' : 'Dancers Called'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bDancers.map(d => (
                        <span key={d.id} className="bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded">{d.first_name} {d.last_name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {bPieces.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                      <Music className="w-2.5 h-2.5" /> Pieces
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bPieces.map(p => (
                        <span key={p.id} className="bg-gold/10 text-gold text-[10px] font-caps uppercase tracking-[0.08em] px-2 py-0.5 rounded">{p.title}</span>
                      ))}
                    </div>
                  </div>
                )}
                {b.notes && <p className="mt-2 text-[10px] text-muted-foreground italic">{b.notes}</p>}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}