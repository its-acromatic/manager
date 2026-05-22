import { db, subscribeAuth } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

// render helpers
function el(id) { return document.getElementById(id); }

async function loadAttendanceForUser(uid) {
  const col = collection(db, 'users', uid, 'attendance');
  const q = query(col, orderBy('date'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderPlaceholder(text) {
  const ph = el('analytics-placeholder');
  const canvas = el('attendance-chart');
  canvas.style.display = 'none';
  ph.textContent = text;
}

function renderCards(total, present) {
  el('total-days').textContent = total;
  el('present-days').textContent = present;
  const pct = total === 0 ? '—' : Math.round((present / total) * 100) + '%';
  el('attendance-percent').textContent = pct;
}

function renderChart(labels, data) {
  const canvas = el('attendance-chart');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  // destroy existing chart if present
  if(window._attendanceChart) window._attendanceChart.destroy();
  window._attendanceChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Attendance (1=Present)', data, borderColor: '#6ee7b7', backgroundColor: 'rgba(110,231,183,0.12)', tension:0.2 }] },
    options: { scales: { y: { min: 0, max: 1, ticks: { callback: v => v === 1 ? 'Present' : 'Absent' } } } }
  });
}

subscribeAuth(async (user) => {
  if(!user) {
    renderPlaceholder('Sign in to view analytics.');
    return;
  }
  const uid = user.uid;
  try {
    const rows = await loadAttendanceForUser(uid);
    if(!rows || rows.length === 0) {
      renderCards(0,0);
      renderPlaceholder('No attendance data yet. Mark attendance to populate analytics.');
      return;
    }
    // assume each doc has { status: 'present' | 'absent' | 'off', date }
    const labels = rows.map(r => r.date || r.id);
    const numeric = rows.map(r => (r.status === 'present' ? 1 : 0));
    const total = rows.filter(r => r.status !== 'off').length;
    const present = rows.filter(r => r.status === 'present').length;
    renderCards(total, present);
    renderChart(labels, numeric);
    el('analytics-placeholder').textContent = '';
  } catch (e) {
    renderPlaceholder('Error loading analytics: ' + e.message);
  }
});
