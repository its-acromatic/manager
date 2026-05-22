import { db, subscribeAuth } from '../firebase.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { refreshAttendanceForUser } from '../attendance/attendance.js';
import { generateSessionDates, defaultStatusForDateISO } from '../attendance/engine.js';

const startEl = document.getElementById('session-start');
const endEl = document.getElementById('session-end');
const reqEl = document.getElementById('required-percent');
const saveBtn = document.getElementById('save-session');
const seedBtn = document.getElementById('seed-defaults');
const statusEl = document.getElementById('session-status');

function isoToday() { return new Date().toISOString().slice(0,10); }

let currentUid = null;

subscribeAuth(async (user) => {
  if(!user) {
    currentUid = null;
    if(startEl) startEl.value = '';
    if(endEl) endEl.value = '';
    if(reqEl) reqEl.value = 75;
    if(saveBtn) saveBtn.disabled = true;
    if(statusEl) statusEl.textContent = 'Sign in to edit session.';
    return;
  }
  currentUid = user.uid;
  if(saveBtn) saveBtn.disabled = false;
  if(statusEl) statusEl.textContent = '';
  // load settings
  const ref = doc(db, 'users', currentUid, 'settings', 'session');
  const snap = await getDoc(ref);
  const defaultStart = isoToday();
  const defaultEnd = isoToday();
  if(snap && snap.exists()) {
    const data = snap.data();
    startEl.value = data.start || defaultStart;
    endEl.value = data.end || defaultEnd;
    reqEl.value = data.requiredPercent || 75;
  } else {
    startEl.value = defaultStart;
    endEl.value = defaultEnd;
    reqEl.value = 75;
  }
});

if(saveBtn) saveBtn.addEventListener('click', async () => {
  if(!currentUid) return;
  const start = startEl.value;
  const end = endEl.value;
  let requiredPercent = Number(reqEl.value) || 75;
  if(!start || !end) { statusEl.textContent = 'Please provide valid start and end dates.'; return; }
  if(new Date(start) > new Date(end)) { statusEl.textContent = 'Start date must be before end date.'; return; }
  if(requiredPercent < 0 || requiredPercent > 100) { statusEl.textContent = 'Required percent must be 0-100.'; return; }
  statusEl.textContent = 'Saving...';
  try {
    const ref = doc(db, 'users', currentUid, 'settings', 'session');
    await setDoc(ref, { start, end, requiredPercent });
    statusEl.textContent = 'Saved.';
    // refresh attendance view
    try { refreshAttendanceForUser(currentUid); } catch (e) { /* ignore */ }
  } catch (e) {
    statusEl.textContent = 'Save failed: ' + e.message;
  }
});

if(seedBtn) seedBtn.addEventListener('click', async () => {
  if(!currentUid) return;
  const ok = confirm('This will (re)create attendance docs for the configured session range. Continue?');
  if(!ok) return;
  const start = startEl.value;
  const end = endEl.value;
  if(!start || !end) { statusEl.textContent = 'Please provide valid session dates before seeding.'; return; }
  statusEl.textContent = 'Seeding...';
  try {
    // write session settings first
    const ref = doc(db, 'users', currentUid, 'settings', 'session');
    const requiredPercent = Number(reqEl.value) || 75;
    await setDoc(ref, { start, end, requiredPercent });

    const dates = generateSessionDates(start, end);
    // create attendance docs for each date only if missing (non-destructive)
    let created = 0;
    for(const date of dates) {
      const status = defaultStatusForDateISO(date);
      const aRef = doc(db, 'users', currentUid, 'attendance', date);
      const snap = await getDoc(aRef);
      if(!snap.exists()) {
        await setDoc(aRef, { date, status });
        created++;
      }
    }
    statusEl.textContent = `Seeding complete. Created ${created} new records.`;
    try { refreshAttendanceForUser(currentUid); } catch(e) {}
  } catch (e) {
    statusEl.textContent = 'Seed failed: ' + e.message;
  }
});
