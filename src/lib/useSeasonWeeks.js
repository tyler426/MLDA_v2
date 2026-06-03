import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { weekStartStr } from '@/lib/scheduleUtils';

// Black/Teal week allocation. Each row maps a week-start (Sunday) → 'Black'|'Teal'.
// `weekTypeFor(date)` returns the allocated type for the week containing a date,
// or null when that week hasn't been allocated yet.
export function useSeasonWeeks() {
  const { data: rows = [] } = useQuery({
    queryKey: ['seasonWeeks'],
    queryFn: () => base44.entities.SeasonWeek.list(),
  });
  const map = new Map(rows.map(r => [r.week_start, r.week_type]));
  const weekTypeFor = (dateInput) => (dateInput ? map.get(weekStartStr(dateInput)) || null : null);
  return { rows, map, weekTypeFor };
}
