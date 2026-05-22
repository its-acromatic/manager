import { db } from '../firebase.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { countAttendanceRecords, calculateAttendancePercent, calculateSafeLeavesFromTotals, countAttendanceNotes, calculateAttendanceStreaks } from '../attendance/engine.js';
import { formatLocalISO, parseISOToLocalDate } from '../utils/date.js';

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
}

async function loadUpcomingEvents(uid) {
  const todayList = document.getElementById('today-events-list');
  const upcomingList = document.getElementById('events-list');
  if(!todayList || !upcomingList) return;
  todayList.innerHTML = 'Loading...';
  upcomingList.innerHTML = 'Loading...';

  try {
    const eventsCol = collection(db, 'users', uid, 'events');
    const q = query(eventsCol, orderBy('date'));
    const snapshot = await getDocs(q);
    const events = [];
    snapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

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

    infoEl.textContent = counts.totalWorking === 0
      ? `No working days recorded yet.${noteSummary}${extras.length ? ' ' + extras.join(', ') : ''}`
      : `Present ${counts.present}/${counts.totalWorking}. Safe leaves left: ${safeLeaves}.${streakSummary}${noteSummary}${extras.length ? ' ' + extras.join(', ') : ''}`;
  } catch (err) {
    console.error(err);
  }
}
