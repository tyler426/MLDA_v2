import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Music, Users, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminPieces() {
  const [showCreate, setShowCreate] = useState(false);
  const [editPiece, setEditPiece] = useState(null);
  const [manageCast, setManageCast] = useState(null);
  const queryClient = useQueryClient();

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

      {pieces.length === 0 ? (
        <EmptyState message="No pieces yet" sub="Create pieces and assign dancers to them" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pieces.map((p, i) => {
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
                    <div className="flex items-center gap-3 mt-2">
                      {p.level && <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">{p.level}</span>}
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

function PieceFormDialog({ open, onClose, piece, onSave }) {
  const [form, setForm] = useState({ title: '', choreographer: '', season: '', level: '' });

  if (open && piece && form.title !== piece.title) {
    setForm({ title: piece.title, choreographer: piece.choreographer || '', season: piece.season || '', level: piece.level || '' });
  }
  if (open && !piece && form.title) {
    // Reset handled below
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setForm({ title: '', choreographer: '', season: '', level: '' }); } }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle className="font-body text-foreground">{piece ? 'Edit Piece' : 'New Piece'}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); setForm({ title: '', choreographer: '', season: '', level: '' }); }} className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="bg-secondary border-border" /></div>
          <div><Label className="text-xs text-muted-foreground">Choreographer</Label><Input value={form.choreographer} onChange={e => setForm({ ...form, choreographer: e.target.value })} className="bg-secondary border-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Season</Label><Input value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} placeholder="e.g. Showcase 2026" className="bg-secondary border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Level</Label><Input value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="bg-secondary border-border" /></div>
          </div>
          <DialogFooter><Button type="submit" className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">{piece ? 'Save' : 'Create'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CastDialog({ open, onClose, piece, dancers, pieceCasts, queryClient }) {
  const currentCast = pieceCasts.filter(pc => pc.piece_id === piece?.id).map(pc => pc.dancer_id);

  const toggleDancer = async (dancerId) => {
    const existing = pieceCasts.find(pc => pc.piece_id === piece.id && pc.dancer_id === dancerId);
    if (existing) {
      await base44.entities.PieceCast.delete(existing.id);
    } else {
      await base44.entities.PieceCast.create({ piece_id: piece.id, dancer_id: dancerId });
    }
    queryClient.invalidateQueries({ queryKey: ['pieceCasts'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-body text-foreground">Cast — {piece?.title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {dancers.map(d => (
            <label key={d.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-secondary/50 transition-colors">
              <Checkbox checked={currentCast.includes(d.id)} onCheckedChange={() => toggleDancer(d.id)} />
              <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
              {d.level && <span className="text-[10px] text-warm-gray ml-auto">{d.level}</span>}
            </label>
          ))}
          {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers in roster yet</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}