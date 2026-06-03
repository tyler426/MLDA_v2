import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudioConfig } from '@/lib/useStudioConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Music, Users, Pencil, Trash2, Upload, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function TeacherPieces() {
  const qc = useQueryClient();
  const [userEmail, setUserEmail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editPiece, setEditPiece] = useState(null);
  const [manageCast, setManageCast] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });
  const { data: cfg } = useStudioConfig();
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });

  const teacherFullName = teacher ? `${teacher.first_name} ${teacher.last_name}`.trim() : '';

  // Pieces this teacher owns (created via teacher_id) or is the named choreographer of (legacy).
  const myPieces = pieces.filter(p => {
    if (teacher && p.teacher_id === teacher.id) return true;
    return p.choreographer && teacher && (
      p.choreographer.toLowerCase().includes(teacher.first_name.toLowerCase()) ||
      p.choreographer.toLowerCase().includes(teacher.last_name.toLowerCase())
    );
  });
  const solos = myPieces.filter(p => p.kind === 'solo');
  const groups = myPieces.filter(p => p.kind !== 'solo');

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Piece.create(d),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['pieces'] });
      setShowCreate(false);
      toast.success('Piece created — now add the cast');
      setManageCast(created); // smooth create → cast flow
    },
    onError: e => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Piece.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pieces'] }); setEditPiece(null); toast.success('Piece updated'); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const casts = pieceCasts.filter(pc => pc.piece_id === id);
      for (const c of casts) await base44.entities.PieceCast.delete(c.id);
      await base44.entities.Piece.delete(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pieces'] }); qc.invalidateQueries({ queryKey: ['pieceCasts'] }); toast.success('Piece deleted'); },
    onError: e => toast.error(e.message),
  });

  const section = (label, list) => (
    <div>
      <div className="font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray mb-2">{label} ({list.length})</div>
      <div className="space-y-2.5">
        {list.map((p, i) => (
          <PieceCard key={p.id} piece={p} index={i}
            castCount={pieceCasts.filter(pc => pc.piece_id === p.id).length}
            onEdit={() => setEditPiece(p)} onCast={() => setManageCast(p)} onDelete={() => deleteMutation.mutate(p.id)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <h1 className="font-serif text-[25px] font-semibold -tracking-[0.01em]">My pieces</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-primary text-[#06110f] font-caps text-[10px] uppercase tracking-[0.12em]">
          <Plus className="w-4 h-4 mr-1" /> New piece
        </Button>
      </div>

      {myPieces.length === 0 ? (
        <EmptyState message="No pieces yet" sub="Tap “New piece” to create a routine, upload its mix, and cast your dancers." />
      ) : (
        <div className="space-y-6">
          {groups.length > 0 && section('Group routines', groups)}
          {solos.length > 0 && section('Solos', solos)}
        </div>
      )}

      <PieceFormDialog
        open={showCreate || !!editPiece}
        onClose={() => { setShowCreate(false); setEditPiece(null); }}
        piece={editPiece}
        cfg={cfg}
        defaultChoreographer={teacherFullName}
        teacherId={teacher?.id}
        onSave={(data) => editPiece ? updateMutation.mutate({ id: editPiece.id, data }) : createMutation.mutate(data)}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <CastDialog
        open={!!manageCast}
        onClose={() => setManageCast(null)}
        piece={manageCast}
        dancers={dancers}
        pieceCasts={pieceCasts}
        qc={qc}
      />
    </div>
  );
}

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-secondary text-warm-gray',
    gold: 'bg-gold/12 text-gold',
    teal: 'bg-primary/12 text-primary',
  };
  return <span className={`font-caps text-[9.5px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${tones[tone]}`}>{children}</span>;
}

function PieceCard({ piece, index, castCount, onEdit, onCast, onDelete }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 w-8 h-8 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0">
            {piece.kind === 'solo' ? <User className="w-4 h-4 text-gold" /> : <Music className="w-4 h-4 text-gold" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-body font-semibold text-foreground text-sm">{piece.title}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {piece.level && <Badge tone="teal">{piece.level}</Badge>}
              {piece.genre && <Badge>{piece.genre}</Badge>}
              {piece.kind !== 'solo' && piece.size && <Badge>{piece.size}</Badge>}
              {piece.age_division && <Badge>{piece.age_division}</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{castCount} cast</span>
              {piece.music_url && <span className="flex items-center gap-1 text-teal-bright"><Music className="w-3 h-3" />Mix uploaded</span>}
              {piece.duration && <span>{piece.duration}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-terracotta"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <button onClick={onCast} className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80">
        <Users className="w-3.5 h-3.5" /> Manage cast
      </button>
    </motion.div>
  );
}

const EMPTY = { title: '', kind: 'group', choreographer: '', level: '', genre: '', size: '', age_division: '', duration: '', music_url: '' };

function PieceFormDialog({ open, onClose, piece, cfg, defaultChoreographer, teacherId, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [loadedId, setLoadedId] = useState(null);
  const [uploading, setUploading] = useState(false);

  if (open && piece && loadedId !== piece.id) {
    setForm({
      title: piece.title || '', kind: piece.kind || 'group', choreographer: piece.choreographer || '',
      level: piece.level || '', genre: piece.genre || '', size: piece.size || '',
      age_division: piece.age_division || '', duration: piece.duration || '', music_url: piece.music_url || '',
    });
    setLoadedId(piece.id);
  }
  if (open && !piece && loadedId !== '__new__') { setForm({ ...EMPTY, choreographer: defaultChoreographer || '' }); setLoadedId('__new__'); }

  const reset = () => { setForm(EMPTY); setLoadedId(null); };

  const uploadMusic = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `music/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('music').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('music').getPublicUrl(path);
      setForm(f => ({ ...f, music_url: data.publicUrl }));
      toast.success('Mix uploaded');
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!piece) payload.teacher_id = teacherId || null;
    if (!payload.choreographer) payload.choreographer = defaultChoreographer || '';
    if (payload.kind === 'solo') payload.size = ''; // size is meaningless for solos
    onSave(payload);
    reset();
  };

  const Field = ({ label, value, onChange, options, placeholder }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="bg-secondary border-border h-10 text-sm"><SelectValue placeholder={placeholder || 'Select…'} /></SelectTrigger>
        <SelectContent>{(options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-foreground">{piece ? 'Edit piece' : 'New piece'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Routine title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. “Fight Song”" className="bg-secondary border-border" /></div>

          {/* Solo / Group */}
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <div className="flex gap-1.5 mt-1 bg-secondary border border-border rounded-lg p-1">
              {[['group', 'Group'], ['solo', 'Solo']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 text-[12px] font-semibold py-1.5 rounded-md transition-colors ${form.kind === k ? 'bg-primary text-[#06110f]' : 'text-muted-foreground'}`}>{l}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Level" value={form.level} onChange={v => setForm({ ...form, level: v })} options={cfg?.levels} />
            <Field label="Genre" value={form.genre} onChange={v => setForm({ ...form, genre: v })} options={cfg?.genres} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {form.kind !== 'solo'
              ? <Field label="Size" value={form.size} onChange={v => setForm({ ...form, size: v })} options={cfg?.sizes} />
              : <div><Label className="text-xs text-muted-foreground">Size</Label><div className="h-10 flex items-center text-xs text-muted-2">— solo —</div></div>}
            <Field label="Age division" value={form.age_division} onChange={v => setForm({ ...form, age_division: v })} options={cfg?.age_divisions} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Choreographer</Label><Input value={form.choreographer} onChange={e => setForm({ ...form, choreographer: e.target.value })} className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Duration</Label><Input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="2:45" className="bg-secondary border-border" /></div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Music mix</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex items-center gap-2 bg-secondary border border-border rounded-md px-3 h-10 text-xs cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {form.music_url ? 'Replace audio' : 'Upload audio'}
                <input type="file" accept="audio/*" onChange={uploadMusic} className="hidden" />
              </label>
              {form.music_url && <span className="text-[11px] text-teal-bright">✓ uploaded</span>}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { onClose(); reset(); }} className="text-[12px]">Cancel</Button>
            <Button type="submit" disabled={saving || uploading} className="bg-primary text-[#06110f] font-bold text-[12px]">{piece ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CastDialog({ open, onClose, piece, dancers, pieceCasts, qc }) {
  const isSolo = piece?.kind === 'solo';
  const currentCast = pieceCasts.filter(pc => pc.piece_id === piece?.id).map(pc => pc.dancer_id);

  const toggleDancer = async (dancerId) => {
    const existing = pieceCasts.find(pc => pc.piece_id === piece.id && pc.dancer_id === dancerId);
    if (existing) {
      await base44.entities.PieceCast.delete(existing.id);
    } else {
      // For solos, replace any existing cast member so there's only one.
      if (isSolo) {
        for (const pc of pieceCasts.filter(pc => pc.piece_id === piece.id)) await base44.entities.PieceCast.delete(pc.id);
      }
      await base44.entities.PieceCast.create({ piece_id: piece.id, dancer_id: dancerId });
    }
    qc.invalidateQueries({ queryKey: ['pieceCasts'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-foreground">Cast — {piece?.title}</DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-2 -mt-1">{isSolo ? 'Pick the soloist (one dancer).' : 'Tap dancers to add or remove them from this routine.'}</p>
        <div className="space-y-1.5 mt-1">
          {dancers.map(d => {
            const inCast = currentCast.includes(d.id);
            return (
              <label key={d.id} className="flex items-center gap-2 cursor-pointer rounded-lg border border-border p-2.5">
                <Checkbox checked={inCast} onCheckedChange={() => toggleDancer(d.id)} />
                <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                {d.level && <span className="text-[10px] text-warm-gray ml-auto">{d.level}</span>}
              </label>
            );
          })}
          {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers in the roster yet.</p>}
        </div>
        <DialogFooter><Button type="button" onClick={onClose} className="bg-primary text-[#06110f] font-bold text-[12px]">Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
