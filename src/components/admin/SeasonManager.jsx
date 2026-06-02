import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Archive, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

async function call(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('season', { body: { action, ...body } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SeasonManager() {
  const qc = useQueryClient();
  const { data: archives = [], isLoading } = useQuery({
    queryKey: ['seasonArchives'],
    queryFn: async () => (await call('list')).archives,
  });

  const archive = useMutation({
    mutationFn: (clear) => {
      const name = window.prompt(clear ? 'Name this archived season (the current schedule will then be cleared):' : 'Name this season snapshot:');
      if (name === null) throw new Error('cancelled');
      return call('archive', { name: name || undefined, clear });
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['seasonArchives'] }); if (d.cleared) qc.invalidateQueries(); toast.success(d.cleared ? 'Season archived & cleared' : 'Season snapshot saved'); },
    onError: (e) => { if (e.message !== 'cancelled') toast.error(e.message); },
  });

  const restore = useMutation({
    mutationFn: (id) => call('restore', { id }),
    onSuccess: () => { qc.invalidateQueries(); toast.success('Season reloaded'); },
    onError: (e) => toast.error(e.message),
  });

  const classCount = (a) => a.table_counts?.dance_classes ?? 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Archive className="w-4 h-4 text-gold" />
        <h3 className="font-body font-semibold text-sm text-foreground">Seasons</h3>
      </div>
      <p className="text-[11px] text-muted-2 mb-3">Snapshot the whole season (classes, rehearsals, pieces, competitions, enrollments) and reload any of them later. Dancers, families, teachers and rooms are never touched.</p>

      <div className="flex gap-2 mb-3">
        <Button size="sm" onClick={() => archive.mutate(false)} disabled={archive.isPending} className="bg-secondary border border-border text-foreground text-xs h-9"><Save className="w-3.5 h-3.5 mr-1" />Save snapshot</Button>
        <Button size="sm" onClick={() => { if (confirm('Archive the current season AND clear the schedule to start fresh?')) archive.mutate(true); }} disabled={archive.isPending} className="bg-gold/20 text-gold border border-gold/30 text-xs h-9"><Archive className="w-3.5 h-3.5 mr-1" />Archive &amp; start new</Button>
      </div>

      {isLoading ? <p className="text-xs text-muted-2">Loading…</p> : archives.length === 0 ? (
        <p className="text-xs text-muted-2 italic">No archived seasons yet.</p>
      ) : (
        <div className="space-y-1.5">
          {archives.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{a.name}</p>
                <p className="text-[10.5px] text-muted-2">{a.created_at ? format(new Date(a.created_at), 'MMM d, yyyy') : ''} · {classCount(a)} classes</p>
              </div>
              <button onClick={() => { if (confirm(`Reload "${a.name}"? This restores its classes/schedule.`)) restore.mutate(a.id); }}
                disabled={restore.isPending} className="flex items-center gap-1 text-[12px] text-teal-bright font-semibold">
                <RotateCcw className="w-3.5 h-3.5" /> Reload
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
