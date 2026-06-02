import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SectionLabel from '@/components/shared/SectionLabel';
import AbsenceThread from '@/components/absence/AbsenceThread';
import { format } from 'date-fns';
import { Upload, X, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'text-gold bg-gold/10',
  approved: 'text-primary bg-primary/10',
  denied: 'text-terracotta bg-terracotta/10',
};

export default function ParentAbsence() {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    dancer_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    multiDay: false,
    reason: '',
    excused: false,
    document_url: '',
    class_ids: [],
  });

  const [expandedAbsence, setExpandedAbsence] = useState(null);
  const qc = useQueryClient();

  const { data: household } = useMyHousehold();

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ['allClasses'],
    queryFn: () => base44.entities.DanceClass.list(),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => base44.entities.ClassEnrollment.filter({ active: true }),
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['absences', household?.id],
    queryFn: () => base44.entities.AbsenceReport.filter({ household_id: household.id }),
    enabled: !!household?.id,
    select: d => [...d].sort((a, b) => b.start_date.localeCompare(a.start_date)),
  });

  const selectedDancer = dancers.find(d => d.id === form.dancer_id);
  const dancerEnrolledClassIds = enrollments
    .filter(e => e.dancer_id === form.dancer_id)
    .map(e => e.class_id);
  const dancerClasses = allClasses.filter(c => dancerEnrolledClassIds.includes(c.id));

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, document_url: file_url }));
    setUploading(false);
    toast.success('Document uploaded');
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ absence, text }) => {
      const newMsg = {
        from: 'family',
        sender_name: household?.primary_contact_name || 'Family',
        text,
        timestamp: new Date().toISOString(),
      };
      const existing = absence.messages || [];
      return base44.entities.AbsenceReport.update(absence.id, { messages: [...existing, newMsg] });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absences'] }); },
  });

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.AbsenceReport.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absences'] });
      toast.success('Absence reported');
      setShowForm(false);
      setForm({
        dancer_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
        multiDay: false,
        reason: '',
        excused: false,
        document_url: '',
        class_ids: [],
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.dancer_id || !form.start_date) {
      toast.error('Please select a dancer and start date');
      return;
    }
    submitMutation.mutate({
      dancer_id: form.dancer_id,
      household_id: household.id,
      start_date: form.start_date,
      end_date: form.multiDay ? form.end_date : form.start_date,
      reason: form.reason,
      excused: form.excused,
      document_url: form.document_url,
      class_ids: form.class_ids,
      status: 'pending',
    });
  };

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between pt-4 mb-4">
        <SectionLabel>Absences</SectionLabel>
        <Button
          size="sm"
          onClick={() => setShowForm(v => !v)}
          className="font-caps text-[10px] uppercase tracking-[0.12em]"
        >
          {showForm ? <X className="w-3 h-3 mr-1" /> : null}
          {showForm ? 'Cancel' : 'Report Absence'}
        </Button>
      </div>

      {/* Absence form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-4">
          <h3 className="font-body font-semibold text-sm text-foreground">Report an Absence</h3>

          {/* Dancer select */}
          <div>
            <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Dancer</Label>
            <select
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground"
              value={form.dancer_id}
              onChange={e => setForm(f => ({ ...f, dancer_id: e.target.value, class_ids: [] }))}
            >
              <option value="">Select dancer…</option>
              {dancers.map(d => (
                <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
              ))}
            </select>
          </div>

          {/* Multi-day toggle */}
          <div className="flex items-center justify-between">
            <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Multi-Day Absence</Label>
            <Switch
              checked={form.multiDay}
              onCheckedChange={v => setForm(f => ({ ...f, multiDay: v }))}
            />
          </div>

          {/* Dates */}
          <div className={`grid gap-3 ${form.multiDay ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">
                {form.multiDay ? 'Start Date' : 'Date'}
              </Label>
              <Input
                type="date"
                className="mt-1"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            {form.multiDay && (
              <div>
                <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">End Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Classes affected */}
          {dancerClasses.length > 0 && (
            <div>
              <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">
                Classes Affected <span className="normal-case opacity-60">(leave blank for all)</span>
              </Label>
              <div className="mt-2 space-y-1.5">
                {dancerClasses.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.class_ids.includes(c.id)}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          class_ids: e.target.checked
                            ? [...f.class_ids, c.id]
                            : f.class_ids.filter(id => id !== c.id),
                        }));
                      }}
                    />
                    <span className="text-xs text-foreground">{c.title}</span>
                    <span className="text-[10px] text-warm-gray">{DAY_NAMES[c.day_of_week]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Reason</Label>
            <textarea
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground min-h-[70px] resize-none"
              placeholder="Brief explanation…"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>

          {/* Excused toggle */}
          <div className="flex items-center justify-between">
            <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Requesting Excused Absence</Label>
            <Switch
              checked={form.excused}
              onCheckedChange={v => setForm(f => ({ ...f, excused: v }))}
            />
          </div>

          {/* Document upload */}
          <div>
            <Label className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray">Supporting Document</Label>
            {form.document_url ? (
              <div className="mt-1 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary">Document uploaded</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, document_url: '' }))} className="ml-auto text-warm-gray hover:text-terracotta">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-md px-3 py-2 hover:border-primary transition-colors">
                <Upload className="w-4 h-4 text-warm-gray" />
                <span className="text-xs text-muted-foreground">{uploading ? 'Uploading…' : 'Upload doctor note or document'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full font-caps text-xs uppercase tracking-[0.12em]" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting…' : 'Submit Absence Report'}
          </Button>
        </form>
      )}

      {/* Past absences */}
      <div className="space-y-3">
        {absences.length === 0 && !showForm && (
          <p className="text-center font-serif italic text-muted-foreground py-10">No absence reports yet</p>
        )}
        {absences.map(a => {
          const dancer = dancers.find(d => d.id === a.dancer_id);
          const isMulti = a.start_date !== a.end_date;
          const expanded = expandedAbsence === a.id;
          const msgCount = (a.messages || []).length;
          const hasStudioMsg = (a.messages || []).some(m => m.from === 'studio');

          return (
            <div key={a.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <button
                className="w-full text-left p-4 flex items-start justify-between gap-2"
                onClick={() => setExpandedAbsence(expanded ? null : a.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-body font-medium text-sm text-foreground">{dancer?.first_name} {dancer?.last_name}</p>
                    <span className={`font-caps text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded ${STATUS_COLORS[a.status]}`}>
                      {a.status}
                    </span>
                    <span className={`font-caps text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${a.excused ? 'text-primary bg-primary/10' : 'text-warm-gray bg-secondary'}`}>
                      {a.excused ? 'Excused' : 'Unexcused'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isMulti
                      ? `${format(new Date(a.start_date + 'T00:00'), 'MMM d')} – ${format(new Date(a.end_date + 'T00:00'), 'MMM d, yyyy')}`
                      : format(new Date(a.start_date + 'T00:00'), 'MMM d, yyyy')}
                  </p>
                  {hasStudioMsg && !expanded && (
                    <p className="text-[10px] text-primary mt-1">Studio replied · tap to view</p>
                  )}
                </div>
                <ChevronRight className={`w-4 h-4 text-warm-gray shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>

              {expanded && (
                <div className="border-t border-border p-4 space-y-3">
                  {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
                  {a.document_url && (
                    <a href={a.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary">
                      <FileText className="w-3 h-3" /> View Document
                    </a>
                  )}
                  <AbsenceThread
                    messages={a.messages || []}
                    role="family"
                    senderName={household?.primary_contact_name || 'Family'}
                    isSending={sendMessageMutation.isPending}
                    onSend={(text) => sendMessageMutation.mutate({ absence: a, text })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}