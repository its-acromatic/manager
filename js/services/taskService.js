// Firestore operations for Task captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { scheduleReminder, cancelReminder } from '../notifications/manager.js';

const tasksCollection = (uid) => collection(db, 'users', uid, 'captures');

function buildTaskReminderTimestamp(dueDate, time) {
  if (!dueDate) return null;
  const scheduleTime = time && typeof time.hour === 'number'
    ? `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')}`
    : '08:00';
  const iso = `${dueDate}T${scheduleTime}`;
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

function buildTaskReminderPayload(id, payload) {
  const ts = buildTaskReminderTimestamp(payload.dueDate, payload.time);
  if (!ts) return null;
  return {
    id: `task:${id}`,
    ts,
    title: 'Task reminder',
    body: payload.title,
    type: 'task',
    priority: 'normal'
  };
}

export async function saveTask(uid, parsed) {
  if (!uid || !parsed || !parsed.title) return null;

  const payload = {
    title: parsed.title,
    type: 'task',
    dueDate: parsed.dueDate || null,
    time: parsed.time || null,
    completed: false,
    priority: 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const ref = await addDoc(tasksCollection(uid), payload);
  const task = { id: ref.id, ...payload };
  const reminderPayload = buildTaskReminderPayload(ref.id, payload);
  if (reminderPayload) {
    scheduleReminder(reminderPayload);
  }
  return task;
}

export async function fetchTasks(uid) {
  if (!uid) return [];
  const snap = await getDocs(tasksCollection(uid));
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(task => task.type === 'task');
}

export async function updateTask(uid, taskId, updates) {
  if (!uid || !taskId) return;
  const ref = doc(tasksCollection(uid), taskId);
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
  if (updates.dueDate || updates.time || updates.title) {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const reminderPayload = buildTaskReminderPayload(taskId, data);
      if (reminderPayload) {
        scheduleReminder(reminderPayload);
      }
    }
  }
}

export async function deleteTask(uid, taskId) {
  if (!uid || !taskId) return;
  cancelReminder(`task:${taskId}`);
  const ref = doc(tasksCollection(uid), taskId);
  await deleteDoc(ref);
}

export async function markTaskCompleted(uid, taskId, completed) {
  if (!uid || !taskId) return;
  await updateTask(uid, taskId, { completed });
}
