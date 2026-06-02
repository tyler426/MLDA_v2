import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SectionLabel from '@/components/shared/SectionLabel';
import { AlertTriangle, Lock, CheckCircle2, Plus, Clock, MapPin } from 'lucide-react';
import { formatTime, DAY_NAMES, DAY_NAMES_SHORT } from '@/lib/scheduleUtils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Convert HH:MM to total minutes
function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(a, b) {
  return toMinutes(a.start_time) < toMinutes(b.end_time) &&
         toMinutes(a.end_time) > toMinutes(b.start_time);
}

export default function AdminConflicts() {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [showBooking, setShowBooking] = useState(null); // { studio_id, start_time, end_time }
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });

  const dayClasses = classes.filter(c => c.day_of_week === selectedDay);

  // --- CONFLICT DETECTION ---
  // Teacher conflicts: same teacher, same time slot
  const teacherConflicts = [];
  const teachersWithClasses = teachers.filter(t => dayClasses.some(c => c.teacher_id === t.id));
  for (const teacher of teachersWithClasses) {
    const tClasses = dayClasses.filter(c => c.teacher_id === teacher.id);
    for (let i = 0; i < tClasses.length; i++) {
      for (let j = i + 1; j < tClasses.length; j++) {
        if (overlaps(tClasses[i], tClasses[j])) {
          teacherConflicts.push({
            type: 'teacher',
            label: `${teacher.first_name} ${teacher.last_name}`,
            classA: tClasses[i],
            classB: tClasses[j],
          });
        }
      }
    }
  }

  // Room conflicts: same studio, same time
  const roomConflicts = [];
  for (const studio of studios) {
    const sClasses = dayClasses.filter(c => c.studio_id === studio.id);
    for (let i = 0; i < sClasses.length; i++) {
      for (let j = i + 1; j < sClasses.length; j++) {
        if (overlaps(sClasses[i], sClasses[j])) {
          roomConflicts.push({
            type: 'room',
            label: `Studio ${studio.name}`,
            classA: sClasses[i],
            classB: sClasses[j],
          });
        }
      }
    }
  }

  const allConflicts = [...teacherConflicts, ...roomConflicts];

  // --- OPEN SLOTS DETECTION ---
  // Time range 3:30pm – 10pm in 30 min increments
  const TIME_RANGE = [];
  for (let m = 930; m < 1320; m += 30) { // 930 = 15:30, 1320 = 22:00
    const h = Math.floor(m / 60);
    const min = m % 60;
    TIME_RANGE.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }

  const openSlots = [];
  for (const studio of studios) {
    for (let i = 0; i < TIME_RANGE.length - 1; i++) {
      const slotStart = TIME_RANGE[i];
      const slotEnd = TIME_RANGE[i + 1];
      const isBusy = dayClasses.some(c =>
        c.studio_id === studio.id &&
        toMinutes(c.start_time) <= toMinutes(slotStart) &&
        toMinutes(c.end_time) >= toMinutes(slotEnd)
      );
      if (!isBusy) {
        // Merge consecutive open slots
        const last = openSlots[openSlots.length - 1];
        if (last && last.studio_id === studio.id && last.end_time === slotStart) {
          last.end_time = slotEnd;
        } else {
          openSlots.push({ studio_id: studio.id, studio_name: studio.name, start_time: slotStart, end_time: slotEnd });
        }
      }
    }
  }

  // Filter slots at least 30 min
  const usableSlots = openSlots.filter(s =>
    toMinutes(s.end_time) - toMinutes(s.start_time) >= 30
  );

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <SectionLabel className="pt-4 mb-4">Conflicts & Open Rooms</SectionLabel>

      {/* Day picker */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {DAY_NAMES_SHORT.map((name, i) => (
          <button key={i} onClick={() => setSelectedDay(i)}
            className={`px-3 py-2 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors ${selectedDay === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >{name}</button>
        ))}
      </div>

      <Tabs defaultValue="conflicts">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="conflicts" className="font-caps text-[10px] uppercase tracking-[0.1em]">
            Conflicts {allConflicts.length > 0 && <span className="ml-1.5 bg-terracotta text-white text-[9px] rounded-full px-1.5">{allConflicts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="open" className="font-caps text-[10px] uppercase tracking-[0.1em]">
            Open Rooms {usableSlots.length > 0 && <span className="ml-1.5 bg-primary text-primary-foreground text-[9px] rounded-full px-1.5">{usableSlots.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts">
          {allConflicts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="font-serif italic text-muted-foreground">No conflicts on {DAY_NAMES[selectedDay]}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allConflicts.map((conflict, i) => {
                const tA = teachers.find(t => t.id === conflict.classA.teacher_id);
                const tB = teachers.find(t => t.id === conflict.classB.teacher_id);
                const sA = studios.find(s => s.id === conflict.classA.studio_id);
                const sB = studios.find(s => s.id === conflict.classB.studio_id);
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-card border border-terracotta/40 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-terracotta shrink-0" />
                      <span className="font-caps text-[10px] uppercase tracking-[0.15em] text-terracotta">
                        {conflict.type === 'teacher' ? 'Teacher Double-Booked' : 'Room Double-Booked'} — {conflict.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[conflict.classA, conflict.classB].map((cls, ci) => {
                        const t = teachers.find(t => t.id === cls.teacher_id);
                        const s = studios.find(s => s.id === cls.studio_id);
                        return (
                          <div key={ci} className="bg-secondary/50 rounded-md p-2.5">
                            <p className="text-xs font-medium text-foreground">{cls.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(cls.start_time)} – {formatTime(cls.end_time)}</p>
                            {s && <p className="text-[10px] text-warm-gray">Studio {s.name}</p>}
                            {t && <p className="text-[10px] text-warm-gray">{t.first_name} {t.last_name}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="open">
          <p className="text-xs text-muted-foreground mb-4">Click any slot to book a private lesson.</p>
          {usableSlots.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-serif italic text-muted-foreground">All studios are fully booked on {DAY_NAMES[selectedDay]}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {usableSlots.map((slot, i) => (
                <motion.button key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  onClick={() => setShowBooking(slot)}
                  className="bg-card border border-primary/20 hover:border-primary rounded-lg p-3 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span className="font-caps text-[10px] uppercase tracking-[0.15em] text-primary">Studio {slot.studio_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    <span className="ml-auto text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Book →</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Private lesson booking dialog */}
      <PrivateLessonDialog
        open={!!showBooking}
        slot={showBooking}
        day={selectedDay}
        teachers={teachers}
        studios={studios}
        onClose={() => setShowBooking(null)}
        queryClient={queryClient}
      />
    </div>
  );
}

function PrivateLessonDialog({ open, slot, day, teachers, studios, onClose, queryClient }) {
  const [form, setForm] = useState({ teacher_id: '', title: '', level: '' });

  const studio = studios.find(s => s.id === slot?.studio_id);

  const bookMutation = useMutation({
    mutationFn: () => base44.entities.DanceClass.create({
      title: form.title || 'Private Lesson',
      day_of_week: day,
      start_time: slot?.start_time,
      end_time: slot?.end_time,
      studio_id: slot?.studio_id,
      teacher_id: form.teacher_id,
      level: form.level,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allClasses'] });
      toast.success('Private lesson booked');
      onClose();
      setForm({ teacher_id: '', title: '', level: '' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-body text-foreground">Book Private Lesson</DialogTitle>
        </DialogHeader>
        <div className="bg-secondary/50 rounded-md p-3 mb-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Studio {studio?.name} • {DAY_NAMES[day]}</p>
          <p>{formatTime(slot?.start_time)} – {formatTime(slot?.end_time)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Lesson Title</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Private Ballet" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teacher</Label>
            <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Level / Notes</Label>
            <Input value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="e.g. Prostar, private" className="bg-secondary border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending}
            className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
            {bookMutation.isPending ? 'Booking...' : 'Book Slot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}