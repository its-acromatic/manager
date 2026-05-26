// Local persistence for notification configuration only.
const SETTINGS_KEY = 'manager.notifications.settings_v1';

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setSettings(obj) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj || {}));
}
