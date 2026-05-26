import * as storage from './storage.js';
import * as perms from './permissions.js';
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

function buildTimestamp(date, time, fallback = null) {
  if (!date) return null;
  const timeValue = time ? (typeof time === 'string' ? time : `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')}`) : fallback;
  if (!timeValue) return null;
  const iso = `${date}T${timeValue}`;
  const ts = new Date(iso);
  return Number.isNaN(ts.getTime()) ? null : ts.toISOString();
}

function hasTimeValue(time) {
  if (!time) return false;
  if (typeof time === 'string') {
    return time.trim().length > 0;
  }
  return typeof time.hour === 'number';
}

function getTimeString(time) {
  if (!time) return '';
  if (typeof time === 'string') return time;
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')}`;
}

function isTodayDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function getScheduleTitle(type) {
  switch (type) {
    case 'task': return 'Task reminder';
    case 'event': return 'Event reminder';
    case 'exam': return 'Exam reminder';
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
    if (!data || !data.dueDate) return;

    const title = getScheduleTitle(data.type);
    const body = data.title || title;
    const itemId = `capture:${data.type || 'reminder'}:${doc.id}`;
    const type = data.type || 'reminder';

    if (hasTimeValue(data.time)) {
      const ts = buildTimestamp(data.dueDate, getTimeString(data.time));
      if (ts) {
        timedItems.push({ id: itemId, ts, title, body, type, priority: 'normal' });
      }
    } else if (isTodayDate(data.dueDate)) {
      pageLoadItems.push({ id: itemId, title, body, type, noNative: true, priority: 'normal' });
    }
  });

  eventSnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data || !data.date) return;

    const title = getScheduleTitle('event');
    const body = data.title || title;
    const itemId = `event:${doc.id}`;

    if (hasTimeValue(data.startTime)) {
      const ts = buildTimestamp(data.date, getTimeString(data.startTime));
      if (ts) {
        timedItems.push({ id: itemId, ts, title, body, type: 'event', priority: 'normal' });
      }
    } else if (isTodayDate(data.date)) {
      pageLoadItems.push({ id: itemId, title, body, type: 'event', noNative: true, priority: 'normal' });
    }
  });

  timedItems.forEach((item) => scheduler.schedule(item));
  pageLoadItems.forEach((item) => triggerNotification(item));
}

export async function triggerNotification(payload) {
  try {
    if (!config.master) return;
    if (inQuietHours() && payload.priority !== 'critical') return;

    const key = payload.id || payload.tag || (payload.type + '::' + payload.title);
    if (firedKeys.has(key)) return;
    firedKeys.add(key);

    if (!payload.noNative && await perms.checkPermission() === 'granted') {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            reg.showNotification(payload.title || 'Manager', {
              body: payload.body || '',
              tag: payload.tag || key,
              icon: payload.icon || '/favicon.png',
              data: payload.data || {},
              badge: payload.badge || '/favicon.png'
            });
          }
        } else if (typeof Notification !== 'undefined') {
          new Notification(payload.title || 'Manager', { body: payload.body || '', tag: payload.tag || key, icon: payload.icon || '/favicon.png' });
        }
      } catch (e) {
      }
    }

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

export async function checkPermission() {
  return perms.checkPermission();
}

export async function requestPermission() {
  const result = await perms.requestPermission();
  return result;
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
      message: 'Notifications are currently disabled in settings. This is a test preview.',
      ttl: 6000
    });
  }
}
