import { DollarSign } from 'lucide-react';

export default function AdminBilling() {
  return (
    <div className="animate-[fade_.3s_ease]">
      <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">Billing</div>
      <h1 className="font-serif text-[30px] font-semibold mt-1.5">Revenue &amp; balances</h1>

      <div className="bg-card border border-border rounded-2xl p-10 mt-6 text-center max-w-xl">
        <DollarSign className="w-9 h-9 text-gold mx-auto mb-3" />
        <h2 className="font-serif text-xl mb-2">Coming soon</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The studio is transitioning billing software, so this is parked for now.
          Once the new system is chosen, this becomes a read-only ledger — family balances,
          outstanding invoices, and revenue roll-ups synced from that provider.
          No card processing happens here.
        </p>
      </div>
    </div>
  );
}
