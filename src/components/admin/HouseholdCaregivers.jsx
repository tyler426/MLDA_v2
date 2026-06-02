import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useHouseholdMembers } from '@/lib/useHouseholdMembers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Mail, Star } from 'lucide-react';
import { toast } from 'sonner';

const RELATIONSHIPS = ['mother', 'father', 'guardian', 'grandparent', 'other'];

// Manage the 2–3 caregiver logins on one household. Used in AdminRoster.
export default function HouseholdCaregivers({ household }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useHouseholdMembers(household.id);
  const [form, setForm] = useState({ email: '', full_name: '', relationship: 'guardian' });

  const invite = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { ...payload, role: 'parent', household_id: household.id, is_primary: members.length === 0 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['householdMembers', household.id] });
      setForm({ email: '', full_name: '', relationship: 'guardian' });
      toast.success('Invite sent');
    },
    onError: (e) => toast.error(e.message || 'Invite failed'),
  });

  const remove = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.from('household_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['householdMembers', household.id] });
      toast.success('Caregiver removed');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      <p className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Caregivers</p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No caregiver logins yet.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-secondary rounded-md px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
                  {m.is_primary && <Star className="w-3 h-3 text-gold shrink-0" />}
                  {m.profiles?.full_name || m.profiles?.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{m.profiles?.email} · {m.relationship}</p>
              </div>
              <button onClick={() => remove.mutate(m.id)} className="p-1 text-muted-foreground hover:text-terracotta shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (form.email) invite.mutate(form); }}
        className="grid grid-cols-1 gap-2 bg-card/50 rounded-md"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Name</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="bg-secondary border-border h-8 text-xs" placeholder="Jane Smith" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Relationship</Label>
            <Select value={form.relationship} onValueChange={v => setForm({ ...form, relationship: v })}>
              <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[10px] text-muted-foreground">Email to invite</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="bg-secondary border-border h-8 text-xs" placeholder="caregiver@email.com" required />
          </div>
          <Button type="submit" size="sm" disabled={invite.isPending}
            className="bg-primary hover:bg-primary/90 h-8 font-caps text-[10px] uppercase tracking-[0.1em]">
            {invite.isPending ? '…' : <><UserPlus className="w-3.5 h-3.5 mr-1" /> Invite</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
