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
