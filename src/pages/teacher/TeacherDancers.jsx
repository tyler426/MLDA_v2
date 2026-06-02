import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Plus } from 'lucide-react';
import { format } from 'date-fns';

const TAGS = [['Progress', '#2c9089'], ['Conditioning', '#d97a5e'], ['Solo', '#c8a464'], ['Behavior', '#7c6fcf'], ['Absence', '#a89e90']];
const tagColor = t => (TAGS.find(([k]) => k === t) || [, '#a89e90'])[1];
function initials(n = '') { const p = n.trim().split(' '); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase(); }
function avColor(n = '') { const c = ['#2c9089', '#c8a464', '#d97a5e', '#7c6fcf', '#5a9bd4', '#cf6f9c']; let s = 0; for (const ch of n) s += ch.charCodeAt(0); return c[s % c.length]; }

export default function TeacherDancers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null); // dancer
  const [tag, setTag] = useState('Progress');
  const [body, setBody] = useState('');

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: teacherRows = [] } = useQuery({
    queryKey: ['teacherRecord', me?.email], enabled: !!me?.email,
    queryFn: () => base44.entities.Teacher.filter({ email: me.email }),
  });
  const teacher = teacherRows[0];
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: notes = [] } = useQuery({ queryKey: ['dancerNotes'], queryFn: () => base44.entities.DancerNote.list('-created_date', 500) });

  const filtered = dancers.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase()));
  const dancerNotes = open ? notes.filter(n => n.dancer_id === open.id) : [];

  const addNote = useMutation({
    mutationFn: async () => base44.entities.DancerNote.create({
      dancer_id: open.id, teacher_id: teacher?.id || null, author_profile_id: me?.id || null, tag, body: body.trim(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dancerNotes'] }); setBody(''); },
    onError: (e) => import('sonner').then(({ toast }) => toast.error(e.message)),
  });

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-teal-bright font-semibold">Roster</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">Dancers &amp; notes</h1>
      </div>

      <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 h-11 mt-4">
        <Search className="w-4 h-4 text-muted-2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dancers…" className="bg-transparent outline-none text-sm flex-1" />
      </div>

      <div className="mt-4 pb-2 flex flex-col gap-1.5">
        {filtered.map(d => {
          const count = notes.filter(n => n.dancer_id === d.id).length;
          return (
            <button key={d.id} onClick={() => setOpen(d)} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 text-left">
              <span className="w-10 h-10 rounded-full flex items-center justify-center font-serif text-[14px] font-semibold text-[#0a0908] overflow-hidden flex-none" style={{ background: avColor(d.first_name + d.last_name) }}>
                {d.photo_url ? <img src={d.photo_url} alt="" className="w-full h-full object-cover" /> : initials(`${d.first_name} ${d.last_name}`)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate">{d.first_name} {d.last_name}</div>
                <div className="text-[11px] text-muted-2">{[d.program, d.level].filter(Boolean).join(' · ') || 'Dancer'}</div>
              </div>
              {count > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{count} note{count !== 1 ? 's' : ''}</span>}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-2 italic text-center py-6">No dancers found.</p>}
      </div>

      {/* dancer note sheet */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setOpen(null)}>
          <div className="w-full max-w-[440px] bg-card border border-border border-b-0 rounded-t-[28px] p-5 pb-7 max-h-[88%] overflow-y-auto animate-[fade_.25s_ease]" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-[15px] font-semibold text-[#0a0908] overflow-hidden" style={{ background: avColor(open.first_name + open.last_name) }}>
                  {open.photo_url ? <img src={open.photo_url} alt="" className="w-full h-full object-cover" /> : initials(`${open.first_name} ${open.last_name}`)}
                </span>
                <div>
                  <div className="font-serif text-[20px] font-semibold">{open.first_name} {open.last_name}</div>
                  <div className="text-[11.5px] text-muted-2">{[open.program, open.level].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              <button onClick={() => setOpen(null)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            {/* add note */}
            <div className="mt-4 bg-secondary rounded-2xl p-3">
              <div className="flex gap-2 mb-2">
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger className="bg-card border-border h-9 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{TAGS.map(([k]) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={!body.trim() || addNote.isPending} onClick={() => addNote.mutate()} className="bg-primary text-[#06110f] font-bold text-[11px] h-9 ml-auto"><Plus className="w-3.5 h-3.5 mr-1" />Note</Button>
              </div>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} placeholder={`Add a note about ${open.first_name}…`} className="w-full bg-card border border-border rounded-xl p-2.5 text-sm outline-none resize-none" />
            </div>

            {/* history */}
            <div className="mt-4 space-y-2.5">
              {dancerNotes.length === 0 && <p className="text-[12.5px] text-muted-2 italic">No notes yet.</p>}
              {dancerNotes.map(n => (
                <div key={n.id} className="bg-card border-l-2 rounded-xl p-3" style={{ borderLeftColor: tagColor(n.tag) }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9.5px] tracking-[0.12em] uppercase font-semibold" style={{ color: tagColor(n.tag) }}>{n.tag}</span>
                    <span className="text-[10.5px] text-muted-2">{n.created_date ? format(new Date(n.created_date), 'MMM d') : ''}</span>
                  </div>
                  <p className="text-[13px] text-foreground leading-relaxed">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
