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
  const today = new Date().toISOString().slice(0, 10);

  const reminders = [];

  const capturesQuery = query(collection(db, 'users', uid, 'captures'));
  const capturesSnap = await getDocs(capturesQuery);
  capturesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.type === 'task' && data.completed !== true) {
      reminders.push({
        id: docSnap.id,
        source: 'task',
        title: data.title || 'Untitled task',
        detail: data.dueDate ? `Due ${data.dueDate}` : 'No due date',
        dueDate: data.dueDate || null
      });
    }
    if (data.type === 'event' && data.dueDate === today) {
      const time = data.time ? `${String(data.time.hour).padStart(2, '0')}:${String(data.time.minute || 0).padStart(2, '0')}` : 'All day';
      reminders.push({
        id: docSnap.id,
        source: 'event',
        title: data.title || 'Untitled event',
        detail: `Today · ${time}`
      });
    }
  });

  const eventTodayQuery = query(collection(db, 'users', uid, 'events'), where('date', '==', today));
  const eventTodaySnap = await getDocs(eventTodayQuery);
  eventTodaySnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const time = data.startTime || 'All day';
    reminders.push({
      id: docSnap.id,
      source: 'event',
      title: data.title || 'Untitled event',
      detail: `Today · ${time}`
    });
  });

  // Sort reminders with events first, then tasks due sooner
  reminders.sort((a, b) => {
    if (a.source === b.source) {
      return (a.dueDate || '') > (b.dueDate || '') ? 1 : -1;
    }
    return a.source === 'event' ? -1 : 1;
  });

  return reminders.slice(0, 6);
}
