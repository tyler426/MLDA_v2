import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Copy, Check, Calendar } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import { toast } from 'sonner';

export default function ParentSettings() {
  const [userEmail, setUserEmail] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: household } = useQuery({
    queryKey: ['parentHousehold', userEmail],
    queryFn: () => base44.entities.ParentHousehold.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const icsToken = household?.ics_token;
  const icsUrl = icsToken ? `${window.location.origin}/api/ics/parent/${icsToken}` : null;

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

      {/* Household info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Household</h3>
        <p className="text-sm text-muted-foreground">{household?.primary_contact_name || 'Not set'}</p>
        <p className="text-xs text-warm-gray mt-1">{userEmail}</p>

        {dancers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray mb-2">Dancers</p>
            {dancers.map(d => (
              <p key={d.id} className="text-sm text-foreground">{d.first_name} {d.last_name}</p>
            ))}
          </div>
        )}
      </div>

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