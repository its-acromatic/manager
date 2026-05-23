// Spotlight: Global quick capture system
// Keyboard-accessible command palette for tasks, reminders, events, and notes

import { parseSpotlightInput, formatParsedForDisplay } from './parser.js';
import { saveSpotlightCapture } from '../services/spotlightService.js';

let spotlightOpen = false;
let currentParsed = null;

export function initSpotlight() {
  // Bind keyboard shortcut: Cmd+K or Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleSpotlight();
    }
  });
}

export function toggleSpotlight() {
  if (spotlightOpen) {
    closeSpotlight();
  } else {
    openSpotlight();
  }
}

export function openSpotlight() {
  if (spotlightOpen) return;
  spotlightOpen = true;
  currentParsed = null;

  const overlay = document.createElement('div');
  overlay.id = 'spotlight-overlay';
  overlay.className = 'spotlight-overlay';

  const modal = document.createElement('div');
  modal.className = 'spotlight-modal';

  modal.innerHTML = `
    <div class="spotlight-header">
      <h2 style="margin:0;font-size:1.1rem;font-weight:400;color:var(--text)">Quick Capture</h2>
      <p style="margin:6px 0 0;font-size:0.85rem;color:var(--secondary)">cmd+k or ctrl+k</p>
    </div>
    <input 
      id="spotlight-input" 
      type="text" 
      class="spotlight-input" 
      placeholder="Type to capture… (e.g., physics assignment tomorrow 5pm)" 
      autocomplete="off"
    />
    <div id="spotlight-parsed" class="spotlight-parsed"></div>
    <div id="spotlight-actions" class="spotlight-actions"></div>
    <div class="spotlight-footer">
      <p style="font-size:0.75rem;color:var(--secondary);margin:0">Type naturally. We'll parse dates, times & types. Press Enter or click Save.</p>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const input = modal.querySelector('#spotlight-input');
  const parsedDiv = modal.querySelector('#spotlight-parsed');
  const actionsDiv = modal.querySelector('#spotlight-actions');

  // Input live feedback
  input.addEventListener('input', () => {
    const raw = input.value.trim();
    if (!raw) {
      parsedDiv.innerHTML = '';
      actionsDiv.innerHTML = '';
      currentParsed = null;
      return;
    }

    currentParsed = parseSpotlightInput(raw);
    if (currentParsed.error) {
      parsedDiv.innerHTML = `<div class="spotlight-error">${currentParsed.error}</div>`;
      actionsDiv.innerHTML = '';
      return;
    }

    const display = formatParsedForDisplay(currentParsed);
    const typeTag = `<span class="spotlight-type-tag spotlight-type-${currentParsed.type}">${currentParsed.type}</span>`;
    parsedDiv.innerHTML = `<div class="spotlight-preview">${typeTag} ${display}</div>`;

    actionsDiv.innerHTML = `
      <button id="spotlight-save" class="spotlight-btn-save">Save</button>
      <button id="spotlight-cancel" class="spotlight-btn-cancel">Cancel</button>
    `;

    modal.querySelector('#spotlight-save').addEventListener('click', () => {
      saveAndClose();
    });
    modal.querySelector('#spotlight-cancel').addEventListener('click', () => {
      closeSpotlight();
    });
  });

  // Keyboard shortcuts
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentParsed && !currentParsed.error) {
      saveAndClose();
    } else if (e.key === 'Escape') {
      closeSpotlight();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSpotlight();
    }
  });

  // Close on ESC globally
  const onEsc = (e) => {
    if (e.key === 'Escape' && spotlightOpen) {
      closeSpotlight();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);

  input.focus();

  async function saveAndClose() {
    if (!currentParsed || currentParsed.error) return;

    input.disabled = true;
    const saveBtn = modal.querySelector('#spotlight-save');
    if (saveBtn) saveBtn.textContent = 'Saving...';

    try {
      // Get current user (assumed to be set globally or via auth context)
      const user = getCurrentUser?.();
      if (!user) {
        alert('Please sign in first');
        input.disabled = false;
        if (saveBtn) saveBtn.textContent = 'Save';
        return;
      }

      await saveSpotlightCapture(user.uid, currentParsed);
      closeSpotlight();
      // Optional: show success toast
      showSpotlightToast('Captured!');
    } catch (err) {
      console.error('Spotlight save error:', err);
      input.disabled = false;
      if (saveBtn) saveBtn.textContent = 'Save';
      alert('Failed to save. Try again.');
    }
  }
}

export function closeSpotlight() {
  spotlightOpen = false;
  currentParsed = null;
  const overlay = document.getElementById('spotlight-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function showSpotlightToast(message) {
  const toast = document.createElement('div');
  toast.className = 'spotlight-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('spotlight-toast-show');
  }, 10);
  setTimeout(() => {
    toast.classList.remove('spotlight-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Helper to get current user (connected to auth context)
function getCurrentUser() {
  // The user is set globally from js/app.js subscribeAuth
  return window._currentUser || null;
}
