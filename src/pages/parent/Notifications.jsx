import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function Notifications() {
  const [userEmail, setUserEmail] = useState(null);
  const queryClient = useQueryClient();
  
  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userEmail],
    queryFn: () => base44.entities.ScheduleNotification.filter({ recipient_email: userEmail }, '-created_date', 50),
    enabled: !!userEmail,
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.ScheduleNotification.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <SectionLabel className="pt-4 mb-4">Notifications</SectionLabel>

      {notifications.length === 0 ? (
        <EmptyState message="No notifications yet" sub="You'll be notified of any schedule changes" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-card border border-border rounded-lg p-4 ${!n.read ? 'border-l-2 border-l-primary' : 'opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-body text-sm font-medium text-foreground">{n.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-[10px] text-warm-gray mt-2">
                    {n.created_date ? format(new Date(n.created_date), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}