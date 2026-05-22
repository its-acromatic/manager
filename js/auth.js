import { auth, signOutUser, subscribeAuth } from './firebase.js';
import { showLoginModal } from './modal.js';

const signOutBtn = document.getElementById('signout');
const statusEl = document.getElementById('auth-status');
const authSignedOut = document.getElementById('auth-signedout');
const authSignedIn = document.getElementById('auth-signedin');
const authUser = document.getElementById('auth-user');

if(signOutBtn) signOutBtn.addEventListener('click', async () => {
  try {
    await signOutUser();
    if(statusEl) statusEl.textContent = 'Signed out';
  } catch (e) {
    if(statusEl) statusEl.textContent = 'Sign out failed: ' + e.message;
  }
});

function updateAuthUI(user) {
  const signedIn = !!user;
  if(authSignedOut) authSignedOut.classList.toggle('hidden', signedIn);
  if(authSignedIn) authSignedIn.classList.toggle('hidden', !signedIn);
  if(authUser) authUser.textContent = signedIn ? (user.email || user.uid) : '';
  if(statusEl) statusEl.textContent = signedIn ? `Signed in as ${user.email || user.uid}` : 'Not signed in';
}

const initialState = () => updateAuthUI(auth.currentUser);
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialState);
} else {
  initialState();
}

subscribeAuth(updateAuthUI);
