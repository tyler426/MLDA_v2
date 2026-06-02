import { useState } from 'react';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { Button } from '@/components/ui/button';
import { Copy, Check, Calendar } from 'lucide-react';
import SectionLabel from '@/components/shared/SectionLabel';
import { toast } from 'sonner';

export default function CalendarSync() {
  const [copied, setCopied] = useState(false);
  const { data: household } = useMyHousehold();

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
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <SectionLabel className="pt-4 mb-6">Calendar Sync</SectionLabel>

      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <Calendar className="w-10 h-10 text-primary mx-auto mb-4" />
        <h2 className="font-body font-semibold text-foreground mb-2">Stay in sync</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Subscribe to your personal calendar feed. All schedule changes will automatically appear in your phone's calendar.
        </p>

        {icsToken ? (
          <div className="space-y-3">
            <div className="bg-secondary rounded-md p-3 text-xs text-muted-foreground break-all font-mono">
              {icsUrl}
            </div>
            <Button onClick={handleCopy} className="w-full bg-primary hover:bg-primary/90 font-caps text-xs uppercase tracking-[0.12em]">
              {copied ? <><Check className="w-4 h-4 mr-2" /> Copied</> : <><Copy className="w-4 h-4 mr-2" /> Copy URL</>}
            </Button>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
              <a
                href={`https://calendar.google.com/calendar/r?cid=webcal://${icsUrl?.replace('https://', '').replace('http://', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full font-caps text-[10px] uppercase tracking-[0.1em]">
                  Add to Google
                </Button>
              </a>
              <a href={`webcal://${icsUrl?.replace('https://', '').replace('http://', '')}`} className="block">
                <Button variant="outline" className="w-full font-caps text-[10px] uppercase tracking-[0.1em]">
                  Add to Apple
                </Button>
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