export function parseISOToLocalDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatLocalISO(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISOToLocalDate(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(iso, days = 1) {
  const date = parseISOToLocalDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + Number(days));
  return formatLocalISO(date);
}

export function compareISODate(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isSameISODate(a, b) {
  return a === b;
}

export function todayISO() {
  return formatLocalISO(new Date());
}
