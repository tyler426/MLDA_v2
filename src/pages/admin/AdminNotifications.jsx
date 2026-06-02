import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';
import { Bell, Mail, User, BellOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setNotificationsEnabled(u?.global_notifications_enabled === true));
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => base44.entities.ScheduleNotification.list('-created_date', 100),
  });

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <SectionLabel>Notifications Log</SectionLabel>
        <div className={`flex items-center gap-1.5 text-[10px] font-caps uppercase tracking-[0.12em] px-2 py-1 rounded-md ${notificationsEnabled ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          {notificationsEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          {notificationsEnabled ? 'Sending' : 'Paused'}
        </div>
      </div>

      {!notificationsEnabled && (
        <div className="mb-4 p-3 bg-secondary/60 border border-border rounded-lg flex items-center gap-2">
          <BellOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Notifications are currently paused. Enable them in <strong className="text-foreground">Settings</strong> when ready to go live.</p>
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState message="No notifications sent yet" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-card border border-border rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-md ${n.recipient_type === 'parent' ? 'bg-primary/10' : 'bg-gold/10'}`}>
                  {n.recipient_type === 'parent' ? <User className="w-3.5 h-3.5 text-primary" /> : <Bell className="w-3.5 h-3.5 text-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-body text-sm font-medium text-foreground truncate">{n.title}</h3>
                    <span className="shrink-0 text-[10px] text-warm-gray">
                      {n.created_date ? format(new Date(n.created_date), 'MMM d, h:mm a') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-warm-gray">
                      <Mail className="w-3 h-3" />{n.recipient_email}
                    </span>
                    <span className="font-caps text-[9px] uppercase tracking-[0.1em] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{n.recipient_type}</span>
                    {n.read && <span className="text-[9px] text-primary">Read</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}