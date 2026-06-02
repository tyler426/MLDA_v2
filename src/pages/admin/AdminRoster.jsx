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
import HouseholdCaregivers from '@/components/admin/HouseholdCaregivers';
import TeacherLoginInvite from '@/components/admin/TeacherLoginInvite';
import DancerLoginInvite from '@/components/shared/DancerLoginInvite';
import PhotoUpload from '@/components/shared/PhotoUpload';
import { Plus, Search, UserPlus, Users, Pencil, Archive, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminRoster() {
  const [tab, setTab] = useState('dancers');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(null); // 'dancer' | 'parent' | 'teacher'
  const [editItem, setEditItem] = useState(null);
  const [expandedParent, setExpandedParent] = useState(null);
  const queryClient = useQueryClient();

  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: parents = [] } = useQuery({ queryKey: ['allParents'], queryFn: () => base44.entities.ParentHousehold.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });

  const activeDancers = dancers.filter(d => !d.archived);
  const activeTeachers = teachers.filter(t => !t.archived);

  const deleteStudio = useMutation({
    mutationFn: (id) => base44.entities.Studio.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studios'] }); toast.success('Room removed'); },
    onError: (e) => toast.error(e.message),
  });

  const filteredDancers = activeDancers.filter(d =>
    `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredParents = parents.filter(p =>
    p.primary_contact_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTeachers = activeTeachers.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudios = studios.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const createType = tab === 'dancers' ? 'dancer' : tab === 'parents' ? 'parent' : tab === 'teachers' ? 'teacher' : 'studio';

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">Studio</div>
        <h1 className="font-serif text-[30px] font-semibold mt-1.5 -tracking-[0.01em]">Roster</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center gap-3 mb-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="dancers" className="font-caps text-[10px] uppercase tracking-[0.1em]">Dancers</TabsTrigger>
            <TabsTrigger value="parents" className="font-caps text-[10px] uppercase tracking-[0.1em]">Parents</TabsTrigger>
            <TabsTrigger value="teachers" className="font-caps text-[10px] uppercase tracking-[0.1em]">Teachers</TabsTrigger>
            <TabsTrigger value="studios" className="font-caps text-[10px] uppercase tracking-[0.1em]">Rooms</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setShowCreate(createType)} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em] ml-auto">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-10 bg-secondary border-border" />
        </div>

        <TabsContent value="dancers">
          <div className="space-y-2">
            {filteredDancers.map((d, i) => {
              const parent = parents.find(p => p.id === d.parent_household_id);
              return (
                <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-body text-sm font-medium text-foreground">{d.first_name} {d.last_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.program && <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">{d.program}</span>}
                      {d.level && <span className="text-[10px] text-gold">{d.level}</span>}
                      {d.jackrabbit_student_id && <span className="text-[10px] text-primary bg-primary/10 px-1.5 rounded">JR Synced</span>}
                    </div>
                    {parent && <p className="text-[10px] text-muted-foreground mt-0.5">Parent: {parent.primary_contact_name}</p>}
                    <div className="mt-1.5"><DancerLoginInvite dancer={d} hasLogin={!!d.profile_id} /></div>
                  </div>
                  <button onClick={() => setEditItem({ type: 'dancer', data: d })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="parents">
          <div className="space-y-2">
            {filteredParents.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-card border border-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedParent(expandedParent === p.id ? null : p.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedParent === p.id ? 'rotate-180' : ''}`} />
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-foreground truncate">{p.primary_contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      {p.phone && <p className="text-[10px] text-warm-gray">{p.phone}</p>}
                    </div>
                  </button>
                  <button onClick={() => setEditItem({ type: 'parent', data: p })} className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                </div>
                {expandedParent === p.id && <HouseholdCaregivers household={p} />}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <div className="space-y-2">
            {filteredTeachers.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-body text-sm font-medium text-foreground">{t.first_name} {t.last_name}</p>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {t.initials && <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-gold">{t.initials}</span>}
                    <TeacherLoginInvite teacher={t} />
                  </div>
                </div>
                <button onClick={() => setEditItem({ type: 'teacher', data: t })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="studios">
          <p className="text-xs text-muted-foreground mb-3">Studios / rooms used across the schedule, conflicts, and availability.</p>
          <div className="space-y-2">
            {filteredStudios.length === 0 && (
              <p className="text-sm text-warm-gray italic text-center py-6">No rooms yet — tap <span className="text-foreground">Add</span> to create your first studio.</p>
            )}
            {filteredStudios.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
              >
                <p className="font-body text-sm font-medium text-foreground">Studio {s.name}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditItem({ type: 'studio', data: s })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm(`Remove Studio ${s.name}?`)) deleteStudio.mutate(s.id); }} className="p-1.5 text-muted-foreground hover:text-terracotta"><Archive className="w-3.5 h-3.5" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <RosterFormDialog
        open={!!showCreate || !!editItem}
        onClose={() => { setShowCreate(null); setEditItem(null); }}
        type={showCreate || editItem?.type}
        editData={editItem?.data}
        parents={parents}
        queryClient={queryClient}
      />
    </div>
  );
}

function RosterFormDialog({ open, onClose, type, editData, parents, queryClient }) {
  const [form, setForm] = useState({});

  const resetForm = () => {
    if (editData) {
      setForm({ ...editData });
    } else {
      setForm({});
    }
  };

  if (open && editData && form.id !== editData.id) setForm({ ...editData });
  if (open && !editData && form.id) setForm({});

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      if (type === 'dancer') {
        if (editData) return base44.entities.Dancer.update(editData.id, formData);
        return base44.entities.Dancer.create(formData);
      } else if (type === 'parent') {
        const data = { ...formData, ics_token: formData.ics_token || crypto.randomUUID().replace(/-/g, '') };
        if (editData) return base44.entities.ParentHousehold.update(editData.id, data);
        return base44.entities.ParentHousehold.create(data);
      } else if (type === 'studio') {
        const data = { name: formData.name };
        if (editData) return base44.entities.Studio.update(editData.id, data);
        return base44.entities.Studio.create(data);
      } else {
        const data = { ...formData, ics_token: formData.ics_token || crypto.randomUUID().replace(/-/g, '') };
        if (editData) return base44.entities.Teacher.update(editData.id, data);
        return base44.entities.Teacher.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
      toast.success(editData ? 'Updated' : 'Created');
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-body text-foreground capitalize">{editData ? 'Edit' : 'New'} {type}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
          {type === 'dancer' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">First Name</Label><Input value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} required className="bg-secondary border-border" /></div>
                <div><Label className="text-xs text-muted-foreground">Last Name</Label><Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} required className="bg-secondary border-border" /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">Program</Label>
                <Select value={form.program || ''} onValueChange={v => setForm({ ...form, program: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PrePro">Pre-Professional</SelectItem>
                    <SelectItem value="Competitive">Competitive</SelectItem>
                    <SelectItem value="Educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Level</Label><Input value={form.level || ''} onChange={e => setForm({ ...form, level: e.target.value })} className="bg-secondary border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Parent Household</Label>
                <Select value={form.parent_household_id || ''} onValueChange={v => setForm({ ...form, parent_household_id: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{parents.map(p => <SelectItem key={p.id} value={p.id}>{p.primary_contact_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <PhotoUpload value={form.photo_url} onChange={url => setForm({ ...form, photo_url: url })} label="Dancer photo" />
            </>
          )}
          {type === 'parent' && (
            <>
              <div><Label className="text-xs text-muted-foreground">Contact Name</Label><Input value={form.primary_contact_name || ''} onChange={e => setForm({ ...form, primary_contact_name: e.target.value })} required className="bg-secondary border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} required className="bg-secondary border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Phone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-secondary border-border" /></div>
            </>
          )}
          {type === 'studio' && (
            <div>
              <Label className="text-xs text-muted-foreground">Room / Studio Name</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. A, B, Main Studio" className="bg-secondary border-border" />
            </div>
          )}
          {type === 'teacher' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">First Name</Label><Input value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} required className="bg-secondary border-border" /></div>
                <div><Label className="text-xs text-muted-foreground">Last Name</Label><Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} required className="bg-secondary border-border" /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">Initials</Label><Input value={form.initials || ''} onChange={e => setForm({ ...form, initials: e.target.value })} className="bg-secondary border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} required className="bg-secondary border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Phone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-secondary border-border" /></div>
            </>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
              {saveMutation.isPending ? 'Saving...' : editData ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}