import { db } from '../firebase.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { countAttendanceRecords, calculateAttendancePercent, calculateSafeLeavesFromTotals, countAttendanceNotes, calculateAttendanceStreaks } from '../attendance/engine.js';
import { formatLocalISO, parseISOToLocalDate } from '../utils/date.js';
import { fetchTasks } from '../services/taskService.js';

function getDashboardInsight(counts, requiredPercent = 75) {
  if (counts.totalWorking === 0) return 'Smart insight: Start marking attendance to unlock recovery guidance.';
  const percent = calculateAttendancePercent(counts.present, counts.totalWorking);
  if (percent >= requiredPercent) return `Smart insight: On track for ${requiredPercent}% attendance.`;
  const missing = Math.ceil((requiredPercent / 100) * counts.totalWorking - counts.present);
  return `Smart insight: ${missing > 0 ? `Need ${missing} more present day${missing === 1 ? '' : 's'} to reach ${requiredPercent}%` : `Keep the pace to stay above ${requiredPercent}%`}.`;
}

export async function loadDashboard(uid) {
  console.log('Dashboard Loaded');
  if(!uid) {
    const list = document.getElementById('events-list');
    if(list) list.innerHTML = '<li style="color:var(--secondary)">Please sign in via Settings to view events.</li>';
    const percentEl = document.getElementById('attendance-percent');
    const infoEl = document.getElementById('attendance-info');
    if(percentEl) percentEl.textContent = '--%';
    if(infoEl) infoEl.textContent = 'Please sign in via Settings to view attendance.';
    return;
  }

  await loadUpcomingEvents(uid);
  await loadAttendanceSummary(uid);
  await loadDashboardTasks(uid);
}

async function loadUpcomingEvents(uid) {
  const todayList = document.getElementById('today-events-list');
  const upcomingList = document.getElementById('events-list');
  if(!todayList || !upcomingList) return;
  todayList.innerHTML = 'Loading...';
  upcomingList.innerHTML = 'Loading...';

  try {
    const events = [];

    // Load manual calendar events
    const eventsCol = collection(db, 'users', uid, 'events');
    const q = query(eventsCol, orderBy('date'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => events.push({ id: doc.id, ...doc.data(), source: 'manual' }));

    // Load Spotlight event captures
    const capturesCol = collection(db, 'users', uid, 'captures');
    const captureSnapshot = await getDocs(capturesCol);
    captureSnapshot.forEach(doc => {
      const data = doc.data();
      if(data.type === 'event' && data.dueDate) {
        events.push({
          id: doc.id,
          title: data.title,
          date: data.dueDate,
          startTime: data.time ? `${String(data.time.hour).padStart(2, '0')}:${String(data.time.minute || 0).padStart(2, '0')}` : null,
          source: 'spotlight'
        });
      }
    });

    const todayISO = formatLocalISO(new Date());
    const normalizeDateOnly = (value) => {
      if(!value) return null;
      const dateObj = typeof value === 'string' ? parseISOToLocalDate(value) : value;
      if(!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
      return formatLocalISO(dateObj);
    };

    const normalizedEvents = events.map(ev => ({
      ...ev,
      normalizedDate: normalizeDateOnly(ev.date)
    }));

    // Sort by date
    normalizedEvents.sort((a, b) => {
      const aDate = a.normalizedDate || '';
      const bDate = b.normalizedDate || '';
      return aDate.localeCompare(bDate);
    });

    const todayEvents = normalizedEvents.filter(ev => ev.normalizedDate === todayISO);
    const upcomingEvents = normalizedEvents.filter(ev => ev.normalizedDate && ev.normalizedDate > todayISO).slice(0, 3);

    todayList.innerHTML = '';
    if(todayEvents.length === 0) {
      todayList.innerHTML = '<li style="color:var(--secondary)">No events today</li>';
    } else {
      todayEvents.forEach(ev => {
        const li = document.createElement('li');
        const time = ev.startTime ? ` — <small style="color:var(--secondary)">${ev.startTime}</small>` : '';
        const desc = ev.description ? `<p style="color:var(--secondary);margin:6px 0">${ev.description}</p>` : '';
        li.innerHTML = `<strong>${ev.title}</strong><br><small style="color:var(--secondary)">${ev.date}${time}</small>${desc}`;
        todayList.appendChild(li);
      });
    }

    upcomingList.innerHTML = '';
    if(upcomingEvents.length === 0) {
      upcomingList.innerHTML = '<li style="color:var(--secondary)">No upcoming events</li>';
    } else {
      upcomingEvents.forEach(ev => {
        const li = document.createElement('li');
        const time = ev.startTime ? ` — <small style="color:var(--secondary)">${ev.startTime}</small>` : '';
        const desc = ev.description ? `<p style="color:var(--secondary);margin:6px 0">${ev.description}</p>` : '';
        li.innerHTML = `<strong>${ev.title}</strong><br><small style="color:var(--secondary)">${ev.date}${time}</small>${desc}`;
        upcomingList.appendChild(li);
      });
      const totalFuture = normalizedEvents.filter(ev => ev.normalizedDate && ev.normalizedDate > todayISO).length;
      if(totalFuture > upcomingEvents.length) {
        const more = document.createElement('li');
        more.style.color = 'var(--secondary)';
        more.textContent = `And ${totalFuture - upcomingEvents.length} more upcoming event(s)`;
        upcomingList.appendChild(more);
      }
    }
  } catch (err) {
    todayList.innerHTML = '<li style="color:var(--secondary)">Error loading today events</li>';
    upcomingList.innerHTML = '<li style="color:var(--secondary)">Error loading events</li>';
    console.error(err);
  }
}

async function loadAttendanceSummary(uid) {
  const percentEl = document.getElementById('attendance-percent');
  const infoEl = document.getElementById('attendance-info');
  if(!percentEl || !infoEl) return;

  try {
    const attCol = collection(db, 'users', uid, 'attendance');
    const snapshot = await getDocs(attCol);

    const records = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if(!data) return;

      const date = data.date || doc.id;
      const status = typeof data.status === 'string' ? data.status.toLowerCase() : null;
      if(status) {
        records.push({ date, status });
        return;
      }

      // fallback for legacy docs saved using workingDay/present fields
      if(data.workingDay !== undefined || data.present !== undefined) {
        const legacyStatus = data.workingDay === false ? 'off' : (data.present ? 'present' : 'absent');
        records.push({ date, status: legacyStatus });
      }
    });

    const counts = countAttendanceRecords(records);
    const percent = calculateAttendancePercent(counts.present, counts.totalWorking);
    percentEl.textContent = counts.totalWorking === 0 ? '--%' : `${percent}%`;
    const safeLeaves = calculateSafeLeavesFromTotals(counts.present, counts.totalWorking, 75);
    const notesCount = countAttendanceNotes(records);
    const streaks = calculateAttendanceStreaks(records);
    const extras = [];
    if(counts.off) extras.push(`${counts.off} Off`);
    if(counts.holiday) extras.push(`${counts.holiday} Holiday`);
    if(counts.vacation) extras.push(`${counts.vacation} Vacation`);
    const noteSummary = notesCount ? ` ${notesCount} note${notesCount === 1 ? '' : 's'}` : '';
    const streakSummary = ` Current streak ${streaks.current}, best ${streaks.best}.`;
    const insight = getDashboardInsight(counts, 75);

    infoEl.textContent = counts.totalWorking === 0
      ? `No working days recorded yet.${noteSummary}${extras.length ? ' ' + extras.join(', ') : ''}`
      : `Present ${counts.present}/${counts.totalWorking}. Safe leaves left: ${safeLeaves}.${streakSummary}${noteSummary}${extras.length ? ' ' + extras.join(', ') : ''} ${insight}`;
  } catch (err) {
    console.error(err);
  }
}

async function loadDashboardTasks(uid) {
  const tasksList = document.getElementById('dashboard-tasks-list');
  if(!tasksList) return;

  try {
    const tasks = await fetchTasks(uid);

    // Get pending tasks (not completed), include undated tasks too
    const pending = tasks.filter(t => !t.completed);
    const sorted = pending.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.title.localeCompare(b.title);
    });
    const limited = sorted.slice(0, 5);

    if (limited.length === 0) {
      tasksList.innerHTML = '<li style="color:var(--secondary);text-align:center;padding:20px">No pending tasks</li>';
      return;
    }

    tasksList.innerHTML = '';
    limited.forEach(task => {
      const li = document.createElement('li');
      li.className = 'dashboard-task-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', async () => {
        // Quick complete - navigate to tasks page for full update
        window.location.href = 'tasks.html';
      });

      const span = document.createElement('span');
      span.textContent = task.title;

      li.appendChild(checkbox);
      li.appendChild(span);
      tasksList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}
