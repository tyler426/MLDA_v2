import { Megaphone } from 'lucide-react';

// Phase 3 will make this a real broadcast composer (targets families/company/comp team,
// posts to notifications + sends email via the send-email edge function).
export default function AdminComms() {
  return (
    <div className="animate-[fade_.3s_ease]">
      <div className="text-[10px] tracking-[0.24em] uppercase text-gold font-semibold">Communications</div>
      <h1 className="font-serif text-[30px] font-semibold mt-1.5">Send a broadcast</h1>

      <div className="bg-card border border-border rounded-2xl p-10 mt-6 text-center max-w-xl">
        <Megaphone className="w-9 h-9 text-teal-bright mx-auto mb-3" />
        <h2 className="font-serif text-xl mb-2">Wiring up in Phase 3</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Broadcast composer — target All families / Company / Competition team / Petite,
          delivered to each recipient's in-app inbox and email. Being built next.
        </p>
      </div>
    </div>
  );
}
