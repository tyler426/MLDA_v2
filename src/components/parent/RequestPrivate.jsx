import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLE = {
  pending:  { bg: 'rgba(200,164,100,.14)', color: '#c8a464', label: 'Pending' },
  approved: { bg: 'rgba(44,144,137,.16)', color: '#3aa89f', label: 'Approved' },
  declined: { bg: 'rgba(217,122,94,.16)', color: '#d97a5e', label: 'Declined' },
};

// Parent-facing: request a private lesson + see status. Teacher approves in Phase 5.
export default function RequestPrivate({ household }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dancer_id: '', teacher_id: '', when_text: '', focus: '' });

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: requests = [] } = useQuery({
    queryKey: ['privateRequests', household?.id],
    queryFn: () => base44.entities.PrivateRequest.filter({ household_id: household.id }, '-created_date', 20),
    enabled: !!household?.id,
  });

  const submit = useMutation({
    mutationFn: () => base44.entities.PrivateRequest.create({
      dancer_id: form.dancer_id, household_id: household.id, teacher_id: form.teacher_id || null,
      when_text: form.when_text, focus: form.focus, status: 'pending',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privateRequests', household?.id] });
      setForm({ dancer_id: '', teacher_id: '', when_text: '', focus: '' });
      setOpen(false);
      toast.success('Private lesson requested — the studio will confirm');
    },
    onError: (e) => toast.error(e.message || 'Could not send request'),
  });

  const dancerName = id => { const d = dancers.find(x => x.id === id); return d ? d.first_name : 'Dancer'; };
  const teacherName = id => { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name}` : 'Any teacher'; };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-[18px] h-[18px] text-gold" />
          <h3 className="font-body font-semibold text-sm text-foreground">Private lessons</h3>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-[12px] text-teal-bright font-semibold">
            <Plus className="w-3.5 h-3.5" /> Request
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); if (form.dancer_id) submit.mutate(); }} className="mt-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Dancer</Label>
              <Select value={form.dancer_id} onValueChange={v => setForm({ ...form, dancer_id: v })}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{dancers.map(d => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Teacher (optional)</Label>
              <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Preferred time</Label>
            <Input value={form.when_text} onChange={e => setForm({ ...form, when_text: e.target.value })} placeholder="e.g. Thursdays after 5 PM" className="bg-secondary border-border h-9 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Focus</Label>
            <Input value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })} placeholder="e.g. Nationals solo cleaning" className="bg-secondary border-border h-9 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submit.isPending} className="flex-1 h-9 bg-primary text-[#06110f] text-xs font-bold">
              {submit.isPending ? '…' : 'Send request'}
            </Button>
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {requests.map(r => {
            const s = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
            return (
              <div key={r.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium truncate">{dancerName(r.dancer_id)} · {r.focus || 'Private'}</p>
                  <p className="text-[10.5px] text-muted-2 truncate">{r.when_text || 'flexible'} · {teacherName(r.teacher_id)}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full flex-none" style={{ background: s.bg, color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {!open && requests.length === 0 && (
        <p className="text-[11.5px] text-muted-2 mt-2">Request 1-on-1 time with an instructor. The studio confirms a slot.</p>
      )}
    </div>
  );
}
