import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SignedDocLink from '@/components/shared/SignedDocLink';
import AbsenceThread from '@/components/absence/AbsenceThread';
import AttendancePolicies from '@/components/absence/AttendancePolicies';
import { format, parseISO } from 'date-fns';
import { Check, X, FileText, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_STYLE = {
  present: 'bg-primary/10 text-primary',
  absent: 'bg-terracotta/10 text-terracotta',
  late: 'bg-gold/10 text-gold',
  excused: 'bg-muted text-muted-foreground',
};
const ABSENCE_STATUS = {
  pending: 'bg-gold/10 text-gold',
  approved: 'bg-primary/10 text-primary',
  denied: 'bg-terracotta/10 text-terracotta',
};

const TABS = ['Absence Reports', 'Attendance Log', 'Policies'];

export default function AdminAttendance() {
  const [tab, setTab] = useState('Absence Reports');
  const [expandedAbsence, setExpandedAbsence] = useState(null);
  const [filterClass, setFilterClass] = useState('');
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const qc = useQueryClient();

  const { data: absences = [] } = useQuery({
    queryKey: ['allAbsences'],
    queryFn: () => base44.entities.AbsenceReport.list(),
    select: d => [...d].sort((a, b) => b.start_date.localeCompare(a.start_date)),
  });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: households = [] } = useQuery({ queryKey: ['allHouseholds'], queryFn: () => base44.entities.ParentHousehold.list() });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', filterDate, filterClass],
    queryFn: () => filterClass
      ? base44.entities.AttendanceRecord.filter({ date: filterDate, class_id: filterClass })
      : base44.entities.AttendanceRecord.filter({ date: filterDate }),
  });

  const updateAbsenceMutation = useMutation({
    mutationFn: (updates) => base44.entities.AbsenceReport.update(updates.id, updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allAbsences'] }); toast.success('Updated'); },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ absence, text }) => {
      const newMsg = {
        from: 'studio',
        sender_name: 'Studio',
        text,
        timestamp: new Date().toISOString(),
      };
      const existing = absence.messages || [];
      return base44.entities.AbsenceReport.update(absence.id, { messages: [...existing, newMsg] });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allAbsences'] }); },
  });

  const pendingCount = absences.filter(a => a.status === 'pending').length;
  const stats = {
    present: attendance.filter(r => r.status === 'present').length,
    absent: attendance.filter(r => r.status === 'absent').length,
    late: attendance.filter(r => r.status === 'late').length,
    excused: attendance.filter(r => r.status === 'excused').length,
  };

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <h1 className="font-serif text-[28px] font-semibold mb-4 -tracking-[0.01em]">Attendance</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-2 font-caps text-[10px] uppercase tracking-[0.12em] transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
            {t === 'Absence Reports' && pendingCount > 0 && (
              <span className="ml-1.5 bg-gold/20 text-gold text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ABSENCE REPORTS */}
      {tab === 'Absence Reports' && (
        <div className="space-y-3">
          {absences.length === 0 && (
            <p className="text-center font-serif italic text-muted-foreground py-10">No absence reports</p>
          )}
          {absences.map(a => {
            const dancer = dancers.find(d => d.id === a.dancer_id);
            const household = households.find(h => h.id === a.household_id);
            const isMulti = a.start_date !== a.end_date;
            const expanded = expandedAbsence === a.id;
            const msgCount = (a.messages || []).length;
            const unreadFromFamily = (a.messages || []).filter(m => m.from === 'family').length;

            return (
              <div key={a.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start justify-between gap-2"
                  onClick={() => setExpandedAbsence(expanded ? null : a.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-body font-medium text-sm text-foreground">
                        {dancer?.first_name} {dancer?.last_name}
                      </p>
                      <span className={`font-caps text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${ABSENCE_STATUS[a.status]}`}>
                        {a.status}
                      </span>
                      <span className={`font-caps text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${a.excused ? 'text-primary bg-primary/10' : 'text-warm-gray bg-secondary'}`}>
                        {a.excused ? 'Excused' : 'Unexcused'}
                      </span>
                      {msgCount > 0 && (
                        <span className="font-caps text-[9px] text-warm-gray">{msgCount} msg{msgCount > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isMulti
                        ? `${format(parseISO(a.start_date), 'MMM d')} – ${format(parseISO(a.end_date), 'MMM d')}`
                        : format(parseISO(a.start_date), 'MMM d, yyyy')}
                      {household && ` · ${household.primary_contact_name}`}
                    </p>
                    {a.reason && <p className="text-xs text-warm-gray mt-1 line-clamp-1">{a.reason}</p>}
                  </div>
                  <ChevronRight className={`w-4 h-4 text-warm-gray shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>

                {expanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Details */}
                    {a.reason && (
                      <div>
                        <p className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray mb-1">Reason</p>
                        <p className="text-sm text-foreground">{a.reason}</p>
                      </div>
                    )}
                    {a.document_url && (
                      <SignedDocLink path={a.document_url} className="flex items-center gap-1.5 text-xs text-primary">
                        <FileText className="w-3.5 h-3.5" /> View Document
                      </SignedDocLink>
                    )}
                    {a.class_ids?.length > 0 && (
                      <div>
                        <p className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray mb-1">Classes Affected</p>
                        <div className="flex flex-wrap gap-1">
                          {a.class_ids.map(cid => {
                            const cls = allClasses.find(c => c.id === cid);
                            return cls ? <span key={cid} className="bg-secondary text-xs px-2 py-0.5 rounded">{cls.title}</span> : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Admin controls */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Status */}
                      <div>
                        <p className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray mb-1.5">Decision</p>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => updateAbsenceMutation.mutate({ id: a.id, status: 'approved' })}
                            disabled={updateAbsenceMutation.isPending || a.status === 'approved'}
                            className="flex-1 font-caps text-[9px] uppercase tracking-[0.08em] h-7 px-2"
                          >
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAbsenceMutation.mutate({ id: a.id, status: 'denied' })}
                            disabled={updateAbsenceMutation.isPending || a.status === 'denied'}
                            className="flex-1 font-caps text-[9px] uppercase tracking-[0.08em] h-7 px-2 border-terracotta/40 text-terracotta hover:bg-terracotta/10"
                          >
                            <X className="w-3 h-3 mr-1" /> Deny
                          </Button>
                        </div>
                      </div>

                      {/* Excused toggle */}
                      <div>
                        <p className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray mb-1.5">Excused Status</p>
                        <button
                          onClick={() => updateAbsenceMutation.mutate({ id: a.id, excused: !a.excused })}
                          disabled={updateAbsenceMutation.isPending}
                          className={`w-full flex items-center justify-center gap-1.5 h-7 rounded-md font-caps text-[9px] uppercase tracking-[0.08em] border transition-colors ${
                            a.excused
                              ? 'bg-primary/10 text-primary border-primary/30 hover:bg-terracotta/10 hover:text-terracotta hover:border-terracotta/30'
                              : 'bg-secondary text-warm-gray border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                          }`}
                        >
                          {a.excused ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          {a.excused ? 'Excused' : 'Unexcused'}
                        </button>
                      </div>
                    </div>

                    {/* Message thread */}
                    <div className="border-t border-border pt-3">
                      <AbsenceThread
                        messages={a.messages || []}
                        role="studio"
                        senderName="Studio"
                        isSending={sendMessageMutation.isPending}
                        onSend={(text) => sendMessageMutation.mutate({ absence: a, text })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ATTENDANCE LOG */}
      {tab === 'Attendance Log' && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            <select
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {attendance.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Object.entries(stats).map(([s, count]) => (
                <div key={s} className={`rounded-lg p-2 text-center ${STATUS_STYLE[s]}`}>
                  <p className="font-display text-xl">{count}</p>
                  <p className="font-caps text-[9px] uppercase tracking-[0.1em]">{s}</p>
                </div>
              ))}
            </div>
          )}

          {attendance.length === 0 ? (
            <p className="text-center font-serif italic text-muted-foreground py-10">No attendance taken for this date</p>
          ) : (
            <div className="space-y-2">
              {attendance.map(r => {
                const dancer = dancers.find(d => d.id === r.dancer_id);
                const cls = allClasses.find(c => c.id === r.class_id);
                return (
                  <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-body text-sm text-foreground">{dancer?.first_name} {dancer?.last_name}</p>
                      {cls && <p className="text-[10px] text-warm-gray">{cls.title}</p>}
                    </div>
                    <span className={`font-caps text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POLICIES */}
      {tab === 'Policies' && <AttendancePolicies dancers={dancers} />}
    </div>
  );
}