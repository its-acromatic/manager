import { db } from '../firebase.js';
import { collection, doc, setDoc, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { showLoginModal, showAttendanceModal } from '../modal.js';
import {
  DayStatus,
  generateSessionDayObjects,
  mergeExistingRecords,
  calculateAttendanceFromSession,
  predictFinalAttendance,
  calculateSafeLeaves,
  defaultStatusForDateISO
} from './engine.js';

let calendar;

export function initAttendance(containerId = 'attendance-calendar') {
  const calendarEl = document.getElementById(containerId);
  if(!calendarEl) return;
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: []
  });
  calendar.render();
}

export async function refreshAttendanceForUser(uid) {
  const calendarEl = document.getElementById('attendance-calendar');
  if(!calendarEl) return;
  if(!uid) {
    showLoginModal({ onSuccess: () => {}, force: true });
    calendar.removeAllEvents();
    const summaryEl = document.getElementById('attendance-summary');
    if(summaryEl) summaryEl.textContent = 'Sign in to view attendance.';
    return;
  }

  calendar.setOption('dateClick', async (info) => {
    // check if attendance exists for this date
    const ref = doc(db, 'users', uid, 'attendance', info.dateStr);
    const snap = await getDoc(ref);
    const docData = snap && snap.exists ? snap.data() : null;
    // convert legacy doc shape to engine shape
    let existing = null;
    if(docData) {
      if(docData.workingDay === false) existing = { status: DayStatus.OFF, meta: {} };
      else existing = { status: docData.present ? DayStatus.PRESENT : DayStatus.ABSENT, meta: {} };
    }
    showAttendanceModal({ date: info.dateStr, existing, onSave: async (payload) => {
      // payload from modal uses { date, workingDay, present }
      // convert to storage schema: { date, status }
      const toSave = {};
      if(payload.workingDay === false) toSave.status = DayStatus.OFF;
      else toSave.status = payload.present ? DayStatus.PRESENT : DayStatus.ABSENT;
      toSave.date = payload.date;
      await setDoc(ref, toSave);
      await loadAttendance(uid);
    }});
  });

  await loadAttendance(uid);
}

async function loadAttendance(uid) {
  const attCol = collection(db, 'users', uid, 'attendance');
  const snapshot = await getDocs(attCol);
  // build map of existing records: { date: { status, meta } }
  const existingMap = {};
  snapshot.forEach(d => {
    const data = d.data();
    // prefer explicit date field, fall back to document id (some legacy or malformed docs)
    const iso = (data && data.date) ? data.date : d.id;
    if(!iso) return;
    if(data && data.status) {
      existingMap[iso] = { status: data.status, meta: data.meta || {} };
    } else if(data) {
      // legacy shape
      if(data.workingDay === false) existingMap[iso] = { status: DayStatus.OFF, meta: {} };
      else existingMap[iso] = { status: data.present ? DayStatus.PRESENT : DayStatus.ABSENT, meta: {} };
    } else {
      // no data, skip
    }
  });

  // load session settings (optional)
  const settingsRef = doc(db, 'users', uid, 'settings', 'session');
  const settingsSnap = await getDoc(settingsRef);
  const defaultStart = (new Date(new Date().getFullYear(), 0, 1)).toISOString().slice(0,10);
  const defaultEnd = (new Date(new Date().getFullYear(), 11, 31)).toISOString().slice(0,10);
  const sessionStart = settingsSnap && settingsSnap.exists() && settingsSnap.data().start ? settingsSnap.data().start : defaultStart;
  const sessionEnd = settingsSnap && settingsSnap.exists() && settingsSnap.data().end ? settingsSnap.data().end : defaultEnd;
  const requiredPercent = settingsSnap && settingsSnap.exists() && settingsSnap.data().requiredPercent ? settingsSnap.data().requiredPercent : 75;

  // generate session days and merge existing records
  let sessionDays = generateSessionDayObjects(sessionStart, sessionEnd, existingMap);

  // Render calendar events for the session
  const events = sessionDays.map(d => {
    let title = '';
    let bg = '#999';
    switch(d.status) {
      case DayStatus.PRESENT: title = 'Present'; bg = '#37b24d'; break;
      case DayStatus.ABSENT: title = 'Absent'; bg = '#fa5252'; break;
      case DayStatus.OFF: title = 'Off'; bg = '#6c757d'; break;
      case DayStatus.HOLIDAY: title = 'Holiday'; bg = '#3366ff'; break;
      case DayStatus.VACATION: title = 'Vacation'; bg = '#9b5de5'; break;
      default: title = ''; bg = 'transparent'; break;
    }
    return { title, start: d.date, allDay: true, backgroundColor: bg };
  });

  if(!calendar) return;
  calendar.removeAllEvents();
  events.forEach(e => { if(e.title) calendar.addEvent(e); });

  // compute attendance stats and predictions
  const nowISO = new Date().toISOString().slice(0,10);
  const stats = calculateAttendanceFromSession(sessionDays, { uptoISO: nowISO });
  const pred = predictFinalAttendance(sessionDays, { asOfISO: nowISO });
  const safe = calculateSafeLeaves(sessionDays, requiredPercent, { asOfISO: nowISO });

  const summaryEl = document.getElementById('attendance-summary');
  if(summaryEl) {
    if(stats.totalWorking === 0) {
      summaryEl.textContent = 'No attendance recorded yet.';
    } else {
      summaryEl.textContent = `Present ${stats.present}/${stats.totalWorking} — ${stats.percent}% (Predicted ${pred.predictedPercent}% — safe leaves left: ${safe.maxFutureAbsences})`;
    }
  }
}
