// Firestore operations for Task captures
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

const tasksCollection = (uid) => collection(db, 'users', uid, 'captures');

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
  return { id: ref.id, ...payload };
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
}

export async function deleteTask(uid, taskId) {
  if (!uid || !taskId) return;
  const ref = doc(tasksCollection(uid), taskId);
  await deleteDoc(ref);
}

export async function markTaskCompleted(uid, taskId, completed) {
  if (!uid || !taskId) return;
  await updateTask(uid, taskId, { completed });
}
