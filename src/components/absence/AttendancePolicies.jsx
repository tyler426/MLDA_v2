import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, Calendar } from 'lucide-react';
import { format, endOfMonth, eachMonthOfInterval, subMonths, parseISO, isWithinInterval } from 'date-fns';

const UNEXCUSED_PROBATION_THRESHOLD = 2;

export default function AttendancePolicies({ dancers }) {
  const { data: allAttendance = [] } = useQuery({
    queryKey: ['allAttendanceAll'],
    queryFn: () => base44.entities.AttendanceRecord.list('-date', 1000),
  });

  // Year range: last 12 months
  const now = new Date();
  const yearStart = subMonths(now, 11);
  const months = eachMonthOfInterval({ start: yearStart, end: now });

  // Per-dancer stats
  const dancerStats = dancers.map(d => {
    const records = allAttendance.filter(r => r.dancer_id === d.id);
    const total = records.length;
    if (total === 0) return null;

    const unexcusedAbsences = records.filter(r => r.status === 'absent').length;
    const excusedAbsences = records.filter(r => r.status === 'excused').length;
    const lates = records.filter(r => r.status === 'late').length;
    const present = records.filter(r => r.status === 'present').length;
    const absentRate = Math.round(((unexcusedAbsences + excusedAbsences) / total) * 100);
    const onProbation = unexcusedAbsences >= UNEXCUSED_PROBATION_THRESHOLD;

    // Monthly breakdown
    const monthly = months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthRecords = records.filter(r => {
        const d = parseISO(r.date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      });
      return {
        label: format(monthStart, 'MMM'),
        total: monthRecords.length,
        absent: monthRecords.filter(r => r.status === 'absent').length,
        excused: monthRecords.filter(r => r.status === 'excused').length,
        late: monthRecords.filter(r => r.status === 'late').length,
      };
    }).filter(m => m.total > 0);

    return { dancer: d, total, unexcusedAbsences, excusedAbsences, lates, present, absentRate, onProbation, monthly };
  }).filter(Boolean).sort((a, b) => b.unexcusedAbsences - a.unexcusedAbsences);

  const onProbation = dancerStats.filter(s => s.onProbation);
  const atRisk = dancerStats.filter(s => !s.onProbation && s.unexcusedAbsences === UNEXCUSED_PROBATION_THRESHOLD - 1);

  return (
    <div className="space-y-6">
      {/* Policy reminder */}
      <div className="bg-secondary/50 border border-border rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-warm-gray shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Studio policy: <span className="text-foreground font-medium">{UNEXCUSED_PROBATION_THRESHOLD} unexcused absences</span> triggers probation review.
        </p>
      </div>

      {/* Probation */}
      {onProbation.length > 0 && (
        <div>
          <p className="font-caps text-[10px] uppercase tracking-[0.12em] text-terracotta mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> On Probation ({onProbation.length})
          </p>
          <div className="space-y-2">
            {onProbation.map(({ dancer, unexcusedAbsences, total, absentRate }) => (
              <DancerRow key={dancer.id} dancer={dancer} unexcused={unexcusedAbsences} total={total} rate={absentRate} level="danger" />
            ))}
          </div>
        </div>
      )}

      {/* At risk */}
      {atRisk.length > 0 && (
        <div>
          <p className="font-caps text-[10px] uppercase tracking-[0.12em] text-gold mb-2 flex items-center gap-1.5">
            <TrendingDown className="w-3 h-3" /> Approaching Limit ({atRisk.length})
          </p>
          <div className="space-y-2">
            {atRisk.map(({ dancer, unexcusedAbsences, total, absentRate }) => (
              <DancerRow key={dancer.id} dancer={dancer} unexcused={unexcusedAbsences} total={total} rate={absentRate} level="warning" />
            ))}
          </div>
        </div>
      )}

      {/* Full roster */}
      <div>
        <p className="font-caps text-[10px] uppercase tracking-[0.12em] text-warm-gray mb-3">All Dancers — Year Overview</p>
        {dancerStats.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No attendance data recorded yet.</p>
        )}
        <div className="space-y-3">
          {dancerStats.map(({ dancer, unexcusedAbsences, excusedAbsences, lates, present, total, onProbation, monthly }) => (
            <DancerYearCard
              key={dancer.id}
              dancer={dancer}
              unexcused={unexcusedAbsences}
              excused={excusedAbsences}
              lates={lates}
              present={present}
              total={total}
              onProbation={onProbation}
              monthly={monthly}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DancerRow({ dancer, unexcused, total, rate, level }) {
  const color = level === 'danger' ? 'text-terracotta' : 'text-gold';
  const bar = level === 'danger' ? 'bg-terracotta' : 'bg-gold';
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-body text-sm text-foreground">{dancer.first_name} {dancer.last_name}</p>
        <span className={`font-caps text-[11px] uppercase tracking-[0.1em] ${color}`}>
          {unexcused} unexcused
        </span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1">
        <div className={`h-1 rounded-full ${bar}`} style={{ width: `${Math.min((unexcused / 4) * 100, 100)}%` }} />
      </div>
      <p className="text-[10px] text-warm-gray mt-1">{total} classes tracked · {rate}% total absence rate</p>
    </div>
  );
}

function DancerYearCard({ dancer, unexcused, excused, lates, present, total, onProbation, monthly }) {
  const probationColor = onProbation ? 'border-terracotta/30' : unexcused === 1 ? 'border-gold/30' : 'border-border';
  return (
    <div className={`bg-card border rounded-lg p-3 ${probationColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-body font-medium text-sm text-foreground">{dancer.first_name} {dancer.last_name}</p>
          {dancer.level && <p className="font-caps text-[11px] uppercase tracking-[0.08em] text-warm-gray">{dancer.level}</p>}
        </div>
        {onProbation && (
          <span className="font-caps text-[11px] uppercase tracking-[0.1em] text-terracotta bg-terracotta/10 px-2 py-0.5 rounded">Probation</span>
        )}
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Present" value={present} color="text-primary bg-primary/10" />
        <Pill label="Unexcused" value={unexcused} color={unexcused >= 2 ? 'text-terracotta bg-terracotta/10' : unexcused === 1 ? 'text-gold bg-gold/10' : 'text-muted-foreground bg-muted'} />
        <Pill label="Excused" value={excused} color="text-muted-foreground bg-muted" />
        <Pill label="Late" value={lates} color="text-gold bg-gold/10" />
      </div>

      {/* Monthly breakdown */}
      {monthly.length > 0 && (
        <div>
          <p className="font-caps text-[11px] uppercase tracking-[0.08em] text-warm-gray mb-1.5 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" /> Monthly
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {monthly.map(m => (
              <div key={m.label} className="text-center">
                <div className="w-8 h-8 rounded-md bg-secondary flex items-end justify-center pb-1 relative overflow-hidden">
                  {m.total > 0 && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 rounded-md transition-all ${m.absent > 0 ? 'bg-terracotta/40' : 'bg-primary/30'}`}
                      style={{ height: `${Math.min((m.absent / m.total) * 100, 100)}%` }}
                    />
                  )}
                  <span className="relative font-display text-[11px] text-foreground">{m.absent}</span>
                </div>
                <p className="font-caps text-[8px] text-warm-gray mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, color }) {
  return (
    <span className={`font-caps text-[11px] uppercase tracking-[0.08em] px-2 py-0.5 rounded ${color}`}>
      {value} {label}
    </span>
  );
}