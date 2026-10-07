// Pure helpers for presenting events. Event times are stored as local
// "YYYY-MM-DD HH:MM" strings (not UTC), so they are parsed as local time.

export function parseEventDate(value) {
  if (!value) return null;
  const [datePart, timePart] = String(value).trim().split(/[ T]/);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (timePart || '').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

const hasTime = (value) => /[ T]\d{1,2}:\d{2}/.test(String(value || ''));

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function formatEventDate(event) {
  const start = parseEventDate(event.start_date);
  const end = parseEventDate(event.end_date);
  if (!start) return 'Date to be announced';
  const day = { weekday: 'short', month: 'short', day: 'numeric' };
  if (!end || sameDay(start, end)) return start.toLocaleDateString(undefined, day);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.getDate()}`
    : `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function formatEventTime(event) {
  const start = parseEventDate(event.start_date);
  const end = parseEventDate(event.end_date);
  const t = { hour: 'numeric', minute: '2-digit' };
  if (!start || !hasTime(event.start_date)) return '';
  const startText = start.toLocaleTimeString(undefined, t);
  return end && hasTime(event.end_date) ? `${startText} – ${end.toLocaleTimeString(undefined, t)}` : startText;
}

// Where an event sits right now; an explicit organizer-set status wins over dates.
export function eventTiming(event, now = new Date()) {
  const status = (event.status || '').toLowerCase();
  if (status === 'completed') return 'past';
  if (status === 'active') return 'live';
  if (status === 'upcoming') return 'upcoming';
  const start = parseEventDate(event.start_date);
  const end = parseEventDate(event.end_date) || start;
  if (end && end < now) return 'past';
  if (start && start <= now) return 'live';
  return 'upcoming';
}

const byStart = (a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999');

// Featured: an event marked featured (soonest not-yet-finished first);
// otherwise the next upcoming event, then a live one, then the most recent.
export function pickFeatured(events, now = new Date()) {
  if (!events.length) return null;
  const notPast = (e) => eventTiming(e, now) !== 'past';
  const featured = events.filter((e) => e.is_featured).sort(byStart);
  if (featured.length) return featured.find(notPast) || featured[0];
  const sorted = [...events].sort(byStart);
  return (
    sorted.find((e) => eventTiming(e, now) === 'upcoming') ||
    sorted.find((e) => eventTiming(e, now) === 'live') ||
    sorted[sorted.length - 1]
  );
}

export function groupEventsByTiming(events, now = new Date()) {
  const groups = { live: [], upcoming: [], past: [] };
  [...events].sort(byStart).forEach((e) => groups[eventTiming(e, now)].push(e));
  groups.past.reverse(); // most recent first
  return groups;
}

export function volunteerProgress(event) {
  const target = event.volunteer_target || 0;
  const assigned = event.volunteers_assigned || 0;
  return { assigned, target, pct: target > 0 ? Math.min(100, Math.round((assigned / target) * 100)) : 0 };
}

export const STATUS_LABEL = { live: 'Live', upcoming: 'Upcoming', past: 'Completed' };
