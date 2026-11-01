import { t } from '../strings.js';
import { esc, lsGet, lsSet } from '../util.js';
import { icon } from '../ui.js';

const KEY = 'vt.theme';

// Light unless the user has turned Dark mode on. An older "auto" choice counts as light.
export function currentTheme() { return lsGet(KEY, 'light') === 'dark' ? 'dark' : 'light'; }

export function applyTheme(v = currentTheme()) {
  document.documentElement.dataset.theme = v;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', v === 'dark' ? '#0E1320' : '#1C2B4A');
}

export function setTheme(v) { lsSet(KEY, v); applyTheme(v); }

// One button: "Dark mode" while light, "Light mode" while dark.
export function themeButton(cls = '') {
  const dark = currentTheme() === 'dark';
  return `<button type="button" class="btn btn-ghost btn-block ${cls}" data-theme-toggle>${icon(dark ? 'sun' : 'moon')}<span>${esc(t(dark ? 'lightMode' : 'darkMode'))}</span></button>`;
}
