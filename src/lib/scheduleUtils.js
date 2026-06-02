import { format, startOfWeek, addDays, isToday, parseISO } from 'date-fns';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function getWeekDates() {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getTodayDow() {
  return new Date().getDay();
}

export function getLatestEndTime(classes) {
  if (!classes || classes.length === 0) return null;
  let latest = '00:00';
  for (const c of classes) {
    if (c.end_time > latest) latest = c.end_time;
  }
  return formatTime(latest);
}

export function isDancerPulled(dancerId, classId, date, exceptions) {
  return exceptions.some(
    e => e.type === 'dancer_pulled' && e.dancer_id === dancerId && e.class_id === classId && e.date === date
  );
}

export function isClassCancelled(classId, date, exceptions) {
  return exceptions.some(
    e => e.type === 'cancelled' && e.class_id === classId && e.date === date
  );
}

export function todayDateStr() {
  return format(new Date(), 'yyyy-MM-dd');
}