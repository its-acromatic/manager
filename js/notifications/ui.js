// In-app toast UI for Manager
const CONTAINER_ID = 'manager-toast-container';
let containerEl = null;

function ensureContainer() {
  if (containerEl) return containerEl;
  containerEl = document.createElement('div');
  containerEl.id = CONTAINER_ID;
  containerEl.style.position = 'fixed';
  containerEl.style.zIndex = '12000';
  containerEl.style.pointerEvents = 'none';
  applyPosition();
  containerEl.style.display = 'flex';
  containerEl.style.flexDirection = 'column';
  containerEl.style.gap = '12px';
  containerEl.style.maxWidth = '420px';
  document.body.appendChild(containerEl);
  window.addEventListener('resize', applyPosition);
  return containerEl;
}

function applyPosition() {
  if (!containerEl) return;
  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  if (isMobile) {
    containerEl.style.left = '50%';
    containerEl.style.top = '12px';
    containerEl.style.transform = 'translateX(-50%)';
    containerEl.style.right = 'auto';
    containerEl.style.alignItems = 'center';
  } else {
    containerEl.style.right = '18px';
    containerEl.style.top = '18px';
    containerEl.style.left = 'auto';
    containerEl.style.transform = 'none';
    containerEl.style.alignItems = 'flex-end';
  }
}

export function showToast({ id, icon, title, message, actionLabel, onAction, ttl = 5000 }) {
  const root = ensureContainer();
  const card = document.createElement('div');
  card.className = 'manager-toast';
  card.style.pointerEvents = 'auto';
  card.style.backdropFilter = 'blur(6px)';
  card.style.background = 'linear-gradient(rgba(16,18,20,0.7), rgba(16,18,20,0.55))';
  card.style.border = '1px solid rgba(255,255,255,0.06)';
  card.style.color = 'white';
  card.style.padding = '12px 14px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
  card.style.width = '320px';
  card.style.maxWidth = 'calc(100vw - 40px)';
  card.style.display = 'flex';
  card.style.gap = '12px';
  card.style.alignItems = 'center';
  card.style.opacity = '0';
  card.style.transform = 'translateY(-8px)';
  card.style.transition = 'opacity 240ms ease, transform 240ms ease';

  if (icon) {
    const img = document.createElement('div');
    img.style.width = '44px';
    img.style.height = '44px';
    img.style.borderRadius = '8px';
    img.style.display = 'flex';
    img.style.alignItems = 'center';
    img.style.justifyContent = 'center';
    img.style.flex = '0 0 44px';
    img.innerHTML = icon;
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.style.flex = '1';
  body.style.minWidth = '0';

  const t = document.createElement('div');
  t.style.fontWeight = '700';
  t.style.fontSize = '0.95rem';
  t.textContent = title || '';
  body.appendChild(t);

  if (message) {
    const m = document.createElement('div');
    m.style.fontSize = '0.92rem';
    m.style.marginTop = '6px';
    m.style.color = 'rgba(255,255,255,0.9)';
    m.textContent = message;
    body.appendChild(m);
  }

  card.appendChild(body);

  if (actionLabel) {
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.style.marginLeft = '8px';
    btn.style.border = 'none';
    btn.style.background = 'rgba(255,255,255,0.06)';
    btn.style.color = 'var(--primary)';
    btn.style.padding = '8px 10px';
    btn.style.borderRadius = '8px';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try { onAction && onAction(); } catch (e) {}
      remove();
    });
    card.appendChild(btn);
  }

  let timeoutId = null;
  let removed = false;

  function remove() {
    if (removed) return;
    removed = true;
    card.style.opacity = '0';
    card.style.transform = 'translateY(-8px)';
    setTimeout(() => { card.remove(); }, 260);
  }

  card.addEventListener('mouseenter', () => { if (timeoutId) clearTimeout(timeoutId); });
  card.addEventListener('mouseleave', () => { timeoutId = setTimeout(remove, ttl); });

  // swipe to dismiss on touch
  let startY = null;
  card.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  card.addEventListener('touchmove', (e) => {
    if (!startY) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 40) remove();
  }, { passive: true });

  root.appendChild(card);

  // animate in
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  timeoutId = setTimeout(remove, ttl);

  return {
    remove
  };
}

export function clearToasts() {
  const c = document.getElementById(CONTAINER_ID);
  if (c) c.remove();
  containerEl = null;
}
