import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { getTodayDow, formatTime, getWeekDates } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];
const STATUS_STYLE = {
  present: 'bg-primary/10 text-primary border-primary/30',
  absent: 'bg-terracotta/10 text-terracotta border-terracotta/30',
  late: 'bg-gold/10 text-gold border-gold/30',
  excused: 'bg-muted text-muted-foreground border-border',
};

export default function TeacherAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [userEmail, setUserEmail] = useState(null);
  const [selectedDow, setSelectedDow] = useState(searchParams.get('dow') !== null ? Number(searchParams.get('dow')) : null);
  const [activeClassId, setActiveClassId] = useState(searchParams.get('class') || null);
  const [localStatuses, setLocalStatuses] = useState({});
  const qc = useQueryClient();

  // Deep-link: /teacher/attendance?class=<id>&dow=<n> jumps straight into a class.
  useEffect(() => {
    const cls = searchParams.get('class');
    const dow = searchParams.get('dow');
    if (cls) setActiveClassId(cls);
    if (dow !== null) setSelectedDow(Number(dow));
    if (cls || dow !== null) setSearchParams({}, { replace: true }); // clear so back-button returns to the list
  }, []);

  const todayDow = getTodayDow();
  const activeDow = selectedDow !== null ? selectedDow : todayDow;
  const weekDates = getWeekDates();
  const activeDateStr = format(weekDates[activeDow], 'yyyy-MM-dd');

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: absences = [] } = useQuery({ queryKey: ['allAbsences'], queryFn: () => base44.entities.AbsenceReport.list() });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', activeDateStr],
    queryFn: () => base44.entities.AttendanceRecord.filter({ date: activeDateStr }),
  });

  const myClasses = allClasses
    .filter(c => c.teacher_id === teacher?.id && c.day_of_week === activeDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const activeClass = myClasses.find(c => c.id === activeClassId);
  const classEnrollments = enrollments.filter(e => e.class_id === activeClassId);
  const enrolledDancers = classEnrollments
    .map(e => dancers.find(d => d.id === e.dancer_id))
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  // Pre-populate local statuses when class selected
  useEffect(() => {
    if (!activeClassId) return;
    const existing = {};
    attendance.filter(r => r.class_id === activeClassId).forEach(r => {
      existing[r.dancer_id] = r.status;
    });
    // Pre-fill absent for dancers with approved absences covering this date
    enrolledDancers.forEach(d => {
      if (existing[d.id]) return;
      const hasAbsence = absences.some(a =>
        a.dancer_id === d.id &&
        activeDateStr >= a.start_date &&
        activeDateStr <= a.end_date &&
        (a.class_ids?.length === 0 || a.class_ids?.includes(activeClassId))
      );
      existing[d.id] = hasAbsence ? 'excused' : 'present';
    });
    setLocalStatuses(existing);
  }, [activeClassId, attendance.length, enrolledDancers.length, activeDateStr]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upsert each dancer's attendance
      const promises = Object.entries(localStatuses).map(async ([dancer_id, status]) => {
        const existing = attendance.find(r => r.class_id === activeClassId && r.dancer_id === dancer_id);
        if (existing) {
          return base44.entities.AttendanceRecord.update(existing.id, { status });
        }
        return base44.entities.AttendanceRecord.create({
          class_id: activeClassId,
          date: activeDateStr,
          dancer_id,
          status,
          taken_by_teacher_id: teacher?.id,
        });
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance saved');
      setActiveClassId(null);
    },
  });

  const attendanceTakenForClass = (classId) =>
    attendance.some(r => r.class_id === classId);

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[25px] font-semibold mb-4 -tracking-[0.01em]">Attendance</h1>

      {/* Day selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {DAYS.map((label, dow) => (
          <button
            key={dow}
            onClick={() => { setSelectedDow(dow === todayDow && selectedDow === null ? null : dow === todayDow ? null : dow); setActiveClassId(null); }}
            className={`flex-shrink-0 px-2.5 py-1 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors ${
              activeDow === dow ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}{dow === todayDow && <span className="ml-1 text-[8px] opacity-60">•</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!activeClassId ? (
          <motion.div key="class-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {myClasses.length === 0 ? (
              <EmptyState message={`No classes on ${DAYS[activeDow]}`} />
            ) : (
              <div className="space-y-2">
                {myClasses.map(c => {
                  const taken = attendanceTakenForClass(c.id);
                  const count = enrollments.filter(e => e.class_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveClassId(c.id)}
                      className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-body font-medium text-sm text-foreground">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatTime(c.start_time)} – {formatTime(c.end_time)} · {count} enrolled</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {taken && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          <ChevronRight className="w-4 h-4 text-warm-gray" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="take-attendance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setActiveClassId(null)} className="text-xs text-warm-gray hover:text-foreground font-caps uppercase tracking-[0.1em]">← Classes</button>
              <span className="text-warm-gray">/</span>
              <span className="text-xs text-foreground font-body font-medium">{activeClass?.title}</span>
            </div>

            <p className="text-xs text-muted-foreground mb-3">{format(weekDates[activeDow], 'EEEE, MMMM d')}</p>

            {enrolledDancers.length === 0 ? (
              <EmptyState message="No dancers enrolled" />
            ) : (
              <div className="space-y-2 mb-4">
                {enrolledDancers.map(dancer => {
                  const current = localStatuses[dancer.id] || 'present';
                  return (
                    <div key={dancer.id} className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-body font-medium text-sm text-foreground">{dancer.first_name} {dancer.last_name}</p>
                        <span className="font-caps text-[11px] uppercase tracking-[0.1em] text-warm-gray">{dancer.level}</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => setLocalStatuses(prev => ({ ...prev, [dancer.id]: s }))}
                            className={`px-2.5 py-1 rounded-md font-caps text-[11px] uppercase tracking-[0.1em] border transition-all ${
                              current === s ? STATUS_STYLE[s] + ' font-semibold' : 'border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || enrolledDancers.length === 0}
              className="w-full font-caps text-xs uppercase tracking-[0.12em]"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Attendance'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}