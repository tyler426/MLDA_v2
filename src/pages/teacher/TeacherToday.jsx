import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getTodayDow, formatTime, todayDateStr, getWeekDates } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { Clock, MapPin, Check, Zap } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

export default function TeacherToday() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState(null);
  const [selectedDow, setSelectedDow] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail], enabled: !!userEmail,
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }), select: d => d[0],
  });
  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: exceptions = [] } = useQuery({ queryKey: ['exceptions', todayDateStr()], queryFn: () => base44.entities.ScheduleException.filter({ date: todayDateStr() }) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });
  const { data: attendance = [] } = useQuery({ queryKey: ['attendanceToday', todayDateStr()], queryFn: () => base44.entities.AttendanceRecord.filter({ date: todayDateStr() }) });

  const todayDow = getTodayDow();
  const activeDow = selectedDow ?? todayDow;
  const isToday = activeDow === todayDow;
  const activeDateStr = format(getWeekDates()[activeDow], 'yyyy-MM-dd');

  const myClasses = allClasses
    .filter(c => c.teacher_id === teacher?.id && c.day_of_week === activeDow)
    .map(c => ({ ...c, studioName: studios.find(s => s.id === c.studio_id)?.name, count: enrollments.filter(e => e.class_id === c.id).length, taken: attendance.some(a => a.class_id === c.id) }))
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const dayBookings = spaceBookings.filter(b => b.date === activeDateStr && b.teacher_id === teacher?.id).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const totalDancers = myClasses.reduce((a, c) => a + c.count, 0);
  const takenCount = myClasses.filter(c => c.taken).length;
  const nextIdx = myClasses.findIndex(c => !c.taken);

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-gold font-semibold">{format(new Date(), 'EEEE · MMMM d')}</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">{greeting()}, {teacher?.first_name || 'Teacher'}</h1>
      </div>

      {/* stat row */}
      <div className="flex gap-2.5 mt-4">
        {[['Classes', myClasses.length, '#3aa89f'], ['Dancers', totalDancers, '#c8a464'], ['Attendance', `${takenCount}/${myClasses.length}`, '#3aa89f']].map(([l, v, c]) => (
          <div key={l} className="flex-1 bg-card border border-border rounded-2xl p-3.5">
            <div className="font-serif text-[26px] font-semibold" style={{ color: c }}>{v}</div>
            <div className="text-[10.5px] text-muted-2 mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* day pills */}
      <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
        {DAYS.map((label, dow) => (
          <button key={dow} onClick={() => setSelectedDow(dow === todayDow ? null : dow)}
            className="flex-none px-3 py-1.5 rounded-full text-[10px] font-caps uppercase tracking-[0.12em]"
            style={{ background: activeDow === dow ? '#2c9089' : 'var(--card)', color: activeDow === dow ? '#06110f' : 'var(--muted-foreground)' }}>
            {label}{dow === todayDow && <span className="ml-1 opacity-60">•</span>}
          </button>
        ))}
      </div>

      <div className="text-[9.5px] tracking-[0.26em] uppercase text-teal-bright font-semibold mt-5 mb-3">{isToday ? "Today's classes" : DAYS[activeDow]} · tap to take attendance</div>

      <div className="pb-2 flex flex-col gap-2.5">
        {myClasses.length === 0 && dayBookings.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-7 text-center text-[13px] text-muted-2">No classes {isToday ? 'today' : 'this day'}.</div>
        )}
        {myClasses.map((c, i) => {
          const glow = isToday && i === nextIdx && !c.taken;
          return (
            <button key={c.id} onClick={() => navigate('/teacher/attendance')}
              className="text-left rounded-2xl p-4 border bg-card"
              style={{ borderColor: glow ? 'rgba(58,168,159,.35)' : 'var(--border)', boxShadow: glow ? '0 0 0 4px rgba(44,144,137,.16)' : 'none' }}>
              <div className="flex items-center gap-3.5">
                <div className="text-center pr-3.5 border-r border-border min-w-[54px]">
                  <div className="font-serif text-[17px] font-semibold">{formatTime(c.start_time).replace(/ ?[AP]M/, '')}</div>
                  <div className="text-[10px] text-muted-2">{formatTime(c.end_time)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15.5px] font-semibold truncate">{c.title}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">Studio {c.studioName} · {c.level || '—'} · {c.count} dancers</div>
                </div>
                {c.taken
                  ? <span className="flex items-center gap-1 text-[11.5px] text-teal-bright font-semibold"><Check className="w-4 h-4" />Taken</span>
                  : <span className="flex items-center gap-1 text-[11.5px] font-bold text-[#06110f] bg-primary px-3 py-1.5 rounded-full"><Zap className="w-3.5 h-3.5" />Take</span>}
              </div>
            </button>
          );
        })}
        {dayBookings.map(b => {
          const studio = studios.find(s => s.id === b.studio_id);
          return (
            <div key={b.id} className="rounded-2xl p-4 border" style={{ borderColor: b.type === 'private' ? 'rgba(200,164,100,.3)' : 'rgba(44,144,137,.3)' }}>
              <span className="text-[9.5px] tracking-[0.14em] uppercase font-semibold" style={{ color: b.type === 'private' ? '#c8a464' : '#3aa89f' }}>{b.type === 'private' ? 'Private lesson' : 'Rehearsal booking'}</span>
              <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)}–{formatTime(b.end_time || computeEndTime(b.start_time, b.duration_hours))}</span>
                {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
