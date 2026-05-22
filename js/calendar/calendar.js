import { db } from '../firebase.js';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { showLoginModal, showEventModal, showDayModal } from '../modal.js';

let calendar;

export function initCalendar(containerId = 'calendar') {
  const calendarEl = document.getElementById(containerId);
  if(!calendarEl) return;
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    selectable: true,
    events: []
  });
  calendar.render();
}

export async function refreshCalendarForUser(uid) {
  const calendarEl = document.getElementById('calendar');
  if(!calendarEl) return;
  if(!uid) {
    // force login modal (block usage)
    showLoginModal({ onSuccess: () => {}, force: true });
    calendar.removeAllEvents();
    return;
  }

  // setup dateClick / eventClick handlers with current uid
  calendar.setOption('dateClick', async (info) => {
    // fetch events for this date and open a day-list modal first
    const col = collection(db, 'users', uid, 'events');
    const q = query(col, where('date', '==', info.dateStr));
    const snap = await getDocs(q);
    const dayEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    showDayModal({ date: info.dateStr, events: dayEvents,
      onAdd: () => {
        showEventModal({ date: info.dateStr, onSave: async (payload) => {
          await addDoc(collection(db, 'users', uid, 'events'), payload);
          await loadEvents(uid);
        }});
      },
      onOpenEvent: (ev) => {
        // open the event edit modal
        showEventModal({ date: ev.date, existing: ev, onSave: async (payload) => {
          if(ev.id) {
            await updateDoc(doc(db, 'users', uid, 'events', ev.id), { title: payload.title, date: payload.date, description: payload.description || '', startTime: payload.startTime || '', endTime: payload.endTime || '' });
          }
          await loadEvents(uid);
        }, onDelete: async (id) => {
          if(id) await deleteDoc(doc(db, 'users', uid, 'events', id));
          await loadEvents(uid);
        }});
      }
    });
  });

  calendar.setOption('eventClick', async (info) => {
    const ev = info.event;
    // fetch full doc to get all fields
    if(ev.id) {
      const docRef = doc(db, 'users', uid, 'events', ev.id);
      const snap = await getDoc(docRef);
      const data = snap.exists() ? snap.data() : { title: ev.title, date: ev.startStr };
      const existing = { id: ev.id, title: data.title || ev.title, description: data.description || '', startTime: data.startTime || '', endTime: data.endTime || '', date: data.date || (ev.startStr && ev.startStr.split('T')[0]) };
      showEventModal({ date: existing.date, existing: existing, onSave: async (payload) => {
        if(existing.id) {
          await updateDoc(doc(db, 'users', uid, 'events', existing.id), { title: payload.title, date: payload.date, description: payload.description || '', startTime: payload.startTime || '', endTime: payload.endTime || '' });
        }
        await loadEvents(uid);
      }, onDelete: async (id) => {
        if(id) await deleteDoc(doc(db, 'users', uid, 'events', id));
        await loadEvents(uid);
      }});
    }
  });

  await loadEvents(uid);
}

async function loadEvents(uid) {
  const docs = await getDocs(collection(db, 'users', uid, 'events'));
  if(!calendar) return;
  calendar.removeAllEvents();
  docs.forEach(d => {
    const data = d.data();
    let start = data.date;
    if(data.startTime) start = `${data.date}T${data.startTime}`;
    const ev = { id: d.id, title: data.title, start };
    if(data.description) ev.extendedProps = { description: data.description };
    calendar.addEvent(ev);
  });
}
