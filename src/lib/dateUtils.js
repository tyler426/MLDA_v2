import { format } from 'date-fns';

// Parse a date-only string ('YYYY-MM-DD') in LOCAL time.
// `new Date('2026-06-06')` parses as UTC midnight, which in a negative-offset
// timezone (e.g. Denver) renders as the previous day — this avoids that.
export function localDate(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Format a date-only string safely in local time.
export function fmtDate(value, pattern) {
  const d = localDate(value);
  return isNaN(d.getTime()) ? '' : format(d, pattern);
}

// US timezones a competition might be in.
export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

// Short, DST-aware timezone abbreviation (e.g. "EST"/"EDT") for a given zone + date.
export function tzAbbrev(timezone, dateValue) {
  if (!timezone) return '';
  try {
    const d = dateValue ? new Date(`${String(dateValue).slice(0, 10)}T12:00:00`) : new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(d);
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  } catch { return ''; }
}
