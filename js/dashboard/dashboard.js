import { db } from '../firebase.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { calculateAttendance, calculateSafeLeaves } from '../attendance/calculator.js';

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
  const list = document.getElementById('events-list');
  if(!list) return;
  list.innerHTML = 'Loading...';

  try {
    const eventsCol = collection(db, 'users', uid, 'events');
    const q = query(eventsCol, orderBy('date'));
    const snapshot = await getDocs(q);
    const events = [];
    snapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

    list.innerHTML = '';
    if(events.length === 0) list.innerHTML = '<li style="color:var(--secondary)">No upcoming events</li>';

    events.slice(0,6).forEach(ev => {
      const li = document.createElement('li');
      const time = ev.startTime ? ` — <small style="color:var(--secondary)">${ev.startTime}</small>` : '';
      const desc = ev.description ? `<p style="color:var(--secondary);margin:6px 0">${ev.description}</p>` : '';
      li.innerHTML = `<strong>${ev.title}</strong><br><small style="color:var(--secondary)">${ev.date}${time}</small>${desc}`;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li style="color:var(--secondary)">Error loading events</li>';
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

    let totalWorking = 0, present = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if(!data) return;

      const status = typeof data.status === 'string' ? data.status.toLowerCase() : null;
      if(status === 'present' || status === 'absent') {
        totalWorking++;
        if(status === 'present') present++;
        return;
      }

      // fallback for legacy docs saved using workingDay/present fields
      if(data.workingDay !== undefined || data.present !== undefined) {
        if(data.workingDay) {
          totalWorking++;
          if(data.present) present++;
        }
      }
    });

    const percent = calculateAttendance(present, totalWorking);
    percentEl.textContent = totalWorking === 0 ? '--%' : `${percent}%`;
    const safeLeaves = calculateSafeLeaves(present, totalWorking, 75);

    infoEl.textContent = totalWorking === 0 ? 'No working days recorded yet.' : `Present ${present}/${totalWorking}. Safe leaves left: ${safeLeaves}`;
  } catch (err) {
    console.error(err);
  }
}
