import { subscribeAuth } from '../firebase.js';
import { refreshAttendanceForUser } from '../attendance/attendance.js';
import { fetchSessionSettings, saveSessionSettings, seedAttendanceRange } from '../services/firestoreService.js';
import { todayISO } from '../utils/date.js';

const startEl = document.getElementById('session-start');
const endEl = document.getElementById('session-end');
const reqEl = document.getElementById('required-percent');
const saveBtn = document.getElementById('save-session');
const seedBtn = document.getElementById('seed-defaults');
const statusEl = document.getElementById('session-status');

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
  const settings = await fetchSessionSettings(currentUid);
  const defaultStart = todayISO();
  const defaultEnd = todayISO();
  startEl.value = settings?.start || defaultStart;
  endEl.value = settings?.end || defaultEnd;
  reqEl.value = settings?.requiredPercent || 75;
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
    await saveSessionSettings(currentUid, { start, end, requiredPercent });
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
    const requiredPercent = Number(reqEl.value) || 75;
    await saveSessionSettings(currentUid, { start, end, requiredPercent });
    const result = await seedAttendanceRange(currentUid, start, end);
    statusEl.textContent = `Seeding complete. Created ${result.created || 0} new records.`;
    try { refreshAttendanceForUser(currentUid); } catch(e) {}
  } catch (e) {
    statusEl.textContent = 'Seed failed: ' + e.message;
  }
});
