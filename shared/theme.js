// shared/theme.js — Theme logic shared across all pages
const THEME_KEY = "tof_theme";
const htmlEl = document.documentElement;
const mediaDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(mode) {
  if (mode === 'auto') {
    htmlEl.setAttribute('data-theme', mediaDark && mediaDark.matches ? 'dark' : 'light');
  } else {
    htmlEl.setAttribute('data-theme', mode);
  }
  localStorage.setItem(THEME_KEY, mode);
  const sel = document.getElementById("themeMode");
  if (sel) sel.value = mode;
}

mediaDark && mediaDark.addEventListener('change', () => {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  if (saved === 'auto') applyTheme('auto');
});

function initTheme() {
  const sel = document.getElementById("themeMode");
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  if (sel) { sel.value = saved; }
  applyTheme(saved);
  if (sel) sel.addEventListener("change", () => applyTheme(sel.value));
}
