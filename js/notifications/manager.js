import * as storage from './storage.js';
import * as ui from './ui.js';
import * as scheduler from './scheduler.js';
import { db } from '../firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

let config = storage.getSettings() || { master: true, task: true, event: true, focus: true, daily: true, sound: false, quietHours: null };
const firedKeys = new Set();
let listenerAttached = false;

export async function initNotifications(uid) {
  config = storage.getSettings() || config;
  firedKeys.clear();
  scheduler.clearAll();

  if (uid) {
    await loadFirestoreSchedules(uid);
  }

  if (!listenerAttached) {
    listenerAttached = true;
    window.addEventListener('manager:notification:trigger', (e) => {
      const item = e.detail;
      triggerNotification(item);
    });
  }
}

export function updateConfig(newCfg) {
  config = { ...(config || {}), ...(newCfg || {}) };
  storage.setSettings(config);
}

function inQuietHours() {
  if (!config || !config.quietHours || !config.quietHours.start) return false;
  try {
    const now = new Date();
    const startParts = (config.quietHours.start || '00:00').split(':').map(Number);
    const endParts = (config.quietHours.end || '00:00').split(':').map(Number);
    const start = new Date(now);
    start.setHours(startParts[0] || 0, startParts[1] || 0, 0, 0);
    const end = new Date(now);
    end.setHours(endParts[0] || 0, endParts[1] || 0, 0, 0);
    if (start <= end) return now >= start && now <= end;
    return now >= start || now <= end;
  } catch (e) {
    return false;
  }
}

function normalizeTime(time) {
  if (!time) return null;
  let hour;
  let minute;
  let period = null;

  if (typeof time === 'string') {
    const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    hour = Number(match[1]);
    minute = Number(match[2] || 0);
    period = match[3]?.toLowerCase() || null;
  } else if (typeof time === 'object' && Number.isFinite(Number(time.hour))) {
    hour = Number(time.hour);
    minute = Number(time.minute || 0);
    period = typeof time.period === 'string' ? time.period.toLowerCase() : null;
  } else {
    return null;
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (period === 'pm' && hour >= 1 && hour <= 11) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;
  return { hour, minute };
}

function buildTimestamp(date, time) {
  const parsedTime = normalizeTime(time);
  if (!date || !parsedTime) return null;
  const dateParts = date.split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = dateParts;
  const timestamp = new Date(year, month - 1, day, parsedTime.hour, parsedTime.minute, 0, 0);
  if (timestamp.getFullYear() !== year || timestamp.getMonth() !== month - 1 || timestamp.getDate() !== day) return null;
  return timestamp.toISOString();
}

function hasTimeValue(time) {
  return normalizeTime(time) !== null;
}

function getStoredScheduleTimestamp(data, dateKey, timeKey) {
  if (data.scheduledHasTime !== true && !hasTimeValue(data[timeKey])) return null;
  const stored = data.reminderAtDateTime || data.scheduledDateTime;
  if (stored) {
    const timestamp = Date.parse(stored);
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
  }
  if (!hasTimeValue(data[timeKey])) return null;
  return buildTimestamp(data[dateKey], data[timeKey]);
}

function hasScheduledClockTime(data, timeKey) {
  return data.scheduledHasTime === true || hasTimeValue(data[timeKey]);
}

function isTodayDate(dateStr) {
  if (!dateStr) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr === today;
}

function isTodayTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return isTodayDate(localDate);
}

function getScheduleTitle(type) {
  switch (type) {
    case 'task': return 'Task reminder';
    case 'event': return 'Event reminder';
    case 'exam': return 'Exam reminder';
    case 'focus': return 'Focus session';
    case 'note': return 'Note';
    default: return 'Reminder';
  }
}

async function loadFirestoreSchedules(uid) {
  const captureSnapshot = await getDocs(collection(db, 'users', uid, 'captures'));
  const eventSnapshot = await getDocs(collection(db, 'users', uid, 'events'));

  const timedItems = [];
  const pageLoadItems = [];

  captureSnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data || !data.dueDate || data.completed) return;

    const title = getScheduleTitle(data.type);
    const body = data.title || title;
    const itemId = `capture:${data.type || 'reminder'}:${doc.id}`;
    const type = data.type || 'reminder';

    const ts = getStoredScheduleTimestamp(data, 'dueDate', 'time');
    if (ts) {
      const timestamp = Date.parse(ts);
      if (timestamp >= Date.now()) {
        timedItems.push({ id: itemId, ts, title, body, type, priority: 'normal' });
      } else if (isTodayTimestamp(timestamp) && Date.now() - timestamp < 60000) {
        pageLoadItems.push({ id: itemId, title, body, type, priority: 'normal' });
      }
    } else if (!hasScheduledClockTime(data, 'time') && isTodayDate(data.dueDate)) {
      pageLoadItems.push({ id: itemId, title, body, type, priority: 'normal' });
    }
  });

  eventSnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data || !data.date) return;

    const title = getScheduleTitle('event');
    const body = data.title || title;
    const itemId = `event:${doc.id}`;

    const ts = getStoredScheduleTimestamp(data, 'date', 'startTime');
    if (ts) {
      const timestamp = Date.parse(ts);
      if (timestamp >= Date.now()) {
        timedItems.push({ id: itemId, ts, title, body, type: 'event', priority: 'normal' });
      } else if (isTodayTimestamp(timestamp) && Date.now() - timestamp < 60000) {
        pageLoadItems.push({ id: itemId, title, body, type: 'event', priority: 'normal' });
      }
    } else if (!hasScheduledClockTime(data, 'startTime') && isTodayDate(data.date)) {
      pageLoadItems.push({ id: itemId, title, body, type: 'event', priority: 'normal' });
    }
  });

  timedItems.forEach((item) => scheduler.schedule(item));
  pageLoadItems.forEach((item) => triggerNotification(item));
}

export async function triggerNotification(payload) {
  try {
    if (!config.master) return;
    if (payload.type === 'event' && config.event === false) return;
    if (['task', 'reminder', 'exam'].includes(payload.type) && config.task === false) return;
    if (payload.type === 'focus' && config.focus === false) return;
    if (payload.type === 'daily' && config.daily === false) return;
    if (inQuietHours() && payload.priority !== 'critical') return;

    const key = payload.id || payload.tag || (payload.type + '::' + payload.title);
    if (firedKeys.has(key)) return;
    firedKeys.add(key);

    ui.showToast({
      id: key,
      icon: payload.icon || '',
      title: payload.title,
      message: payload.body,
      actionLabel: payload.actionLabel,
      onAction: payload.onAction,
      ttl: payload.ttl || 6000
    });
  } catch (err) {
    console.error('Notification trigger failed', err);
  }
}

export function scheduleReminder({ id, ts, title, body, type, priority = 'normal' }) {
  if (!id || !ts) return;
  scheduler.schedule({ id, ts, title, body, type, priority });
}

export function cancelReminder(id) {
  scheduler.cancel(id);
}

export function getConfig() {
  return config;
}

export function testNotification() {
  const payload = { id: 'test-' + Date.now(), title: 'Test Notification', body: 'This is a test from Manager.', type: 'test', priority: 'normal' };
  if (config.master) {
    triggerNotification(payload);
  } else {
    ui.showToast({
      id: payload.id,
      icon: '',
      title: payload.title,
      message: 'In-app notifications are currently disabled in settings.',
      ttl: 6000
    });
  }
}
