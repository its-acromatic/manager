// Firebase initialization with anonymous auth and Firestore
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, onSnapshot, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

// User-provided config (the user gave their config to the assistant)
const firebaseConfig = {
  apiKey: "AIzaSyBTVaprEboRkZpA-v4I121kF-nxYsYkSzI",
  authDomain: "manager-app-arnav.firebaseapp.com",
  projectId: "manager-app-arnav",
  storageBucket: "manager-app-arnav.firebasestorage.app",
  messagingSenderId: "483457782361",
  appId: "1:483457782361:web:22396f79a05146523c1748"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Resolves once when initial auth state is known (uid or null)
export function waitForInitialAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user ? user.uid : null);
    });
  });
}

// Subscribe to auth state changes; callback receives user or null. Returns unsubscribe.
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, (user) => callback(user));
}

export async function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}

export function currentUserUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

export async function getUserDocRef(uid) {
  return doc(db, 'users', uid);
}
