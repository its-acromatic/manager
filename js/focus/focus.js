// Focus Mode timer (Pomodoro + free timer)
import { fetchTasks } from '../services/taskService.js';
import { saveFocusSession, fetchFocusReminders } from '../services/focusService.js';

let timer = null;
let remaining = 0;
let sessionLength = 0;
let isRunning = false;
let currentType = 'work';
let sessionsCompleted = 0;
let currentSessionStart = null;
let loadedTasks = [];

const SESSION_CONFIG = {
  work: 25,
  short: 5,
  long: 15,
  free: 30
};

const SESSION_LABELS = {
  work: 'Pomodoro Work',
  short: 'Short Break',
  long: 'Long Break',
  free: 'Free Timer'
};

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatTaskOption(task) {
  return `${task.title}${task.dueDate ? ' — ' + task.dueDate : ''}`;
}

async function populateTasks(uid) {
  const select = document.getElementById('focus-task');
  if (!select) return;
  select.innerHTML = '<option value="">-- No task selected --</option>';
  if (!uid) return;

  try {
    const tasks = await fetchTasks(uid);
    loadedTasks = tasks;
    tasks.forEach((task) => {
      const opt = document.createElement('option');
      opt.value = task.id;
      opt.textContent = formatTaskOption(task);
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Failed to load focus tasks', error);
  }
}

async function populateReminders(uid) {
  const container = document.getElementById('focus-reminders');
  if (!container) return;
  container.innerHTML = '<p class="muted">Loading reminders…</p>';
  if (!uid) return;

  try {
    const reminders = await fetchFocusReminders(uid);
    if (!reminders.length) {
      container.innerHTML = '<p class="muted">No reminders for today. Keep the workspace quiet.</p>';
      return;
    }

    container.innerHTML = '';
    reminders.forEach((item) => {
      const card = document.createElement('div');
      card.className = `reminder-card reminder-${item.type}`;

      const title = document.createElement('h3');
      title.textContent = item.title;
      card.appendChild(title);

      const detail = document.createElement('p');
      detail.textContent = item.detail || 'Keep this item in mind today.';
      card.appendChild(detail);

      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = item.type === 'exam'
        ? 'Exam'
        : item.type === 'event'
        ? 'Event today'
        : item.type === 'reminder'
        ? 'Reminder'
        : 'Task reminder';
      card.appendChild(tag);

      container.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load focus reminders', error);
    container.innerHTML = '<p class="muted">Unable to load reminders.</p>';
  }
}

function updateDisplay() {
  const display = document.getElementById('focus-timer');
  if (display) display.textContent = formatSeconds(remaining);

  const indicator = document.getElementById('focus-mode-indicator');
  if (indicator) indicator.textContent = SESSION_LABELS[currentType] || 'Focus';

  const freeSettings = document.getElementById('free-settings');
  if (freeSettings) {
    freeSettings.style.display = currentType === 'free' ? 'grid' : 'none';
  }

  document.querySelectorAll('.session-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === currentType);
  });

  updatePreviewText();
}

function updateStats() {
  const el = document.getElementById('focus-stats');
  if (el) el.textContent = `Sessions completed: ${sessionsCompleted}`;
}

function getSelectedTask() {
  const select = document.getElementById('focus-task');
  if (!select) return null;
  const taskId = select.value;
  return loadedTasks.find((task) => task.id === taskId) || null;
}

function updatePreviewText() {
  const preview = document.getElementById('focus-session-label-preview');
  if (!preview) return;
  const label = getSessionLabel();
  const task = getSelectedTask();
  if (label && task) {
    preview.textContent = `Working on “${label}” for ${task.title}.`;
  } else if (label) {
    preview.textContent = `Working on “${label}”.`;
  } else if (task) {
    preview.textContent = `Working on ${task.title}.`;
  } else {
    preview.textContent = 'Optional session label and task are quiet anchors; leave either blank to work freely.';
  }
}

function isFullscreenSupported() {
  return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || document.documentElement.msRequestFullscreen);
}

async function enterFullscreen() {
  const element = document.documentElement;
  if (element.requestFullscreen) await element.requestFullscreen();
  else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
  else if (element.msRequestFullscreen) await element.msRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
  else if (document.msExitFullscreen) await document.msExitFullscreen();
}

function updateFullscreenButton() {
  const button = document.getElementById('focus-fullscreen');
  if (!button) return;
  button.textContent = document.fullscreenElement ? 'Exit immersive mode' : 'Enter immersive mode';
}

function attemptEnterFullscreenOnGesture() {
  if (!isFullscreenSupported()) return;
  const handler = async () => {
    try {
      await enterFullscreen();
    } catch (err) {
      // ignore blocked fullscreen request
    }
  };
  document.body.addEventListener('click', handler, { once: true });
}

function getSessionLabel() {
  const input = document.getElementById('focus-label');
  return input ? input.value.trim() : '';
}

function getFreeMinutes() {
  const input = document.getElementById('focus-free-minutes');
  const value = input ? parseInt(input.value, 10) : SESSION_CONFIG.free;
  return Number.isFinite(value) && value > 0 ? Math.min(value, 240) : SESSION_CONFIG.free;
}

function resetTimerState() {
  clearInterval(timer);
  timer = null;
  isRunning = false;
  currentSessionStart = null;
}

function setSession(type, minutes) {
  currentType = type;
  sessionLength = minutes;
  remaining = minutes * 60;
  updateDisplay();
}

async function saveSession(uid, status) {
  if (!uid || !currentSessionStart) return;

  const selectedTask = getSelectedTask();
  const endAt = new Date().toISOString();
  const durationMinutes = Math.max(1, Math.round((Date.parse(endAt) - Date.parse(currentSessionStart)) / 60000));

  const payload = {
    type: currentType,
    mode: currentType === 'free' ? 'free' : 'pomodoro',
    label: getSessionLabel() || null,
    taskId: selectedTask?.id || null,
    taskTitle: selectedTask?.title || null,
    plannedMinutes: sessionLength,
    durationMinutes,
    startAt: currentSessionStart,
    endAt,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await saveFocusSession(uid, payload);
  } catch (err) {
    console.error('Unable to persist focus session', err);
  }
}

async function completeSession(uid) {
  resetTimerState();

  if (currentType === 'work') {
    sessionsCompleted += 1;
    updateStats();
    await saveSession(uid, 'completed');
    setSession('short', SESSION_CONFIG.short);
    return;
  }

  if (currentType === 'short' || currentType === 'long') {
    await saveSession(uid, 'completed');
    setSession('work', SESSION_CONFIG.work);
    return;
  }

  await saveSession(uid, 'completed');
  setSession('free', getFreeMinutes());
}

function tick(uid) {
  if (remaining <= 0) {
    completeSession(uid);
    return;
  }

  remaining -= 1;
  updateDisplay();
}

function startSession(uid) {
  if (isRunning) return;
  if (remaining <= 0) {
    if (currentType === 'free') {
      setSession('free', getFreeMinutes());
    } else {
      setSession(currentType, SESSION_CONFIG[currentType] || SESSION_CONFIG.work);
    }
  }

  currentSessionStart = currentSessionStart || new Date().toISOString();
  timer = setInterval(() => tick(uid), 1000);
  isRunning = true;
}

function pauseSession() {
  if (!isRunning) return;
  clearInterval(timer);
  isRunning = false;
}

function resetSession() {
  resetTimerState();
  setSession(currentType, currentType === 'free' ? getFreeMinutes() : SESSION_CONFIG[currentType]);
}

export function initFocus() {
  document.querySelectorAll('.session-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const minutes = type === 'free' ? getFreeMinutes() : parseInt(btn.dataset.min, 10) || SESSION_CONFIG[type] || 25;
      setSession(type, minutes);
    });
  });

  document.getElementById('focus-start')?.addEventListener('click', () => {
    startSession(window._currentUser ? window._currentUser.uid : null);
  });

  document.getElementById('focus-pause')?.addEventListener('click', () => {
    pauseSession();
  });

  document.getElementById('focus-reset')?.addEventListener('click', () => {
    resetSession();
  });

  document.getElementById('focus-fullscreen')?.addEventListener('click', async () => {
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  });

  document.getElementById('focus-free-minutes')?.addEventListener('input', () => {
    if (currentType === 'free') {
      setSession('free', getFreeMinutes());
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenButton);
  attemptEnterFullscreenOnGesture();

  const select = document.getElementById('focus-task');
  const labelInput = document.getElementById('focus-label');

  if (select) {
    select.addEventListener('change', () => {
      if (labelInput) {
        labelInput.placeholder = 'Optional session label';
      }
      updatePreviewText();
    });
  }

  if (labelInput) {
    labelInput.addEventListener('input', () => {
      updatePreviewText();
    });
  }

  const loadFocusData = async (uid) => {
    if (!uid) return;
    await Promise.all([populateTasks(uid), populateReminders(uid)]);
  };

  if (window._currentUser && window._currentUser.uid) {
    loadFocusData(window._currentUser.uid);
  }

  const authInterval = setInterval(() => {
    if (window._currentUser && window._currentUser.uid) {
      loadFocusData(window._currentUser.uid);
      clearInterval(authInterval);
    }
  }, 800);

  setSession('work', SESSION_CONFIG.work);
  updateStats();
}

// Auto-init when loaded as module
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('focus-mode-initialized')) return;
    document.body.classList.add('focus-mode-initialized');
    initFocus();
  });
}
