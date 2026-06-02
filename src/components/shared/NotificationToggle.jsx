import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Switch } from '@/components/ui/switch';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

// Per-user notification preference. Each parent/teacher/dancer controls their own;
// the admin's global switch (app_settings) can pause everyone.
export default function NotificationToggle() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifPref'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const [{ data: prof }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('notifications_enabled').eq('id', user.id).single(),
        supabase.from('app_settings').select('global_notifications_enabled').eq('id', 1).maybeSingle(),
      ]);
      return { uid: user.id, on: prof?.notifications_enabled ?? true, global: settings?.global_notifications_enabled ?? true };
    },
  });

  const toggle = useMutation({
    mutationFn: async (val) => {
      const { error } = await supabase.from('profiles').update({ notifications_enabled: val }).eq('id', data.uid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifPref'] }); toast.success('Notification preference saved'); },
    onError: (e) => toast.error(e.message),
  });

  if (!data) return null;
  const globalOff = !data.global;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: 'rgba(44,144,137,.16)', color: '#3aa89f' }}>
        <Bell className="w-[18px] h-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold">Notifications</div>
        <div className="text-[11.5px] text-muted-2">
          {globalOff ? 'Paused studio-wide by the admin' : data.on ? 'You’ll get schedule alerts & announcements' : 'Turned off for your account'}
        </div>
      </div>
      <Switch checked={data.on && !globalOff} disabled={globalOff || toggle.isPending} onCheckedChange={v => toggle.mutate(v)} />
    </div>
  );
}
