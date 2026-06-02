import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

// Invite a login for one dancer (student) so they can see their own schedule.
// Works for admins and for caregivers who manage the dancer's household
// (authorization is enforced in the invite-member edge function).
export default function DancerLoginInvite({ dancer, hasLogin }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { email, role: 'dancer', dancer_id: dancer.id, full_name: `${dancer.first_name} ${dancer.last_name}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success(`Login invited for ${dancer.first_name}`); setOpen(false); setEmail(''); },
    onError: (e) => toast.error(e.message || 'Invite failed'),
  });

  if (hasLogin) {
    return <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-1"><Check className="w-3 h-3" /> Has login</span>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
        <UserPlus className="w-3 h-3" /> Invite login
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (email) invite.mutate(); }} className="flex items-center gap-1.5">
      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dancer@email.com"
        className="bg-secondary border-border h-7 text-xs w-40" required />
      <Button type="submit" size="sm" disabled={invite.isPending} className="h-7 bg-primary hover:bg-primary/90 text-[10px]">
        {invite.isPending ? '…' : 'Send'}
      </Button>
    </form>
  );
}
