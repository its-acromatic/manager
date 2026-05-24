const THEME_STORAGE_KEY = 'manager-theme';
const DEFAULT_THEME = 'OLED';

export const THEMES = {
  OLED: {
    '--bg': '#050507',
    '--bg-soft': '#090b10',
    '--surface': 'rgba(10,12,18,0.95)',
    '--surface-soft': 'rgba(10,12,18,0.82)',
    '--surface-strong': 'rgba(13,16,23,0.98)',
    '--card-bg': 'rgba(10,12,18,0.75)',
    '--border': 'rgba(255,255,255,0.08)',
    '--border-strong': 'rgba(255,255,255,0.14)',
    '--accent': '#6fe2ff',
    '--accent-soft': 'rgba(111,226,255,0.16)',
    '--text': '#f7f9ff',
    '--secondary': '#b8c3d6',
    '--muted': '#7b8491',
    '--shadow': '0 30px 90px rgba(0,0,0,0.40)',
    '--shadow-soft': '0 16px 40px rgba(0,0,0,0.24)',
    '--glow': '0 0 42px rgba(111,226,255,0.18)',
    '--blur': '20px',
    '--radius': '24px',
    '--font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  Graphite: {
    '--bg': '#10131b',
    '--bg-soft': '#131724',
    '--surface': 'rgba(18,22,29,0.95)',
    '--surface-soft': 'rgba(20,24,32,0.80)',
    '--surface-strong': 'rgba(18,22,29,0.98)',
    '--card-bg': 'rgba(18,22,29,0.78)',
    '--border': 'rgba(255,255,255,0.07)',
    '--border-strong': 'rgba(255,255,255,0.10)',
    '--accent': '#8aa7ff',
    '--accent-soft': 'rgba(138,167,255,0.14)',
    '--text': '#e8edf8',
    '--secondary': '#a5adbf',
    '--muted': '#7d8597',
    '--shadow': '0 28px 84px rgba(0,0,0,0.34)',
    '--shadow-soft': '0 14px 32px rgba(0,0,0,0.20)',
    '--glow': '0 0 32px rgba(138,167,255,0.14)',
    '--blur': '18px',
    '--radius': '18px',
    '--font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  Frost: {
    '--bg': '#0c1628',
    '--bg-soft': '#101e34',
    '--surface': 'rgba(15,23,36,0.92)',
    '--surface-soft': 'rgba(18,28,42,0.78)',
    '--surface-strong': 'rgba(18,26,40,0.96)',
    '--card-bg': 'rgba(17,25,38,0.78)',
    '--border': 'rgba(165,220,255,0.12)',
    '--border-strong': 'rgba(165,220,255,0.18)',
    '--accent': '#8cd8ff',
    '--accent-soft': 'rgba(140,216,255,0.16)',
    '--text': '#edf5ff',
    '--secondary': '#b5c9dd',
    '--muted': '#8d9fb1',
    '--shadow': '0 32px 96px rgba(0,0,0,0.38)',
    '--shadow-soft': '0 18px 46px rgba(0,0,0,0.22)',
    '--glow': '0 0 48px rgba(140,216,255,0.18)',
    '--blur': '24px',
    '--radius': '22px',
    '--font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  Blueprint: {
    '--bg': '#08101f',
    '--bg-soft': '#0d1727',
    '--surface': 'rgba(14,20,31,0.94)',
    '--surface-soft': 'rgba(14,20,31,0.76)',
    '--surface-strong': 'rgba(14,20,31,0.98)',
    '--card-bg': 'rgba(13,18,28,0.76)',
    '--border': 'rgba(78,151,255,0.14)',
    '--border-strong': 'rgba(78,151,255,0.22)',
    '--accent': '#5db7ff',
    '--accent-soft': 'rgba(93,183,255,0.15)',
    '--text': '#eef4ff',
    '--secondary': '#a1b3d0',
    '--muted': '#7c8aa6',
    '--shadow': '0 30px 92px rgba(0,0,0,0.36)',
    '--shadow-soft': '0 16px 40px rgba(0,0,0,0.22)',
    '--glow': '0 0 42px rgba(93,183,255,0.16)',
    '--blur': '20px',
    '--radius': '20px',
    '--font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
};

export function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
}

export function applyTheme(name) {
  const themeName = typeof name === 'string' && THEMES[name] ? name : DEFAULT_THEME;
  const theme = THEMES[themeName];
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.documentElement.dataset.theme = themeName.toLowerCase();
  localStorage.setItem(THEME_STORAGE_KEY, themeName);
}

export function initializeTheme() {
  applyTheme(getStoredTheme());
}
