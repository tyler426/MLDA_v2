import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useStudioConfig } from '@/lib/useStudioConfig';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Music, Users, Pencil, Trash2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminPieces() {
  const [showCreate, setShowCreate] = useState(false);
  const [editPiece, setEditPiece] = useState(null);
  const [manageCast, setManageCast] = useState(null);
  const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'group' | 'solo'
  const queryClient = useQueryClient();

  const { data: cfg } = useStudioConfig();
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Piece.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pieces'] }); setShowCreate(false); toast.success('Piece created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Piece.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pieces'] }); setEditPiece(null); toast.success('Piece updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Delete associated casts first
      const casts = pieceCasts.filter(pc => pc.piece_id === id);
      for (const c of casts) await base44.entities.PieceCast.delete(c.id);
      await base44.entities.Piece.delete(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pieces'] }); queryClient.invalidateQueries({ queryKey: ['pieceCasts'] }); setEditPiece(null); toast.success('Piece deleted'); },
  });

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <h1 className="font-serif text-[28px] font-semibold -tracking-[0.01em]">Pieces</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
          <Plus className="w-4 h-4 mr-1" /> New Piece
        </Button>
      </div>

      {/* Group / Solo filter with counts */}
      {pieces.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {[
            ['all', 'All', pieces.length],
            ['group', 'Group dances', pieces.filter(p => p.kind !== 'solo').length],
            ['solo', 'Solos', pieces.filter(p => p.kind === 'solo').length],
          ].map(([k, label, n]) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-3 py-1.5 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] border transition-colors ${kindFilter === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}>
              {label} <span className="opacity-70">({n})</span>
            </button>
          ))}
        </div>
      )}

      {pieces.length === 0 ? (
        <EmptyState message="No pieces yet" sub="Create pieces and assign dancers to them" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pieces
            .filter(p => kindFilter === 'all' || (kindFilter === 'solo' ? p.kind === 'solo' : p.kind !== 'solo'))
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
            .map((p, i) => {
            const castCount = pieceCasts.filter(pc => pc.piece_id === p.id).length;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-body font-medium text-foreground flex items-center gap-2">
                      <Music className="w-4 h-4 text-gold" />
                      {p.title}
                    </h3>
                    {p.choreographer && <p className="text-xs text-muted-foreground mt-0.5">Choreo: {p.choreographer}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {p.kind === 'solo' && <span className="font-caps text-[11px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-gold/12 text-gold">Solo</span>}
                      {p.level && <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">{p.level}</span>}
                      {p.genre && <span className="text-[10px] text-muted-foreground">{p.genre}</span>}
                      {p.size && <span className="text-[10px] text-muted-foreground">{p.size}</span>}
                      {p.age_division && <span className="text-[10px] text-muted-foreground">{p.age_division}</span>}
                      {p.season && <span className="text-[10px] text-muted-foreground">{p.season}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditPiece(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(p.id)} className="p-1.5 text-muted-foreground hover:text-terracotta transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setManageCast(p)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  {castCount} dancer{castCount !== 1 ? 's' : ''} in cast
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <PieceFormDialog
        open={showCreate || !!editPiece}
        onClose={() => { setShowCreate(false); setEditPiece(null); }}
        piece={editPiece}
        cfg={cfg}
        onSave={(data) => editPiece ? updateMutation.mutate({ id: editPiece.id, data }) : createMutation.mutate(data)}
      />

      {/* Cast management */}
      <CastDialog
        open={!!manageCast}
        onClose={() => setManageCast(null)}
        piece={manageCast}
        dancers={dancers}
        pieceCasts={pieceCasts}
        queryClient={queryClient}
      />
    </div>
  );
}

const EMPTY_PIECE = { title: '', kind: 'group', choreographer: '', season: '', level: '', genre: '', size: '', age_division: '', duration: '', music_url: '' };
function PieceFormDialog({ open, onClose, piece, cfg, onSave }) {
  const [form, setForm] = useState(EMPTY_PIECE);
  const [loadedId, setLoadedId] = useState(null);
  const [uploading, setUploading] = useState(false);

  if (open && piece && loadedId !== piece.id) {
    setForm({ title: piece.title, kind: piece.kind || 'group', choreographer: piece.choreographer || '', season: piece.season || '', level: piece.level || '', genre: piece.genre || '', size: piece.size || '', age_division: piece.age_division || '', duration: piece.duration || '', music_url: piece.music_url || '' });
    setLoadedId(piece.id);
  }
  if (open && !piece && loadedId !== null) { setForm(EMPTY_PIECE); setLoadedId(null); }

  const ClassSelect = ({ label, value, onChange, options }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="bg-secondary border-border h-10 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>{(options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

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
      toast.success('Music uploaded');
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setForm(EMPTY_PIECE); setLoadedId(null); } }}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-foreground">{piece ? 'Edit piece' : 'New piece'}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); setForm(EMPTY_PIECE); setLoadedId(null); }} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="bg-secondary border-border" /></div>
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <div className="flex gap-1.5 mt-1 bg-secondary border border-border rounded-lg p-1">
              {[['group', 'Group'], ['solo', 'Solo']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 text-[12px] font-semibold py-1.5 rounded-md transition-colors ${form.kind === k ? 'bg-primary text-[#06110f]' : 'text-muted-foreground'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Choreographer</Label><Input value={form.choreographer} onChange={e => setForm({ ...form, choreographer: e.target.value })} className="bg-secondary border-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <ClassSelect label="Level" value={form.level} onChange={v => setForm({ ...form, level: v })} options={cfg?.levels} />
            <ClassSelect label="Genre" value={form.genre} onChange={v => setForm({ ...form, genre: v })} options={cfg?.genres} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ClassSelect label="Size" value={form.size} onChange={v => setForm({ ...form, size: v })} options={cfg?.sizes} />
            <ClassSelect label="Age division" value={form.age_division} onChange={v => setForm({ ...form, age_division: v })} options={cfg?.age_divisions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Season</Label><Input value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} placeholder="2025-26" className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Duration</Label><Input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 2:45" className="bg-secondary border-border" /></div>
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
          <DialogFooter><Button type="submit" className="bg-primary text-[#06110f] font-bold text-[12px]">{piece ? 'Save' : 'Create'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CastDialog({ open, onClose, piece, dancers, pieceCasts, queryClient }) {
  const { data: costumes = [] } = useQuery({ queryKey: ['costumes'], queryFn: () => base44.entities.Costume.list() });
  const currentCast = pieceCasts.filter(pc => pc.piece_id === piece?.id).map(pc => pc.dancer_id);

  const toggleDancer = async (dancerId) => {
    const existing = pieceCasts.find(pc => pc.piece_id === piece.id && pc.dancer_id === dancerId);
    if (existing) await base44.entities.PieceCast.delete(existing.id);
    else await base44.entities.PieceCast.create({ piece_id: piece.id, dancer_id: dancerId });
    queryClient.invalidateQueries({ queryKey: ['pieceCasts'] });
  };

  const costumeFor = (dancerId) => costumes.find(c => c.piece_id === piece?.id && c.dancer_id === dancerId);
  const upsertCostume = async (dancerId, patch) => {
    const existing = costumeFor(dancerId);
    if (existing) await base44.entities.Costume.update(existing.id, patch);
    else await base44.entities.Costume.create({ piece_id: piece.id, dancer_id: dancerId, name: `${piece.title} costume`, paid: false, fitted: false, balance_cents: 0, ...patch });
    queryClient.invalidateQueries({ queryKey: ['costumes'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md max-h-[78vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-foreground">Cast &amp; costumes — {piece?.title}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          {dancers.map(d => {
            const inCast = currentCast.includes(d.id);
            const cost = costumeFor(d.id);
            return (
              <div key={d.id} className="rounded-lg border border-border p-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={inCast} onCheckedChange={() => toggleDancer(d.id)} />
                  <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                  {d.level && <span className="text-[10px] text-warm-gray ml-auto">{d.level}</span>}
                </label>
                {inCast && (
                  <div className="flex items-center gap-3 mt-2 pl-6 flex-wrap">
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <Checkbox checked={!!cost?.paid} onCheckedChange={v => upsertCostume(d.id, { paid: !!v })} /> Paid
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <Checkbox checked={!!cost?.fitted} onCheckedChange={v => upsertCostume(d.id, { fitted: !!v })} /> Fitted
                    </label>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      Balance $
                      <Input
                        type="number" min="0"
                        defaultValue={cost ? (cost.balance_cents / 100) : ''}
                        onBlur={e => upsertCostume(d.id, { balance_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                        className="bg-secondary border-border h-7 w-16 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers in roster yet</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}