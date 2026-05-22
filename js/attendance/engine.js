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
  if(typeof d === 'string') return d;
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function generateSessionDates(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const res = [];
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    res.push(toISO(new Date(d)));
  }
  return res;
}

function isSaturday(d) { return d.getDay() === 6; }
function isSunday(d) { return d.getDay() === 0; }

function weekIndexInMonth(d) {
  // 1-based week index for this weekday in the month
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const day = d.getDate();
  // count how many same-weekday have occurred including this
  let count = 0;
  for(let i=1;i<=day;i++){
    const cur = new Date(d.getFullYear(), d.getMonth(), i);
    if(cur.getDay() === d.getDay()) count++;
  }
  return count;
}

export function isSecondOrFourthSaturdayISO(iso) {
  const d = new Date(iso);
  if(!isSaturday(d)) return false;
  const idx = weekIndexInMonth(d);
  return idx === 2 || idx === 4;
}

export function defaultStatusForDateISO(iso) {
  const d = new Date(iso);
  if(isSunday(d)) return DayStatus.OFF;
  if(isSaturday(d) && isSecondOrFourthSaturdayISO(iso)) return DayStatus.OFF;
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
  const s = new Date(startISO);
  const e = new Date(endISO);
  return sessionDays.map(d => {
    const cur = new Date(d.date);
    if(cur >= s && cur <= e) return { date: d.date, status, meta };
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
  const upto = opts.uptoISO ? new Date(opts.uptoISO) : null;
  return sessionDays.filter(d => {
    const cur = new Date(d.date);
    if(upto && cur > upto) return false;
    return isWorkingStatus(d.status);
  });
}

export function calculateAttendanceFromSession(sessionDays, opts = {}) {
  // opts: { uptoISO?:string, treatUnmarkedAsAbsent:false }
  const uptoISO = opts.uptoISO || toISO(new Date());
  const treatUnmarkedAsAbsent = opts.treatUnmarkedAsAbsent === true; // default false
  const working = filterWorkingDays(sessionDays, { uptoISO });
  let totalWorking = working.length;
  let present = 0;
  working.forEach(d => {
    if(d.status === DayStatus.PRESENT) present++;
    else if(d.status === DayStatus.UNMARKED) {
      if(treatUnmarkedAsAbsent) {
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
  const asOfISO = opts.asOfISO || toISO(new Date());
  const treatUnmarkedAsAbsent = opts.treatUnmarkedAsAbsent === true;
  // calculate so far
  const soFar = calculateAttendanceFromSession(sessionDays, { uptoISO: asOfISO, treatUnmarkedAsAbsent });
  const totalWorkingSoFar = soFar.totalWorking;
  const attended = soFar.present;
  // remaining working days in future (strictly > asOfISO)
  // remaining potential working days are days not OFF/HOLIDAY/VACATION
  const remaining = sessionDays.filter(d => new Date(d.date) > new Date(asOfISO) && isPotentialWorkingDay(d.status)).length;
  // current rate
  const currentRate = totalWorkingSoFar === 0 ? 1 : (attended / totalWorkingSoFar);
  const expectedFuturePresent = Math.round(currentRate * remaining);
  const predictedAttended = attended + expectedFuturePresent;
  const predictedTotal = totalWorkingSoFar + remaining;
  const predictedPercent = predictedTotal === 0 ? 0 : Number(((predictedAttended / predictedTotal) * 100).toFixed(2));
  // also provide optimistic forecast (all future present)
  const optimistic = predictedTotal === 0 ? 0 : Number(((attended + remaining) / predictedTotal * 100).toFixed(2));
  return { predictedPercent, predictedAttended, predictedTotal, remaining, optimistic };
}

export function calculateSafeLeaves(sessionDays, requiredPercent = 75, opts = {}) {
  // opts: { asOfISO?:string, treatUnmarkedAsAbsent:true }
  const asOfISO = opts.asOfISO || toISO(new Date());
  const soFar = calculateAttendanceFromSession(sessionDays, { uptoISO: asOfISO, treatUnmarkedAsAbsent: opts.treatUnmarkedAsAbsent === true });
  const attended = soFar.present;
  const totalSoFar = soFar.totalWorking;
  const remaining = sessionDays.filter(d => new Date(d.date) > new Date(asOfISO) && isPotentialWorkingDay(d.status)).length;
  if(remaining === 0) {
    // no future days
    // compute if already meeting requirement
    const currentPercent = totalSoFar === 0 ? 0 : (attended / totalSoFar) * 100;
    return { maxFutureAbsences: 0, meetsRequirement: currentPercent >= requiredPercent };
  }
  // minimal future presents needed: ceil(required*(totalSoFar+remaining)/100 - attended)
  const requiredDecimal = requiredPercent / 100;
  const minimalFuturePresents = Math.max(0, Math.ceil(requiredDecimal * (totalSoFar + remaining) - attended));
  const maxFutureAbsences = Math.max(0, remaining - minimalFuturePresents);
  return { maxFutureAbsences, minimalFuturePresents, remaining };
}

export function backfillSession(sessionStartISO, untilISO) {
  // returns array of ISO dates from sessionStart to untilISO
  return generateSessionDates(sessionStartISO, untilISO);
}
