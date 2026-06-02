import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Music, User, Clock } from 'lucide-react';
import StudioAvailability from '@/components/shared/StudioAvailability';
import { formatTime } from '@/lib/scheduleUtils';

function timeAddHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getSlotTime(startTime, hourIndex) {
  return timeAddHours(startTime, hourIndex);
}

export default function BookSpaceDialog({ open, onClose, studios, pieces, dancers, teacher }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('rehearsal');
  const [form, setForm] = useState({
    date: '',
    start_time: '16:00',
    duration_hours: 1,
    studio_id: '',
    notes: '',
    dancer_ids: [],
    piece_ids: [],
    hour_slots: [],
  });
  const [saving, setSaving] = useState(false);

  const numHours = Math.ceil(form.duration_hours);
  const endTime = form.start_time && form.duration_hours
    ? timeAddHours(form.start_time, form.duration_hours)
    : '';

  const toggleId = (field, id) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter(x => x !== id) : [...prev[field], id],
    }));
  };

  const setSlotDancer = (hourIndex, dancerId) => {
    setForm(prev => {
      const slots = [...(prev.hour_slots || [])];
      const existing = slots.findIndex(s => s.hour_index === hourIndex);
      if (dancerId === 'none') {
        if (existing >= 0) slots.splice(existing, 1);
      } else {
        const entry = { hour_index: hourIndex, dancer_id: dancerId };
        if (existing >= 0) slots[existing] = entry; else slots.push(entry);
      }
      // Sync dancer_ids to all assigned dancers across slots
      const allDancerIds = [...new Set(slots.map(s => s.dancer_id).filter(Boolean))];
      return { ...prev, hour_slots: slots, dancer_ids: allDancerIds };
    });
  };

  const getSlotDancer = (hourIndex) => {
    const slot = (form.hour_slots || []).find(s => s.hour_index === hourIndex);
    return slot?.dancer_id || 'none';
  };

  const handleSave = async () => {
    if (!form.date || !form.studio_id || !form.start_time) {
      toast.error('Date, studio, and start time are required');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.SpaceBooking.create({
        type,
        date: form.date,
        start_time: form.start_time,
        end_time: endTime,
        studio_id: form.studio_id,
        teacher_id: teacher?.id || null,
        dancer_ids: form.dancer_ids,
        piece_ids: type === 'rehearsal' ? form.piece_ids : [],
        hour_slots: type === 'private' ? form.hour_slots : [],
        notes: form.notes,
        duration_hours: form.duration_hours,
      });
      queryClient.invalidateQueries({ queryKey: ['spaceBookings'] });
      toast.success(`${type === 'private' ? 'Private lesson' : 'Rehearsal'} booked`);
      setForm({ date: '', start_time: '16:00', duration_hours: 1, studio_id: '', notes: '', dancer_ids: [], piece_ids: [], hour_slots: [] });
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onInteractOutside={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-body text-foreground">Book a Space</DialogTitle>
        </DialogHeader>

        <Tabs value={type} onValueChange={setType}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="rehearsal" className="flex-1 font-caps text-[10px] uppercase tracking-[0.1em]">Rehearsal</TabsTrigger>
            <TabsTrigger value="private" className="flex-1 font-caps text-[10px] uppercase tracking-[0.1em]">Private Lesson</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* Date + Studio */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-secondary border-border h-10 text-sm w-full" />
                </div>
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Studio</Label>
                  <Select value={form.studio_id} onValueChange={v => setForm({ ...form, studio_id: v })}>
                    <SelectTrigger className="bg-secondary border-border h-10 text-sm w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{studios.map(s => <SelectItem key={s.id} value={s.id}>Studio {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Start time + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Start time</Label>
                  <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border h-10 text-sm w-full" />
                </div>
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Duration</Label>
                  <Select value={String(form.duration_hours)} onValueChange={v => setForm({ ...form, duration_hours: Number(v), hour_slots: [] })}>
                    <SelectTrigger className="bg-secondary border-border h-10 text-sm w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(h => (
                        <SelectItem key={h} value={String(h)}>{h === 0.5 ? '30 min' : `${h} hr${h !== 1 ? 's' : ''}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {endTime && (
                <div className="bg-secondary/40 rounded-md px-3 py-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(form.start_time)} – {formatTime(endTime)}
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" rows={2} placeholder="Optional notes..." />
              </div>

              {/* Rehearsal: pieces + dancers */}
              <TabsContent value="rehearsal" className="m-0 p-0 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                    <Music className="w-3 h-3" /> Pieces
                  </Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {pieces.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={form.piece_ids.includes(p.id)} onCheckedChange={() => toggleId('piece_ids', p.id)} />
                        <span className="text-sm text-foreground">{p.title}</span>
                        {p.level && <span className="text-[10px] text-warm-gray">({p.level})</span>}
                      </label>
                    ))}
                    {pieces.length === 0 && <p className="text-xs text-muted-foreground italic">No pieces yet</p>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                    <User className="w-3 h-3" /> Dancers Called
                  </Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {dancers.map(d => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={form.dancer_ids.includes(d.id)} onCheckedChange={() => toggleId('dancer_ids', d.id)} />
                        <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
                        {d.level && <span className="text-[10px] text-warm-gray">({d.level})</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Private: per-hour slot assignment */}
              <TabsContent value="private" className="m-0 p-0">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                    <User className="w-3 h-3" /> Assign Students by Hour
                  </Label>
                  {form.start_time && numHours > 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: numHours }, (_, i) => {
                        const slotStart = getSlotTime(form.start_time, i);
                        const slotEnd = getSlotTime(form.start_time, i + 1);
                        return (
                          <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-md p-2.5">
                            <div className="flex-shrink-0 w-20">
                              <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-primary">Hr {i + 1}</p>
                              <p className="text-[10px] text-muted-foreground">{formatTime(slotStart)}–{formatTime(slotEnd)}</p>
                            </div>
                            <Select value={getSlotDancer(i)} onValueChange={v => setSlotDancer(i, v)}>
                              <SelectTrigger className="bg-secondary border-border h-8 text-xs flex-1"><SelectValue placeholder="Open / no student" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Open / no student</SelectItem>
                                {dancers.map(d => (
                                  <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.level ? ` (${d.level})` : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Set a start time and duration above</p>
                  )}
                </div>
              </TabsContent>
            </div>

            {/* RIGHT COLUMN — availability */}
            <div>
              {form.date && form.start_time && endTime ? (
                <StudioAvailability
                  date={form.date}
                  startTime={form.start_time}
                  endTime={endTime}
                  selectedStudioId={form.studio_id}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-xs text-muted-foreground italic">Select a date and time to see studio availability</p>
                </div>
              )}
            </div>
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="font-caps text-[10px] uppercase tracking-[0.12em]">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
            {saving ? 'Booking...' : 'Book Space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}