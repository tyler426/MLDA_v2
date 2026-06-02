import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatTime } from '@/lib/scheduleUtils';
import { format } from 'date-fns';

export default function AdminDigest() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sendTestEmail, setSendTestEmail] = useState('');

  const { data: households = [] } = useQuery({ queryKey: ['allParents'], queryFn: () => base44.entities.ParentHousehold.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }) });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });

  const todayDow = new Date().getDay();
  const todayStr = format(new Date(), 'EEEE, MMMM d');

  const buildDigest = (household) => {
    const householdDancers = dancers.filter(d => d.parent_household_id === household.id);
    const scheduleLines = [];

    for (const dancer of householdDancers) {
      const dancerEnrollments = enrollments.filter(e => e.dancer_id === dancer.id);
      const todayClasses = classes
        .filter(c => dancerEnrollments.some(e => e.class_id === c.id) && c.day_of_week === todayDow)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      if (todayClasses.length > 0) {
        scheduleLines.push(`\n${dancer.first_name}:`);
        for (const cls of todayClasses) {
          const studio = studios.find(s => s.id === cls.studio_id);
          const teacher = teachers.find(t => t.id === cls.teacher_id);
          scheduleLines.push(`  • ${cls.title} — ${formatTime(cls.start_time)}–${formatTime(cls.end_time)}${studio ? ` (Studio ${studio.name})` : ''}${teacher ? ` with ${teacher.first_name}` : ''}`);
        }
      }
    }

    return scheduleLines.length > 0 ? scheduleLines.join('\n') : null;
  };

  const previewDigest = () => {
    const sampleHousehold = households[0];
    if (!sampleHousehold) { toast.error('No households found'); return; }
    const lines = buildDigest(sampleHousehold);
    setPreview({
      to: sampleHousehold.email,
      subject: `MLDA Schedule Update — ${todayStr}`,
      body: lines || '(No classes scheduled today for this household)',
    });
  };

  const sendDigest = async () => {
    setSending(true);
    let count = 0;
    for (const household of households) {
      const lines = buildDigest(household);
      if (!lines) continue;
      await base44.integrations.Core.SendEmail({
        to: household.email,
        subject: `MLDA Schedule Update — ${todayStr}`,
        body: `Hi ${household.primary_contact_name},\n\nHere's your dancer schedule for today, ${todayStr}:\n${lines}\n\nSee you at the studio!\n— MLDA Collective`,
      });
      // Also save a notification record
      await base44.entities.ScheduleNotification.create({
        recipient_email: household.email,
        recipient_type: 'parent',
        type: 'daily_digest',
        title: `Daily Schedule — ${todayStr}`,
        message: lines.replace(/\n/g, ' ').slice(0, 200),
      });
      count++;
    }
    setSending(false);
    setSent(true);
    toast.success(`Daily digest sent to ${count} household${count !== 1 ? 's' : ''}`);
    setTimeout(() => setSent(false), 4000);
  };

  const sendTest = async () => {
    if (!sendTestEmail) { toast.error('Enter a test email'); return; }
    setSending(true);
    await base44.integrations.Core.SendEmail({
      to: sendTestEmail,
      subject: `[TEST] MLDA Schedule Update — ${todayStr}`,
      body: `This is a test digest email.\n\nIf you were a parent at MLDA Collective, you'd see your dancer's schedule for today here.\n\n— MLDA Collective Admin`,
    });
    setSending(false);
    toast.success('Test email sent');
  };

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[28px] font-semibold mb-6 -tracking-[0.01em]">Daily digest</h1>

      {/* Status card */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-body font-semibold text-sm text-foreground">Scheduled Send</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          The daily digest is automatically sent to all parents each morning via the scheduled automation. Each parent receives only their dancer's schedule for that day.
        </p>
        <div className="bg-primary/10 rounded-md px-3 py-2">
          <p className="text-xs text-primary font-medium">Auto-sends daily at 7:30 AM MT</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{households.length} households • {dancers.length} active dancers</p>
        </div>
      </div>

      {/* Manual send */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Send Now</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Immediately send today's schedule to all {households.length} households.
        </p>
        <Button
          onClick={sendDigest}
          disabled={sending || households.length === 0}
          className="w-full bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
          ) : sent ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Sent!</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Send Today's Digest</>
          )}
        </Button>
      </div>

      {/* Preview */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Preview</h3>
        <Button variant="outline" onClick={previewDigest} className="font-caps text-[10px] uppercase tracking-[0.12em] mb-3">
          Preview Sample Email
        </Button>
        {preview && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-secondary/50 rounded-md p-3 text-xs">
            <p className="text-warm-gray mb-1">To: {preview.to}</p>
            <p className="font-medium text-foreground mb-2">{preview.subject}</p>
            <pre className="text-muted-foreground whitespace-pre-wrap font-body text-[11px]">{preview.body}</pre>
          </motion.div>
        )}
      </div>

      {/* Test send */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Send Test</h3>
        <div className="flex gap-2">
          <Input
            type="email"
            value={sendTestEmail}
            onChange={e => setSendTestEmail(e.target.value)}
            placeholder="test@email.com"
            className="bg-secondary border-border flex-1"
          />
          <Button onClick={sendTest} disabled={sending} variant="outline" className="font-caps text-[10px] uppercase tracking-[0.12em] shrink-0">
            Send Test
          </Button>
        </div>
      </div>
    </div>
  );
}