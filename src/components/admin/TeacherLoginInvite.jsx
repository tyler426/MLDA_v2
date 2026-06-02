import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

// Admin-only: invite a login for a teacher record (uses the teacher's email).
export default function TeacherLoginInvite({ teacher }) {
  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { email: teacher.email, role: 'teacher', teacher_id: teacher.id, full_name: `${teacher.first_name} ${teacher.last_name}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success(`Login invited for ${teacher.first_name}`),
    onError: (e) => toast.error(e.message || 'Invite failed'),
  });

  if (teacher.profile_id) {
    return <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-1"><Check className="w-3 h-3" /> Has login</span>;
  }

  return (
    <button
      onClick={() => { if (teacher.email) invite.mutate(); else toast.error('Add an email first'); }}
      disabled={invite.isPending}
      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
    >
      <UserPlus className="w-3 h-3" /> {invite.isPending ? '…' : 'Invite login'}
    </button>
  );
}
