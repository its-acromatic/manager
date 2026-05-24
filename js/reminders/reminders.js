import { fetchCapturesByType, deleteCapture } from '../services/spotlightService.js';
import { parseISOToLocalDate, formatLocalISO } from '../utils/date.js';

let currentFilter = 'all';
let currentUid = null;

export function initRemindersPage() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      filterBtns.forEach((btnItem) => btnItem.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      await loadRemindersPage(currentUid);
    });
  });
}

export async function loadRemindersPage(uid) {
  currentUid = uid;
  const container = document.getElementById('reminders-container');
  const summary = document.getElementById('reminders-summary');
  if (!container || !summary) return;

  if (!uid) {
    container.innerHTML = '<div style="text-align:center;color:var(--secondary);padding:40px">Please sign in to manage reminders and exams.</div>';
    summary.textContent = 'Sign in to view saved reminders.';
    return;
  }

  container.innerHTML = '<div style="text-align:center;color:var(--secondary);padding:40px">Loading reminders…</div>';
  summary.textContent = '';

  try {
    const reminders = await fetchCapturesByType(uid, 'reminder');
    const exams = await fetchCapturesByType(uid, 'exam');
    const items = [...reminders, ...exams].map((item) => ({
      ...item,
      displayDate: formatDueDate(item.dueDate),
      displayTime: item.time ? formatTime(item.time) : null
    }));

    const filtered = currentFilter === 'all'
      ? items
      : items.filter((item) => item.type === currentFilter);

    renderReminders(filtered, items.length);
  } catch (error) {
    console.error('Failed to load reminders page', error);
    container.innerHTML = '<div style="text-align:center;color:var(--secondary);padding:40px">Unable to load reminders. Try again later.</div>';
    summary.textContent = '';
  }
}

function renderReminders(items, totalCount) {
  const container = document.getElementById('reminders-container');
  const summary = document.getElementById('reminders-summary');
  if (!container || !summary) return;

  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--secondary);padding:40px">No reminders or exams found for the selected filter.</div>';
    summary.textContent = totalCount ? `Showing ${items.length} items in this view.` : 'No reminders or exams saved yet.';
    return;
  }

  container.innerHTML = '';
  summary.textContent = `Showing ${items.length} of ${totalCount} saved reminder${totalCount === 1 ? '' : 's'} and exam${totalCount === 1 ? '' : 's'}.`;

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'reminder-card';

    const content = document.createElement('div');
    content.className = 'reminder-content';

    const title = document.createElement('h3');
    title.textContent = item.title || (item.type === 'exam' ? 'Exam' : 'Reminder');
    content.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'reminder-meta';
    meta.innerHTML = `
      <span class="reminder-badge ${item.type}">${item.type}</span>
      <span>${item.displayDate || 'No date'}</span>
      ${item.displayTime ? `<span>${item.displayTime}</span>` : ''}
    `;
    content.appendChild(meta);

    card.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'reminder-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!currentUid) return;
      const confirmed = confirm('Delete this reminder/exam?');
      if (!confirmed) return;
      await deleteCapture(currentUid, item.id);
      await loadRemindersPage(currentUid);
    });
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function formatDueDate(dateStr) {
  if (!dateStr) return 'No date';
  const parsed = typeof dateStr === 'string' ? parseISOToLocalDate(dateStr) : dateStr;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return dateStr;
  const today = new Date();
  const todayISO = formatLocalISO(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = formatLocalISO(tomorrow);
  if (dateStr === todayISO) return 'Today';
  if (dateStr === tomorrowISO) return 'Tomorrow';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(time) {
  if (!time) return '';
  const hour = String(time.hour).padStart(2, '0');
  const minute = String(time.minute || 0).padStart(2, '0');
  return `${hour}:${minute}`;
}
