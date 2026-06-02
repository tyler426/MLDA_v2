import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { formatTime } from '@/lib/scheduleUtils';
import { X, Clock, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';

const STYLE_PALETTE = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function styleColor(s = '') { let n = 0; for (const c of s) n += c.charCodeAt(0); return STYLE_PALETTE[n % STYLE_PALETTE.length]; }

// Slide-up class detail sheet for parents: instructor + message, bring-to-class, report absence.
export default function ClassSheet({ cls, dancer, household, date, studios = [], teachers = [], onClose }) {
  const qc = useQueryClient();
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!cls) return null;
  const col = styleColor(cls.title);
  const studio = studios.find(s => s.id === cls.studio_id);
  const teacher = teachers.find(t => t.id === cls.teacher_id);
  const bring = cls.bring_items || [];

  const reportAbsence = async () => {
    const reason = window.prompt(`Report ${dancer?.first_name || 'your dancer'} absent from ${cls.title}. Reason (optional):`);
    if (reason === null) return;
    setBusy(true);
    try {
      await base44.entities.AbsenceReport.create({
        dancer_id: dancer.id, household_id: household.id,
        start_date: date, end_date: date, class_ids: [cls.id],
        reason: reason || 'Reported from class detail', status: 'pending',
      });
      qc.invalidateQueries({ queryKey: ['absences'] });
      toast.success(`${teacher ? teacher.first_name + ' notified — ' : ''}absence reported`);
      onClose();
    } catch (e) { toast.error(e.message || 'Could not report absence'); }
    finally { setBusy(false); }
  };

  const sendMessage = async () => {
    if (!msg.trim() || !teacher) return;
    setBusy(true);
    try {
      const thread = await base44.entities.MessageThread.create({
        household_id: household.id, teacher_id: teacher.id, subject: cls.title,
      });
      await base44.entities.Message.create({
        thread_id: thread.id, sender_role: 'family', body: msg.trim(),
      });
      toast.success(`Message sent to ${teacher.first_name}`);
      setMsg(''); setMsgOpen(false);
    } catch (e) { toast.error(e.message || 'Could not send'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
      <div className="w-full max-w-[440px] bg-card border border-border border-b-0 rounded-t-[28px] p-5 pb-7 max-h-[86%] overflow-y-auto animate-[fade_.25s_ease]" onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3" />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: col }} />
              <span className="text-[9.5px] tracking-[0.14em] uppercase" style={{ color: col }}>{cls.level || 'Class'}</span>
            </div>
            <div className="font-serif text-[28px] font-semibold mt-1.5">{cls.title}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 my-4">
          <div className="bg-secondary rounded-xl p-3">
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 flex items-center gap-1"><Clock className="w-3 h-3" />Time</div>
            <div className="font-serif text-[17px] mt-1">{formatTime(cls.start_time)}–{formatTime(cls.end_time)}</div>
          </div>
          <div className="bg-secondary rounded-xl p-3">
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 flex items-center gap-1"><MapPin className="w-3 h-3" />Studio</div>
            <div className="font-serif text-[17px] mt-1">{studio ? studio.name : '—'}</div>
          </div>
        </div>

        {teacher && (
          <div className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 mb-4">
            <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center font-serif text-[18px]" style={{ background: 'rgba(44,144,137,.16)', color: '#3aa89f' }}>{teacher.first_name[0]}</div>
            <div className="flex-1"><div className="text-[14px] font-semibold">{teacher.first_name} {teacher.last_name}</div><div className="text-[11.5px] text-muted-2">Instructor</div></div>
            <button onClick={() => setMsgOpen(v => !v)} className="bg-secondary border border-border rounded-full px-3.5 py-2 text-[12px]">Message</button>
          </div>
        )}

        {msgOpen && teacher && (
          <div className="flex gap-2 mb-4">
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder={`Message ${teacher.first_name}…`}
              className="flex-1 bg-secondary border border-border rounded-xl px-3 h-10 text-sm outline-none" />
            <button onClick={sendMessage} disabled={busy || !msg.trim()} className="bg-primary text-[#06110f] rounded-xl px-3.5 flex items-center"><Send className="w-4 h-4" /></button>
          </div>
        )}

        {bring.length > 0 && (
          <>
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 mb-2">Bring to class</div>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {bring.map((x, i) => <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">{x}</span>)}
            </div>
          </>
        )}

        <button onClick={reportAbsence} disabled={busy} className="w-full bg-primary text-[#06110f] rounded-2xl py-3.5 text-[14px] font-bold">
          Report an absence
        </button>
      </div>
    </div>
  );
}
