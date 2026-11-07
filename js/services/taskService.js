// Firestore operations for Task captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { scheduleReminder, cancelReminder } from '../notifications/manager.js';

const tasksCollection = (uid) => collection(db, 'users', uid, 'captures');

function buildTaskReminderTimestamp(dueDate, time) {
  if (!dueDate || !time || typeof time.hour !== 'number') return null;
  let hour = Number(time.hour);
  const minute = Number(time.minute || 0);
  if (time.period === 'pm' && hour < 12) hour += 12;
  if (time.period === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const [year, month, day] = dueDate.split('-').map(Number);
  const when = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

function buildTaskScheduleFields(payload, useParsedSchedule = false) {
  const scheduledHasTime = useParsedSchedule ? payload.scheduledHasTime === true : !!payload.time;
  const scheduledDateTime = payload.scheduledDateTime || buildTaskReminderTimestamp(payload.dueDate, payload.time) || (() => {
    if (!payload.dueDate) return null;
    const [year, month, day] = payload.dueDate.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
  })();
  let reminderAtDateTime = payload.reminderAtDateTime || null;
  if (scheduledHasTime && scheduledDateTime && !reminderAtDateTime) {
    reminderAtDateTime = new Date(Date.parse(scheduledDateTime) - Number(payload.reminderOffsetMinutes || 0) * 60000).toISOString();
  }
  return { scheduledDateTime, scheduledHasTime, reminderAtDateTime };
}

function cancelTaskReminder(taskId) {
  cancelReminder(`task:${taskId}`);
  cancelReminder(`capture:task:${taskId}`);
}

function buildTaskReminderPayload(id, payload) {
  const ts = payload.reminderAtDateTime || (payload.scheduledHasTime ? payload.scheduledDateTime : null) || buildTaskReminderTimestamp(payload.dueDate, payload.time);
  if (!ts) return null;
  return {
    id: `capture:task:${id}`,
    ts,
    title: 'Task reminder',
    body: payload.title,
    type: 'task',
    priority: 'normal'
  };
}

export async function saveTask(uid, parsed) {
  if (!uid || !parsed || !parsed.title) return null;

  const taskData = {
    title: parsed.title,
    type: 'task',
    dueDate: parsed.dueDate || null,
    time: parsed.time || null,
    reminderOffsetMinutes: parsed.reminderOffsetMinutes ?? null,
    tags: parsed.tags || [],
    completed: false,
    priority: parsed.priority || 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const payload = { ...taskData, ...buildTaskScheduleFields({ ...taskData, ...parsed }, true) };

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
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const current = snapshot.data();
  const data = { ...current, ...updates };
  const scheduleChanged = ['dueDate', 'time'].some((key) => Object.hasOwn(updates, key));
  const scheduleFields = scheduleChanged ? buildTaskScheduleFields({ ...data, scheduledDateTime: null, reminderAtDateTime: null }) : {};
  await updateDoc(ref, { ...updates, ...scheduleFields, updatedAt: new Date().toISOString() });
  if (scheduleChanged || Object.hasOwn(updates, 'title') || Object.hasOwn(updates, 'completed')) {
    cancelTaskReminder(taskId);
    const reminderPayload = buildTaskReminderPayload(taskId, { ...data, ...scheduleFields });
    if (reminderPayload && !data.completed) scheduleReminder(reminderPayload);
  }
}

export async function deleteTask(uid, taskId) {
  if (!uid || !taskId) return;
  cancelTaskReminder(taskId);
  const ref = doc(tasksCollection(uid), taskId);
  await deleteDoc(ref);
}

export async function markTaskCompleted(uid, taskId, completed) {
  if (!uid || !taskId) return;
  await updateTask(uid, taskId, { completed });
}
