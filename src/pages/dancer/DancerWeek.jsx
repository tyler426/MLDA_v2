import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyDancer } from '@/lib/useMyDancer';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { formatTime, DAY_NAMES } from '@/lib/scheduleUtils';

export default function DancerWeek() {
  const { data: dancer } = useMyDancer();

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });

  const myClassIds = enrollments.filter(e => e.dancer_id === dancer?.id).map(e => e.class_id);
  const myClasses = allClasses.filter(c => myClassIds.includes(c.id));
  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}` : ''; };

  const byDay = DAY_NAMES.map((name, dow) => ({
    name,
    classes: myClasses
      .filter(c => c.day_of_week === dow)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
  })).filter(d => d.classes.length > 0);

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="pt-4 mb-4"><SectionLabel>My Week</SectionLabel></div>

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
