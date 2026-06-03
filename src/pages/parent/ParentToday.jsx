import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { useSignedUrl } from '@/lib/useSignedUrl';
import SignedImage from '@/components/shared/SignedImage';
import EventSheet from '@/components/shared/EventSheet';
import { formatTime, getTodayDow, todayDateStr, isDancerPulled } from '@/lib/scheduleUtils';
import { Clock, ChevronRight, Bell, Music } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';

const STYLE_PALETTE = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function styleColor(s = '') { let n = 0; for (const c of s) n += c.charCodeAt(0); return STYLE_PALETTE[n % STYLE_PALETTE.length]; }
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function ParentToday() {
  const navigate = useNavigate();
  const { data: household } = useMyHousehold();
  const [selId, setSelId] = useState(null);
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
  const { data: exceptions = [] } = useQuery({ queryKey: ['exToday'], queryFn: () => base44.entities.ScheduleException.filter({ date: todayDateStr() }) });
  const { data: comps = [] } = useQuery({ queryKey: ['competitions'], queryFn: () => base44.entities.CompetitionWeekend.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });
  const { data: notes = [] } = useQuery({
    queryKey: ['notifs', household?.email],
    queryFn: () => base44.entities.ScheduleNotification.filter({ recipient_email: household.email }, '-created_date', 5),
    enabled: !!household?.email,
  });

  const dancer = dancers.find(d => d.id === selId) || dancers[0];
  const dow = getTodayDow();
  const myClassIds = dancer ? enrollments.filter(e => e.dancer_id === dancer.id).map(e => e.class_id) : [];
  const todayClasses = allClasses
    .filter(c => myClassIds.includes(c.id) && c.day_of_week === dow)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const next = todayClasses.find(c => !isDancerPulled(dancer?.id, c.id, todayDateStr(), exceptions)) || todayClasses[0];
  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; };

  // Today's rehearsals & private lessons for the selected dancer.
  const today = todayDateStr();
  const myCastPieceIds = new Set(pieceCasts.filter(pc => pc.dancer_id === dancer?.id).map(pc => pc.piece_id));
  const todayRehearsals = rehearsals.filter(r => {
    if (r.date !== today) return false;
    if ((r.dancer_ids || []).includes(dancer?.id)) return true;
    return (r.piece_ids || []).some(pid => myCastPieceIds.has(pid));
  }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const todayPrivates = spaceBookings.filter(b => {
    if (b.date !== today || b.type !== 'private') return false;
    if ((b.dancer_ids || []).includes(dancer?.id)) return true;
    return (b.hour_slots || []).some(s => s.dancer_id === dancer?.id);
  }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const nextComp = comps
    .filter(c => c.start_date && c.start_date >= todayDateStr())
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const compDays = nextComp ? differenceInCalendarDays(parseISO(nextComp.start_date), new Date()) : null;
  const latestNote = notes[0];
  const firstName = (household?.primary_contact_name || '').split(' ')[0] || 'there';
  const heroPhoto = useSignedUrl('photos', dancer?.photo_url);

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      {/* greeting */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="text-[11px] tracking-[0.26em] uppercase text-gold font-semibold">MLDA Collective</div>
          <div className="font-serif text-[25px] font-semibold mt-1">{greeting()}, {firstName}</div>
        </div>
      </div>

      {/* dancer switcher */}
      {dancers.length > 0 && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {dancers.map(d => {
            const on = d.id === dancer?.id;
            const col = styleColor(d.first_name + d.last_name);
            return (
              <button key={d.id} onClick={() => setSelId(d.id)}
                className="flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 border transition-colors"
                style={{ borderColor: on ? col : 'var(--border, #2a2722)', background: on ? 'rgba(44,144,137,.16)' : 'transparent' }}>
                <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-serif text-[12px] font-semibold text-[#0a0908] overflow-hidden" style={{ background: col }}>
                  <SignedImage path={d.photo_url} className="w-full h-full object-cover" fallback={d.first_name[0]} />
                </span>
                <span className={`text-[13px] font-semibold ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{d.first_name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* up next hero */}
      <div className="mt-5">
        <div className="text-[11px] tracking-[0.26em] uppercase text-teal-bright font-semibold mb-2.5">Up next · Today</div>
        {next ? (
          <button onClick={() => navigate('/week')} className="block w-full text-left">
            <div className="rounded-[20px] overflow-hidden border" style={{ borderColor: 'rgba(58,168,159,.35)', background: 'linear-gradient(180deg,#19211f,#121311)', boxShadow: '0 0 0 4px rgba(44,144,137,.16)' }}>
              <div className="h-[112px] flex items-end px-3 py-2.5 text-[11px] uppercase tracking-[0.1em] text-[#6f6048]"
                style={heroPhoto ? { backgroundImage: `url(${heroPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#13211f', backgroundImage: 'repeating-linear-gradient(135deg,rgba(58,168,159,.1) 0 9px,transparent 9px 18px)' }}>
                {!heroPhoto && `${dancer?.first_name} · add a photo`}
              </div>
              <div className="px-4 pt-3.5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="w-3.5 h-3.5 text-teal-bright" />{formatTime(next.start_time)}–{formatTime(next.end_time)}</span>
                  <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(44,144,137,.16)', color: '#3aa89f' }}>Studio {studioName(next.studio_id)}</span>
                </div>
                <div className="font-serif text-[27px] font-semibold mt-2.5 mb-1">{next.title}</div>
                <div className="text-[12.5px] text-muted-foreground">with {teacherName(next.teacher_id)}</div>
              </div>
            </div>
          </button>
        ) : (
          <div className="bg-card border border-border rounded-[18px] p-5 text-center text-[13px] text-muted-2">No classes today — rest day for {dancer?.first_name || 'your dancer'}.</div>
        )}
      </div>

      {/* today's rehearsals & private lessons */}
      {(todayRehearsals.length > 0 || todayPrivates.length > 0) && (
        <div className="mt-5 flex flex-col gap-2.5">
          <div className="text-[11px] tracking-[0.26em] uppercase text-gold font-semibold">Also today</div>
          {todayRehearsals.map(r => (
            <button key={r.id} onClick={() => setEventSheet({ event: r, kind: 'rehearsal' })} className="flex gap-3.5 rounded-2xl p-3.5 border items-center text-left w-full" style={{ borderColor: 'rgba(200,164,100,.3)', background: 'rgba(200,164,100,.06)' }}>
              <Music className="w-4 h-4 text-gold flex-none" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] tracking-[0.14em] uppercase text-gold">Rehearsal · tap for details</div>
                <div className="text-[14px] font-semibold mt-0.5">{formatTime(r.start_time)}–{formatTime(r.end_time)} · Studio {studioName(r.studio_id)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-2 self-center" />
            </button>
          ))}
          {todayPrivates.map(b => (
            <button key={b.id} onClick={() => setEventSheet({ event: b, kind: 'booking' })} className="flex gap-3.5 rounded-2xl p-3.5 border items-center text-left w-full" style={{ borderColor: 'rgba(200,164,100,.3)', background: 'rgba(200,164,100,.06)' }}>
              <Clock className="w-4 h-4 text-gold flex-none" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] tracking-[0.14em] uppercase text-gold">Private lesson · tap for details</div>
                <div className="text-[14px] font-semibold mt-0.5">{formatTime(b.start_time)} · Studio {studioName(b.studio_id)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-2 self-center" />
            </button>
          ))}
        </div>
      )}

      {/* week strip */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] tracking-[0.26em] uppercase text-muted-2 font-semibold">This week</div>
          <button onClick={() => navigate('/week')} className="text-[11.5px] text-teal-bright flex items-center gap-1">Full schedule <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-1.5">
          {DAY_LETTERS.map((letter, i) => {
            const cls = dancer ? allClasses.filter(c => myClassIds.includes(c.id) && c.day_of_week === i) : [];
            const on = i === dow;
            return (
              <button key={i} onClick={() => navigate('/week')} className="flex-1 rounded-xl py-2 text-center" style={{ background: on ? '#2c9089' : 'var(--card, #16140f)', color: on ? '#06110f' : 'var(--muted-foreground)' }}>
                <div className="text-[10px] font-bold">{letter}</div>
                <div className="flex gap-0.5 justify-center mt-1.5 min-h-[6px]">
                  {cls.slice(0, 3).map((c, j) => <span key={j} className="w-[5px] h-[5px] rounded-full" style={{ background: on ? '#06110f' : styleColor(c.title) }} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* competition countdown */}
      {nextComp && (
        <button onClick={() => navigate('/pieces')} className="block w-full text-left mt-5">
          <div className="rounded-[18px] border p-4 flex items-center gap-4" style={{ borderColor: 'rgba(200,164,100,.3)', background: 'linear-gradient(180deg,#1c1813,#141210)' }}>
            <div className="text-center">
              <div className="font-serif text-[44px] leading-[0.85] text-gold">{compDays}</div>
              <div className="text-[8.5px] tracking-[0.18em] text-muted-2 mt-0.5">DAYS</div>
            </div>
            <div className="flex-1 border-l border-border pl-4">
              <div className="text-[11px] tracking-[0.26em] uppercase text-gold font-semibold">Next competition</div>
              <div className="font-serif text-[19px] font-semibold mt-1 mb-0.5">{nextComp.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{nextComp.venue || nextComp.start_date}</div>
            </div>
            <ChevronRight className="w-[18px] h-[18px] text-muted-2" />
          </div>
        </button>
      )}

      {/* announcement preview */}
      {latestNote && (
        <button onClick={() => navigate('/notifications')} className="flex w-full items-center gap-3 mt-4 mb-2 text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: 'rgba(200,164,100,.14)', color: '#c8a464' }}><Bell className="w-[19px] h-[19px]" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{latestNote.title || latestNote.message}</div>
            <div className="text-[11.5px] text-muted-2">From the studio</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-2" />
        </button>
      )}

      {eventSheet && <EventSheet event={eventSheet.event} kind={eventSheet.kind} onClose={() => setEventSheet(null)} />}
    </div>
  );
}
