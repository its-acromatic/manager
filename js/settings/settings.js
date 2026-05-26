import { subscribeAuth } from '../firebase.js';
import { refreshAttendanceForUser } from '../attendance/attendance.js';
import { fetchSessionSettings, saveSessionSettings, seedAttendanceRange } from '../services/firestoreService.js';
import { applyTheme, getStoredTheme } from '../theme.js';
import { todayISO } from '../utils/date.js';
import * as notifications from '../notifications/manager.js';
import { showToast } from '../notifications/ui.js';

const startEl = document.getElementById('session-start');
const endEl = document.getElementById('session-end');
const reqEl = document.getElementById('required-percent');
const saveBtn = document.getElementById('save-session');
const seedBtn = document.getElementById('seed-defaults');
const statusEl = document.getElementById('session-status');
const themeStatusEl = document.getElementById('theme-status');
const themeOptions = Array.from(document.querySelectorAll('input[name="theme-option"]'));

let currentUid = null;

function setThemeSelection(themeName) {
  themeOptions.forEach((option) => {
    option.checked = option.value === themeName;
  });
}

const initialTheme = getStoredTheme();
setThemeSelection(initialTheme);
applyTheme(initialTheme);

async function persistTheme(themeName) {
  if (!themeName) return;
  applyTheme(themeName);
  setThemeSelection(themeName);
  localStorage.setItem('manager-theme', themeName);

  if (currentUid) {
    try {
      await saveSessionSettings(currentUid, { theme: themeName });
      if (themeStatusEl) themeStatusEl.textContent = `Theme saved: ${themeName}`;
    } catch (err) {
      console.error('Unable to save theme preference', err);
      if (themeStatusEl) themeStatusEl.textContent = 'Theme saved locally. Sign in to persist across devices.';
    }
  }
}

if (themeOptions.length) {
  themeOptions.forEach((option) => {
    option.addEventListener('change', () => {
      if (option.checked) {
        persistTheme(option.value);
      }
    });
  });
}

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
  if (saveBtn) saveBtn.disabled = false;
  if (statusEl) statusEl.textContent = '';
  // load settings
  const settings = await fetchSessionSettings(currentUid);
  const defaultStart = todayISO();
  const defaultEnd = todayISO();
  startEl.value = settings?.start || defaultStart;
  endEl.value = settings?.end || defaultEnd;
  reqEl.value = settings?.requiredPercent || 75;
  const themeName = settings?.theme || getStoredTheme();
  setThemeSelection(themeName);
  applyTheme(themeName);
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

// --- Notification settings wiring ---
const notifMaster = document.getElementById('notif-master');
const notifTasks = document.getElementById('notif-tasks');
const notifEvents = document.getElementById('notif-events');
const notifFocus = document.getElementById('notif-focus');
const notifDaily = document.getElementById('notif-daily');
const notifSound = document.getElementById('notif-sound');
const notifQuietStart = document.getElementById('notif-quiet-start');
const notifQuietEnd = document.getElementById('notif-quiet-end');
const notifPermission = document.getElementById('notif-permission');
const notifRequest = document.getElementById('notif-request');
const notifTest = document.getElementById('notif-test');

async function refreshPermissionLabel() {
  try {
    const p = await notifications.checkPermission();
    if (notifPermission) {
      notifPermission.textContent = `Permission: ${p}`;
      if (p === 'insecure') {
        notifPermission.textContent = 'Permission: insecure (use HTTPS or localhost)';
      }
    }
    return p;
  } catch (e) {
    if (notifPermission) notifPermission.textContent = 'Permission: unknown';
    return 'unknown';
  }
}

async function loadNotificationSettings(settings) {
  const ns = settings?.notifications || {};
  if (notifMaster) notifMaster.checked = ns.master !== false;
  if (notifTasks) notifTasks.checked = ns.task !== false;
  if (notifEvents) notifEvents.checked = ns.event !== false;
  if (notifFocus) notifFocus.checked = ns.focus !== false;
  if (notifDaily) notifDaily.checked = ns.daily !== false;
  if (notifSound) notifSound.checked = ns.sound === true;
  if (notifQuietStart) notifQuietStart.value = ns.quietHours?.start || '';
  if (notifQuietEnd) notifQuietEnd.value = ns.quietHours?.end || '';
  notifications.updateConfig(ns);
}

function readNotificationSettingsFromUI() {
  return {
    master: !!(notifMaster && notifMaster.checked),
    task: !!(notifTasks && notifTasks.checked),
    event: !!(notifEvents && notifEvents.checked),
    focus: !!(notifFocus && notifFocus.checked),
    daily: !!(notifDaily && notifDaily.checked),
    sound: !!(notifSound && notifSound.checked),
    quietHours: {
      start: notifQuietStart ? notifQuietStart.value : '',
      end: notifQuietEnd ? notifQuietEnd.value : ''
    }
  };
}

// Hook into auth load flow to populate notification settings when session settings are fetched
subscribeAuth(async (user) => {
  if (!user) return;
  try {
    const s = await fetchSessionSettings(user.uid);
    await loadNotificationSettings(s || {});
    await refreshPermissionLabel();
  } catch (e) {
    console.error('Unable to load notification settings', e);
  }
});

// Persist changes locally and to Firestore
[notifMaster, notifTasks, notifEvents, notifFocus, notifDaily, notifSound, notifQuietStart, notifQuietEnd].forEach((el) => {
  if (!el) return;
  el.addEventListener('change', async () => {
    const ns = readNotificationSettingsFromUI();
    notifications.updateConfig(ns);
    if (currentUid) {
      try {
        await saveSessionSettings(currentUid, { notifications: ns });
      } catch (e) {
        console.warn('Failed to persist notification settings', e);
      }
    }
  });
});

if (notifRequest) notifRequest.addEventListener('click', async () => {
  const result = await notifications.requestPermission();
  if (notifPermission) {
    notifPermission.textContent = result === 'insecure' ? 'Permission: insecure (use HTTPS or localhost)' : `Permission: ${result}`;
  }
  showToast({
    id: 'notif-request-feedback',
    title: 'Request permission',
    message: result === 'granted'
      ? 'Notification permission granted.'
      : result === 'denied'
      ? 'Notification permission denied.'
      : result === 'insecure'
      ? 'Notifications require HTTPS or localhost.'
      : 'Notification permission unavailable.',
    ttl: 5200
  });
});
if (notifTest) notifTest.addEventListener('click', async () => {
  notifications.testNotification();
  const p = await notifications.checkPermission();
  if (notifPermission) {
    notifPermission.textContent = p === 'insecure' ? 'Permission: insecure (use HTTPS or localhost)' : `Permission: ${p}`;
  }
  showToast({
    id: 'notif-test-feedback',
    title: 'Test notification',
    message: p === 'granted'
      ? 'A test notification has been triggered.'
      : p === 'denied'
      ? 'Notifications are denied. Please enable them in browser settings.'
      : p === 'insecure'
      ? 'Notifications require HTTPS or localhost.'
      : 'Test sent. If native permission is not granted, only the toast is visible.',
    ttl: 5200
  });
});
