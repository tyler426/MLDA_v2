import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyDancer } from '@/lib/useMyDancer';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { getTodayDow, getLatestEndTime, formatTime, todayDateStr, isDancerPulled } from '@/lib/scheduleUtils';
import { format } from 'date-fns';

export default function DancerToday() {
  const { data: dancer } = useMyDancer();

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: exceptions = [] } = useQuery({
    queryKey: ['exceptionsToday'],
    queryFn: () => base44.entities.ScheduleException.filter({ date: todayDateStr() }),
  });

  const dow = getTodayDow();
  const myClassIds = enrollments.filter(e => e.dancer_id === dancer?.id).map(e => e.class_id);
  const todayClasses = allClasses
    .filter(c => myClassIds.includes(c.id) && c.day_of_week === dow)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}` : ''; };

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="pt-4 mb-1">
        <SectionLabel>Today</SectionLabel>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {dancer ? `Hi ${dancer.first_name} · ` : ''}{format(new Date(), 'EEEE, MMMM d')}
      </p>

      {todayClasses.length > 0 && (
        <p className="text-xs text-warm-gray mb-3">Done at {getLatestEndTime(todayClasses)}</p>
      )}

      {todayClasses.length === 0 ? (
        <EmptyState message="No classes today. Enjoy the day off!" />
      ) : (
        <div className="space-y-2">
          {todayClasses.map(c => (
            <ClassCard
              key={c.id}
              title={c.title}
              startTime={formatTime(c.start_time)}
              endTime={formatTime(c.end_time)}
              studioName={studioName(c.studio_id)}
              teacherName={teacherName(c.teacher_id)}
              level={c.level}
              isPulled={isDancerPulled(dancer?.id, c.id, todayDateStr(), exceptions)}
              pullReason="Pulled to rehearsal"
            />
          ))}
        </div>
      )}
    </div>
  );
}
