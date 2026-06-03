import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import StudioLists from '@/components/admin/StudioLists';
import StudioRooms from '@/components/admin/StudioRooms';
import SeasonManager from '@/components/admin/SeasonManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Key, AlertTriangle, Trash2, Archive, FileDown, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { COMMON_TIMEZONES } from '@/lib/dateUtils';
import { format } from 'date-fns';

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [jackrabbitKey, setJackrabbitKey] = useState('');
  const [studioName, setStudioName] = useState('');
  const [studioLocation, setStudioLocation] = useState('');
  const [studioTimezone, setStudioTimezone] = useState('America/Denver');
  const [savingStudio, setSavingStudio] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setJackrabbitKey(u?.jackrabbit_api_key || '');
      setStudioName(u?.studio_name || 'MLDA Collective');
      setStudioLocation(u?.studio_location || '');
      setStudioTimezone(u?.studio_timezone || 'America/Denver');
      setNotificationsEnabled(u?.global_notifications_enabled === true);
    });
  }, []);

  const saveStudio = async () => {
    setSavingStudio(true);
    try {
      await base44.auth.updateMe({ studio_name: studioName.trim(), studio_location: studioLocation.trim(), studio_timezone: studioTimezone });
      toast.success('Studio details saved');
    } catch (e) { toast.error(e.message); }
    finally { setSavingStudio(false); }
  };

  const toggleNotifications = async (val) => {
    setNotificationsEnabled(val);
    await base44.auth.updateMe({ global_notifications_enabled: val });
    toast.success(val ? 'Notifications enabled — parents & teachers will now receive alerts' : 'Notifications paused — no alerts will be sent until re-enabled');
  };

  const handleReset = async (what) => {
    setResetting(true);
    try {
      const deleteAll = async (entityName) => {
        let records = await base44.entities[entityName].list();
        for (const r of records) await base44.entities[entityName].delete(r.id);
      };
      if (what === 'classes') {
        await deleteAll('DanceClass');
        await deleteAll('ClassEnrollment');
        await deleteAll('ScheduleException');
        await deleteAll('RehearsalBlock');
        toast.success('All classes, enrollments & rehearsals cleared');
      } else if (what === 'season') {
        // Keep Dancers, ParentHousehold, Teacher — clear everything else
        await deleteAll('DanceClass');
        await deleteAll('ClassEnrollment');
        await deleteAll('ScheduleException');
        await deleteAll('RehearsalBlock');
        await deleteAll('PieceCast');
        await deleteAll('Piece');
        await deleteAll('CompetitionShift');
        await deleteAll('CompetitionWeekend');
        await deleteAll('ScheduleNotification');
        toast.success('Season reset complete — rosters preserved');
      } else if (what === 'full') {
        await deleteAll('DanceClass');
        await deleteAll('ClassEnrollment');
        await deleteAll('ScheduleException');
        await deleteAll('RehearsalBlock');
        await deleteAll('PieceCast');
        await deleteAll('Piece');
        await deleteAll('CompetitionShift');
        await deleteAll('CompetitionWeekend');
        await deleteAll('ScheduleNotification');
        await deleteAll('Dancer');
        await deleteAll('ParentHousehold');
        toast.success('Full season reset complete');
      }
      setShowResetDialog(false);
      setResetConfirm('');
    } catch (e) {
      toast.error('Reset failed: ' + e.message);
    }
    setResetting(false);
  };

  const handleArchive = async (format_type) => {
    setArchiving(true);
    try {
      const [classes, enrollments, dancers, teachers, studios, pieces, pieceCasts, competitions] = await Promise.all([
        base44.entities.DanceClass.list(),
        base44.entities.ClassEnrollment.list(),
        base44.entities.Dancer.list(),
        base44.entities.Teacher.list(),
        base44.entities.Studio.list(),
        base44.entities.Piece.list(),
        base44.entities.PieceCast.list(),
        base44.entities.CompetitionWeekend.list(),
      ]);

      const seasonLabel = `MLDA_Season_${format(new Date(), 'yyyy-MM-dd')}`;

      if (format_type === 'json') {
        const archive = { exported_at: new Date().toISOString(), season: seasonLabel, classes, enrollments, dancers, teachers, studios, pieces, pieceCasts, competitions };
        const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${seasonLabel}.json`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Archive downloaded as JSON');
      } else if (format_type === 'pdf') {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        let y = 20;
        const line = (text, indent = 0) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(text, 14 + indent, y); y += 6;
        };

        doc.setFontSize(18); doc.text('MLDA Collective — Season Archive', 14, y); y += 10;
        doc.setFontSize(10); doc.text(`Exported: ${format(new Date(), 'PPP')}`, 14, y); y += 10;

        // Classes by day
        doc.setFontSize(13); line('Schedule');
        doc.setFontSize(9);
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        for (let d = 0; d <= 6; d++) {
          const dayCls = classes.filter(c => c.day_of_week === d);
          if (!dayCls.length) continue;
          doc.setFontSize(10); line(days[d]); doc.setFontSize(9);
          dayCls.sort((a,b) => a.start_time.localeCompare(b.start_time)).forEach(c => {
            const t = teachers.find(t => t.id === c.teacher_id);
            const s = studios.find(s => s.id === c.studio_id);
            line(`${c.start_time}–${c.end_time}  ${c.title} (${c.level||'—'})  Studio ${s?.name||'?'}  ${t ? t.first_name+' '+t.last_name : ''}`, 4);
          });
        }

        y += 6; doc.setFontSize(13); line('Dancers');
        doc.setFontSize(9);
        dancers.forEach(d => {
          line(`${d.first_name} ${d.last_name} — ${d.level||''} / ${d.program||''}`, 4);
        });

        y += 6; doc.setFontSize(13); line('Pieces');
        doc.setFontSize(9);
        pieces.forEach(p => {
          const cast = pieceCasts.filter(pc => pc.piece_id === p.id).map(pc => {
            const d = dancers.find(d => d.id === pc.dancer_id);
            return d ? `${d.first_name} ${d.last_name}` : '';
          }).filter(Boolean).join(', ');
          line(`${p.title} — Choreo: ${p.choreographer||'—'} — Cast: ${cast||'none'}`, 4);
        });

        doc.save(`${seasonLabel}.pdf`);
        toast.success('Archive saved as PDF');
      }
    } catch (e) {
      toast.error('Archive failed: ' + e.message);
    }
    setArchiving(false);
  };

  const saveSettings = async () => {
    await base44.auth.updateMe({ jackrabbit_api_key: jackrabbitKey });
    toast.success('Settings saved');
  };

  const RESET_LABELS = {
    classes: 'Clear Schedule',
    season: 'New Season Reset (Keep Rosters)',
    full: 'Full Season Reset',
  };
  const RESET_DESCRIPTIONS = {
    classes: 'This will permanently delete all classes, enrollments, rehearsal blocks, and schedule exceptions. Dancers and parents are preserved.',
    season: 'This will delete all classes, enrollments, rehearsals, pieces, competitions, and notifications — but keep all dancer and parent roster data.',
    full: 'This will permanently delete ALL classes, enrollments, rehearsals, pieces, piece casts, competitions, notifications, AND all dancer/parent records.',
  };

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[28px] font-semibold mb-6 -tracking-[0.01em]">Settings</h1>

      {/* Programs / Levels (editable) */}
      <div className="mb-6"><StudioLists /></div>

      {/* Season archive / reload */}
      <div className="mb-6"><SeasonManager /></div>

      {/* Studio info (editable) */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-body font-semibold text-sm text-foreground">Studio</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Studio name</Label>
            <Input value={studioName} onChange={e => setStudioName(e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Location</Label>
            <Input value={studioLocation} onChange={e => setStudioLocation(e.target.value)} placeholder="e.g. Centennial, Colorado" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Home timezone</Label>
            <Select value={studioTimezone} onValueChange={setStudioTimezone}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{COMMON_TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={saveStudio} disabled={savingStudio} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
            {savingStudio ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Rooms / Studios (moved here from the Roster) */}
      <div className="mb-6"><StudioRooms /></div>

      {/* Notifications Global Toggle */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-body font-semibold text-sm text-foreground">Notifications</h3>
          <span className={`ml-auto text-[10px] font-caps uppercase tracking-[0.15em] px-2 py-0.5 rounded ${notificationsEnabled ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
            {notificationsEnabled ? 'Live' : 'Paused'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          When paused, no email or push alerts are sent to parents or teachers — even when schedule changes occur. Enable only when the app is ready to go live.
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Send notifications to parents & teachers</Label>
          <Switch checked={notificationsEnabled} onCheckedChange={toggleNotifications} />
        </div>
      </div>

      {/* Jackrabbit integration */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-body font-semibold text-sm text-foreground">Jackrabbit Class</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Connect your Jackrabbit account to sync dancer rosters and class definitions. Org ID: 531472
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={jackrabbitKey}
              onChange={e => setJackrabbitKey(e.target.value)}
              placeholder="Paste your Jackrabbit API key"
              className="bg-secondary border-border"
            />
          </div>
          <Button onClick={saveSettings} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
            Save
          </Button>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="font-body font-semibold text-sm text-foreground mb-3">Brand</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-teal" />
            <span className="text-xs text-muted-foreground">Teal #1f7570</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gold" />
            <span className="text-xs text-muted-foreground">Gold #c8a464</span>
          </div>
        </div>
        <p className="mt-3 font-caps text-[10px] uppercase tracking-[0.2em] text-warm-gray">
          Lead · Support · Uplift · Inspire
        </p>
      </div>

      {/* Season Archive */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Archive className="w-4 h-4 text-gold" />
          <h3 className="font-body font-semibold text-sm text-foreground">Season Archive</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Export the full season data — classes, roster, pieces, and cast — before resetting.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={archiving}
            onClick={() => handleArchive('json')}
            className="flex-1 border-gold/40 text-gold hover:bg-gold/10 font-caps text-[10px] uppercase tracking-[0.12em] gap-1"
          >
            <FileDown className="w-3 h-3" />
            {archiving ? 'Exporting…' : 'JSON Backup'}
          </Button>
          <Button
            variant="outline"
            disabled={archiving}
            onClick={() => handleArchive('pdf')}
            className="flex-1 border-gold/40 text-gold hover:bg-gold/10 font-caps text-[10px] uppercase tracking-[0.12em] gap-1"
          >
            <FileDown className="w-3 h-3" />
            {archiving ? 'Exporting…' : 'PDF Report'}
          </Button>
        </div>
      </div>

      {/* New Season Reset */}
      <div className="bg-card border border-terracotta/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="w-4 h-4 text-terracotta" />
          <h3 className="font-body font-semibold text-sm text-terracotta">New Season Reset</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Start fresh for a new season. These actions are <strong className="text-foreground">permanent and cannot be undone.</strong>
        </p>
        <div className="space-y-2">
          <Button variant="outline" className="w-full border-terracotta/30 text-terracotta hover:bg-terracotta/10 font-caps text-[10px] uppercase tracking-[0.12em]"
            onClick={() => setShowResetDialog('classes')}>
            Clear Schedule Only
          </Button>
          <Button variant="outline" className="w-full border-terracotta/50 text-terracotta hover:bg-terracotta/10 font-caps text-[10px] uppercase tracking-[0.12em]"
            onClick={() => setShowResetDialog('season')}>
            New Season Reset (Keep Rosters)
          </Button>
          <Button variant="outline" className="w-full border-terracotta/70 text-terracotta hover:bg-terracotta/10 font-caps text-[10px] uppercase tracking-[0.12em]"
            onClick={() => setShowResetDialog('full')}>
            Full Reset (Everything)
          </Button>
        </div>
      </div>

      {/* Confirm Reset Dialog */}
      <Dialog open={!!showResetDialog} onOpenChange={v => { if (!v) { setShowResetDialog(false); setResetConfirm(''); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-terracotta">
              <AlertTriangle className="w-4 h-4" />
              {showResetDialog ? RESET_LABELS[showResetDialog] : ''}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {showResetDialog ? RESET_DESCRIPTIONS[showResetDialog] : ''}
          </p>
          <p className="text-xs text-foreground mt-2">Type <strong>RESET</strong> to confirm:</p>
          <Input
            value={resetConfirm}
            onChange={e => setResetConfirm(e.target.value)}
            placeholder="RESET"
            className="bg-secondary border-border"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowResetDialog(false); setResetConfirm(''); }}>Cancel</Button>
            <Button
              disabled={resetConfirm !== 'RESET' || resetting}
              onClick={() => handleReset(showResetDialog)}
              className="bg-terracotta hover:bg-terracotta/90 text-white font-caps text-[10px] uppercase tracking-[0.12em]"
            >
              {resetting ? 'Resetting…' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}