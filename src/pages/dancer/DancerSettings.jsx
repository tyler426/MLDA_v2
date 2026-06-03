import { useMyDancer } from '@/lib/useMyDancer';
import { Link } from 'react-router-dom';
import SectionLabel from '@/components/shared/SectionLabel';
import NotificationToggle from '@/components/shared/NotificationToggle';
import { CalendarDays, ChevronRight } from 'lucide-react';

export default function DancerSettings() {
  const { data: dancer } = useMyDancer();

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="pt-4 mb-4"><SectionLabel>My Profile</SectionLabel></div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <Row label="Name" value={dancer ? `${dancer.first_name} ${dancer.last_name}` : '—'} />
        <Row label="Program" value={dancer?.program || '—'} />
        <Row label="Level" value={dancer?.level || '—'} />
      </div>

      {/* Month calendar (Tribe Vibe, competitions, camps — no classes) */}
      <Link to="/dancer/month" className="mt-4 flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:bg-secondary/40">
        <CalendarDays className="w-[18px] h-[18px] text-teal-bright" />
        <span className="flex-1 text-[14px]">Month calendar</span>
        <ChevronRight className="w-4 h-4 text-muted-2" />
      </Link>

      <div className="mt-4"><NotificationToggle /></div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Need a change? Ask a parent or the studio admin.
      </p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
