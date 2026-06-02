import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import SectionLabel from '@/components/shared/SectionLabel';
import { Plus, Trash2, X } from 'lucide-react';
import { formatTime, DAY_NAMES, DAY_NAMES_SHORT } from '@/lib/scheduleUtils';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import StudioAvailability from '@/components/shared/StudioAvailability';

const VARIANT_COLORS = {
  Black: 'bg-zinc-700 text-zinc-200',
  Teal: 'bg-teal/20 text-teal border border-teal/30',
};

// Spotlight style-color coding (derived from the class title since classes have no style field)
const STYLE_PALETTE = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function styleColor(str = '') { let s = 0; for (const c of str) s += c.charCodeAt(0); return STYLE_PALETTE[s % STYLE_PALETTE.length]; }

// Which classes to show given a selected week variant filter
function matchesVariantFilter(c, filter) {
  if (filter === 'All') return true;
  if (filter === 'Black') return !c.week_variant || c.week_variant === 'Black';
  if (filter === 'Teal') return !c.week_variant || c.week_variant === 'Teal';
  return true;
}

const TIME_SLOTS = [];
for (let h = 9; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export default function AdminSchedule() {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [weekFilter, setWeekFilter] = useState('All');
  const [editClass, setEditClass] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 60) });

  // Get the actual calendar date for the selected day-of-week (this week)
  const todayDate = new Date();
  const weekStartDate = new Date(todayDate);
  weekStartDate.setDate(todayDate.getDate() - todayDate.getDay());
  const selectedDate = new Date(weekStartDate);
  selectedDate.setDate(weekStartDate.getDate() + selectedDay);
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);

  // Bookings on this specific date
  const dayBookings = spaceBookings.filter(b => b.date === selectedDateStr);

  const dayClasses = classes.filter(c => c.day_of_week === selectedDay && matchesVariantFilter(c, weekFilter));

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.DanceClass.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allClasses'] }); setShowCreate(false); toast.success('Class created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DanceClass.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allClasses'] }); setEditClass(null); toast.success('Class updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DanceClass.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allClasses'] }); setEditClass(null); toast.success('Class deleted'); },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id) => base44.entities.SpaceBooking.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spaceBookings'] }); toast.success('Booking cancelled'); },
  });

  return (
    <div className="max-w-6xl">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="text-[10px] tracking-[0.24em] uppercase text-teal-bright font-semibold">Schedule</div>
          <h1 className="font-serif text-[30px] font-semibold mt-1.5 -tracking-[0.01em]">Master schedule</h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-primary text-[#06110f] hover:bg-primary/90 font-bold text-[13px] rounded-[10px] px-4 py-2.5">
          <Plus className="w-4 h-4 mr-1.5" /> New class
        </Button>
      </div>

      {/* Day picker */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {DAY_NAMES_SHORT.map((name, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`px-3 py-2 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors ${
              selectedDay === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Week variant toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-caps text-[9px] uppercase tracking-[0.15em] text-muted-foreground mr-1">Week</span>
        {['All', 'Black', 'Teal'].map(v => (
          <button
            key={v}
            onClick={() => setWeekFilter(v)}
            className={`px-3 py-1 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] transition-colors border ${
              weekFilter === v
                ? v === 'Black' ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                  : v === 'Teal' ? 'bg-teal/20 text-teal border-teal/40'
                  : 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {v === 'All' ? 'All Weeks' : `${v} Week`}
          </button>
        ))}
        {weekFilter !== 'All' && (
          <span className="text-[10px] text-muted-foreground italic ml-1">
            Showing {weekFilter}-week classes + every-week classes
          </span>
        )}
      </div>

      {/* Schedule grid by studio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {studios.map(studio => {
          const studioClasses = dayClasses
            .filter(c => c.studio_id === studio.id)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const studioBookings = dayBookings
            .filter(b => b.studio_id === studio.id)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          return (
            <div key={studio.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border text-center">
                <h3 className="text-[12px] font-semibold text-muted-foreground">Studio {studio.name}</h3>
              </div>
              <div className="p-2 space-y-1.5 min-h-[200px]">
                {studioClasses.length === 0 && studioBookings.length === 0 ? (
                  <p className="text-xs text-muted-2 text-center py-8 italic">No classes</p>
                ) : (
                  <>
                    {studioClasses.map(c => {
                      const teacher = teachers.find(t => t.id === c.teacher_id);
                      const col = styleColor(c.title);
                      return (
                        <button
                          key={c.id}
                          onClick={() => setEditClass(c)}
                          className="w-full text-left rounded-[10px] p-2.5 transition-all border-l-[3px] hover:brightness-125"
                          style={{ background: col + '22', borderLeftColor: col }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-[11.5px] font-bold text-foreground leading-tight truncate flex-1">{c.title}</p>
                            {c.week_variant && (
                              <span className={`flex-shrink-0 text-[8px] font-caps uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${VARIANT_COLORS[c.week_variant]}`}>
                                {c.week_variant}
                              </span>
                            )}
                          </div>
                          <p className="font-serif text-[12px] text-muted-foreground mt-1">
                            {formatTime(c.start_time)} – {formatTime(c.end_time)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {teacher && <span className="text-[10px] text-muted-2">{teacher.initials || `${teacher.first_name?.[0]}${teacher.last_name?.[0]}`}</span>}
                            {c.level && <span className="text-[10px] text-gold/80">{c.level}</span>}
                          </div>
                        </button>
                      );
                    })}
                    {studioBookings.map(b => {
                      const teacher = teachers.find(t => t.id === b.teacher_id);
                      return (
                        <div
                          key={b.id}
                          className={`rounded-md p-2.5 border ${b.type === 'private' ? 'bg-gold/5 border-gold/25' : 'bg-primary/5 border-primary/25'}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className={`text-[9px] font-caps uppercase tracking-[0.1em] ${b.type === 'private' ? 'text-gold' : 'text-primary'}`}>
                              {b.type === 'private' ? 'Private' : 'Rehearsal'}
                            </span>
                            <button
                              onClick={() => deleteBookingMutation.mutate(b.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Cancel booking"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formatTime(b.start_time)} – {formatTime(b.end_time)}
                          </p>
                          {teacher && (
                            <p className="text-[10px] text-warm-gray mt-0.5">{teacher.initials || `${teacher.first_name?.[0]}${teacher.last_name?.[0]}`}</p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit dialog */}
      <ClassFormDialog
        open={showCreate || !!editClass}
        onClose={() => { setShowCreate(false); setEditClass(null); }}
        classData={editClass}
        studios={studios}
        teachers={teachers}
        selectedDay={selectedDay}
        onSave={(data) => {
          if (editClass) {
            updateMutation.mutate({ id: editClass.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        onDelete={editClass ? () => deleteMutation.mutate(editClass.id) : null}
      />
    </div>
  );
}

const LEVELS = ['Starburst', 'Superstar', 'Prostar', 'Premier', 'Junior', 'Intern', 'Teen', 'Senior', 'Pre-Pro'];
const AGE_RANGES = ['5–7', '7–9', '8–10', '9–11', '10–12', '11–13', '12–14', '13–15', '14–16', '15–18', '16+', 'Adult', 'Mixed'];

function ClassFormDialog({ open, onClose, classData, studios, teachers, selectedDay, onSave, onDelete }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) return;
    if (classData) {
      setForm({ ...classData });
    } else {
      setForm({
        title: '', day_of_week: selectedDay, one_time_date: '', start_time: '16:00', end_time: '17:00',
        studio_id: '', teacher_id: '', guest_artist: false, guest_artist_name: '',
        level: '', age_range: '', week_variant: '',
      });
    }
  }, [open, classData?.id]);

  const isOneTime = !!form.one_time_date;

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (isOneTime) {
      delete data.day_of_week;
      delete data.week_variant;
    } else {
      delete data.one_time_date;
    }
    if (!data.guest_artist) delete data.guest_artist_name;
    onSave(data);
  };

  // For availability panel: derive a date from one_time_date or today's occurrence of the selected day
  const availDate = form.one_time_date || (() => {
    const today = new Date();
    const diff = ((form.day_of_week ?? selectedDay) - today.getDay() + 7) % 7;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[92vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-body text-foreground">{classData ? 'Edit Class' : 'New Class'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Title */}
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} required className="bg-secondary border-border" />
          </div>

          {/* One-time toggle */}
          <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg border border-border">
            <Switch
              checked={isOneTime}
              onCheckedChange={v => setForm({ ...form, one_time_date: v ? '' : undefined, day_of_week: v ? undefined : (form.day_of_week ?? selectedDay) })}
            />
            <div>
              <p className="text-xs font-medium text-foreground">One-time class</p>
              <p className="text-[10px] text-muted-foreground">Guest artist, special session, or substitute day</p>
            </div>
          </div>

          {/* Day OR specific date */}
          {isOneTime ? (
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={form.one_time_date || ''} onChange={e => setForm({ ...form, one_time_date: e.target.value })} required className="bg-secondary border-border" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Day of Week</Label>
                <Select value={String(form.day_of_week ?? selectedDay)} onValueChange={v => setForm({ ...form, day_of_week: Number(v) })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Alternating Week</Label>
                <Select value={form.week_variant || 'none'} onValueChange={v => setForm({ ...form, week_variant: v === 'none' ? '' : v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Every week</SelectItem>
                    <SelectItem value="Black">Black Week only</SelectItem>
                    <SelectItem value="Teal">Teal Week only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Studio */}
          <div>
            <Label className="text-xs text-muted-foreground">Studio</Label>
            <Select value={form.studio_id || ''} onValueChange={v => setForm({ ...form, studio_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select studio" /></SelectTrigger>
              <SelectContent>{studios.map(s => <SelectItem key={s.id} value={s.id}>Studio {s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground mb-1 block">Start</Label>
              <Input type="time" value={form.start_time || ''} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-secondary border-border h-10 w-full text-sm" />
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground mb-1 block">End</Label>
              <Input type="time" value={form.end_time || ''} onChange={e => setForm({ ...form, end_time: e.target.value })} className="bg-secondary border-border h-10 w-full text-sm" />
            </div>
          </div>

          {/* Studio availability */}
          {form.studio_id && form.start_time && form.end_time && (
            <StudioAvailability
              date={availDate}
              startTime={form.start_time}
              endTime={form.end_time}
              selectedStudioId={form.studio_id}
              dayOfWeek={isOneTime ? undefined : (form.day_of_week ?? selectedDay)}
            />
          )}

          {/* Teacher */}
          <div>
            <Label className="text-xs text-muted-foreground">Teacher</Label>
            <Select value={form.teacher_id || ''} onValueChange={v => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Guest Artist */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={!!form.guest_artist}
                onCheckedChange={v => setForm({ ...form, guest_artist: v, guest_artist_name: v ? form.guest_artist_name : '' })}
              />
              <Label className="text-xs text-foreground">Guest Artist</Label>
            </div>
            {form.guest_artist && (
              <Input
                placeholder="Guest artist name"
                value={form.guest_artist_name || ''}
                onChange={e => setForm({ ...form, guest_artist_name: e.target.value })}
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Level + Age Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Level</Label>
              <Select value={form.level || 'custom'} onValueChange={v => setForm({ ...form, level: v === 'custom' ? '' : v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  <SelectItem value="custom">Other / Custom</SelectItem>
                </SelectContent>
              </Select>
              {(form.level && !LEVELS.includes(form.level)) && (
                <Input
                  className="mt-1 bg-secondary border-border"
                  placeholder="Custom level"
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Age Range</Label>
              <Select value={form.age_range || 'custom'} onValueChange={v => setForm({ ...form, age_range: v === 'custom' ? '' : v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  <SelectItem value="custom">Other / Custom</SelectItem>
                </SelectContent>
              </Select>
              {(form.age_range && !AGE_RANGES.includes(form.age_range)) && (
                <Input
                  className="mt-1 bg-secondary border-border"
                  placeholder="Custom age range"
                  value={form.age_range}
                  onChange={e => setForm({ ...form, age_range: e.target.value })}
                />
              )}
            </div>
          </div>

          {/* Bring to class */}
          <div>
            <Label className="text-xs text-muted-foreground">Bring to class <span className="text-muted-2">(comma separated)</span></Label>
            <Input
              value={(form.bring_items || []).join(', ')}
              onChange={e => setForm({ ...form, bring_items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g. Pointe shoes, Black leo, Water"
              className="bg-secondary border-border"
            />
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            {onDelete && (
              <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
            <Button type="submit" className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
              {classData ? 'Save Changes' : 'Create Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}