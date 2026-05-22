import {
  parseISOToLocalDate,
  formatLocalISO,
  addDaysISO,
  todayISO
} from '../utils/date.js';

// Attendance engine: session handling, working-day generation, prediction, safe leaves
export const DayStatus = {
  PRESENT: 'present',
  ABSENT: 'absent',
  OFF: 'off',
  HOLIDAY: 'holiday',
  VACATION: 'vacation',
  UNMARKED: 'unmarked'
};

function toISO(d) {
  return formatLocalISO(d);
}

export function normalizeStatus(status) {
  return typeof status === 'string' ? status.toLowerCase() : null;
}

export function countAttendanceRecords(records = []) {
  const counts = {
    present: 0,
    absent: 0,
    off: 0,
    holiday: 0,
    vacation: 0,
    unmarked: 0,
    unknown: 0
  };

  records.forEach((record) => {
    const status = normalizeStatus(record?.status);
    if (status && Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    } else {
      counts.unknown += 1;
    }
  });

  counts.totalWorking = counts.present + counts.absent;
  counts.totalPotential = counts.present + counts.absent + counts.unmarked;
  return counts;
}

export function calculateAttendancePercent(attended, total) {
  if (!total || total === 0) return 0;
  return Number(((attended / total) * 100).toFixed(2));
}

export function generateSessionDates(startISO, endISO) {
  const start = parseISOToLocalDate(startISO);
  const end = parseISOToLocalDate(endISO);
  if (!start || !end) return [];

  const res = [];
  let current = formatLocalISO(start);
  while (current && current <= formatLocalISO(end)) {
    res.push(current);
    current = addDaysISO(current, 1);
  }
  return res;
}

function isSaturday(d) { return d.getDay() === 6; }
function isSunday(d) { return d.getDay() === 0; }

function weekIndexInMonth(d) {
  // 1-based week index for this weekday in the month
  let count = 0;
  for (let i = 1; i <= d.getDate(); i += 1) {
    const current = new Date(d.getFullYear(), d.getMonth(), i);
    if (current.getDay() === d.getDay()) count += 1;
  }
  return count;
}

export function isSecondOrFourthSaturdayISO(iso) {
  const d = parseISOToLocalDate(iso);
  if (!d || !isSaturday(d)) return false;
  return weekIndexInMonth(d) === 2 || weekIndexInMonth(d) === 4;
}

export function defaultStatusForDateISO(iso) {
  const d = parseISOToLocalDate(iso);
  if (!d) return DayStatus.UNMARKED;
  if (isSunday(d)) return DayStatus.OFF;
  if (isSaturday(d) && isSecondOrFourthSaturdayISO(iso)) return DayStatus.OFF;
  return DayStatus.UNMARKED;
}

// Generate an array of day objects for the session. ExistingOverrides is a map { dateISO: { status, ...meta } }
export function generateSessionDayObjects(sessionStartISO, sessionEndISO, existingOverrides = {}) {
  const dates = generateSessionDates(sessionStartISO, sessionEndISO);
  return dates.map(date => {
    if(existingOverrides && existingOverrides[date]) {
      return { date, status: existingOverrides[date].status, meta: existingOverrides[date].meta || {} };
    }
    return { date, status: defaultStatusForDateISO(date), meta: {} };
  });
}

export function mergeExistingRecords(sessionDays, existingRecordsMap) {
  // existingRecordsMap: { date: { status, meta } }
  const map = Object.assign({}, existingRecordsMap || {});
  return sessionDays.map(d => {
    if(map[d.date]) return { date: d.date, status: map[d.date].status, meta: map[d.date].meta || {} };
    return d;
  });
}

export function applyManualMark(sessionDays, dateISO, status, meta = {}) {
  return sessionDays.map(d => d.date === dateISO ? { date: d.date, status, meta } : d);
}

export function bulkMarkRange(sessionDays, startISO, endISO, status, meta = {}) {
  const s = parseISOToLocalDate(startISO);
  const e = parseISOToLocalDate(endISO);
  return sessionDays.map(d => {
    const cur = parseISOToLocalDate(d.date);
    if (s && e && cur && cur >= s && cur <= e) return { date: d.date, status, meta };
    return d;
  });
}

export function isWorkingStatus(status) {
  // Working days counted in totals are only PRESENT or ABSENT
  return status === DayStatus.PRESENT || status === DayStatus.ABSENT;
}

export function isPotentialWorkingDay(status) {
  // Potential working days are any day that is not OFF/HOLIDAY/VACATION
  return status !== DayStatus.OFF && status !== DayStatus.HOLIDAY && status !== DayStatus.VACATION;
}

export function filterWorkingDays(sessionDays, opts = {}) {
  // opts: { uptoISO?:string } - if provided, only include days <= uptoISO
  const upto = opts.uptoISO ? parseISOToLocalDate(opts.uptoISO) : null;
  return sessionDays.filter(d => {
    const cur = parseISOToLocalDate(d.date);
    if (!cur) return false;
    if (upto && cur > upto) return false;
    return isWorkingStatus(d.status);
  });
}

export function calculateAttendanceFromSession(sessionDays, opts = {}) {
  // opts: { uptoISO?:string, treatUnmarkedAsAbsent:false }
  const uptoISO = opts.uptoISO || todayISO();
  const treatUnmarkedAsAbsent = opts.treatUnmarkedAsAbsent === true; // default false
  const working = filterWorkingDays(sessionDays, { uptoISO });
  let totalWorking = working.length;
  let present = 0;
  working.forEach(d => {
    if (d.status === DayStatus.PRESENT) present++;
    else if (d.status === DayStatus.UNMARKED) {
      if (treatUnmarkedAsAbsent) {
        // count as absent implicitly (present not incremented)
      } else {
        // exclude from totals
        totalWorking--;
      }
    }
  });
  const percent = totalWorking === 0 ? 0 : Number(((present / totalWorking) * 100).toFixed(2));
  return { present, totalWorking, percent };
}

export function predictFinalAttendance(sessionDays, opts = {}) {
  // opts: { asOfISO?:string, treatUnmarkedAsAbsent:true }
  const asOfISO = opts.asOfISO || todayISO();
  const asOfDate = parseISOToLocalDate(asOfISO);
  const treatUnmarkedAsAbsent = opts.treatUnmarkedAsAbsent === true;
  const soFar = calculateAttendanceFromSession(sessionDays, { uptoISO: asOfISO, treatUnmarkedAsAbsent });
  const totalWorkingSoFar = soFar.totalWorking;
  const attended = soFar.present;
  const remaining = sessionDays.filter(d => {
    const cur = parseISOToLocalDate(d.date);
    return cur && asOfDate && cur > asOfDate && isPotentialWorkingDay(d.status);
  }).length;
  const currentRate = totalWorkingSoFar === 0 ? 1 : (attended / totalWorkingSoFar);
  const expectedFuturePresent = Math.round(currentRate * remaining);
  const predictedAttended = attended + expectedFuturePresent;
  const predictedTotal = totalWorkingSoFar + remaining;
  const predictedPercent = predictedTotal === 0 ? 0 : Number(((predictedAttended / predictedTotal) * 100).toFixed(2));
  const optimistic = predictedTotal === 0 ? 0 : Number(((attended + remaining) / predictedTotal * 100).toFixed(2));
  return { predictedPercent, predictedAttended, predictedTotal, remaining, optimistic };
}

export function calculateSafeLeaves(sessionDays, requiredPercent = 75, opts = {}) {
  // opts: { asOfISO?:string, treatUnmarkedAsAbsent:true }
  const asOfISO = opts.asOfISO || todayISO();
  const asOfDate = parseISOToLocalDate(asOfISO);
  const soFar = calculateAttendanceFromSession(sessionDays, { uptoISO: asOfISO, treatUnmarkedAsAbsent: opts.treatUnmarkedAsAbsent === true });
  const attended = soFar.present;
  const totalSoFar = soFar.totalWorking;
  const remaining = sessionDays.filter(d => {
    const cur = parseISOToLocalDate(d.date);
    return cur && asOfDate && cur > asOfDate && isPotentialWorkingDay(d.status);
  }).length;
  if (remaining === 0) {
    const currentPercent = totalSoFar === 0 ? 0 : (attended / totalSoFar) * 100;
    return { maxFutureAbsences: 0, meetsRequirement: currentPercent >= requiredPercent };
  }
  const requiredDecimal = requiredPercent / 100;
  const minimalFuturePresents = Math.max(0, Math.ceil(requiredDecimal * (totalSoFar + remaining) - attended));
  const maxFutureAbsences = Math.max(0, remaining - minimalFuturePresents);
  return { maxFutureAbsences, minimalFuturePresents, remaining };
}

export function calculateSafeLeavesFromTotals(attended, totalWorking, requiredPercent = 75) {
  if (!totalWorking || totalWorking === 0) return 0;
  const maxTotalAllowed = Math.floor((attended * 100) / requiredPercent);
  return Math.max(0, maxTotalAllowed - totalWorking);
}

export function backfillSession(sessionStartISO, untilISO) {
  // returns array of ISO dates from sessionStart to untilISO
  return generateSessionDates(sessionStartISO, untilISO);
}
