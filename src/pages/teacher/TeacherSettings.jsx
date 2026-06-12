import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Check, Calendar, Music, Trophy, ClipboardList, ChevronRight, Sparkles, CalendarDays } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import NotificationToggle from '@/components/shared/NotificationToggle';
import { toast } from 'sonner';

export default function TeacherSettings() {
  const [userEmail, setUserEmail] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  // Token now lives in the scoped teacher_secrets table; read own via RPC
  // (fallback to the legacy column for the pre-migration window).
  const { data: rpcToken } = useQuery({
    queryKey: ['myIcsToken', userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data } = await supabase.rpc('my_ics_token');
      return data || null;
    },
  });
  const icsToken = rpcToken || teacher?.ics_token;
  const fnBase = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co');
  const icsUrl = icsToken ? `${fnBase}/ics-feed?type=teacher&token=${icsToken}` : null;

  const handleCopy = async () => {
    if (icsUrl) {
      await navigator.clipboard.writeText(icsUrl);
      setCopied(true);
      toast.success('Calendar URL copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto space-y-4">
      <SectionLabel className="pt-4 mb-2">Settings</SectionLabel>

      <NotificationToggle />

      {/* Quick links to features kept off the bottom nav */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {[
          { to: '/teacher/month', icon: CalendarDays, label: 'Month calendar' },
          { to: '/teacher/privates', icon: Sparkles, label: 'Private lessons' },
          { to: '/teacher/pieces', icon: Music, label: 'My pieces' },
          { to: '/teacher/competitions', icon: Trophy, label: 'Competitions' },
          { to: '/teacher/attendance', icon: ClipboardList, label: 'Attendance' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-secondary/40">
            <Icon className="w-[18px] h-[18px] text-teal-bright" />
            <span className="flex-1 text-[14px]">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-2" />
          </Link>
        ))}
      </div>

      {/* Profile info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-body font-semibold text-sm text-foreground mb-2">Profile</h3>
        <p className="text-sm text-foreground">{teacher?.first_name} {teacher?.last_name}</p>
        <p className="text-xs text-warm-gray mt-1">{userEmail}</p>
      </div>

      {/* Calendar Sync */}
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <Calendar className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="font-body font-semibold text-foreground mb-1">Calendar Sync</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Subscribe to your personal calendar feed to see all your classes and competition shifts.
        </p>

        {icsToken ? (
          <div className="space-y-3">
            <div className="bg-secondary rounded-md p-3 text-xs text-muted-foreground break-all font-mono text-left">
              {icsUrl}
            </div>
            <Button onClick={handleCopy} className="w-full bg-primary hover:bg-primary/90 font-caps text-xs uppercase tracking-[0.12em]">
              {copied ? <><Check className="w-4 h-4 mr-2" /> Copied</> : <><Copy className="w-4 h-4 mr-2" /> Copy URL</>}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://calendar.google.com/calendar/r?cid=webcal://${icsUrl?.replace('https://', '').replace('http://', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full font-caps text-[10px] uppercase tracking-[0.1em]">Add to Google</Button>
              </a>
              <a href={`webcal://${icsUrl?.replace('https://', '').replace('http://', '')}`} className="block">
                <Button variant="outline" className="w-full font-caps text-[10px] uppercase tracking-[0.1em]">Add to Apple</Button>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-warm-gray italic">Calendar feed available once your admin sets up your profile.</p>
        )}
      </div>
    </div>
  );
}