const CONTAINER_ID = 'manager-toast-container';
const MAX_VISIBLE = 4;
const MAX_QUEUED = 40;
const TYPE_COLORS = {
  task: '#72b7ff',
  event: '#f39a75',
  exam: '#f0c66e',
  reminder: '#75d1b0',
  test: '#aab4c2'
};

let containerEl = null;
let queue = [];
let visibleCount = 0;
let droppedCount = 0;
const records = new Map();

function ensureContainer() {
  if (containerEl?.isConnected) return containerEl;

  containerEl = document.createElement('div');
  containerEl.id = CONTAINER_ID;
  containerEl.setAttribute('role', 'region');
  containerEl.setAttribute('aria-label', 'Notifications');
  containerEl.style.position = 'fixed';
  containerEl.style.zIndex = '12000';
  containerEl.style.pointerEvents = 'none';
  containerEl.style.top = '16px';
  containerEl.style.right = '16px';
  containerEl.style.width = 'min(400px, calc(100vw - 32px))';
  containerEl.style.display = 'flex';
  containerEl.style.flexDirection = 'column';
  containerEl.style.gap = '10px';
  document.body.appendChild(containerEl);
  return containerEl;
}

function categoryColor(type) {
  return TYPE_COLORS[type] || 'var(--accent, #72b7ff)';
}

function renderNext() {
  const root = ensureContainer();
  while (visibleCount < MAX_VISIBLE && queue.length) {
    const record = queue.shift();
    if (!record || record.dismissed) continue;
    renderToast(root, record);
  }

  if (queue.length === 0 && droppedCount > 0) {
    const count = droppedCount;
    droppedCount = 0;
    showToast({
      id: `notification-overflow-${Date.now()}`,
      type: 'reminder',
      title: 'More notifications',
      message: `${count} additional notifications were grouped to keep this list manageable.`,
      ttl: 7000
    });
  }
}

function renderToast(root, record) {
  const { item } = record;
  const ttl = item.ttl;
  const color = categoryColor(item.type);
  const card = document.createElement('article');
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-atomic', 'true');
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  card.style.pointerEvents = 'auto';
  card.style.display = 'grid';
  card.style.gridTemplateColumns = '4px minmax(0, 1fr) 32px';
  card.style.gap = '13px';
  card.style.alignItems = 'stretch';
  card.style.width = '100%';
  card.style.color = 'var(--text, #f4f7fb)';
  card.style.background = 'var(--surface-strong, rgba(18,22,30,0.98))';
  card.style.border = '1px solid var(--border-strong, rgba(255,255,255,0.14))';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 12px 32px rgba(0,0,0,0.32)';
  card.style.opacity = '0';
  card.style.transform = 'translateY(-8px)';
  card.style.transition = 'opacity 180ms ease, transform 180ms ease';

  const accent = document.createElement('div');
  accent.style.background = color;
  accent.style.borderRadius = '12px 0 0 12px';
  card.appendChild(accent);

  const content = document.createElement('div');
  content.style.minWidth = '0';
  content.style.padding = '13px 0 15px';

  const heading = document.createElement('div');
  heading.style.display = 'flex';
  heading.style.alignItems = 'center';
  heading.style.gap = '8px';

  const kind = document.createElement('span');
  kind.textContent = item.type ? String(item.type) : 'update';
  kind.style.color = color;
  kind.style.fontSize = '0.7rem';
  kind.style.fontWeight = '700';
  kind.style.textTransform = 'uppercase';
  kind.style.flex = '0 0 auto';
  heading.appendChild(kind);

  const title = document.createElement('strong');
  title.textContent = item.title || 'Manager';
  title.style.minWidth = '0';
  title.style.fontSize = '0.9rem';
  title.style.lineHeight = '1.35';
  title.style.overflowWrap = 'anywhere';
  heading.appendChild(title);
  content.appendChild(heading);

  if (item.message) {
    const message = document.createElement('div');
    message.textContent = item.message;
    message.style.marginTop = '5px';
    message.style.color = 'var(--secondary, #a1a9b7)';
    message.style.fontSize = '0.84rem';
    message.style.lineHeight = '1.45';
    message.style.overflowWrap = 'anywhere';
    content.appendChild(message);
  }

  if (item.actionLabel) {
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = item.actionLabel;
    action.style.marginTop = '9px';
    action.style.padding = '5px 0';
    action.style.border = '0';
    action.style.background = 'transparent';
    action.style.color = color;
    action.style.fontWeight = '700';
    action.style.cursor = 'pointer';
    action.addEventListener('click', () => {
      try { item.onAction?.(); } catch (error) { console.error('Notification action failed', error); }
      record.dismiss();
    });
    content.appendChild(action);
  }
  card.appendChild(content);

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.title = 'Dismiss';
  close.textContent = '\u00d7';
  close.style.width = '32px';
  close.style.height = '32px';
  close.style.margin = '9px 8px 0 0';
  close.style.border = '0';
  close.style.borderRadius = '6px';
  close.style.background = 'transparent';
  close.style.color = 'var(--secondary, #a1a9b7)';
  close.style.fontSize = '1.3rem';
  close.style.cursor = 'pointer';
  close.addEventListener('click', () => record.dismiss());
  card.appendChild(close);

  const progress = document.createElement('div');
  progress.style.position = 'absolute';
  progress.style.left = '4px';
  progress.style.right = '0';
  progress.style.bottom = '0';
  progress.style.height = '2px';
  progress.style.background = color;
  progress.style.transformOrigin = 'left';
  progress.style.transform = 'scaleX(1)';
  progress.style.transition = `transform ${ttl}ms linear`;
  card.appendChild(progress);

  record.card = card;
  record.progress = progress;
  record.remaining = ttl;
  record.startedAt = 0;
  record.timer = null;
  record.dismiss = () => dismissRecord(record);
  records.set(record.id, record);
  visibleCount += 1;
  root.appendChild(card);

  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
    startTimer(record);
  });

  card.addEventListener('pointerenter', () => pauseTimer(record));
  card.addEventListener('pointerleave', () => {
    if (!card.contains(document.activeElement)) resumeTimer(record);
  });
  card.addEventListener('focusin', () => pauseTimer(record));
  card.addEventListener('focusout', (event) => {
    if (!card.contains(event.relatedTarget) && !card.matches(':hover')) resumeTimer(record);
  });
}

function startTimer(record) {
  if (record.dismissed) return;
  if (record.card.matches(':hover') || record.card.contains(document.activeElement)) return;
  record.startedAt = performance.now();
  record.progress.style.transition = `transform ${record.remaining}ms linear`;
  record.progress.style.transform = 'scaleX(0)';
  record.timer = setTimeout(record.dismiss, record.remaining);
}

function pauseTimer(record) {
  if (!record.timer || record.dismissed) return;
  clearTimeout(record.timer);
  record.timer = null;
  record.remaining = Math.max(0, record.remaining - (performance.now() - record.startedAt));
  record.progress.style.transition = 'none';
  record.progress.style.transform = `scaleX(${record.remaining / record.item.ttl})`;
}

function resumeTimer(record) {
  if (record.timer || record.dismissed) return;
  if (record.remaining <= 0) {
    record.dismiss();
    return;
  }
  record.progress.style.transform = `scaleX(${record.remaining / record.item.ttl})`;
  record.progress.getBoundingClientRect();
  requestAnimationFrame(() => startTimer(record));
}

function dismissRecord(record) {
  if (record.dismissed) return;
  record.dismissed = true;
  if (record.timer) clearTimeout(record.timer);
  records.delete(record.id);
  const queuedIndex = queue.indexOf(record);
  if (queuedIndex !== -1) {
    queue.splice(queuedIndex, 1);
    renderNext();
    return;
  }

  if (record.card) {
    visibleCount = Math.max(0, visibleCount - 1);
    record.card.style.opacity = '0';
    record.card.style.transform = 'translateY(-6px)';
    setTimeout(() => record.card?.remove(), 190);
  }
  renderNext();
}

export function showToast({ id, icon, title, message, actionLabel, onAction, type, ttl = 5000 }) {
  const toastId = String(id || `toast-${Date.now()}-${Math.random()}`);
  const item = { icon, title, message, actionLabel, onAction, type, ttl: Math.max(1200, Number(ttl) || 5000) };
  const existing = records.get(toastId);
  if (existing) {
    if (existing.card) existing.dismiss();
    else {
      existing.item = item;
      return { remove: existing.dismiss };
    }
  }

  const record = { id: toastId, item, dismissed: false };
  if (visibleCount < MAX_VISIBLE && queue.length === 0) {
    renderToast(ensureContainer(), record);
  } else if (queue.length < MAX_QUEUED) {
    queue.push(record);
    records.set(toastId, record);
    renderNext();
  } else {
    droppedCount += 1;
  }
  return { remove: record.dismiss || (() => dismissRecord(record)) };
}

export function clearToasts() {
  records.forEach((record) => {
    record.dismissed = true;
    if (record.timer) clearTimeout(record.timer);
  });
  records.clear();
  queue = [];
  visibleCount = 0;
  droppedCount = 0;
  if (containerEl) containerEl.remove();
  containerEl = null;
}