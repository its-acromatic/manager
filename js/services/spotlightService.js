// Firestore operations for Spotlight captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { scheduleReminder, cancelReminder } from '../notifications/manager.js';

const capturesCollection = (uid) => collection(db, 'users', uid, 'captures');

function buildReminderTimestamp(dueDate, time) {
  if (!dueDate) return null;
  const scheduleTime = time && typeof time.hour === 'number'
    ? `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')}`
    : '08:00';
  const iso = `${dueDate}T${scheduleTime}`;
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

function buildReminderPayload(id, payload) {
  const ts = buildReminderTimestamp(payload.dueDate, payload.time);
  if (!ts) return null;
  const title = payload.type === 'task' ? 'Task reminder' : payload.type === 'event' ? 'Event reminder' : 'Reminder';
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

  const payload = {
    title: parsed.title,
    type: parsed.type,
    dueDate: parsed.dueDate || null,
    time: parsed.time || null,
    completed: false,
    priority: 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

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
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
  if (updates.dueDate || updates.time || updates.title || updates.type) {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const reminderPayload = buildReminderPayload(captureId, data);
      if (reminderPayload) {
        scheduleReminder(reminderPayload);
      }
    }
  }
}

export async function deleteCapture(uid, captureId) {
  if (!uid || !captureId) return;
  cancelReminder(`capture:task:${captureId}`);
  cancelReminder(`capture:event:${captureId}`);
  cancelReminder(`capture:reminder:${captureId}`);
  cancelReminder(`capture:exam:${captureId}`);
  const ref = doc(capturesCollection(uid), captureId);
  await deleteDoc(ref);
}

export async function markCaptureCompleted(uid, captureId, completed) {
  if (!uid || !captureId) return;
  await updateCapture(uid, captureId, { completed });
}
