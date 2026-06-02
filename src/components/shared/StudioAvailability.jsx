import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatTime } from '@/lib/scheduleUtils';

// Returns minutes since midnight
function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function timeAddHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Visual hours range: 8am–10pm
const RANGE_START = 8 * 60;  // 480
const RANGE_END   = 22 * 60; // 1320
const RANGE_TOTAL = RANGE_END - RANGE_START;

function pct(minutes) {
  return ((Math.max(RANGE_START, Math.min(RANGE_END, minutes)) - RANGE_START) / RANGE_TOTAL) * 100;
}

function BlockBar({ label, start, end, color }) {
  const left = pct(toMinutes(start));
  const right = pct(toMinutes(end));
  const width = Math.max(right - left, 1);
  return (
    <div
      className={`absolute top-0 h-full rounded-sm flex items-center px-1 overflow-hidden ${color}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${label}: ${formatTime(start)}–${formatTime(end)}`}
    >
      <span className="text-[8px] font-caps uppercase tracking-wide truncate leading-none">{label}</span>
    </div>
  );
}

// Hour tick marks
const TICKS = [];
for (let h = 8; h <= 22; h += 2) TICKS.push(h);

/**
 * StudioAvailability
 * Props:
 *   date         - YYYY-MM-DD string
 *   startTime    - HH:MM (the proposed start)
 *   endTime      - HH:MM (the proposed end)
 *   selectedStudioId - currently selected studio (optional highlight)
 *   dayOfWeek    - number (0-6), for recurring class lookup (optional)
 */
export default function StudioAvailability({ date, startTime, endTime, selectedStudioId, dayOfWeek }) {
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: bookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list() });
  const { data: rehearsals = [] } = useQuery({ queryKey: ['rehearsals'], queryFn: () => base44.entities.RehearsalBlock.list() });
  const { data: classes = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });

  if (!date) return null;

  const dow = dayOfWeek ?? new Date(date + 'T12:00:00').getDay();

  // Build per-studio blocks
  const studioBlocks = {};
  studios.forEach(s => { studioBlocks[s.id] = []; });

  // Space bookings on this date
  bookings.filter(b => b.date === date && b.studio_id).forEach(b => {
    if (!studioBlocks[b.studio_id]) studioBlocks[b.studio_id] = [];
    const end = b.end_time || (b.start_time && b.duration_hours ? timeAddHours(b.start_time, b.duration_hours) : '');
    studioBlocks[b.studio_id].push({ label: b.type === 'private' ? 'Private' : 'Rehearsal', start: b.start_time, end, color: 'bg-terracotta/60 text-white' });
  });

  // RehearsalBlocks on this date
  rehearsals.filter(r => r.date === date && r.studio_id).forEach(r => {
    if (!studioBlocks[r.studio_id]) studioBlocks[r.studio_id] = [];
    studioBlocks[r.studio_id].push({ label: 'Rehearsal', start: r.start_time, end: r.end_time, color: 'bg-gold/50 text-black' });
  });

  // Recurring classes on same day of week (and one-time classes on this date)
  classes.forEach(c => {
    if (!c.studio_id) return;
    const isToday = c.one_time_date === date;
    const isRecurring = !c.one_time_date && c.day_of_week === dow;
    if (!isToday && !isRecurring) return;
    if (!studioBlocks[c.studio_id]) studioBlocks[c.studio_id] = [];
    studioBlocks[c.studio_id].push({ label: c.title, start: c.start_time, end: c.end_time, color: 'bg-primary/50 text-white' });
  });

  // Proposed block
  const hasProposed = startTime && endTime;

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
      <p className="font-caps text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Studio Availability — {date}</p>

      {/* Hour ruler */}
      <div className="relative h-4 mb-1">
        {TICKS.map(h => (
          <span
            key={h}
            className="absolute top-0 text-[8px] text-muted-foreground font-caps"
            style={{ left: `${pct(h * 60)}%`, transform: 'translateX(-50%)' }}
          >
            {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
          </span>
        ))}
      </div>

      {studios.map(studio => {
        const blocks = studioBlocks[studio.id] || [];
        const isSelected = selectedStudioId === studio.id;
        return (
          <div key={studio.id} className={`flex items-center gap-2 ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
            <span className={`font-caps text-[9px] uppercase tracking-[0.15em] w-12 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-warm-gray'}`}>
              {studio.name}
            </span>
            <div className="relative flex-1 h-5 bg-secondary/50 rounded-sm overflow-hidden border border-border/50">
              {/* Proposed time highlight */}
              {hasProposed && (
                <div
                  className="absolute top-0 h-full bg-green-500/20 border-l border-r border-green-500/60"
                  style={{ left: `${pct(toMinutes(startTime))}%`, width: `${Math.max(pct(toMinutes(endTime)) - pct(toMinutes(startTime)), 1)}%` }}
                />
              )}
              {blocks.map((b, i) => (
                <BlockBar key={i} {...b} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-3 pt-1">
        <LegendDot color="bg-primary/50" label="Class" />
        <LegendDot color="bg-gold/50" label="Rehearsal" />
        <LegendDot color="bg-terracotta/60" label="Booking" />
        {hasProposed && <LegendDot color="bg-green-500/40 border border-green-500/60" label="Proposed" />}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[9px] font-caps uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
    </div>
  );
}