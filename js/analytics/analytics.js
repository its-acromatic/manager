import { db, subscribeAuth } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { countAttendanceRecords, calculateAttendancePercent } from '../attendance/engine.js';

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

function renderChart(statusCounts) {
  const canvas = el('attendance-chart');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  if(window._attendanceChart) window._attendanceChart.destroy();
  const labels = ['Present', 'Absent', 'Off', 'Holiday', 'Vacation', 'Unmarked'];
  const data = [
    statusCounts.present,
    statusCounts.absent,
    statusCounts.off,
    statusCounts.holiday,
    statusCounts.vacation,
    statusCounts.unmarked
  ];
  window._attendanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Attendance status counts',
        data,
        backgroundColor: ['#37b24d', '#fa5252', '#6c757d', '#3366ff', '#9b5de5', '#adb5bd']
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
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
    const counts = countAttendanceRecords(rows);
    const total = counts.totalWorking;
    const present = counts.present;
    renderCards(total, present);
    renderChart(counts);
    el('analytics-placeholder').textContent = '';
  } catch (e) {
    renderPlaceholder('Error loading analytics: ' + e.message);
  }
});
