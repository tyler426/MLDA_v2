import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useStudioConfig } from '@/lib/useStudioConfig';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

// Studio-editable programs (groups) + levels. Used by the roster + Comms targeting.
export default function StudioLists() {
  const qc = useQueryClient();
  const { data: cfg } = useStudioConfig();

  const save = useMutation({
    mutationFn: async ({ field, list }) => {
      const { error } = await supabase.from('app_settings').update({ [field]: list }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['studioConfig'] }); toast.success('Saved'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-5">
      <div>
        <h3 className="font-body font-semibold text-sm text-foreground">Programs / Groups</h3>
        <p className="text-[11px] text-muted-2 mb-2">Used on dancer profiles and to target broadcasts. Rename or add as your groups change.</p>
        <ListEditor items={cfg?.programs || []} onSave={list => save.mutate({ field: 'programs', list })} addLabel="program" />
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="font-body font-semibold text-sm text-foreground">Levels</h3>
        <p className="text-[11px] text-muted-2 mb-2">Competitive levels, listed lowest to highest. Used on dancer profiles and pieces.</p>
        <ListEditor items={cfg?.levels || []} onSave={list => save.mutate({ field: 'levels', list })} addLabel="level" />
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-body font-semibold text-sm text-foreground">Competition classifications</h3>
        <p className="text-[11px] text-muted-2 mb-3">Tags applied to routines. Order matters where noted — smallest/youngest first.</p>

        <div className="space-y-4">
          <div>
            <h4 className="text-[12px] font-medium text-foreground mb-1">Genres</h4>
            <ListEditor items={cfg?.genres || []} onSave={list => save.mutate({ field: 'genres', list })} addLabel="genre" />
          </div>
          <div>
            <h4 className="text-[12px] font-medium text-foreground mb-1">Sizes <span className="text-[10px] text-muted-2 font-normal">— smallest to largest</span></h4>
            <ListEditor items={cfg?.sizes || []} onSave={list => save.mutate({ field: 'sizes', list })} addLabel="size" />
          </div>
          <div>
            <h4 className="text-[12px] font-medium text-foreground mb-1">Age divisions <span className="text-[10px] text-muted-2 font-normal">— youngest to oldest</span></h4>
            <ListEditor items={cfg?.age_divisions || []} onSave={list => save.mutate({ field: 'age_divisions', list })} addLabel="age division" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ListEditor({ items, onSave, addLabel }) {
  const [adding, setAdding] = useState('');
  const rename = (i, v) => { const next = [...items]; next[i] = v; onSave(next.filter(Boolean)); };
  const remove = (i) => onSave(items.filter((_, idx) => idx !== i));
  const add = () => { if (adding.trim()) { onSave([...items, adding.trim()]); setAdding(''); } };

  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input defaultValue={it} onBlur={e => { if (e.target.value !== it) rename(i, e.target.value); }} className="bg-secondary border-border h-9 text-sm flex-1" />
          <button onClick={() => remove(i)} className="p-1.5 text-muted-2 hover:text-terracotta"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Input value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={`Add a ${addLabel}…`} className="bg-secondary border-border h-9 text-sm flex-1" />
        <Button size="sm" onClick={add} disabled={!adding.trim()} className="bg-primary text-[#06110f] h-9"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
