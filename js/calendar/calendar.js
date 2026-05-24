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
    // fetch events for this date from both collections
    const manualEventsCol = collection(db, 'users', uid, 'events');
    const q = query(manualEventsCol, where('date', '==', info.dateStr));
    const snap = await getDocs(q);
    const dayEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Also fetch Spotlight events for this date
    const capturesCol = collection(db, 'users', uid, 'captures');
    const qCaptures = query(capturesCol, where('dueDate', '==', info.dateStr));
    const snapCaptures = await getDocs(qCaptures);
    snapCaptures.forEach(d => {
      const data = d.data();
      if(data.type === 'event') {
        dayEvents.push({ id: d.id, ...data, fromSpotlight: true });
      }
    });

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
      const isSpotlightEvent = ev.extendedProps?.isSpotlight;
      
      if(isSpotlightEvent) {
        // Handle Spotlight captured event
        const docRef = doc(db, 'users', uid, 'captures', ev.id);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : { title: ev.title, dueDate: ev.startStr };
        const dateStr = data.dueDate || (ev.startStr && ev.startStr.split('T')[0]);
        const existing = { 
          id: ev.id, 
          title: data.title || ev.title, 
          date: dateStr,
          isSpotlight: true
        };
        showEventModal({ date: existing.date, existing: existing, onSave: async (payload) => {
          // Spotlight events are read-only in modal, no edit
          await loadEvents(uid);
        }, onDelete: async (id) => {
          if(id) await deleteDoc(doc(db, 'users', uid, 'captures', id));
          await loadEvents(uid);
        }});
      } else {
        // Handle manual event
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
    }
  });

  await loadEvents(uid);
}

async function loadEvents(uid) {
  if(!calendar) return;
  calendar.removeAllEvents();

  // Load manual calendar events from 'events' collection
  const eventDocs = await getDocs(collection(db, 'users', uid, 'events'));
  eventDocs.forEach(d => {
    const data = d.data();
    let start = data.date;
    if(data.startTime) start = `${data.date}T${data.startTime}`;
    const ev = { id: d.id, title: data.title, start };
    if(data.description) ev.extendedProps = { description: data.description };
    calendar.addEvent(ev);
  });

  // Load Spotlight event captures from 'captures' collection
  const captureDocs = await getDocs(collection(db, 'users', uid, 'captures'));
  captureDocs.forEach(d => {
    const data = d.data();
    // Only add Spotlight events (type === 'event')
    if(data.type === 'event' && data.dueDate) {
      let start = data.dueDate;
      if(data.time) {
        const { hour, minute } = data.time;
        const h = String(hour).padStart(2, '0');
        const m = String(minute || 0).padStart(2, '0');
        start = `${data.dueDate}T${h}:${m}`;
      }
      const ev = { id: d.id, title: data.title, start, extendedProps: { isSpotlight: true } };
      calendar.addEvent(ev);
    }
  });
}
