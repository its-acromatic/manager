// In-memory map of notification timers
const timers = new Map();

export function clearAll() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
}

export function loadScheduledToMemory() {
  // Firestore schedules are loaded directly from persisted item data.
}

export function schedule(item) {
  if (!item || !item.id || !item.ts) return;
  const now = Date.now();
  const when = typeof item.ts === 'string' ? Date.parse(item.ts) : item.ts;
  if (Number.isNaN(when)) return;
  const delay = Math.max(0, when - now);

  // Replace any existing timer for the same schedule id.
  if (timers.has(item.id)) {
    clearTimeout(timers.get(item.id));
    timers.delete(item.id);
  }

  const t = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('manager:notification:trigger', { detail: item }));
    timers.delete(item.id);
  }, delay);

  timers.set(item.id, t);
}

export function cancel(id) {
  if (!timers.has(id)) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
}

export function persistSchedule(item) {
  schedule(item);
}
