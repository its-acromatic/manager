// Tasks page logic
import { fetchTasks, markTaskCompleted, deleteTask } from '../services/taskService.js';
import { formatLocalISO, parseISOToLocalDate } from '../utils/date.js';

let currentFilter = 'all';

export function initTasks() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      // Re-render with current filter
      const container = document.getElementById('tasks-container');
      if(container && window._currentUid) {
        loadTasks(window._currentUid);
      }
    });
  });
}

export async function loadTasks(uid) {
  const container = document.getElementById('tasks-container');
  const summary = document.getElementById('tasks-summary');
  
  if(!container || !summary) return;
  
  window._currentUid = uid;
  container.innerHTML = '<div style="text-align:center;color:var(--secondary)">Loading...</div>';
  
  try {
    const tasks = await fetchTasks(uid);
    const todayISO = formatLocalISO(new Date());
    
    // Normalize task dates
    const normalized = tasks.map(t => ({
      ...t,
      normalizedDate: normalizeDate(t.dueDate)
    }));

    // Categorize tasks
    const today = normalized.filter(t => t.normalizedDate === todayISO && !t.completed);
    const upcoming = normalized.filter(t => t.normalizedDate && t.normalizedDate > todayISO && !t.completed);
    const overdue = normalized.filter(t => t.normalizedDate && t.normalizedDate < todayISO && !t.completed);
    const completed = normalized.filter(t => t.completed);

    // Summary
    const totalPending = today.length + upcoming.length + overdue.length;
    summary.textContent = `${totalPending} pending • ${completed.length} completed`;

    // Filter and render
    let toShow = [];
    switch(currentFilter) {
      case 'today': toShow = today; break;
      case 'upcoming': toShow = upcoming; break;
      case 'overdue': toShow = overdue; break;
      case 'completed': toShow = completed; break;
      default: toShow = [...overdue, ...today, ...upcoming, ...completed];
    }

    if(toShow.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:var(--secondary);padding:40px">No ${currentFilter === 'all' ? 'tasks' : currentFilter + ' tasks'}</div>`;
      return;
    }

    container.innerHTML = '';
    
    // Render with section headers for 'all' filter
    if(currentFilter === 'all') {
      if(overdue.length > 0) {
        renderSection(container, 'Overdue', overdue, uid);
      }
      if(today.length > 0) {
        renderSection(container, 'Today', today, uid);
      }
      if(upcoming.length > 0) {
        renderSection(container, 'Upcoming', upcoming, uid);
      }
      if(completed.length > 0) {
        renderSection(container, 'Completed', completed, uid);
      }
    } else {
      toShow.forEach(task => {
        const item = createTaskItem(task, uid);
        container.appendChild(item);
      });
    }
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;color:var(--secondary)">Error loading tasks</div>';
    console.error(err);
  }
}

function renderSection(container, title, tasks, uid) {
  const section = document.createElement('div');
  section.className = 'tasks-section';
  
  const heading = document.createElement('h3');
  heading.className = 'section-title';
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'tasks-list';
  
  tasks.forEach(task => {
    const item = createTaskItem(task, uid);
    list.appendChild(item);
  });

  section.appendChild(list);
  container.appendChild(section);
}

function createTaskItem(task, uid) {
  const item = document.createElement('div');
  item.className = `task-item ${task.completed ? 'completed' : ''}`;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  checkbox.addEventListener('change', async () => {
    await markTaskCompleted(uid, task.id, checkbox.checked);
    await loadTasks(uid);
  });

  const content = document.createElement('div');
  content.className = 'task-content';
  
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;
  content.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  
  if(task.dueDate) {
    const dateSpan = document.createElement('span');
    dateSpan.className = 'task-date';
    dateSpan.textContent = formatTaskDate(task.dueDate);
    meta.appendChild(dateSpan);
  }

  if(task.time) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'task-time';
    const h = String(task.time.hour).padStart(2, '0');
    const m = String(task.time.minute || 0).padStart(2, '0');
    timeSpan.textContent = `${h}:${m}`;
    meta.appendChild(timeSpan);
  }

  if(task.priority && task.priority !== 'normal') {
    const prioritySpan = document.createElement('span');
    prioritySpan.className = `task-priority priority-${task.priority}`;
    prioritySpan.textContent = task.priority;
    meta.appendChild(prioritySpan);
  }

  content.appendChild(meta);
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'task-delete';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', async () => {
    if(confirm('Delete this task?')) {
      await deleteTask(uid, task.id);
      await loadTasks(uid);
    }
  });

  item.appendChild(checkbox);
  item.appendChild(content);
  item.appendChild(deleteBtn);
  
  return item;
}

function normalizeDate(value) {
  if(!value) return null;
  const dateObj = typeof value === 'string' ? parseISOToLocalDate(value) : value;
  if(!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
  return formatLocalISO(dateObj);
}

function formatTaskDate(dateStr) {
  if(!dateStr) return '';
  const today = new Date();
  const todayISO = formatLocalISO(today);
  
  if(dateStr === todayISO) return 'Today';
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = formatLocalISO(tomorrow);
  if(dateStr === tomorrowISO) return 'Tomorrow';

  const date = parseISOToLocalDate(dateStr);
  const options = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}
