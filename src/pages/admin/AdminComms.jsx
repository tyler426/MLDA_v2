import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudioConfig } from '@/lib/useStudioConfig';
import { Send, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminComms() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const { data: cfg } = useStudioConfig();
  const { data: households = [] } = useQuery({ queryKey: ['allParents'], queryFn: () => base44.entities.ParentHousehold.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });

  const audiences = [
    { key: 'all', label: 'All families' },
    ...(cfg?.programs || []).map(p => ({ key: `program:${p}`, label: p })),
    ...(cfg?.levels || []).map(l => ({ key: `level:${l}`, label: l })),
  ];

  // Households that match the selected audience (via their dancers).
  const targetHouseholds = (() => {
    if (audience === 'all') return households.filter(h => h.email);
    const [kind, val] = audience.split(':');
    const ok = new Set(dancers.filter(d => (kind === 'program' ? d.program === val : d.level === val)).map(d => d.parent_household_id));
    return households.filter(h => h.email && ok.has(h.id));
  })();

  const send = useMutation({
    mutationFn: async () => {
      for (const h of targetHouseholds) {
        await base44.entities.ScheduleNotification.create({
          recipient_email: h.email, recipient_type: 'parent', type: 'announcement',
          title: subject.trim(), message: body.trim(),
        });
      }
      return targetHouseholds.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['notifications'] }); setSubject(''); setBody(''); toast.success(`Broadcast sent to ${n} famil${n === 1 ? 'y' : 'ies'}`); },
    onError: (e) => toast.error(e.message || 'Send failed'),
  });

  const label = audiences.find(a => a.key === audience)?.label || 'All families';

  return (
    <div className="animate-[fade_.3s_ease] max-w-2xl">
      <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">Communications</div>
      <h1 className="font-serif text-[30px] font-semibold mt-1.5">Send a broadcast</h1>

      <div className="bg-card border border-border rounded-2xl p-5 mt-5">
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-2 mb-2.5">Audience</div>
        <div className="flex flex-wrap gap-2">
          {audiences.map(a => (
            <button key={a.key} onClick={() => setAudience(a.key)}
              className="rounded-full px-3.5 py-2 text-[13px] border transition-colors"
              style={{ borderColor: audience === a.key ? 'rgba(58,168,159,.35)' : 'var(--border)', background: audience === a.key ? 'rgba(44,144,137,.16)' : 'transparent', color: audience === a.key ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {a.label}
            </button>
          ))}
          {audiences.length === 1 && <span className="text-[12px] text-muted-2 self-center">Add programs/levels in Settings to target groups.</span>}
        </div>

        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-2 mt-5 mb-2">Subject</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Nationals costume balance due Friday"
          className="w-full bg-secondary border border-border rounded-xl px-3.5 h-11 text-sm outline-none" />

        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-2 mt-4 mb-2">Message</div>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Write your announcement to families…"
          className="w-full bg-secondary border border-border rounded-xl p-3.5 text-sm outline-none resize-none leading-relaxed" />

        <div className="flex items-center justify-between mt-4">
          <span className="text-[12.5px] text-muted-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Goes to <b className="text-teal-bright">{label}</b> · {targetHouseholds.length} famil{targetHouseholds.length === 1 ? 'y' : 'ies'} · in-app inbox
          </span>
          <button onClick={() => { if (subject.trim() && body.trim() && targetHouseholds.length) send.mutate(); else toast.error('Add a subject, message, and audience'); }}
            disabled={send.isPending}
            className="inline-flex items-center gap-2 bg-primary text-[#06110f] rounded-xl px-5 py-2.5 text-[13px] font-bold">
            <Send className="w-4 h-4" /> {send.isPending ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
        <p className="text-[11px] text-muted-2 mt-3">Email delivery turns on automatically once you add an email provider (it'll respect each family's notification preference).</p>
      </div>
    </div>
  );
}
