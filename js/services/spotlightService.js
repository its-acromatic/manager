// Firestore operations for Spotlight captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { scheduleReminder, cancelReminder } from '../notifications/manager.js';

const capturesCollection = (uid) => collection(db, 'users', uid, 'captures');

function buildReminderTimestamp(dueDate, time) {
  if (!dueDate) return null;
  if (!time) return null;
  let hour = Number(time.hour);
  const minute = Number(time.minute || 0);
  if (time.period === 'pm' && hour < 12) hour += 12;
  if (time.period === 'am' && hour === 12) hour = 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const scheduleTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const iso = `${dueDate}T${scheduleTime}`;
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

function buildCaptureScheduleMetadata(payload, useParsedSchedule = false) {
  const scheduledHasTime = useParsedSchedule ? payload.scheduledHasTime === true : !!payload.time;
  let scheduledDateTime = useParsedSchedule ? payload.scheduledDateTime : null;
  if (!scheduledDateTime && payload.dueDate) {
    scheduledDateTime = buildReminderTimestamp(payload.dueDate, payload.time);
    if (!scheduledDateTime) {
      const [year, month, day] = payload.dueDate.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (!Number.isNaN(date.getTime())) scheduledDateTime = date.toISOString();
    }
  }

  let reminderAtDateTime = useParsedSchedule ? payload.reminderAtDateTime : null;
  if (scheduledHasTime && scheduledDateTime && !reminderAtDateTime) {
    const offset = Number(payload.reminderOffsetMinutes || 0);
    reminderAtDateTime = new Date(Date.parse(scheduledDateTime) - offset * 60000).toISOString();
  }
  return { scheduledDateTime: scheduledDateTime || null, scheduledHasTime, reminderAtDateTime: reminderAtDateTime || null };
}

function cancelCaptureReminders(captureId) {
  ['task', 'event', 'reminder', 'exam', 'focus', 'note'].forEach((type) => cancelReminder(`capture:${type}:${captureId}`));
}

function buildReminderPayload(id, payload) {
  const ts = payload.reminderAtDateTime || (payload.scheduledHasTime ? payload.scheduledDateTime : null) || buildReminderTimestamp(payload.dueDate, payload.time);
  if (!ts) return null;
  const title = ({ task: 'Task reminder', event: 'Event reminder', exam: 'Exam reminder', focus: 'Focus session', note: 'Note' })[payload.type] || 'Reminder';
  return {
    id: `capture:${payload.type}:${id}`,
    ts,
    title,
    body: payload.title,
    type: payload.type,
    priority: 'normal'
  };
}

export async function saveSpotlightCapture(uid, parsed) {
  if (!uid || !parsed || !parsed.title) return null;

  const captureData = {
    title: parsed.title,
    type: parsed.type,
    dueDate: parsed.dueDate || null,
    time: parsed.time || null,
    reminderOffsetMinutes: parsed.reminderOffsetMinutes ?? null,
    subject: parsed.subject || null,
    tags: parsed.tags || [],
    parserConfidence: parsed.confidence ?? null,
    completed: false,
    priority: parsed.priority || 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const payload = { ...captureData, ...buildCaptureScheduleMetadata({ ...captureData, ...parsed }, true) };

  const ref = await addDoc(capturesCollection(uid), payload);
  const capture = { id: ref.id, ...payload };
  const reminderPayload = buildReminderPayload(ref.id, payload);
  if (reminderPayload) {
    scheduleReminder(reminderPayload);
  }
  return capture;
}

export async function fetchCaptures(uid) {
  if (!uid) return [];
  const snap = await getDocs(capturesCollection(uid));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchCapturesByType(uid, type) {
  if (!uid || !type) return [];
  const allCaptures = await fetchCaptures(uid);
  return allCaptures.filter((c) => c.type === type);
}

export async function updateCapture(uid, captureId, updates) {
  if (!uid || !captureId) return;
  const ref = doc(capturesCollection(uid), captureId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const current = snapshot.data();
  const data = { ...current, ...updates };
  const scheduleChanged = ['dueDate', 'time'].some((key) => Object.hasOwn(updates, key));
  const scheduleMetadata = scheduleChanged ? buildCaptureScheduleMetadata(data) : {};
  await updateDoc(ref, { ...updates, ...scheduleMetadata, updatedAt: new Date().toISOString() });

  if (scheduleChanged || Object.hasOwn(updates, 'title') || Object.hasOwn(updates, 'type') || Object.hasOwn(updates, 'completed')) {
    cancelCaptureReminders(captureId);
    const reminderPayload = buildReminderPayload(captureId, { ...data, ...scheduleMetadata });
    if (reminderPayload && !data.completed) scheduleReminder(reminderPayload);
  }
}

export async function deleteCapture(uid, captureId) {
  if (!uid || !captureId) return;
  cancelCaptureReminders(captureId);
  const ref = doc(capturesCollection(uid), captureId);
  await deleteDoc(ref);
}

export async function markCaptureCompleted(uid, captureId, completed) {
  if (!uid || !captureId) return;
  await updateCapture(uid, captureId, { completed });
}
