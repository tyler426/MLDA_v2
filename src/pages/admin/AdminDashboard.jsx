import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatTime, getTodayDow } from '@/lib/scheduleUtils';
import { AlertTriangle, ClipboardList, Trophy, Megaphone, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';

const STYLE_COLOR = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function colorFor(str = '') { let s = 0; for (const c of str) s += c.charCodeAt(0); return STYLE_COLOR[s % STYLE_COLOR.length]; }
function toMin(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function overlaps(a, b) { return toMin(a.start_time) < toMin(b.end_time) && toMin(a.end_time) > toMin(b.start_time); }
function initials(n = '') { const p = n.trim().split(' '); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'; }

export default function AdminDashboard() {
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: households = [] } = useQuery({ queryKey: ['allParents'], queryFn: () => base44.entities.ParentHousehold.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['allAbsences'], queryFn: () => base44.entities.AbsenceReport.list() });
  const { data: competitions = [] } = useQuery({ queryKey: ['competitions'], queryFn: () => base44.entities.CompetitionWeekend.list() });

  const activeDancers = dancers.filter(d => !d.archived);
  const dow = getTodayDow();
  const todayClasses = classes.filter(c => c.day_of_week === dow);

  // KPIs (only what we can compute honestly)
  const kpis = [
    { label: 'Active dancers', value: activeDancers.length, sub: `${dancers.length} total on file`, gold: false },
    { label: 'Classes today', value: todayClasses.length, sub: `${classes.length} in the week`, gold: false },
    { label: 'Faculty', value: teachers.filter(t => !t.archived).length, sub: `${studios.length} studios`, gold: false },
    { label: 'Pending absences', value: absences.filter(a => a.status === 'pending').length, sub: 'awaiting review', gold: true },
  ];

  // Needs attention — real signals
  const alerts = [];
  for (let i = 0; i < todayClasses.length; i++)
    for (let j = i + 1; j < todayClasses.length; j++) {
      const a = todayClasses[i], b = todayClasses[j];
      if (a.studio_id && a.studio_id === b.studio_id && overlaps(a, b))
        alerts.push({ icon: AlertTriangle, color: 'var(--terracotta)', title: 'Room double-booked today', body: `${a.title} & ${b.title} overlap`, to: '/admin/conflicts' });
    }
  absences.filter(a => a.status === 'pending').slice(0, 2).forEach(a => {
    const d = dancers.find(x => x.id === a.dancer_id);
    alerts.push({ icon: ClipboardList, color: '#3aa89f', title: 'Absence awaiting review', body: d ? `${d.first_name} ${d.last_name} — ${a.reason || 'no reason given'}` : 'Pending absence', to: '/admin/attendance' });
  });
  const upcomingComp = competitions.find(c => c.start_date && c.start_date >= format(new Date(), 'yyyy-MM-dd'));
  if (upcomingComp) alerts.push({ icon: Trophy, color: '#c8a464', title: upcomingComp.name, body: `Competition weekend ${upcomingComp.start_date}`, to: '/admin/competitions' });
  if (studios.length === 0) alerts.push({ icon: Users, color: '#c8a464', title: 'No rooms set up', body: 'Add studios in Roster → Rooms', to: '/admin/roster' });

  const recent = [...dancers].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5);
  const studioName = id => studios.find(s => s.id === id)?.name;
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name?.[0] || ''}.` : ''; };

  return (
    <div className="animate-[fade_.3s_ease]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">{format(new Date(), 'EEEE · MMMM d')}</div>
          <h1 className="font-serif text-[30px] font-semibold mt-1.5 -tracking-[0.01em]">Studio overview</h1>
        </div>
        <div className="flex gap-2.5">
          <Link to="/admin/comms" className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[10px] px-4 py-2 text-[13px] font-semibold hover:text-foreground"><Megaphone className="w-[15px] h-[15px]" />Broadcast</Link>
          <Link to="/admin/roster" className="inline-flex items-center gap-2 bg-primary text-[#06110f] rounded-[10px] px-4 py-2 text-[13px] font-bold"><Plus className="w-[15px] h-[15px]" />Add dancer</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mt-[22px]">
        {kpis.map((k, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[11.5px] text-muted-2">{k.label}</div>
            <div className="font-serif text-[34px] font-semibold my-1" style={{ color: k.gold ? '#c8a464' : 'var(--bone, #efe9df)' }}>{k.value}</div>
            <div className="text-[11.5px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-[1.55fr_1fr] gap-[18px] mt-[18px]">
        {/* Today across studios */}
        <div className="bg-card border border-border rounded-2xl p-[18px]">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="text-[15px] font-bold">Today across the studios</div>
              <div className="text-[11.5px] text-muted-2 mt-0.5">{format(new Date(), 'EEE')} · {todayClasses.length} classes</div>
            </div>
            <Link to="/admin/schedule" className="bg-secondary border border-border rounded-[10px] px-3 py-1.5 text-[12px] font-semibold hover:text-foreground">Full schedule</Link>
          </div>
          {studios.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-8 text-center">No rooms yet — add studios in Roster → Rooms.</p>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(studios.length, 4)}, 1fr)` }}>
              {studios.slice(0, 4).map(st => {
                const list = todayClasses.filter(c => c.studio_id === st.id).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                return (
                  <div key={st.id}>
                    <div className="text-[12px] font-semibold text-muted-foreground text-center pb-2 mb-2 border-b border-border">Studio {st.name}</div>
                    <div className="space-y-1.5">
                      {list.length === 0 && <p className="text-[11px] text-muted-2 text-center py-3">—</p>}
                      {list.map(c => (
                        <Link key={c.id} to="/admin/schedule" className="block rounded-[9px] px-2.5 py-2 border-l-[3px]" style={{ background: colorFor(c.title) + '28', borderLeftColor: colorFor(c.title) }}>
                          <div className="text-[11.5px] font-bold leading-tight">{c.title}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatTime(c.start_time)} · {teacherName(c.teacher_id)}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-[18px]">
          <div className="bg-card border border-border rounded-2xl">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="text-[15px] font-bold">Needs attention</div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(217,122,94,.14)', color: '#d97a5e' }}>{alerts.length}</span>
            </div>
            <div className="mt-2.5">
              {alerts.length === 0 && <p className="text-sm text-muted-foreground italic px-4 py-6 text-center">All clear. 🎉</p>}
              {alerts.slice(0, 5).map((a, i) => {
                const Icon = a.icon;
                return (
                  <Link key={i} to={a.to} className="flex gap-3 px-3.5 py-3 border-b border-border last:border-0 hover:bg-secondary/40">
                    <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-none" style={{ background: a.color + '22', color: a.color }}><Icon className="w-[17px] h-[17px]" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold">{a.title}</span>
                      <span className="block text-[11.5px] text-muted-2 mt-0.5 leading-snug">{a.body}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[15px] font-bold">Recent registrations</div>
              <Link to="/admin/roster" className="text-[11.5px] text-teal-bright">View all</Link>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
              {recent.length === 0 && <p className="text-sm text-muted-foreground italic py-2">No dancers yet.</p>}
              {recent.map(d => (
                <div key={d.id} className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-serif font-semibold text-[#0a0908]" style={{ background: colorFor(d.first_name + d.last_name) }}>{initials(`${d.first_name} ${d.last_name}`)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{d.first_name} {d.last_name}</div>
                    <div className="text-[11px] text-muted-2">{d.program || d.level || 'Dancer'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
