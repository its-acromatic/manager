const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ALIASES = new Map(MONTHS.flatMap((month, index) => [[month, index], [month.slice(0, 3), index]]));

export function toDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, count) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + count);
  return result;
}

function nearestMonthDay(month, day, now) {
  let year = now.getFullYear();
  let date = new Date(year, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    year += 1;
    date = new Date(year, month, day);
  }
  return date;
}

export function extractDate(input, now = new Date()) {
  const text = input.toLowerCase();
  let match;

  match = text.match(/\bnow\b/);
  if (match) return { date: toDateISO(now), matchedText: match[0], indicator: 'now', now: true };

  match = text.match(/\b(after|in)\s+(\d{1,3})\s+days?\b/);
  if (match) return { date: toDateISO(addDays(now, Number(match[2]))), matchedText: match[0], indicator: match[0] };

  match = text.match(/\bnext\s+week\b/);
  if (match) return { date: toDateISO(addDays(now, 7)), matchedText: match[0], indicator: 'next week' };

  match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    if (date.getFullYear() === year && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1])) {
      return { date: toDateISO(date), matchedText: match[0], indicator: match[0] };
    }
  }

  match = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/);
  if (match && MONTH_ALIASES.has(match[2])) {
    const date = nearestMonthDay(MONTH_ALIASES.get(match[2]), Number(match[1]), now);
    if (date) return { date: toDateISO(date), matchedText: match[0], indicator: match[0] };
  }

  match = text.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (match && MONTH_ALIASES.has(match[1])) {
    const date = nearestMonthDay(MONTH_ALIASES.get(match[1]), Number(match[2]), now);
    if (date) return { date: toDateISO(date), matchedText: match[0], indicator: match[0] };
  }

  match = text.match(/\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (match) {
    const target = WEEKDAYS.indexOf(match[2]);
    const current = now.getDay();
    let offset = (target - current + 7) % 7;
    if (match[1] === 'next') offset = offset || 7;
    const date = addDays(now, offset);
    return { date: toDateISO(date), matchedText: match[0], indicator: match[0] };
  }

  match = text.match(/\b(today|tomorrow|tomrrow|tonight)\b/);
  if (match) {
    const word = match[1];
    const offset = word === 'tomorrow' || word === 'tomrrow' ? 1 : 0;
    return { date: toDateISO(addDays(now, offset)), matchedText: match[0], indicator: word === 'tomrrow' ? 'tomorrow' : word };
  }

  return null;
}

function timeObject(hour, minute = 0, period = null, vague = false, ambiguous = false) {
  let normalizedHour = hour;
  if (period === 'pm' && hour < 12) normalizedHour += 12;
  if (period === 'am' && hour === 12) normalizedHour = 0;
  if (normalizedHour < 0 || normalizedHour > 23 || minute < 0 || minute > 59) return null;
  return { hour: normalizedHour, minute, period: null, vague, ambiguous };
}

export function extractTime(input, allowBareHour = false) {
  const text = input.toLowerCase();
  let match = text.match(/\b(noon|midnight)\b/);
  if (match) return { time: timeObject(match[1] === 'noon' ? 12 : 0), matchedText: match[0], indicator: match[0] };

  match = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/);
  if (match) {
    const hour = Number(match[1]);
    if (hour < 1 || hour > 12) return null;
    const time = timeObject(hour, Number(match[2] || 0), match[3]);
    return time ? { time, matchedText: match[0], indicator: match[0] } : null;
  }

  match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match) {
    const time = timeObject(Number(match[1]), Number(match[2]));
    return time ? { time, matchedText: match[0], indicator: match[0] } : null;
  }

  match = text.match(/\b(\d{1,2})\s+(?:(?:in|at)\s+(?:the\s+)?)?(morning|afternoon|evening|night)\b/);
  if (match) {
    let hour = Number(match[1]);
    if (hour < 1 || hour > 12) return null;
    const period = match[2] === 'morning' ? 'am' : 'pm';
    const time = timeObject(hour, 0, period);
    return time ? { time, matchedText: match[0], indicator: match[0] } : null;
  }

  match = text.match(/\b(\d{1,2})\s+o'?clock\b/);
  if (match) {
    const hour = Number(match[1]);
    if (hour > 23) return null;
    const time = timeObject(hour, 0, null, false, hour <= 12);
    return time ? { time, matchedText: match[0], indicator: match[0] } : null;
  }

  match = text.match(/\b(morning|afternoon|evening|night)\b/);
  if (match) {
    const hour = { morning: 9, afternoon: 14, evening: 18, night: 21 }[match[1]];
    return { time: timeObject(hour, 0, null, true), matchedText: match[0], indicator: match[1] };
  }

  if (allowBareHour) {
    match = text.match(/\bat\s+(\d{1,2})\b/) || text.match(/\b(\d{1,2})\s*$/);
    if (match) {
      const hour = Number(match[1]);
      if (hour <= 23) {
        const time = timeObject(hour, 0, null, false, hour <= 12);
        return time ? { time, matchedText: match[0], indicator: match[0] } : null;
      }
    }
  }
  return null;
}

export function toScheduledDateTime(date, time) {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const scheduled = new Date(year, month - 1, day, time.hour, time.minute, 0, 0);
  if (scheduled.getFullYear() !== year || scheduled.getMonth() !== month - 1 || scheduled.getDate() !== day) return null;
  return scheduled.toISOString();
}

export function formatTime(time) {
  if (!time) return '';
  const hour = Number(time.hour);
  const minute = Number(time.minute || 0);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatDate(dateString, now = new Date()) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: year === now.getFullYear() ? undefined : 'numeric' });
}