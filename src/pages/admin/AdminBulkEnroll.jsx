import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SectionLabel from '@/components/shared/SectionLabel';
import { Users, CheckSquare, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminBulkEnroll() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDancers, setSelectedDancers] = useState([]);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });

  const filteredDancers = dancers.filter(d => {
    const levelOk = filterLevel === 'all' || d.level === filterLevel;
    const programOk = filterProgram === 'all' || d.program === filterProgram;
    return levelOk && programOk;
  });

  const levels = [...new Set(dancers.map(d => d.level).filter(Boolean))].sort();
  const programs = ['PrePro', 'Competitive', 'Educational'];

  const toggleDancer = (id) => {
    setSelectedDancers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedDancers(filteredDancers.map(d => d.id));
  const clearAll = () => setSelectedDancers([]);

  const alreadyEnrolled = (dancerId) => enrollments.some(e => e.class_id === selectedClass && e.dancer_id === dancerId);

  const bulkEnrollMutation = useMutation({
    mutationFn: async () => {
      const toEnroll = selectedDancers.filter(id => !alreadyEnrolled(id));
      for (const dancerId of toEnroll) {
        await base44.entities.ClassEnrollment.create({ class_id: selectedClass, dancer_id: dancerId, active: true });
      }
      return toEnroll.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      toast.success(`Enrolled ${count} dancer${count !== 1 ? 's' : ''}`);
      setSelectedDancers([]);
    },
  });

  const bulkUnenrollMutation = useMutation({
    mutationFn: async () => {
      const toUnenroll = selectedDancers.filter(id => alreadyEnrolled(id));
      for (const dancerId of toUnenroll) {
        const enrollment = enrollments.find(e => e.class_id === selectedClass && e.dancer_id === dancerId);
        if (enrollment) await base44.entities.ClassEnrollment.update(enrollment.id, { active: false });
      }
      return toUnenroll.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      toast.success(`Removed ${count} dancer${count !== 1 ? 's' : ''}`);
      setSelectedDancers([]);
    },
  });

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const classEnrollmentCount = enrollments.filter(e => e.class_id === selectedClass).length;

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <SectionLabel className="pt-4 mb-4">Bulk Enrollment</SectionLabel>

      {/* Class selector */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <Label className="text-xs text-muted-foreground block mb-2">Select Class to Enroll In</Label>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Choose a class..." />
          </SelectTrigger>
          <SelectContent>
            {classes.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map(c => (
              <SelectItem key={c.id} value={c.id}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.day_of_week]} {c.start_time} — {c.title}
                {c.level ? ` (${c.level})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedClassData && (
          <p className="text-xs text-muted-foreground mt-2">
            Currently <span className="text-primary">{classEnrollmentCount}</span> active enrollment{classEnrollmentCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-3">
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="bg-secondary border-border w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="bg-secondary border-border w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={selectAll} className="text-xs text-primary hover:text-primary/80 transition-colors">Select All</button>
        <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        <span className="text-xs text-warm-gray ml-auto">{selectedDancers.length} selected</span>
      </div>

      {/* Dancer list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-4">
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
          {filteredDancers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 italic">No dancers match filters</p>
          ) : (
            filteredDancers.map((d, i) => {
              const enrolled = alreadyEnrolled(d.id);
              return (
                <label key={d.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-secondary/40 transition-colors ${enrolled ? 'opacity-60' : ''}`}>
                  <Checkbox
                    checked={selectedDancers.includes(d.id)}
                    onCheckedChange={() => toggleDancer(d.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{d.first_name} {d.last_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.program && <span className="text-[10px] text-warm-gray">{d.program}</span>}
                      {d.level && <span className="text-[10px] text-gold">{d.level}</span>}
                    </div>
                  </div>
                  {enrolled && selectedClass && (
                    <span className="text-[10px] font-caps uppercase tracking-[0.1em] text-primary bg-primary/10 px-2 py-0.5 rounded">Enrolled</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => bulkEnrollMutation.mutate()}
          disabled={!selectedClass || selectedDancers.length === 0 || bulkEnrollMutation.isPending}
          className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]"
        >
          <Users className="w-4 h-4 mr-1" />
          Enroll {selectedDancers.length > 0 ? selectedDancers.length : ''} Selected
        </Button>
        <Button
          variant="outline"
          onClick={() => bulkUnenrollMutation.mutate()}
          disabled={!selectedClass || selectedDancers.length === 0 || bulkUnenrollMutation.isPending}
          className="font-caps text-[10px] uppercase tracking-[0.12em]"
        >
          Remove Selected
        </Button>
      </div>
    </div>
  );
}