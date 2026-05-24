import { db } from '../firebase.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

const focusSessionsCollection = (uid) => collection(db, 'users', uid, 'focusSessions');

export async function saveFocusSession(uid, sessionPayload) {
  if (!uid || !sessionPayload) return null;
  const payload = {
    ...sessionPayload,
    createdAt: sessionPayload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const sessionRef = await addDoc(focusSessionsCollection(uid), payload);
  return { id: sessionRef.id, ...payload };
}

export async function fetchFocusSessions(uid) {
  if (!uid) return [];
  const snap = await getDocs(focusSessionsCollection(uid));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchFocusReminders(uid) {
  if (!uid) return [];
  const todayISO = new Date().toISOString().slice(0, 10);

  const reminders = [];

  const capturesQuery = query(collection(db, 'users', uid, 'captures'));
  const capturesSnap = await getDocs(capturesQuery);
  capturesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data || !data.type) return;

    const dueDate = data.dueDate || null;
    const dueLabel = formatDueLabel(dueDate, todayISO);
    const timeLabel = data.time ? ` · ${String(data.time.hour).padStart(2, '0')}:${String(data.time.minute || 0).padStart(2, '0')}` : '';
    const isToday = dueDate === todayISO;

    if (data.type === 'task' && data.completed !== true) {
      reminders.push({
        id: docSnap.id,
        type: 'task',
        title: data.title || 'Untitled task',
        detail: dueDate ? `Due ${dueLabel}${timeLabel}` : 'No due date',
        dueDate,
        order: isToday ? 2 : dueDate ? 4 : 6
      });
    }

    if (data.type === 'event' && dueDate === todayISO) {
      const time = data.time ? `${String(data.time.hour).padStart(2, '0')}:${String(data.time.minute || 0).padStart(2, '0')}` : 'All day';
      reminders.push({
        id: docSnap.id,
        type: 'event',
        title: data.title || 'Untitled event',
        detail: `Today · ${time}`,
        dueDate,
        order: 0
      });
    }

    if (data.type === 'exam') {
      reminders.push({
        id: docSnap.id,
        type: 'exam',
        title: data.title || 'Upcoming exam',
        detail: dueDate ? `Exam ${dueLabel}${timeLabel}` : 'Exam reminder',
        dueDate,
        order: isToday ? 1 : dueDate ? 3 : 5
      });
    }

    if (data.type === 'reminder') {
      reminders.push({
        id: docSnap.id,
        type: 'reminder',
        title: data.title || 'Reminder',
        detail: dueDate ? `${dueLabel}${timeLabel}` : 'Reminder saved',
        dueDate,
        order: isToday ? 1 : dueDate ? 4 : 7
      });
    }
  });

  const eventTodayQuery = query(collection(db, 'users', uid, 'events'), where('date', '==', todayISO));
  const eventTodaySnap = await getDocs(eventTodayQuery);
  eventTodaySnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const time = data.startTime || 'All day';
    reminders.push({
      id: docSnap.id,
      type: 'event',
      title: data.title || 'Untitled event',
      detail: `Today · ${time}`,
      dueDate: todayISO,
      order: 0
    });
  });

  reminders.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  return reminders.slice(0, 6);
}

function formatDueLabel(dateStr, todayISO) {
  if (!dateStr) return 'No date';
  if (dateStr === todayISO) return 'Today';
  const tomorrow = new Date(todayISO);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  if (dateStr === tomorrowISO) return 'Tomorrow';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
