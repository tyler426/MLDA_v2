import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';

// Studios / rooms used across the schedule, conflicts, and availability.
// Lives in Admin → Settings (moved out of the Roster).
export default function StudioRooms() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState('');
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });

  const create = useMutation({
    mutationFn: (name) => base44.entities.Studio.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['studios'] }); setAdding(''); toast.success('Room added'); },
    onError: (e) => toast.error(e.message),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }) => base44.entities.Studio.update(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studios'] }),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => base44.entities.Studio.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['studios'] }); toast.success('Room removed'); },
    onError: (e) => toast.error(e.message),
  });

  const sorted = [...studios].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <DoorOpen className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-body font-semibold text-sm text-foreground">Rooms / Studios</h3>
      </div>
      <p className="text-[11px] text-muted-2 mb-3">Used across the schedule, conflicts, and availability. Renaming keeps every class/booking linked.</p>

      <div className="space-y-1.5">
        {sorted.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-2 w-12 flex-none">Studio</span>
            <Input defaultValue={s.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== s.name) rename.mutate({ id: s.id, name: e.target.value.trim() }); }}
              className="bg-secondary border-border h-9 text-sm flex-1" />
            <button onClick={() => { if (confirm(`Remove Studio ${s.name}? Classes/bookings in this room will lose their room.`)) remove.mutate(s.id); }}
              className="p-1.5 text-muted-2 hover:text-terracotta"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-xs text-warm-gray italic py-2">No rooms yet — add your first studio below.</p>}
        <div className="flex items-center gap-2 pt-1">
          <Input value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && adding.trim()) create.mutate(adding.trim()); }}
            placeholder="Add a room (e.g. A, B, Main Studio)…" className="bg-secondary border-border h-9 text-sm flex-1" />
          <Button size="sm" disabled={!adding.trim() || create.isPending} onClick={() => create.mutate(adding.trim())} className="bg-primary text-[#06110f] h-9"><Plus className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}
