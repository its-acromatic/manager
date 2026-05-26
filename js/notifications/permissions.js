export async function checkPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch (e) {
    return 'denied';
  }
}

export function isGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
