import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Check, Calendar, ClipboardList, CalendarDays, ChevronRight } from 'lucide-react';
import HouseholdCaregivers from '@/components/admin/HouseholdCaregivers';
import DancerLoginInvite from '@/components/shared/DancerLoginInvite';
import RequestPrivate from '@/components/parent/RequestPrivate';
import NotificationToggle from '@/components/shared/NotificationToggle';
import { toast } from 'sonner';

export default function ParentSettings() {
  const [copied, setCopied] = useState(false);
  const { data: household } = useMyHousehold();

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const icsToken = household?.ics_token;
  const fnBase = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co');
  const icsUrl = icsToken ? `${fnBase}/ics-feed?type=parent&token=${icsToken}` : null;

  const handleCopy = async () => {
    if (icsUrl) {
      await navigator.clipboard.writeText(icsUrl);
      setCopied(true);
      toast.success('Calendar URL copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-5 pt-1 pb-6 space-y-4">
      <div>
        <div className="text-[11px] tracking-[0.26em] uppercase text-gold font-semibold">Family</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">{household?.primary_contact_name || 'Your account'}</h1>
      </div>

      {/* Quick links to features kept off the bottom nav */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {[
          { to: '/absences', icon: ClipboardList, label: 'Absences' },
          { to: '/month', icon: CalendarDays, label: 'Month calendar' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-secondary/40">
            <Icon className="w-[18px] h-[18px] text-teal-bright" />
            <span className="flex-1 text-[14px]">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-2" />
          </Link>
        ))}
      </div>

      {/* Private lesson requests */}
      {household && <RequestPrivate household={household} />}

      {/* Notification preference (per-user) */}
      <NotificationToggle />

      {/* Household info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Household</h3>
        <p className="text-sm text-muted-foreground">{household?.primary_contact_name || 'Not set'}</p>
        {household?.email && <p className="text-xs text-warm-gray mt-1">{household.email}</p>}

        {dancers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray mb-2">Dancers</p>
            <div className="space-y-1.5">
              {dancers.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-foreground">{d.first_name} {d.last_name}</p>
                  <DancerLoginInvite dancer={d} hasLogin={!!d.profile_id} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-warm-gray mt-2">Dancers 10+ can have their own login to see their schedule.</p>
          </div>
        )}
      </div>

      {/* Caregivers — invite another parent/guardian to this household */}
      {household && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-sm text-foreground">Caregivers</h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">Invite another parent or guardian to share this household.</p>
          <HouseholdCaregivers household={household} />
        </div>
      )}

      {/* Calendar Sync */}
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <Calendar className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="font-body font-semibold text-foreground mb-1">Calendar Sync</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Subscribe to your personal calendar feed. All schedule changes will automatically appear in your phone's calendar.
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
          <p className="text-sm text-warm-gray italic">
            Your calendar feed will be available once your studio admin sets up your household.
          </p>
        )}
      </div>
    </div>
  );
}