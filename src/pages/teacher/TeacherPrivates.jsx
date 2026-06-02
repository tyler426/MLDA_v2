import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Plus, Trash2, Clock } from 'lucide-react';
import { formatTime } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { fmtDate } from '@/lib/dateUtils';
import { toast } from 'sonner';

export default function TeacherPrivates() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('requests');
  const [slot, setSlot] = useState({ date: '', start_time: '16:00', end_time: '17:00' });

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: teacherRows = [] } = useQuery({
    queryKey: ['teacherRecord', me?.email], enabled: !!me?.email,
    queryFn: () => base44.entities.Teacher.filter({ email: me.email }),
  });
  const teacher = teacherRows[0];

  const { data: requests = [] } = useQuery({ queryKey: ['privateRequests'], queryFn: () => base44.entities.PrivateRequest.list('-created_date', 100) });
  const { data: slots = [] } = useQuery({ queryKey: ['availability'], queryFn: () => base44.entities.AvailabilitySlot.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: households = [] } = useQuery({ queryKey: ['allParents'], queryFn: () => base44.entities.ParentHousehold.list() });

  const mine = r => !r.teacher_id || r.teacher_id === teacher?.id;
  const pending = requests.filter(r => r.status === 'pending' && mine(r));
  const booked = requests.filter(r => r.status === 'approved' && mine(r));
  const mySlots = slots.filter(s => s.teacher_id === teacher?.id);

  const dancerName = id => { const d = dancers.find(x => x.id === id); return d ? `${d.first_name} ${d.last_name}` : 'Dancer'; };
  const parentName = id => { const h = households.find(x => x.id === id); return h?.primary_contact_name || ''; };

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.PrivateRequest.update(id, { status, teacher_id: teacher?.id || null }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['privateRequests'] }); toast.success(v.status === 'approved' ? 'Approved' : 'Declined'); },
    onError: e => toast.error(e.message),
  });
  const addSlot = useMutation({
    mutationFn: () => base44.entities.AvailabilitySlot.create({ teacher_id: teacher?.id || null, ...slot, status: 'open' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['availability'] }); setSlot({ date: '', start_time: '16:00', end_time: '17:00' }); toast.success('Availability published'); },
    onError: e => toast.error(e.message),
  });
  const delSlot = useMutation({
    mutationFn: id => base44.entities.AvailabilitySlot.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-gold font-semibold">Private lessons</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">Requests &amp; availability</h1>
      </div>

      <div className="mt-4 flex gap-1.5 bg-[#1d1a15] border border-border rounded-full p-1">
        {[['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`], ['availability', 'Availability'], ['booked', 'Booked']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 text-[11.5px] font-semibold py-2 rounded-full transition-colors ${tab === k ? 'bg-primary text-[#06110f]' : 'text-muted-foreground'}`}>{l}</button>
        ))}
      </div>

      <div className="mt-4 pb-2 space-y-2.5">
        {tab === 'requests' && (pending.length === 0
          ? <Empty msg="No pending requests." />
          : pending.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-serif text-[18px] font-semibold">{dancerName(r.dancer_id)}</div>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(200,164,100,.14)', color: '#c8a464' }}>Pending</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-1">{r.focus || 'Private lesson'}</div>
              <div className="text-[11.5px] text-muted-2 mt-0.5">{r.when_text || 'flexible'}{parentName(r.household_id) ? ` · ${parentName(r.household_id)}` : ''}</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'declined' })} variant="outline" className="flex-1 h-9 text-xs"><X className="w-3.5 h-3.5 mr-1" />Decline</Button>
                <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'approved' })} className="flex-1 h-9 bg-primary text-[#06110f] font-bold text-xs"><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
              </div>
            </div>
          )))}

        {tab === 'availability' && (
          <>
            <div className="bg-card border border-border rounded-2xl p-3 flex items-end gap-2 flex-wrap">
              <div className="min-w-0"><label className="text-[10px] text-muted-foreground">Date</label><Input type="date" value={slot.date} onChange={e => setSlot({ ...slot, date: e.target.value })} className="bg-secondary border-border h-9 text-xs" /></div>
              <div><label className="text-[10px] text-muted-foreground">From</label><Input type="time" value={slot.start_time} onChange={e => setSlot({ ...slot, start_time: e.target.value })} className="bg-secondary border-border h-9 text-xs w-[88px]" /></div>
              <div><label className="text-[10px] text-muted-foreground">To</label><Input type="time" value={slot.end_time} onChange={e => setSlot({ ...slot, end_time: e.target.value })} className="bg-secondary border-border h-9 text-xs w-[88px]" /></div>
              <Button size="sm" disabled={!slot.date || addSlot.isPending} onClick={() => addSlot.mutate()} className="bg-primary text-[#06110f] font-bold text-[11px] h-9"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            {mySlots.length === 0 ? <Empty msg="No open slots published." /> : mySlots.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-teal-bright" />{s.date ? fmtDate(s.date, 'EEE, MMM d') : ''} · {formatTime(s.start_time)}–{formatTime(s.end_time)}</div>
                <button onClick={() => delSlot.mutate(s.id)} className="p-1.5 text-muted-foreground hover:text-terracotta"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </>
        )}

        {tab === 'booked' && (booked.length === 0
          ? <Empty msg="Nothing booked yet." />
          : booked.map(r => (
            <div key={r.id} className="bg-card border rounded-2xl p-4" style={{ borderColor: 'rgba(44,144,137,.35)' }}>
              <div className="flex items-center justify-between">
                <div className="font-serif text-[18px] font-semibold">{dancerName(r.dancer_id)}</div>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(44,144,137,.16)', color: '#3aa89f' }}>Approved</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-1">{r.focus || 'Private'} · {r.when_text || 'time TBD'}</div>
            </div>
          )))}
      </div>
    </div>
  );
}

function Empty({ msg }) { return <div className="bg-card border border-border rounded-2xl p-6 text-center text-[13px] text-muted-2">{msg}</div>; }
