// Firestore operations for Spotlight captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

const capturesCollection = (uid) => collection(db, 'users', uid, 'captures');

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
  return { id: ref.id, ...payload };
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
}

export async function deleteCapture(uid, captureId) {
  if (!uid || !captureId) return;
  const ref = doc(capturesCollection(uid), captureId);
  await deleteDoc(ref);
}

export async function markCaptureCompleted(uid, captureId, completed) {
  if (!uid || !captureId) return;
  await updateCapture(uid, captureId, { completed });
}
