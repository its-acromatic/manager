import { db } from '../firebase.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { generateSessionDates, defaultStatusForDateISO } from '../attendance/engine.js';

const attendanceCollection = (uid) => collection(db, 'users', uid, 'attendance');
const eventsCollection = (uid) => collection(db, 'users', uid, 'events');
const settingsDoc = (uid) => doc(db, 'users', uid, 'settings', 'session');

export async function fetchAttendanceEntries(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(attendanceCollection(uid), orderBy('date')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAttendanceEntry(uid, date) {
  if (!uid || !date) return null;
  const ref = doc(attendanceCollection(uid), date);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveAttendanceEntry(uid, entry) {
  if (!uid || !entry || !entry.date || !entry.status) return null;
  const ref = doc(attendanceCollection(uid), entry.date);
  await setDoc(ref, { date: entry.date, status: entry.status, meta: entry.meta || {} });
  return entry;
}

export async function saveAttendanceRange(uid, start, end, status) {
  if (!uid || !start || !end || !status) return { updated: 0 };
  const dates = generateSessionDates(start, end);
  const existingDocs = await getDocs(attendanceCollection(uid));
  const existingMeta = {};
  existingDocs.forEach((docSnap) => {
    const data = docSnap.data();
    const iso = (data && data.date) ? data.date : docSnap.id;
    if (!iso || iso < start || iso > end) return;
    existingMeta[iso] = data.meta || {};
  });

  const batch = writeBatch(db);
  let updated = 0;
  dates.forEach((date) => {
    const ref = doc(attendanceCollection(uid), date);
    const payload = { date, status };
    if (existingMeta[date]) payload.meta = existingMeta[date];
    batch.set(ref, payload);
    updated += 1;
  });
  await batch.commit();
  return { updated };
}

export async function fetchSessionSettings(uid) {
  if (!uid) return null;
  const snap = await getDoc(settingsDoc(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveSessionSettings(uid, settings) {
  if (!uid || !settings) return;
  await setDoc(settingsDoc(uid), {
    ...(settings.start !== undefined ? { start: settings.start } : {}),
    ...(settings.end !== undefined ? { end: settings.end } : {}),
    ...(settings.requiredPercent !== undefined ? { requiredPercent: settings.requiredPercent } : {}),
    ...(settings.theme !== undefined ? { theme: settings.theme } : {})
    ,...(settings.notifications !== undefined ? { notifications: settings.notifications } : {})
  }, { merge: true });
}

export async function fetchEvents(uid) {
  if (!uid) return [];
  const snap = await getDocs(eventsCollection(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchEventsByDate(uid, date) {
  if (!uid || !date) return [];
  const q = query(eventsCollection(uid), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(uid, payload) {
  if (!uid || !payload || !payload.date || !payload.title) return null;
  const ref = await addDoc(eventsCollection(uid), payload);
  return { id: ref.id, ...payload };
}

export async function updateEvent(uid, id, payload) {
  if (!uid || !id || !payload) return;
  const ref = doc(eventsCollection(uid), id);
  await updateDoc(ref, payload);
}

export async function deleteEvent(uid, id) {
  if (!uid || !id) return;
  const ref = doc(eventsCollection(uid), id);
  await deleteDoc(ref);
}

export async function seedAttendanceRange(uid, start, end) {
  if (!uid || !start || !end) return { created: 0 };
  const docs = await getDocs(attendanceCollection(uid));
  const existing = new Set(docs.docs.map((d) => d.id));
  const batch = writeBatch(db);
  let created = 0;
  generateSessionDates(start, end).forEach((date) => {
    if (!existing.has(date)) {
      const ref = doc(attendanceCollection(uid), date);
      batch.set(ref, { date, status: defaultStatusForDateISO(date) });
      created += 1;
    }
  });
  await batch.commit();
  return { created };
}
