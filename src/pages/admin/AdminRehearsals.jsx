import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Music, AlertTriangle, Clock, MapPin, Pencil, X } from 'lucide-react';
import { formatTime, DAY_NAMES } from '@/lib/scheduleUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminRehearsals() {
  const [showCreator, setShowCreator] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list('-date', 50) });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: allDancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <SectionLabel>Rehearsal Blocks</SectionLabel>
        <Button size="sm" onClick={() => setShowCreator(true)} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
          <Plus className="w-4 h-4 mr-1" /> New Rehearsal
        </Button>
      </div>

      {rehearsals.length === 0 ? (
        <EmptyState message="No rehearsal blocks yet" sub="Create one to start pulling dancers from classes" />
      ) : (
        <div className="space-y-3">
          {rehearsals.map((r, i) => {
            const studio = studios.find(s => s.id === r.studio_id);
            const teacher = teachers.find(t => t.id === r.teacher_id);
            const rPieces = (r.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-body font-medium text-sm text-foreground">
                      {format(new Date(r.date), 'EEE, MMM d, yyyy')}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(r.start_time)} – {formatTime(r.end_time)}</span>
                      {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                    </div>
                    {teacher && <p className="text-xs text-warm-gray mt-1">Teacher: {teacher.first_name} {teacher.last_name}</p>}
                  </div>
                  <button
                    onClick={() => setEditingId(r.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Edit rehearsal"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {rPieces.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rPieces.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 bg-gold/10 text-gold font-caps text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded">
                        <Music className="w-3 h-3" />{p.title}
                      </span>
                    ))}
                  </div>
                )}
                {r.notes && <p className="mt-2 text-xs text-muted-foreground italic">{r.notes}</p>}
              </motion.div>
            );
          })}
        </div>
      )}

      <RehearsalCreatorDialog
        open={showCreator}
        onClose={() => setShowCreator(false)}
        studios={studios}
        teachers={teachers}
        pieces={pieces}
        dancers={allDancers}
        queryClient={queryClient}
      />

      {editingId && (
        <RehearsalEditorDialog
          rehearsalId={editingId}
          onClose={() => setEditingId(null)}
          studios={studios}
          teachers={teachers}
          pieces={pieces}
          dancers={allDancers}
          queryClient={queryClient}
        />
      )}
    </div>
  );
}

function RehearsalCreatorDialog({ open, onClose, studios, teachers, pieces, dancers = [], queryClient }) {
  const [form, setForm] = useState({ date: '', start_time: '14:00', end_time: '16:00', studio_id: '', teacher_id: '', notes: '', piece_ids: [], dancer_ids: [] });
  const [impactPreview, setImpactPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const togglePiece = (pieceId) => {
    setForm(prev => ({
      ...prev,
      piece_ids: prev.piece_ids.includes(pieceId)
        ? prev.piece_ids.filter(id => id !== pieceId)
        : [...prev.piece_ids, pieceId]
    }));
  };

  const toggleDancer = (dancerId) => {
    setForm(prev => ({
      ...prev,
      dancer_ids: prev.dancer_ids.includes(dancerId)
        ? prev.dancer_ids.filter(id => id !== dancerId)
        : [...prev.dancer_ids, dancerId]
    }));
  };

  const previewImpact = async () => {
    if (!form.date || form.piece_ids.length === 0) return;
    setLoading(true);
    
    // Get all dancers in selected pieces
    const pieceCasts = await base44.entities.PieceCast.list();
    const affectedDancerIds = [...new Set(pieceCasts.filter(pc => form.piece_ids.includes(pc.piece_id)).map(pc => pc.dancer_id))];
    
    // Get dancers
    const allDancers = await base44.entities.Dancer.list();
    const affectedDancers = allDancers.filter(d => affectedDancerIds.includes(d.id));

    // Check classes on the rehearsal day
    const dayOfWeek = new Date(form.date).getDay();
    const allClasses = await base44.entities.DanceClass.list();
    const enrollments = await base44.entities.ClassEnrollment.filter({ active: true });

    const conflicts = [];
    for (const dancer of affectedDancers) {
      const dancerEnrollments = enrollments.filter(e => e.dancer_id === dancer.id);
      for (const enrollment of dancerEnrollments) {
        const cls = allClasses.find(c => c.id === enrollment.class_id);
        if (cls && cls.day_of_week === dayOfWeek) {
          // Check time overlap
          if (cls.start_time < form.end_time && cls.end_time > form.start_time) {
            conflicts.push({ dancer, class: cls });
          }
        }
      }
    }

    setImpactPreview({ affectedDancers, conflicts });
    setLoading(false);
  };

  const createRehearsal = useMutation({
    mutationFn: async () => {
      // Create the rehearsal block
      const rehearsal = await base44.entities.RehearsalBlock.create(form);

      // Check global notifications setting
      const adminUser = await base44.auth.me();
      const notificationsEnabled = adminUser?.global_notifications_enabled === true;

      // Create schedule exceptions for each conflict
      if (impactPreview?.conflicts) {
        for (const conflict of impactPreview.conflicts) {
          await base44.entities.ScheduleException.create({
            class_id: conflict.class.id,
            date: form.date,
            type: 'dancer_pulled',
            dancer_id: conflict.dancer.id,
            rehearsal_block_id: rehearsal.id,
            reason: `Pulled to rehearsal`,
          });

          // Notify parent only if notifications are enabled globally
          if (notificationsEnabled) {
            const dancer = conflict.dancer;
            if (dancer.parent_household_id) {
              const households = await base44.entities.ParentHousehold.filter({ id: dancer.parent_household_id });
              if (households.length > 0) {
                await base44.entities.ScheduleNotification.create({
                  recipient_email: households[0].email,
                  recipient_type: 'parent',
                  type: 'dancer_pulled',
                  title: `${dancer.first_name} pulled to rehearsal`,
                  message: `${dancer.first_name} has been pulled from ${conflict.class.title} on ${format(new Date(form.date), 'MMM d')} for rehearsal.`,
                });
              }
            }
          }
        }

        if (notificationsEnabled) {
          // Check if any class lost all dancers
          const classConflictCounts = {};
          for (const conflict of impactPreview.conflicts) {
            const key = conflict.class.id;
            if (!classConflictCounts[key]) classConflictCounts[key] = { cls: conflict.class, count: 0 };
            classConflictCounts[key].count++;
          }

          const enrollments = await base44.entities.ClassEnrollment.filter({ active: true });
          for (const [classId, info] of Object.entries(classConflictCounts)) {
            const totalEnrolled = enrollments.filter(e => e.class_id === classId).length;
            if (info.count >= totalEnrolled && info.cls.teacher_id) {
              const teacherList = await base44.entities.Teacher.filter({ id: info.cls.teacher_id });
              if (teacherList.length > 0) {
                await base44.entities.ScheduleNotification.create({
                  recipient_email: teacherList[0].email,
                  recipient_type: 'teacher',
                  type: 'class_cancelled',
                  title: `${info.cls.title} — all dancers pulled`,
                  message: `All enrolled dancers have been pulled to rehearsal on ${format(new Date(form.date), 'MMM d')}. You don't need to come in for this class.`,
                });
              }
            }
          }
        }
      }

      return rehearsal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rehearsals'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      toast.success('Rehearsal created and dancers pulled');
      setForm({ date: '', start_time: '14:00', end_time: '16:00', studio_id: '', teacher_id: '', notes: '', piece_ids: [], dancer_ids: [] });
      setImpactPreview(null);
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setImpactPreview(null); } }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-body text-foreground">Create Rehearsal Block</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Studio</Label>
              <Select value={form.studio_id} onValueChange={v => setForm({ ...form, studio_id: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{studios.map(s => <SelectItem key={s.id} value={s.id}>Studio {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teacher</Label>
            <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Pieces */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Pieces</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pieces.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.piece_ids.includes(p.id)} onCheckedChange={() => togglePiece(p.id)} />
                  <span className="text-sm text-foreground">{p.title}</span>
                  {p.level && <span className="text-[10px] text-warm-gray">({p.level})</span>}
                </label>
              ))}
              {pieces.length === 0 && <p className="text-xs text-muted-foreground italic">No pieces created yet</p>}
            </div>
          </div>

          {/* Dancers called */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Dancers Called</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {dancers.map(d => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.dancer_ids.includes(d.id)} onCheckedChange={() => toggleDancer(d.id)} />
                  <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                  {d.level && <span className="text-[10px] text-warm-gray">{d.level}</span>}
                </label>
              ))}
              {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers yet</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" rows={2} />
          </div>

          {/* Impact preview */}
          <Button type="button" variant="outline" onClick={previewImpact} disabled={loading || !form.date || form.piece_ids.length === 0} className="w-full font-caps text-[10px] uppercase tracking-[0.12em]">
            {loading ? 'Checking...' : 'Preview Impact'}
          </Button>

          {impactPreview && (
            <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gold" />
                <span className="font-body text-xs font-medium text-foreground">
                  {impactPreview.affectedDancers.length} dancer{impactPreview.affectedDancers.length !== 1 ? 's' : ''} affected, {impactPreview.conflicts.length} class conflict{impactPreview.conflicts.length !== 1 ? 's' : ''}
                </span>
              </div>
              {impactPreview.conflicts.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {impactPreview.conflicts.slice(0, 10).map((c, i) => (
                    <p key={i}>{c.dancer.first_name} {c.dancer.last_name} → pulled from {c.class.title}</p>
                  ))}
                  {impactPreview.conflicts.length > 10 && <p>...and {impactPreview.conflicts.length - 10} more</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => createRehearsal.mutate()}
            disabled={createRehearsal.isPending || !form.date || form.piece_ids.length === 0}
            className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]"
          >
            {createRehearsal.isPending ? 'Creating...' : 'Confirm & Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RehearsalEditorDialog({ rehearsalId, onClose, studios, teachers, pieces, dancers = [], queryClient }) {
  const { data: rehearsal } = useQuery({ queryKey: ['rehearsal', rehearsalId], queryFn: () => base44.entities.RehearsalBlock.filter({ id: rehearsalId }).then(r => r[0]) });
  const [form, setForm] = useState(null);

  // Initialize form when rehearsal loads
  useEffect(() => {
    if (rehearsal) {
      setForm({
        date: rehearsal.date,
        start_time: rehearsal.start_time,
        end_time: rehearsal.end_time,
        studio_id: rehearsal.studio_id || '',
        teacher_id: rehearsal.teacher_id || '',
        notes: rehearsal.notes || '',
        piece_ids: rehearsal.piece_ids || [],
        dancer_ids: rehearsal.dancer_ids || [],
      });
    }
  }, [rehearsal]);

  const togglePiece = (pieceId) => {
    setForm(prev => ({
      ...prev,
      piece_ids: prev.piece_ids.includes(pieceId)
        ? prev.piece_ids.filter(id => id !== pieceId)
        : [...prev.piece_ids, pieceId]
    }));
  };

  const toggleDancer = (dancerId) => {
    setForm(prev => ({
      ...prev,
      dancer_ids: prev.dancer_ids.includes(dancerId)
        ? prev.dancer_ids.filter(id => id !== dancerId)
        : [...prev.dancer_ids, dancerId]
    }));
  };

  const updateRehearsal = useMutation({
    mutationFn: async () => {
      await base44.entities.RehearsalBlock.update(rehearsalId, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rehearsals'] });
      toast.success('Rehearsal updated');
      onClose();
    },
  });

  const deleteRehearsal = useMutation({
    mutationFn: async () => {
      // Delete associated schedule exceptions
      const exceptions = await base44.entities.ScheduleException.filter({ rehearsal_block_id: rehearsalId });
      for (const exc of exceptions) {
        await base44.entities.ScheduleException.delete(exc.id);
      }
      // Delete the rehearsal
      await base44.entities.RehearsalBlock.delete(rehearsalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rehearsals'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      toast.success('Rehearsal deleted');
      onClose();
    },
  });

  if (!form) return null;

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle className="font-body text-foreground">Edit Rehearsal Block</DialogTitle>
          <button
            onClick={() => deleteRehearsal.mutate()}
            disabled={deleteRehearsal.isPending}
            className="text-destructive hover:opacity-80 transition-opacity"
            title="Delete rehearsal"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Studio</Label>
              <Select value={form.studio_id} onValueChange={v => setForm({ ...form, studio_id: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{studios.map(s => <SelectItem key={s.id} value={s.id}>Studio {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teacher</Label>
            <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Pieces */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Pieces</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pieces.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.piece_ids.includes(p.id)} onCheckedChange={() => togglePiece(p.id)} />
                  <span className="text-sm text-foreground">{p.title}</span>
                  {p.level && <span className="text-[10px] text-warm-gray">({p.level})</span>}
                </label>
              ))}
              {pieces.length === 0 && <p className="text-xs text-muted-foreground italic">No pieces created yet</p>}
            </div>
          </div>

          {/* Dancers called */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Dancers Called</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {dancers.map(d => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.dancer_ids.includes(d.id)} onCheckedChange={() => toggleDancer(d.id)} />
                  <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                  {d.level && <span className="text-[10px] text-warm-gray">{d.level}</span>}
                </label>
              ))}
              {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers yet</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="font-caps text-[10px] uppercase tracking-[0.12em]">
            Cancel
          </Button>
          <Button
            onClick={() => updateRehearsal.mutate()}
            disabled={updateRehearsal.isPending}
            className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]"
          >
            {updateRehearsal.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}