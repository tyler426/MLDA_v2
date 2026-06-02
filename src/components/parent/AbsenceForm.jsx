import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Shared "Report an Absence" form — used on the Absences screen AND the class sheet,
// so absence reporting is identical everywhere.
export default function AbsenceForm({ household, dancers = [], defaultDancerId = '', defaultClassIds = [], defaultDate, onDone }) {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    dancer_id: defaultDancerId || (dancers[0]?.id ?? ''),
    multiDay: false,
    start_date: defaultDate || today,
    end_date: defaultDate || today,
    reason: '',
    excused: false,
    document_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, document_url: file_url }));
      toast.success('Document uploaded');
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.dancer_id || !form.start_date) { toast.error('Select a dancer and date'); return; }
    setSaving(true);
    try {
      await base44.entities.AbsenceReport.create({
        dancer_id: form.dancer_id,
        household_id: household.id,
        start_date: form.start_date,
        end_date: form.multiDay ? form.end_date : form.start_date,
        class_ids: defaultClassIds,
        reason: form.reason,
        excused: form.excused,
        document_url: form.document_url,
        status: 'pending',
      });
      qc.invalidateQueries({ queryKey: ['absences'] });
      toast.success('Absence reported');
      onDone?.();
    } catch (err) { toast.error(err.message || 'Could not report absence'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Dancer</Label>
        <Select value={form.dancer_id} onValueChange={v => setForm({ ...form, dancer_id: v })}>
          <SelectTrigger className="bg-secondary border-border h-10"><SelectValue placeholder="Select dancer" /></SelectTrigger>
          <SelectContent>{dancers.map(d => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Multi-day absence</Label>
        <Switch checked={form.multiDay} onCheckedChange={v => setForm({ ...form, multiDay: v })} />
      </div>

      <div className={`grid ${form.multiDay ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1 block">{form.multiDay ? 'From' : 'Date'}</Label>
          <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="bg-secondary border-border h-10 w-full text-sm" />
        </div>
        {form.multiDay && (
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1 block">To</Label>
            <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="bg-secondary border-border h-10 w-full text-sm" />
          </div>
        )}
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Reason</Label>
        <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} placeholder="Brief explanation…"
          className="w-full bg-secondary border border-border rounded-xl p-3 text-sm outline-none resize-none" />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Requesting excused absence</Label>
        <Switch checked={form.excused} onCheckedChange={v => setForm({ ...form, excused: v })} />
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Supporting document</Label>
        {form.document_url ? (
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 h-10">
            <FileText className="w-4 h-4 text-teal-bright" /><span className="text-xs text-teal-bright">Document attached</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, document_url: '' }))} className="ml-auto text-muted-2 hover:text-terracotta"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-xl px-3 h-10 text-sm text-muted-foreground hover:border-primary">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload doctor note or document
            <input type="file" accept="image/*,application/pdf" onChange={upload} className="hidden" />
          </label>
        )}
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-primary text-[#06110f] font-bold rounded-2xl py-3">
        {saving ? 'Submitting…' : 'Submit absence report'}
      </Button>
    </form>
  );
}
