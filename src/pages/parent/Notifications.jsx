import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { Bell, Check, Pin } from 'lucide-react';
import { format } from 'date-fns';

const TAG_ACCENT = {
  daily_digest: '#3aa89f',
  announcement: '#c8a464',
  schedule_change: '#d97a5e',
  costume: '#c8a464',
  default: '#a89e90',
};
function tagFor(t = '') { return (t || 'update').replace(/_/g, ' '); }
function accentFor(t) { return TAG_ACCENT[t] || TAG_ACCENT.default; }

export default function Notifications() {
  const qc = useQueryClient();
  const { data: household } = useMyHousehold();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', household?.email],
    queryFn: () => base44.entities.ScheduleNotification.filter({ recipient_email: household.email }, '-created_date', 50),
    enabled: !!household?.email,
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.ScheduleNotification.update(id, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-teal-bright font-semibold">Inbox</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">From the studio</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center mt-5">
          <Bell className="w-8 h-8 text-muted-2 mx-auto mb-3" />
          <p className="text-[13px] text-muted-2">No announcements yet.</p>
        </div>
      ) : (
        <div className="mt-4 pb-2 flex flex-col gap-2.5">
          {notifications.map(n => {
            const accent = accentFor(n.type);
            const unread = !n.read;
            return (
              <button key={n.id} onClick={() => unread && markRead.mutate(n.id)}
                className="text-left rounded-2xl p-4 border transition-colors"
                style={{ borderColor: unread ? 'rgba(200,164,100,.3)' : 'var(--border)', background: unread ? 'linear-gradient(180deg,#1b1712,#141210)' : 'var(--card)', opacity: unread ? 1 : 0.7 }}>
                <div className="flex items-center gap-2 mb-2">
                  {unread && <Pin className="w-3 h-3 text-gold" />}
                  <span className="text-[9.5px] tracking-[0.12em] uppercase font-semibold" style={{ color: accent }}>{tagFor(n.type)}</span>
                  <span className="text-[11px] text-muted-2 ml-auto">{n.created_date ? format(new Date(n.created_date), 'MMM d') : ''}</span>
                </div>
                <div className="text-[15px] font-semibold mb-1">{n.title}</div>
                {n.message && <div className="text-[12.5px] text-muted-foreground leading-relaxed">{n.message}</div>}
                {unread && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px]" style={{ color: accent }}>
                    <Check className="w-3.5 h-3.5" /> Tap to mark read
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
