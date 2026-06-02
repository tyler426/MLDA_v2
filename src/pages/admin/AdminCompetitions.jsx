import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Trophy, MapPin, Calendar, Clock, UserPlus, Trash2, Music2 } from 'lucide-react';
import { format } from 'date-fns';
import { fmtDate } from '@/lib/dateUtils';
import { formatTime } from '@/lib/scheduleUtils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminCompetitions() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWeekend, setSelectedWeekend] = useState(null);
  const [showShiftCreate, setShowShiftCreate] = useState(false);
  const [showEntryCreate, setShowEntryCreate] = useState(false);
  const [entryPiece, setEntryPiece] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const queryClient = useQueryClient();

  const { data: weekends = [], refetch: refetchWeekends } = useQuery({ queryKey: ['compWeekends'], queryFn: () => base44.entities.CompetitionWeekend.list('-start_date') });
  const { data: shifts = [] } = useQuery({ queryKey: ['compShifts'], queryFn: () => base44.entities.CompetitionShift.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });

  const updateWeekend = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CompetitionWeekend.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compWeekends'] }); setShowEntryCreate(false); toast.success('Entry saved'); },
  });

  const createWeekend = useMutation({
    mutationFn: (d) => base44.entities.CompetitionWeekend.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compWeekends'] }); setShowCreate(false); toast.success('Competition created'); },
  });

  const createShift = useMutation({
    mutationFn: (d) => base44.entities.CompetitionShift.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compShifts'] }); setShowShiftCreate(false); toast.success('Shift added'); },
  });

  const deleteShift = useMutation({
    mutationFn: (id) => base44.entities.CompetitionShift.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compShifts'] }); toast.success('Shift removed'); },
  });

  const { data: compEntries = [] } = useQuery({ queryKey: ['compEntries'], queryFn: () => base44.entities.CompetitionEntry.list() });
  const createEntry = useMutation({
    mutationFn: (d) => base44.entities.CompetitionEntry.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compEntries'] }); setEntryPiece(''); setEntryTime(''); toast.success('Call time added'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntry = useMutation({
    mutationFn: (id) => base44.entities.CompetitionEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compEntries'] }),
  });
  const updateEntry = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CompetitionEntry.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compEntries'] }),
  });

  const weekendShifts = selectedWeekend ? shifts.filter(s => s.competition_weekend_id === selectedWeekend.id).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)) : [];
  const weekendEntries = selectedWeekend ? compEntries.filter(e => e.competition_weekend_id === selectedWeekend.id) : [];

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <h1 className="font-serif text-[28px] font-semibold -tracking-[0.01em]">Competition weekends</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {weekends.length === 0 ? (
        <EmptyState message="No competitions yet" />
      ) : (
        <div className="space-y-3">
          {weekends.map((w, i) => (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedWeekend(w)}
              className={`w-full text-left bg-card border rounded-lg p-4 transition-colors ${selectedWeekend?.id === w.id ? 'border-primary' : 'border-border hover:border-primary/30'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-body font-medium text-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-gold" />{w.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(w.start_date, 'MMM d')} – {fmtDate(w.end_date, 'MMM d, yyyy')}</span>
                    {w.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.venue}</span>}
                  </div>
                </div>
                <span className="text-xs text-warm-gray">{shifts.filter(s => s.competition_weekend_id === w.id).length} shifts</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail panels for selected weekend */}
      {selectedWeekend && (
        <div className="mt-6 space-y-6">

          {/* Competing Entries */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Competing Numbers — {selectedWeekend.name}</SectionLabel>
              <Button size="sm" onClick={() => setShowEntryCreate(true)} className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 font-caps text-[10px] uppercase tracking-[0.12em]">
                <Music2 className="w-3.5 h-3.5 mr-1" /> Add Number
              </Button>
            </div>
            {!(selectedWeekend.competing_entries?.length > 0) ? (
              <p className="text-xs text-muted-foreground italic">No numbers added yet</p>
            ) : (
              <div className="space-y-2">
                {[...(selectedWeekend.competing_entries || [])].sort((a, b) => {
                  const d = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                  return d !== 0 ? d : (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                }).map((entry, i) => (
                  <div key={i} className="bg-card border border-gold/20 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {entry.category && <span className="text-gold font-caps text-[10px] uppercase tracking-[0.1em]">{entry.category}</span>}
                        {entry.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(entry.scheduled_date, 'EEE, MMM d')}</span>}
                        {entry.scheduled_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(entry.scheduled_time)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const updated = selectedWeekend.competing_entries.filter((_, idx) => idx !== i);
                        updateWeekend.mutate({ id: selectedWeekend.id, data: { competing_entries: updated } });
                        setSelectedWeekend(prev => ({ ...prev, competing_entries: updated }));
                      }}
                      className="p-1.5 text-muted-foreground hover:text-terracotta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competing routines — add the routine first; fill entry # and call time later */}
          <div>
            <SectionLabel className="mb-1">Competing routines</SectionLabel>
            <p className="text-[11px] text-muted-2 mb-3">Add a routine that's competing. Entry number &amp; call time can be filled in later when the schedule is released — they flow straight to families.</p>
            <div className="bg-card border border-border rounded-lg p-3 mb-2 flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Routine</Label>
                <Select value={entryPiece} onValueChange={setEntryPiece}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue placeholder="Select routine" /></SelectTrigger>
                  <SelectContent>{pieces.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={!entryPiece || createEntry.isPending}
                onClick={() => createEntry.mutate({ competition_weekend_id: selectedWeekend.id, piece_id: entryPiece, call_time: null, entry_number: null })}
                className="bg-primary text-[#06110f] font-bold text-[11px] h-9"><Plus className="w-3.5 h-3.5 mr-1" />Add routine</Button>
            </div>
            {weekendEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No routines added yet</p>
            ) : (
              <div className="space-y-2">
                {weekendEntries.map(en => {
                  const piece = pieces.find(p => p.id === en.piece_id);
                  return (
                    <div key={en.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                        <Music2 className="w-3.5 h-3.5 text-gold" />
                        <span className="text-sm text-foreground">{piece?.title || 'Routine'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        Entry #
                        <Input defaultValue={en.entry_number || ''} onBlur={e => updateEntry.mutate({ id: en.id, data: { entry_number: e.target.value || null } })}
                          placeholder="—" className="bg-secondary border-border h-8 w-16 text-xs" />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        Call
                        <Input type="time" defaultValue={en.call_time || ''} onBlur={e => updateEntry.mutate({ id: en.id, data: { call_time: e.target.value || null } })}
                          className="bg-secondary border-border h-8 w-[110px] text-xs" />
                      </div>
                      <button onClick={() => deleteEntry.mutate(en.id)} className="p-1.5 text-muted-foreground hover:text-terracotta"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shifts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Staff Shifts</SectionLabel>
              <Button size="sm" variant="outline" onClick={() => setShowShiftCreate(true)} className="font-caps text-[10px] uppercase tracking-[0.12em]">
                <UserPlus className="w-4 h-4 mr-1" /> Add Shift
              </Button>
            </div>
            {weekendShifts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No shifts assigned yet</p>
            ) : (
              <div className="space-y-2">
                {weekendShifts.map(s => {
                  const teacher = teachers.find(t => t.id === s.teacher_id);
                  return (
                    <div key={s.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">{fmtDate(s.date, 'EEE, MMM d')}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(s.start_time)} – {formatTime(s.end_time)}</span>
                          {teacher && <span>{teacher.first_name} {teacher.last_name}</span>}
                          {s.role && <span className="text-gold">{s.role}</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteShift.mutate(s.id)} className="p-1.5 text-muted-foreground hover:text-terracotta"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <WeekendFormDialog open={showCreate} onClose={() => setShowCreate(false)} onSave={(d) => createWeekend.mutate(d)} />
      <ShiftFormDialog open={showShiftCreate} onClose={() => setShowShiftCreate(false)} weekend={selectedWeekend} teachers={teachers} onSave={(d) => createShift.mutate(d)} />
      <EntryFormDialog
        open={showEntryCreate}
        onClose={() => setShowEntryCreate(false)}
        weekend={selectedWeekend}
        pieces={pieces}
        onSave={(entry) => {
          const existing = selectedWeekend.competing_entries || [];
          const updated = [...existing, entry];
          updateWeekend.mutate({ id: selectedWeekend.id, data: { competing_entries: updated } });
          setSelectedWeekend(prev => ({ ...prev, competing_entries: updated }));
        }}
      />
    </div>
  );
}

function EntryFormDialog({ open, onClose, weekend, pieces, onSave }) {
  const [form, setForm] = useState({ title: '', category: '', scheduled_date: '', scheduled_time: '', piece_id: '' });

  const handlePieceSelect = (pid) => {
    const piece = pieces.find(p => p.id === pid);
    setForm(f => ({
      ...f,
      piece_id: pid === 'none' ? '' : pid,
      title: piece ? piece.title : f.title,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setForm({ title: '', category: '', scheduled_date: '', scheduled_time: '', piece_id: '' }); } }}>
      <DialogContent className="bg-card border-border max-w-sm" onInteractOutside={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle className="font-body text-foreground">Add Competing Number</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); setForm({ title: '', category: '', scheduled_date: '', scheduled_time: '', piece_id: '' }); }} className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Link to Piece (optional)</Label>
            <Select value={form.piece_id || 'none'} onValueChange={handlePieceSelect}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select piece or leave blank" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No link</SelectItem>
                {pieces.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Number Title</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Firebird Group" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Category / Division</Label>
            <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Teen Group, Junior Solo" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Performance Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Est. Time</Label>
              <Input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="bg-secondary border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">Add Number</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WeekendFormDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', venue: '', notes: '' });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setForm({ name: '', start_date: '', end_date: '', venue: '', notes: '' }); } }}>
      <DialogContent className="bg-card border-border max-w-sm" onInteractOutside={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle className="font-body text-foreground">New Competition Weekend</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="bg-secondary border-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Start</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">End</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required className="bg-secondary border-border" /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Venue</Label><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="bg-secondary border-border" /></div>
          <div><Label className="text-xs text-muted-foreground">Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="bg-secondary border-border" /></div>
          <DialogFooter><Button type="submit" className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShiftFormDialog({ open, onClose, weekend, teachers, onSave }) {
  const [form, setForm] = useState({ date: '', start_time: '08:00', end_time: '17:00', teacher_id: '', role: '' });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setForm({ date: '', start_time: '08:00', end_time: '17:00', teacher_id: '', role: '' }); } }}>
      <DialogContent className="bg-card border-border max-w-sm" onInteractOutside={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle className="font-body text-foreground">Add Shift</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, competition_weekend_id: weekend?.id }); }} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className="bg-secondary border-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Start</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">End</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="bg-secondary border-border" /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Teacher</Label>
            <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Role</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Backstage, Warm-up" className="bg-secondary border-border" /></div>
          <DialogFooter><Button type="submit" className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">Add Shift</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}