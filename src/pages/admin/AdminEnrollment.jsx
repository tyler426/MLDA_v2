import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatTime, DAY_NAMES_SHORT } from '@/lib/scheduleUtils';
import { Users, Search, UserPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminEnrollment() {
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const [addingTo, setAddingTo] = useState(null); // class object
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.ClassEnrollment.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DanceClass.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allClasses'] });
      toast.success('Teacher assigned');
    },
  });

  const removeEnrollmentMutation = useMutation({
    mutationFn: (id) => base44.entities.ClassEnrollment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allEnrollments'] }),
  });

  const addEnrollmentMutation = useMutation({
    mutationFn: ({ class_id, dancer_id }) => base44.entities.ClassEnrollment.create({ class_id, dancer_id, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allEnrollments'] });
      toast.success('Dancer enrolled');
      setAddingTo(null);
    },
  });

  const getTeacher = (id) => teachers.find(t => t.id === id);
  const getStudio = (id) => studios.find(s => s.id === id);
  const getDancer = (id) => dancers.find(d => d.id === id);

  const enrollmentsByClass = useMemo(() => {
    const map = {};
    for (const e of enrollments) {
      if (!map[e.class_id]) map[e.class_id] = [];
      map[e.class_id].push(e);
    }
    return map;
  }, [enrollments]);

  const filteredClasses = useMemo(() => {
    let result = [...classes];
    if (selectedDay !== null) result = result.filter(c => c.day_of_week === selectedDay);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        c.level?.toLowerCase().includes(q) ||
        getTeacher(c.teacher_id)?.first_name?.toLowerCase().includes(q) ||
        getTeacher(c.teacher_id)?.last_name?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time?.localeCompare(b.start_time));
  }, [classes, selectedDay, search, teachers]);

  const totalEnrolled = enrollments.filter(e => e.active !== false).length;

  return (
    <div className="px-4 pt-2 pb-8 max-w-4xl mx-auto">
      <h1 className="font-serif text-[28px] font-semibold mb-1 -tracking-[0.01em]">Class roster & enrollment</h1>
      <p className="text-xs text-muted-foreground mb-4">{filteredClasses.length} classes · {totalEnrolled} active enrollments</p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search classes, levels, teachers…"
            className="pl-8 bg-secondary border-border text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedDay(null)}
            className={`px-3 py-1.5 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] whitespace-nowrap transition-colors ${selectedDay === null ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >All</button>
          {DAY_NAMES_SHORT.map((name, i) => (
            <button key={i} onClick={() => setSelectedDay(selectedDay === i ? null : i)}
              className={`px-3 py-1.5 rounded-md font-caps text-[10px] uppercase tracking-[0.12em] whitespace-nowrap transition-colors ${selectedDay === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
            >{name}</button>
          ))}
        </div>
      </div>

      {/* Class list */}
      <div className="space-y-2">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-serif italic text-muted-foreground text-sm">No classes found</p>
          </div>
        ) : filteredClasses.map(cls => {
          const teacher = getTeacher(cls.teacher_id);
          const studio = getStudio(cls.studio_id);
          const classEnrollments = enrollmentsByClass[cls.id] || [];
          const isExpanded = expandedClass === cls.id;
          const count = classEnrollments.length;

          return (
            <div key={cls.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Class header row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{cls.title}</span>
                    {cls.level && <span className="font-caps text-[11px] uppercase tracking-[0.12em] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{cls.level}</span>}
                    {cls.week_variant && <span className={`font-caps text-[11px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${cls.week_variant === 'Black' ? 'bg-secondary text-foreground' : 'bg-teal/20 text-teal'}`}>{cls.week_variant}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{DAY_NAMES_SHORT[cls.day_of_week]} {formatTime(cls.start_time)}–{formatTime(cls.end_time)}</span>
                    {studio && <span>Studio {studio.name}</span>}
                    {teacher && <span className="text-warm-gray">{teacher.first_name} {teacher.last_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-caps text-[10px] px-2 py-0.5 rounded-full ${count > 0 ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {count} enrolled
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="px-4 py-3 space-y-3">
                      {/* Teacher assignment */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Teacher</span>
                        <Select
                          value={cls.teacher_id || '__none__'}
                          onValueChange={v => updateClassMutation.mutate({ id: cls.id, data: { teacher_id: v === '__none__' ? null : v } })}
                        >
                          <SelectTrigger className="bg-secondary border-border h-8 text-xs flex-1 max-w-xs">
                            <SelectValue placeholder="Assign teacher…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Unassigned —</SelectItem>
                            {teachers.filter(t => !t.archived).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Enrolled dancers */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Enrolled Dancers</span>
                          <Button size="sm" variant="ghost"
                            className="h-6 px-2 text-[10px] font-caps uppercase tracking-[0.1em] text-primary hover:text-primary"
                            onClick={() => setAddingTo(cls)}
                          >
                            <UserPlus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {classEnrollments.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No dancers enrolled</p>
                        ) : (
                          <div className="space-y-1">
                            {classEnrollments.map(e => {
                              const dancer = getDancer(e.dancer_id);
                              return (
                                <div key={e.id} className="flex items-center justify-between bg-secondary/50 rounded px-2.5 py-1.5">
                                  <div>
                                    <span className="text-xs text-foreground">{dancer ? `${dancer.first_name} ${dancer.last_name}` : 'Unknown Dancer'}</span>
                                    {dancer?.level && <span className="text-[10px] text-muted-foreground ml-2">{dancer.level}</span>}
                                  </div>
                                  <button
                                    onClick={() => removeEnrollmentMutation.mutate(e.id)}
                                    className="text-[10px] text-muted-foreground hover:text-terracotta transition-colors"
                                  >remove</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Add dancer dialog */}
      <AddDancerDialog
        open={!!addingTo}
        cls={addingTo}
        dancers={dancers}
        enrollments={enrollmentsByClass[addingTo?.id] || []}
        onAdd={(dancer_id) => addEnrollmentMutation.mutate({ class_id: addingTo.id, dancer_id })}
        onClose={() => setAddingTo(null)}
        isPending={addEnrollmentMutation.isPending}
      />
    </div>
  );
}

function AddDancerDialog({ open, cls, dancers, enrollments, onAdd, onClose, isPending }) {
  const [search, setSearch] = useState('');
  const enrolledIds = new Set(enrollments.map(e => e.dancer_id));

  const filtered = dancers
    .filter(d => !d.archived && !enrolledIds.has(d.id))
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) || d.level?.toLowerCase().includes(q);
    });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-body text-foreground text-sm">Add Dancer to {cls?.title}</DialogTitle>
        </DialogHeader>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search dancers…"
          className="bg-secondary border-border"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">No unenrolled dancers found</p>
          ) : filtered.map(d => (
            <button key={d.id}
              onClick={() => onAdd(d.id)}
              disabled={isPending}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary transition-colors text-left disabled:opacity-50"
            >
              <span className="text-sm text-foreground">{d.first_name} {d.last_name}</span>
              <span className="text-[10px] text-muted-foreground">{d.level}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}