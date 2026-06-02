import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import ClassSheet from '@/components/parent/ClassSheet';
import EventSheet from '@/components/shared/EventSheet';
import { formatTime, getTodayDow, isDancerPulled } from '@/lib/scheduleUtils';
import { ChevronRight, Music } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

const STYLE_PALETTE = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function styleColor(s = '') { let n = 0; for (const c of s) n += c.charCodeAt(0); return STYLE_PALETTE[n % STYLE_PALETTE.length]; }
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ParentWeek() {
  const { data: household } = useMyHousehold();
  const [selId, setSelId] = useState(null);
  const [dow, setDow] = useState(getTodayDow());
  const [sheet, setSheet] = useState(null);
  const [eventSheet, setEventSheet] = useState(null);

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });
  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: exceptions = [] } = useQuery({ queryKey: ['allExceptions'], queryFn: () => base44.entities.ScheduleException.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });

  const dancer = dancers.find(d => d.id === selId) || dancers[0];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const activeDate = format(addDays(weekStart, dow), 'yyyy-MM-dd');
  const todayDow = getTodayDow();

  const myClassIds = dancer ? enrollments.filter(e => e.dancer_id === dancer.id).map(e => e.class_id) : [];
  const dayClasses = allClasses
    .filter(c => myClassIds.includes(c.id) && c.day_of_week === dow)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const dayRehearsals = rehearsals.filter(r => {
    if (r.date !== activeDate) return false;
    if ((r.dancer_ids || []).includes(dancer?.id)) return true;
    const castPieceIds = pieceCasts.filter(pc => pc.dancer_id === dancer?.id).map(pc => pc.piece_id);
    return (r.piece_ids || []).some(pid => castPieceIds.includes(pid));
  });
  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; };

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-teal-bright font-semibold">Schedule</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">{dancer ? `${dancer.first_name}'s week` : 'Schedule'}</h1>
      </div>

      {/* dancer switcher */}
      {dancers.length > 1 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {dancers.map(d => {
            const on = d.id === dancer?.id; const col = styleColor(d.first_name + d.last_name);
            return (
              <button key={d.id} onClick={() => setSelId(d.id)} className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold border"
                style={{ borderColor: on ? col : 'var(--border)', background: on ? 'rgba(44,144,137,.16)' : 'transparent', color: on ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                {d.first_name}
              </button>
            );
          })}
        </div>
      )}

      {/* dated day scroller */}
      <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
        {LETTERS.map((letter, i) => {
          const on = i === dow; const date = addDays(weekStart, i);
          const has = dancer && allClasses.some(c => myClassIds.includes(c.id) && c.day_of_week === i);
          return (
            <button key={i} onClick={() => setDow(i)} className="flex-none min-w-[44px] rounded-2xl py-2.5 text-center"
              style={{ background: on ? '#2c9089' : 'var(--card)', color: on ? '#06110f' : has ? 'var(--foreground)' : 'var(--muted-2)' }}>
              <div className="text-[10px] font-bold opacity-70">{letter}</div>
              <div className="font-serif text-[18px] font-semibold mt-0.5">{format(date, 'd')}</div>
              {i === todayDow && <div className="text-[8px] tracking-[0.1em] mt-0.5" style={{ color: on ? '#06110f' : '#3aa89f' }}>TODAY</div>}
            </button>
          );
        })}
      </div>

      {/* classes */}
      <div className="mt-4 pb-2 flex flex-col gap-2.5">
        {dayClasses.length === 0 && dayRehearsals.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-7 text-center text-[13px] text-muted-2">Rest day. No classes scheduled.</div>
        )}
        {dayClasses.map(c => {
          const pulled = dow === todayDow && isDancerPulled(dancer?.id, c.id, activeDate, exceptions);
          const col = styleColor(c.title);
          return (
            <button key={c.id} onClick={() => setSheet(c)} className={`flex gap-3.5 bg-card border border-border rounded-2xl p-3.5 text-left items-stretch ${pulled ? 'opacity-60' : ''}`}>
              <div className="flex flex-col items-center justify-center pr-3.5 border-r border-border min-w-[52px]">
                <div className="font-serif text-[17px] font-semibold">{formatTime(c.start_time).replace(/ ?[AP]M/, '')}</div>
                <div className="text-[10px] text-muted-2">{formatTime(c.end_time)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: col }} />
                  <span className="text-[9.5px] tracking-[0.14em] uppercase" style={{ color: col }}>{c.level || 'Class'}</span>
                  {pulled && <span className="text-[9px] text-gold ml-1">· Pulled to rehearsal</span>}
                </div>
                <div className="text-[15px] font-semibold mt-1 mb-0.5 truncate">{c.title}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">Studio {studioName(c.studio_id)} · {teacherName(c.teacher_id)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-2 self-center" />
            </button>
          );
        })}
        {dayRehearsals.map(r => (
          <button key={r.id} onClick={() => setEventSheet(r)} className="flex gap-3.5 rounded-2xl p-3.5 border items-center text-left w-full" style={{ borderColor: 'rgba(200,164,100,.3)', background: 'rgba(200,164,100,.06)' }}>
            <Music className="w-4 h-4 text-gold flex-none" />
            <div className="flex-1 min-w-0">
              <div className="text-[9.5px] tracking-[0.14em] uppercase text-gold">Rehearsal · tap for details</div>
              <div className="text-[14px] font-semibold mt-0.5">{formatTime(r.start_time)}–{formatTime(r.end_time)} · Studio {studioName(r.studio_id)}</div>
              {r.notes && <div className="text-[11.5px] text-muted-2 truncate">{r.notes}</div>}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-2 self-center" />
          </button>
        ))}
      </div>

      {sheet && <ClassSheet cls={sheet} dancer={dancer} household={household} date={activeDate} studios={studios} teachers={teachers} onClose={() => setSheet(null)} />}
      {eventSheet && <EventSheet event={eventSheet} kind="rehearsal" onClose={() => setEventSheet(null)} />}
    </div>
  );
}
