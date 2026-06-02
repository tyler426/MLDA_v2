import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PickupTimeHero from '@/components/shared/PickupTimeHero';
import ClassCard from '@/components/shared/ClassCard';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { getTodayDow, getLatestEndTime, formatTime, todayDateStr, isDancerPulled } from '@/lib/scheduleUtils';
import RehearsalCard from '@/components/shared/RehearsalCard';
import { format } from 'date-fns';
import RehearsalDetailCard from '@/components/shared/RehearsalDetailCard';
import { Clock, MapPin } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

export default function ParentToday() {
  const [userEmail, setUserEmail] = useState(null);
  const [selectedDow, setSelectedDow] = useState(null); // null = today

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email));
  }, []);

  const { data: household } = useQuery({
    queryKey: ['parentHousehold', userEmail],
    queryFn: () => base44.entities.ParentHousehold.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: data => data[0],
  });

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ['allClasses'],
    queryFn: () => base44.entities.DanceClass.list(),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.ScheduleException.list(),
  });

  const { data: studios = [] } = useQuery({
    queryKey: ['studios'],
    queryFn: () => base44.entities.Studio.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: rehearsals = [] } = useQuery({
    queryKey: ['rehearsals'],
    queryFn: () => base44.entities.RehearsalBlock.list(),
  });

  const { data: allDancers = [] } = useQuery({
    queryKey: ['allDancers'],
    queryFn: () => base44.entities.Dancer.list(),
  });

  const { data: pieces = [] } = useQuery({
    queryKey: ['pieces'],
    queryFn: () => base44.entities.Piece.list(),
  });

  const { data: pieceCasts = [] } = useQuery({
    queryKey: ['pieceCasts'],
    queryFn: () => base44.entities.PieceCast.list(),
  });

  const { data: spaceBookings = [] } = useQuery({
    queryKey: ['spaceBookings'],
    queryFn: () => base44.entities.SpaceBooking.list('-date', 60),
  });

  const todayDow = getTodayDow();
  const today = todayDateStr();
  const activeDow = selectedDow !== null ? selectedDow : todayDow;
  const isToday = activeDow === todayDow;

  // Compute the actual calendar date for activeDow this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const activeDate = new Date(weekStart);
  activeDate.setDate(weekStart.getDate() + activeDow);
  const activeDateStr = format(activeDate, 'yyyy-MM-dd');

  // IDs of rehearsal blocks already shown via pull exceptions (to avoid duplicates)
  const pulledRehearsalIds = new Set(
    exceptions.filter(e => e.type === 'dancer_pulled' && e.rehearsal_block_id).map(e => e.rehearsal_block_id)
  );

  // Rehearsals on the active date that involve any of our dancers
  const dancerIdSet = new Set(dancers.map(d => d.id));
  const dayRehearsals = rehearsals.filter(r => {
    // Skip if already shown via a class-pull exception
    if (pulledRehearsalIds.has(r.id)) return false;
    if (r.date !== activeDateStr) return false;
    // check explicit dancer_ids first
    if ((r.dancer_ids || []).some(id => dancerIdSet.has(id))) return true;
    // fall back: check if any household dancer is cast in any of the rehearsal's pieces
    const castDancerIds = new Set(
      (r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id))
    );
    return [...dancerIdSet].some(id => castDancerIds.has(id));
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Space bookings (private lessons + rehearsal blocks) on the active date that include any of our dancers
  const dayPrivateLessons = spaceBookings.filter(b =>
    b.date === activeDateStr &&
    (b.dancer_ids || []).some(id => dancerIdSet.has(id))
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Build per-dancer schedule for the selected day
  const dancerSchedules = dancers.map(dancer => {
    const dancerEnrollments = enrollments.filter(e => e.dancer_id === dancer.id);
    const dancerClassIds = dancerEnrollments.map(e => e.class_id);
    const dayClasses = allClasses
      .filter(c => dancerClassIds.includes(c.id) && c.day_of_week === activeDow)
      .map(c => ({
        ...c,
        studioName: studios.find(s => s.id === c.studio_id)?.name,
        teacherName: (() => { const t = teachers.find(t => t.id === c.teacher_id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; })(),
        isPulled: isToday ? isDancerPulled(dancer.id, c.id, today, exceptions) : false,
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    const activeClasses = dayClasses.filter(c => !c.isPulled);
    const classPickup = getLatestEndTime(activeClasses);

    // Also consider private lesson slots for this dancer's pickup time
    const dancerPrivates = spaceBookings.filter(b =>
      b.date === activeDateStr &&
      ((b.dancer_ids || []).includes(dancer.id) || (b.hour_slots || []).some(s => s.dancer_id === dancer.id))
    );
    const privatePickup = dancerPrivates.reduce((latest, b) => {
      const slot = (b.hour_slots || []).find(s => s.dancer_id === dancer.id);
      const slotStart = slot != null ? computeEndTime(b.start_time, slot.hour_index) : b.start_time;
      const slotEnd = slot != null ? computeEndTime(slotStart, 1) : computeEndTime(b.start_time, b.duration_hours);
      return slotEnd > latest ? slotEnd : latest;
    }, '');

    const pickupTime = classPickup && privatePickup
      ? (classPickup > privatePickup ? classPickup : privatePickup)
      : classPickup || privatePickup || null;

    return { dancer, classes: dayClasses, pickupTime };
  });

  // Overall latest pickup
  const overallPickup = dancerSchedules.reduce((latest, ds) => {
    if (!ds.pickupTime) return latest;
    if (!latest) return ds.pickupTime;
    return ds.pickupTime > latest ? ds.pickupTime : latest;
  }, null);

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="flex items-baseline justify-between pt-4 mb-1">
        <SectionLabel>{isToday ? 'Today' : DAYS[activeDow]}</SectionLabel>
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

      {dancers.length === 0 ? (
        <div className="mt-8">
          <PickupTimeHero time="—" />
          <EmptyState 
            message="No dancers linked yet" 
            sub="Ask your studio admin to add your household" 
          />
        </div>
      ) : dancerSchedules.length === 1 ? (
        <>
          <PickupTimeHero 
            time={dancerSchedules[0].pickupTime} 
            dancerName={dancerSchedules[0].dancer.first_name} 
          />
          <div className="space-y-3">
            {dancerSchedules[0].classes.length === 0 && dayRehearsals.length === 0 && dayPrivateLessons.length === 0 ? (
            <EmptyState message={`No classes ${isToday ? 'today' : 'on ' + DAYS[activeDow]}`} />
            ) : (
            <>
            {dancerSchedules[0].classes.map(c => (
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
            {dayRehearsals.map(r => (
              <RehearsalCard
                key={r.id}
                rehearsal={r}
                pieces={pieces}
                dancers={allDancers}
                pieceCasts={pieceCasts}
                studioName={studios.find(s => s.id === r.studio_id)?.name}
              />
            ))}
            {dayPrivateLessons.map(b => {
              const studio = studios.find(s => s.id === b.studio_id);
              const t = teachers.find(t => t.id === b.teacher_id);
              const isPrivate = b.type === 'private';
              const singleDancer = dancerSchedules[0]?.dancer;
              const slot = singleDancer
                ? (b.hour_slots || []).find(s => s.dancer_id === singleDancer.id)
                : null;
              const slotStartTime = slot != null
                ? computeEndTime(b.start_time, slot.hour_index)
                : b.start_time;
              const slotEndTime = slot != null
                ? computeEndTime(slotStartTime, 1)
                : computeEndTime(b.start_time, b.duration_hours);
              return (
                <div key={b.id} className={`bg-card border rounded-lg p-3 ${isPrivate ? 'border-gold/30' : 'border-primary/30'}`}>
                  <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${isPrivate ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                    {isPrivate ? 'Private Lesson' : 'Rehearsal'}
                  </span>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(slotStartTime)} – {formatTime(slotEndTime)}</span>
                    {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                    {t && <span>{t.first_name} {t.last_name}</span>}
                  </div>
                </div>
              );
            })}
                    </>
                    )}
          </div>
        </>
      ) : (
        <>
          {/* Multi-dancer family view */}
          <PickupTimeHero time={overallPickup} />
          {dancerSchedules.map(({ dancer, classes, pickupTime }) => (
            <div key={dancer.id} className="mb-8">
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="font-body font-semibold text-foreground">{dancer.first_name}</h3>
                {pickupTime && (
                  <span className="font-caps text-[10px] uppercase tracking-[0.12em] text-gold">
                    Done at {pickupTime}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {(() => {
                  const dancerRehearsals = dayRehearsals.filter(r => {
                    if ((r.dancer_ids || []).includes(dancer.id)) return true;
                    const castIds = new Set((r.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)));
                    return castIds.has(dancer.id);
                  });
                  const dancerPrivates = dayPrivateLessons.filter(b =>
                    (b.dancer_ids || []).includes(dancer.id) ||
                    (b.hour_slots || []).some(s => s.dancer_id === dancer.id)
                  );
                  if (classes.length === 0 && dancerRehearsals.length === 0 && dancerPrivates.length === 0) {
                    return <EmptyState message={`No classes ${isToday ? 'today' : 'on ' + DAYS[activeDow]}`} />;
                  }
                  return (
                    <>
                      {classes.map(c => (
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
                      {dancerRehearsals.map(r => (
                        <RehearsalCard
                          key={r.id}
                          rehearsal={r}
                          pieces={pieces}
                          dancers={allDancers}
                          pieceCasts={pieceCasts}
                          studioName={studios.find(s => s.id === r.studio_id)?.name}
                        />
                      ))}
                      {dancerPrivates.map(b => {
                        const studio = studios.find(s => s.id === b.studio_id);
                        const t = teachers.find(t => t.id === b.teacher_id);
                        const isPrivate = b.type === 'private';
                        // Find this dancer's specific hour slot for per-slot time display
                        const slot = (b.hour_slots || []).find(s => s.dancer_id === dancer.id);
                        const slotStartTime = slot != null
                          ? computeEndTime(b.start_time, slot.hour_index)
                          : b.start_time;
                        const slotEndTime = computeEndTime(slotStartTime, 1);
                        return (
                          <div key={b.id} className={`bg-card border rounded-lg p-3 ${isPrivate ? 'border-gold/30' : 'border-primary/30'}`}>
                            <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${isPrivate ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                              {isPrivate ? 'Private Lesson' : 'Rehearsal'}
                            </span>
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(slotStartTime)} – {formatTime(slotEndTime)}</span>
                              {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                              {t && <span>{t.first_name} {t.last_name}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}