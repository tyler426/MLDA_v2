import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Clock, MapPin, Music, Users, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { formatTime } from '@/lib/scheduleUtils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

function addHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + hours * 60;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export default function TeacherBookSpace() {
  const [userEmail, setUserEmail] = useState(null);
  const [form, setForm] = useState({
    type: 'rehearsal',
    date: '',
    start_time: '15:00',
    duration_hours: 1,
    studio_id: '',
    piece_ids: [],
    dancer_ids: [],
    notes: '',
  });
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['dancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: bookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 30) });

  const toggleItem = (field, id) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter(x => x !== id) : [...prev[field], id],
    }));
  };

  const createMutation = useMutation({
    mutationFn: () => base44.entities.SpaceBooking.create({
      ...form,
      teacher_id: teacher?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaceBookings'] });
      toast.success(`${form.type === 'rehearsal' ? 'Rehearsal' : 'Private'} booked`);
      setForm({ type: 'rehearsal', date: '', start_time: '15:00', duration_hours: 1, studio_id: '', piece_ids: [], dancer_ids: [], notes: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpaceBooking.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spaceBookings'] }); toast.success('Booking removed'); },
  });

  const endTime = addHours(form.start_time, form.duration_hours);

  // Segment breakdown
  const segments = [];
  for (let i = 0; i < form.duration_hours; i += 1) {
    const segStart = addHours(form.start_time, i);
    const segEnd = addHours(form.start_time, Math.min(i + 1, form.duration_hours));
    segments.push(`${formatTime(segStart)} – ${formatTime(segEnd)}`);
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto space-y-6">
      <SectionLabel className="pt-4">Book a Space</SectionLabel>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          {['rehearsal', 'private'].map(t => (
            <button
              key={t}
              onClick={() => setForm({ ...form, type: t })}
              className={`flex-1 py-2 rounded-md font-caps text-[11px] uppercase tracking-[0.12em] transition-colors border ${
                form.type === t
                  ? t === 'rehearsal' ? 'bg-primary text-primary-foreground border-primary' : 'bg-gold/20 text-gold border-gold/40'
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {t === 'rehearsal' ? 'Rehearsal' : 'Private Lesson'}
            </button>
          ))}
        </div>

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
            <Label className="text-xs text-muted-foreground">Start Time</Label>
            <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Duration</Label>
            <Select value={String(form.duration_hours)} onValueChange={v => setForm({ ...form, duration_hours: Number(v) })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(d => (
                  <SelectItem key={d} value={String(d)}>{d} hr{d !== 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Time breakdown */}
        {form.duration_hours > 0 && (
          <div className="bg-secondary/50 rounded-md p-2">
            <p className="font-caps text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Time segments</p>
            <div className="flex flex-wrap gap-1.5">
              {segments.map((seg, i) => (
                <span key={i} className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded border border-border">
                  {seg}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-primary font-caps tracking-[0.08em]">
              Total: {formatTime(form.start_time)} – {formatTime(endTime)}
            </p>
          </div>
        )}

        {/* Pieces (rehearsal only) */}
        {form.type === 'rehearsal' && (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <Music className="w-3 h-3" /> Pieces Being Called
            </Label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {pieces.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.piece_ids.includes(p.id)} onCheckedChange={() => toggleItem('piece_ids', p.id)} />
                  <span className="text-sm text-foreground">{p.title}</span>
                  {p.level && <span className="text-[10px] text-warm-gray">({p.level})</span>}
                </label>
              ))}
              {pieces.length === 0 && <p className="text-xs text-muted-foreground italic">No pieces yet</p>}
            </div>
          </div>
        )}

        {/* Dancers called */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <Users className="w-3 h-3" /> {form.type === 'rehearsal' ? 'Dancers Called' : 'Dancer(s) for Private'}
          </Label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {dancers.map(d => (
              <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.dancer_ids.includes(d.id)} onCheckedChange={() => toggleItem('dancer_ids', d.id)} />
                <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                {d.level && <span className="text-[10px] text-warm-gray">{d.level}</span>}
              </label>
            ))}
            {dancers.length === 0 && <p className="text-xs text-muted-foreground italic">No dancers yet</p>}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" rows={2} placeholder="Optional notes..." />
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !form.date || !form.studio_id}
          className="w-full bg-primary hover:bg-primary/90 font-caps text-[11px] uppercase tracking-[0.12em]"
        >
          {createMutation.isPending ? 'Booking...' : `Book ${form.type === 'rehearsal' ? 'Rehearsal' : 'Private'}`}
        </Button>
      </div>

      {/* Upcoming bookings */}
      {bookings.filter(b => b.teacher_id === teacher?.id).length > 0 && (
        <div>
          <SectionLabel className="mb-3">My Upcoming Bookings</SectionLabel>
          <div className="space-y-2">
            {bookings
              .filter(b => b.teacher_id === teacher?.id)
              .map((b, i) => {
                const studio = studios.find(s => s.id === b.studio_id);
                const bEnd = addHours(b.start_time, b.duration_hours);
                const bPieces = (b.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);
                const bDancers = (b.dancer_ids || []).map(did => dancers.find(d => d.id === did)).filter(Boolean);
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`bg-card border rounded-lg p-3 ${b.type === 'private' ? 'border-gold/30' : 'border-primary/30'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-caps text-[10px] uppercase tracking-[0.12em] ${b.type === 'private' ? 'text-gold' : 'text-primary'}`}>
                            {b.type === 'private' ? 'Private' : 'Rehearsal'}
                          </span>
                          <span className="text-xs text-muted-foreground">{format(new Date(b.date), 'MMM d')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)} – {formatTime(bEnd)}</span>
                          {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                        </div>
                        {bPieces.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {bPieces.map(p => (
                              <span key={p.id} className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-caps uppercase tracking-[0.08em]">
                                <Music className="w-2.5 h-2.5 inline mr-0.5" />{p.title}
                              </span>
                            ))}
                          </div>
                        )}
                        {bDancers.length > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <Users className="w-3 h-3 inline mr-1" />
                            {bDancers.map(d => d.first_name).join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(b.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}