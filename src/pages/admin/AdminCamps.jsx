import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/shared/EmptyState';
import { useStudioConfig } from '@/lib/useStudioConfig';
import { fmtDate } from '@/lib/dateUtils';
import { Plus, Tent, MapPin, Pencil, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminCamps() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCamp, setEditCamp] = useState(null);

  const { data: cfg } = useStudioConfig();
  const { data: camps = [] } = useQuery({ queryKey: ['camps'], queryFn: () => base44.entities.Camp.list('start_date') });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Camp.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['camps'] }); setShowCreate(false); toast.success('Camp added'); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Camp.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['camps'] }); setEditCamp(null); toast.success('Camp updated'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Camp.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['camps'] }); setEditCamp(null); toast.success('Camp deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const sorted = [...camps].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  return (
    <div className="max-w-4xl">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">Programs</div>
          <h1 className="font-serif text-[30px] font-semibold mt-1.5 -tracking-[0.01em]">Camps &amp; intensives</h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-primary text-[#06110f] hover:bg-primary/90 font-bold text-[13px] rounded-[10px] px-4 py-2.5">
          <Plus className="w-4 h-4 mr-1.5" /> New camp
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="No camps yet" sub="Add summer camps, intensives, or big-weekend workshops — divided by level." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center flex-none"><Tent className="w-[18px] h-[18px] text-gold" /></div>
                  <div className="min-w-0">
                    <h3 className="font-body font-semibold text-foreground">{c.name}</h3>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{fmtDate(c.start_date, 'MMM d')}{c.end_date && c.end_date !== c.start_date ? ` – ${fmtDate(c.end_date, 'MMM d')}` : ''}
                    </p>
                    {c.location && <p className="text-[11.5px] text-muted-2 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</p>}
                  </div>
                </div>
                <div className="flex gap-1 flex-none">
                  <button onClick={() => setEditCamp(c)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 text-muted-foreground hover:text-terracotta"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {c.program && c.program !== 'all' && <span className="font-caps text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-primary/12 text-primary">{c.program}</span>}
                {(c.levels || []).length === 0
                  ? <span className="font-caps text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-secondary text-warm-gray">All levels</span>
                  : (c.levels || []).map(l => <span key={l} className="font-caps text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-secondary text-warm-gray">{l}</span>)}
              </div>
              {c.description && <p className="text-[12px] text-muted-foreground mt-2.5 leading-relaxed">{c.description}</p>}
            </motion.div>
          ))}
        </div>
      )}

      <CampFormDialog
        open={showCreate || !!editCamp}
        camp={editCamp}
        cfg={cfg}
        onClose={() => { setShowCreate(false); setEditCamp(null); }}
        onSave={(data) => editCamp ? updateMutation.mutate({ id: editCamp.id, data }) : createMutation.mutate(data)}
        saving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

const EMPTY = { name: '', start_date: '', end_date: '', levels: [], program: 'all', location: '', description: '' };

function CampFormDialog({ open, camp, cfg, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [loadedId, setLoadedId] = useState(null);

  if (open && camp && loadedId !== camp.id) {
    setForm({ name: camp.name || '', start_date: camp.start_date || '', end_date: camp.end_date || '', levels: camp.levels || [], program: camp.program || 'all', location: camp.location || '', description: camp.description || '' });
    setLoadedId(camp.id);
  }
  if (open && !camp && loadedId !== '__new__') { setForm(EMPTY); setLoadedId('__new__'); }

  const reset = () => { setForm(EMPTY); setLoadedId(null); };
  const toggleLevel = (l) => setForm(f => ({ ...f, levels: f.levels.includes(l) ? f.levels.filter(x => x !== l) : [...f.levels, l] }));

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, end_date: form.end_date || form.start_date, program: form.program === 'all' ? null : form.program });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-body text-foreground">{camp ? 'Edit camp' : 'New camp'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Summer Intensive — Week 1" className="bg-secondary border-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Start</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">End <span className="text-muted-2">(optional)</span></Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="bg-secondary border-border" /></div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Levels <span className="text-muted-2">(none = all levels)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(cfg?.levels || []).map(l => (
                <button type="button" key={l} onClick={() => toggleLevel(l)}
                  className={`px-2.5 py-1 rounded font-caps text-[11px] uppercase tracking-[0.08em] border transition-colors ${form.levels.includes(l) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
              {(cfg?.levels || []).length === 0 && <span className="text-[11px] text-muted-2">Add levels in Settings first.</span>}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Program</Label>
            <Select value={form.program} onValueChange={v => setForm({ ...form, program: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole studio</SelectItem>
                {(cfg?.programs || []).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Location <span className="text-muted-2">(optional)</span></Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-secondary border-border" /></div>
          <div><Label className="text-xs text-muted-foreground">Details <span className="text-muted-2">(optional)</span></Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="bg-secondary border-border" /></div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { onClose(); reset(); }} className="text-[12px]">Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-[#06110f] font-bold text-[12px]">{camp ? 'Save' : 'Add camp'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
