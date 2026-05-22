import { signIn, signUp } from './firebase.js';

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  return overlay;
}

export function showLoginModal({ onSuccess, force = false } = {}) {
  const overlay = createOverlay();
  const modal = document.createElement('div');
  modal.className = 'modal';

  // build inner HTML depending on forced mode
  modal.innerHTML = `
    <h3>Sign in to Manager</h3>
    <input id="m-email" type="email" placeholder="Email" />
    <input id="m-pass" type="password" placeholder="Password" />
    <div class="actions">
      <button id="m-signin" class="primary">Sign In</button>
      <button id="m-signup" class="ghost">Sign Up</button>
      ${force ? '' : '<button id="m-close" class="ghost">Close</button>'}
    </div>
    <p id="m-status" style="color:var(--secondary);margin-top:8px"></p>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const email = modal.querySelector('#m-email');
  const pass = modal.querySelector('#m-pass');
  const signin = modal.querySelector('#m-signin');
  const signup = modal.querySelector('#m-signup');
  const close = modal.querySelector('#m-close');
  const status = modal.querySelector('#m-status');

  async function doClose() { overlay.remove(); }

  // only allow outside-click to close when not forced
  if(!force) overlay.addEventListener('click', (e) => { if(e.target === overlay) doClose(); });

  // prevent ESC from closing when forced
  function onKey(e) { if(e.key === 'Escape' && !force) doClose(); }
  document.addEventListener('keydown', onKey);

  signin.addEventListener('click', async () => {
    try {
      await signIn(email.value, pass.value);
      status.textContent = 'Signed in';
      if(onSuccess) onSuccess();
      doClose();
    } catch (e) { status.textContent = 'Sign in failed: ' + e.message; }
  });

  signup.addEventListener('click', async () => {
    try {
      await signUp(email.value, pass.value);
      status.textContent = 'Account created and signed in';
      if(onSuccess) onSuccess();
      doClose();
    } catch (e) { status.textContent = 'Sign up failed: ' + e.message; }
  });

  if(close) close.addEventListener('click', doClose);
  // cleanup listener on close
  overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKey));
}

export function showEventModal({ date, existing = null, onSave, onDelete } = {}) {
  const overlay = createOverlay();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>${existing ? 'Edit Event' : 'Add Event'}</h3>
    <label style="color:var(--secondary)">Date</label>
    <input id="m-date" type="date" value="${date || ''}" />
    <label style="color:var(--secondary)">Title</label>
    <input id="m-title" type="text" value="${existing ? existing.title : ''}" />
    <div class="row">
      <div style="flex:1">
        <label style="color:var(--secondary)">Start time</label>
        <input id="m-start" type="time" value="${existing ? existing.startTime || '' : ''}" />
      </div>
      <div style="width:12px"></div>
      <div style="flex:1">
        <label style="color:var(--secondary)">End time</label>
        <input id="m-end" type="time" value="${existing ? existing.endTime || '' : ''}" />
      </div>
    </div>
    <label style="color:var(--secondary)">Description</label>
    <textarea id="m-desc" rows="4">${existing ? existing.description || '' : ''}</textarea>
    <div class="actions">
      <button id="m-save" class="primary">Save</button>
      <button id="m-cancel" class="ghost">Cancel</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.remove(); });

  modal.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());
  modal.querySelector('#m-save').addEventListener('click', () => {
    const title = modal.querySelector('#m-title').value.trim();
    const dateVal = modal.querySelector('#m-date').value;
    const startTime = modal.querySelector('#m-start').value || '';
    const endTime = modal.querySelector('#m-end').value || '';
    const description = modal.querySelector('#m-desc').value.trim() || '';
    if(!title || !dateVal) return;
    if(onSave) onSave({ title, date: dateVal, description, startTime, endTime });
    overlay.remove();
  });
  // delete handler when editing an existing event
  if(existing && existing.id) {
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = 'Delete';
    del.style.marginLeft = '8px';
    del.addEventListener('click', () => {
      if(confirm('Delete this event?')) {
        if(typeof onDelete === 'function') onDelete(existing.id);
        overlay.remove();
      }
    });
    const actions = modal.querySelector('.actions');
    actions.insertBefore(del, actions.firstChild);
  }
}

export function showDayModal({ date, events = [], onAdd, onOpenEvent } = {}) {
  const overlay = createOverlay();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>Events on ${date}</h3>
    <div id="day-events-list" style="max-height:320px;overflow:auto;margin-top:8px"></div>
    <div class="actions">
      <button id="day-add" class="primary">Add Event</button>
      <button id="day-close" class="ghost">Close</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const list = modal.querySelector('#day-events-list');
  function render() {
    list.innerHTML = '';
    if(!events || events.length === 0) {
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = 'No events for this date.';
      list.appendChild(p);
      return;
    }
    events.forEach(ev => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '8px 6px';
      item.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
      const left = document.createElement('div');
      left.style.flex = '1';
      const title = document.createElement('div');
      title.textContent = ev.title || '(untitled)';
      const meta = document.createElement('div');
      meta.className = 'muted';
      meta.style.fontSize = '0.9rem';
      meta.textContent = (ev.startTime ? ev.startTime : '') + (ev.endTime ? ' - ' + ev.endTime : '') + (ev.description ? ' • ' + ev.description : '');
      left.appendChild(title);
      left.appendChild(meta);
      const openBtn = document.createElement('button');
      openBtn.className = 'ghost';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => { if(onOpenEvent) onOpenEvent(ev); overlay.remove(); });
      item.appendChild(left);
      item.appendChild(openBtn);
      list.appendChild(item);
    });
  }
  render();

  modal.querySelector('#day-add').addEventListener('click', () => { if(onAdd) onAdd(); overlay.remove(); });
  modal.querySelector('#day-close').addEventListener('click', () => overlay.remove());
}

export function showAttendanceModal({ date, existing = null, onSave } = {}) {
  const overlay = createOverlay();
  const modal = document.createElement('div');
  modal.className = 'modal';
  const existingNote = existing?.meta?.note ? existing.meta.note : '';
  modal.innerHTML = `
    <h3>Mark Attendance</h3>
    <label style="color:var(--secondary)">Date</label>
    <input id="m-date" type="date" value="${date || ''}" />
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
      <button id="m-off" class="ghost" style="flex:1;min-width:80px">Off</button>
      <button id="m-present" class="ghost" style="flex:1;min-width:80px">Present</button>
      <button id="m-absent" class="ghost" style="flex:1;min-width:80px">Absent</button>
      <button id="m-holiday" class="ghost" style="flex:1;min-width:80px">Holiday</button>
      <button id="m-vacation" class="ghost" style="flex:1;min-width:80px">Vacation</button>
    </div>
    <label style="color:var(--secondary);margin-top:14px">Note</label>
    <textarea id="m-note" rows="3" placeholder="Optional note"></textarea>
    <div class="actions" style="margin-top:14px">
      <button id="m-save" class="primary">Save</button>
      <button id="m-cancel" class="ghost">Cancel</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const noteInput = modal.querySelector('#m-note');
  if (noteInput) noteInput.value = existingNote;

  overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.remove(); });

  const btnOff = modal.querySelector('#m-off');
  const btnPresent = modal.querySelector('#m-present');
  const btnAbsent = modal.querySelector('#m-absent');
  const btnHoliday = modal.querySelector('#m-holiday');
  const btnVacation = modal.querySelector('#m-vacation');
  const saveBtn = modal.querySelector('#m-save');
  const cancelBtn = modal.querySelector('#m-cancel');

  let state = 'off';
  if(existing && typeof existing.status === 'string') state = existing.status.toLowerCase();
  else if(existing && existing.workingDay !== undefined) {
    state = existing.workingDay === false ? 'off' : (existing.present ? 'present' : 'absent');
  }

  function updateSelection() {
    const buttons = [
      { btn: btnOff, value: 'off' },
      { btn: btnPresent, value: 'present' },
      { btn: btnAbsent, value: 'absent' },
      { btn: btnHoliday, value: 'holiday' },
      { btn: btnVacation, value: 'vacation' }
    ];
    buttons.forEach(({ btn, value }) => {
      btn.classList.toggle('primary', state === value);
      btn.classList.toggle('ghost', state !== value);
    });
  }
  updateSelection();

  btnOff.addEventListener('click', () => { state = 'off'; updateSelection(); });
  btnPresent.addEventListener('click', () => { state = 'present'; updateSelection(); });
  btnAbsent.addEventListener('click', () => { state = 'absent'; updateSelection(); });
  btnHoliday.addEventListener('click', () => { state = 'holiday'; updateSelection(); });
  btnVacation.addEventListener('click', () => { state = 'vacation'; updateSelection(); });

  cancelBtn.addEventListener('click', () => overlay.remove());
  saveBtn.addEventListener('click', () => {
    const dateVal = modal.querySelector('#m-date').value;
    const note = modal.querySelector('#m-note').value.trim();
    if(!dateVal) return;
    const payload = { date: dateVal, status: state, meta: {} };
    if(note) payload.meta.note = note;
    if(onSave) onSave(payload);
    overlay.remove();
  });
}

export function showAttendanceRangeModal({ start = '', end = '', onSave } = {}) {
  const overlay = createOverlay();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>Bulk Mark Attendance</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
      <div style="flex:1;min-width:160px;">
        <label style="color:var(--secondary)">Start date</label>
        <input id="m-start" type="date" value="${start}" />
      </div>
      <div style="flex:1;min-width:160px;">
        <label style="color:var(--secondary)">End date</label>
        <input id="m-end" type="date" value="${end}" />
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
      <button id="m-off" class="ghost" style="flex:1;min-width:80px">Off</button>
      <button id="m-present" class="ghost" style="flex:1;min-width:80px">Present</button>
      <button id="m-absent" class="ghost" style="flex:1;min-width:80px">Absent</button>
      <button id="m-holiday" class="ghost" style="flex:1;min-width:80px">Holiday</button>
      <button id="m-vacation" class="ghost" style="flex:1;min-width:80px">Vacation</button>
    </div>
    <div class="actions" style="margin-top:14px">
      <button id="m-save" class="primary">Save</button>
      <button id="m-cancel" class="ghost">Cancel</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.remove(); });

  const startInput = modal.querySelector('#m-start');
  const endInput = modal.querySelector('#m-end');
  const btnOff = modal.querySelector('#m-off');
  const btnPresent = modal.querySelector('#m-present');
  const btnAbsent = modal.querySelector('#m-absent');
  const btnHoliday = modal.querySelector('#m-holiday');
  const btnVacation = modal.querySelector('#m-vacation');
  const saveBtn = modal.querySelector('#m-save');
  const cancelBtn = modal.querySelector('#m-cancel');

  let state = 'present';

  function updateSelection() {
    const buttons = [
      { btn: btnOff, value: 'off' },
      { btn: btnPresent, value: 'present' },
      { btn: btnAbsent, value: 'absent' },
      { btn: btnHoliday, value: 'holiday' },
      { btn: btnVacation, value: 'vacation' }
    ];
    buttons.forEach(({ btn, value }) => {
      btn.classList.toggle('primary', state === value);
      btn.classList.toggle('ghost', state !== value);
    });
  }
  updateSelection();

  btnOff.addEventListener('click', () => { state = 'off'; updateSelection(); });
  btnPresent.addEventListener('click', () => { state = 'present'; updateSelection(); });
  btnAbsent.addEventListener('click', () => { state = 'absent'; updateSelection(); });
  btnHoliday.addEventListener('click', () => { state = 'holiday'; updateSelection(); });
  btnVacation.addEventListener('click', () => { state = 'vacation'; updateSelection(); });

  cancelBtn.addEventListener('click', () => overlay.remove());
  saveBtn.addEventListener('click', () => {
    const startDate = startInput.value;
    const endDate = endInput.value;
    if(!startDate || !endDate) return;
    if(startDate > endDate) {
      alert('End date must be the same or after start date.');
      return;
    }
    if(onSave) onSave({ start: startDate, end: endDate, status: state });
    overlay.remove();
  });
}
