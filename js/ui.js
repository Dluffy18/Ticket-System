// Shared interface pieces: icons, stamps, serials, toasts, dialogs, pager.
import { esc } from './util.js';
import { t } from './strings.js';
import { statusWord } from './store.js';

const P = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-4M13 17V7M18 17v-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  summary: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
  wifiOff: '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5a15 15 0 0 1 11.3 3.8M16.9 11.3a10 10 0 0 1 2.2 1.6M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="m2 2 20 20"/>',
  cloudOff: '<path d="m2 2 20 20"/><path d="M5.8 5.8A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.3-.2M21.5 16.5A4.5 4.5 0 0 0 17.5 9h-1.8a7 7 0 0 0-5.5-3.9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  arrowL: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  retake: '<path d="M3 12a9 9 0 0 1 15.7-6L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-15.7 6L3 16"/><path d="M8 16H3v5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6M16 13H8M16 17H8M10 9H8"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  fileX: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/><path d="m9.5 11.5 5 5M14.5 11.5l-5 5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}

export function serial(no, cls = '') {
  return `<span class="serial ${cls}">${esc(no)}</span>`;
}

export function stamp(status, { admin = false } = {}) {
  return `<span class="stamp stamp-${esc(status)}">${esc(statusWord(status, admin))}</span>`;
}
export function paidStamp(paid) {
  return paid ? `<span class="stamp stamp-paid">${esc(t('stPaid'))}</span>` : `<span class="tag tag-unpaid">${esc(t('stUnpaid'))}</span>`;
}
export function unsyncedTag() {
  // stamp-style mark in lists; reads "Unsynced", announced as "Not synced yet"
  return `<span class="stamp stamp-sync" title="${esc(t('notSyncedYet'))}"><span aria-hidden="true">${esc(t('stUnsyncedShort'))}</span><span class="sr-only">${esc(t('notSyncedYet'))}</span></span>`;
}

// ---- Toasts
let toastHost;
export function toast(msg, kind = 'info') {
  if (!toastHost) toastHost = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : kind === 'offline' ? 'wifiOff' : 'check')}<span>${esc(msg)}</span>`;
  toastHost.prepend(el); // newest on top
  requestAnimationFrame(() => el.classList.add('in'));
  const ms = Math.min(9000, 3200 + msg.length * 40);
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, ms);
}

// ---- Dialog (confirmations that protect a final action)
// opts: { title, body, confirm, danger, typeToConfirm, textarea: {label, hint, max} }
export function dialog(opts) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    const needType = opts.typeToConfirm != null;
    dlg.innerHTML = `
      <form method="dialog" class="dlg-form" novalidate>
        <h2 class="dlg-title">${esc(opts.title)}</h2>
        ${opts.body ? `<p class="dlg-body">${esc(opts.body)}</p>` : ''}
        ${needType ? `<label class="field"><span class="lbl">${esc(t('cancelTypeNo', { no: opts.typeToConfirm }))}</span>
          <input class="input input-serial" name="confirmNo" inputmode="numeric" autocomplete="off" required></label>` : ''}
        ${opts.textarea ? `<label class="field"><span class="lbl">${esc(opts.textarea.label)}</span>
          <textarea class="input" name="text" rows="3" maxlength="${opts.textarea.max || 200}"></textarea>
          <span class="hint">${esc(opts.textarea.hint || '')}</span></label>` : ''}
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" value="cancel" data-act="cancel">${esc(opts.cancel || t('cancel'))}</button>
          <button type="submit" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" value="ok" data-act="ok" ${needType ? 'disabled' : ''}>${esc(opts.confirm)}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('[data-act=ok]');
    const typed = dlg.querySelector('[name=confirmNo]');
    if (typed) typed.addEventListener('input', () => { ok.disabled = typed.value.trim() !== String(opts.typeToConfirm); });
    let result = null;
    dlg.querySelector('[data-act=cancel]').addEventListener('click', () => dlg.close());
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      if (needType && typed.value.trim() !== String(opts.typeToConfirm)) return;
      result = { ok: true, text: dlg.querySelector('[name=text]')?.value || '' };
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    (typed || dlg.querySelector('textarea') || ok).focus();
  });
}

// ---- Pager: first, last, current ±1, gaps as "…"
export function pager(page, pages) {
  if (pages <= 1) return '';
  const set = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
  const nums = [...set].sort((a, b) => a - b);
  let html = `<nav class="pager" aria-label="Pages">
    <button class="btn btn-ghost btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${icon('chevL')}<span>${esc(t('prev'))}</span></button>
    <span class="pager-nums">`;
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) html += `<span class="pager-gap" aria-hidden="true">…</span>`;
    html += `<button class="pager-n ${n === page ? 'on' : ''}" data-page="${n}" ${n === page ? 'aria-current="page"' : ''} aria-label="${esc(t('page', { n }))}">${n}</button>`;
    prev = n;
  }
  html += `</span><button class="btn btn-ghost btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}><span>${esc(t('nextPage'))}</span>${icon('chevR')}</button></nav>`;
  return html;
}

export function paginate(items, page, per = 10) {
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = Math.min(Math.max(1, page), pages);
  return { page: p, pages, slice: items.slice((p - 1) * per, p * per), a: items.length ? (p - 1) * per + 1 : 0, b: Math.min(p * per, items.length), n: items.length };
}

// Keep a one-line row on one line: narrow the letters first, then shrink to a 12px floor.
// Past the floor the [data-fit-cut] part ends in "…" (CSS); the rest never gets cut.
const FIT_STEPS = [[100, 14], [87.5, 14], [75, 14], [75, 13], [75, 12]];
export function fitLines(root) {
  root.querySelectorAll('[data-fit]').forEach(el => {
    const cut = el.querySelector('[data-fit-cut]');
    for (const [stretch, px] of FIT_STEPS) {
      el.style.fontStretch = stretch === 100 ? '' : stretch + '%';
      el.style.fontSize = px === 14 ? '' : px + 'px';
      if (el.scrollWidth <= el.clientWidth && (!cut || cut.scrollWidth <= cut.clientWidth)) break;
    }
  });
}

export function emptyState(title, body, iconName = 'file') {
  return `<div class="empty">${icon(iconName, 'empty-ic')}<p class="empty-title">${esc(title)}</p><p class="empty-body">${esc(body)}</p></div>`;
}

// Key/value rows used on detail pages.
export function kv(rows) {
  return `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => k
    ? `<div class="kv-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`
    : `<div class="kv-row kv-full"><dd>${v}</dd></div>`).join('')}</dl>`;
}

// Image downscale for camera captures: max 1280px JPEG.
export function shrinkImage(source, max = 1280) {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

// ---- Menu button (single choice). Shared by Home's Citation Type and the
// Citations Status filter. items: [{ value, name, right, rightClass, checked }]
export function menuMarkup({ id, label, inlineLabel = false, value, items, labelledBy, placeholder = '' }) {
  return `
    <div class="type-menu" data-menu="${esc(id)}">
      <button type="button" class="type-menu-btn" id="${esc(id)}-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="${esc(id)}-list"${labelledBy ? ` aria-labelledby="${esc(labelledBy)} ${esc(id)}-val"` : ''}>
        ${inlineLabel ? `<span class="lbl">${esc(label)}</span>` : ''}
        <span class="type-menu-val ${value ? '' : 'is-placeholder'}" id="${esc(id)}-val">${esc(value || placeholder)}</span>
        ${icon('chevD', 'type-menu-chev')}
      </button>
      <ul class="type-menu-list" id="${esc(id)}-list" role="menu" aria-labelledby="${esc(id)}-btn" hidden>
        ${items.map(it => `<li role="none"><button type="button" role="menuitemradio" aria-checked="${!!it.checked}" tabindex="-1" class="type-menu-item" data-value="${esc(it.value)}">
          <span class="type-menu-check">${it.checked ? icon('check') : ''}</span>
          <span class="type-menu-name">${esc(it.name)}</span>
          ${it.right != null ? `<span class="type-menu-state ${it.rightClass || ''}"><span class="sr"> · </span>${esc(it.right)}</span>` : ''}
        </button></li>`).join('')}
      </ul>
    </div>`;
}

// Opens on click or arrow keys; arrows/Home/End move, Enter picks, Escape or a
// tap outside closes and returns focus to the button.
export function bindMenu(menu, onChoose, onLeave) {
  const btn = menu.querySelector('.type-menu-btn');
  const list = menu.querySelector('.type-menu-list');
  const items = [...list.querySelectorAll('[role=menuitemradio]')];
  const isOpen = () => !list.hidden;
  const focusItem = i => items[(i + items.length) % items.length].focus();
  const open = focusIdx => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    menu.classList.add('open');
    const cur = items.findIndex(x => x.getAttribute('aria-checked') === 'true');
    focusItem(focusIdx ?? Math.max(0, cur));
  };
  const close = (refocus = true) => {
    if (!isOpen()) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('open');
    if (refocus) btn.focus();
  };
  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  btn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); open(items.length - 1); }
  });
  items.forEach((it, i) => {
    it.addEventListener('click', () => { close(false); onChoose(it.dataset.value); });
    it.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
      else if (k === 'Home') { e.preventDefault(); focusItem(0); }
      else if (k === 'End') { e.preventDefault(); focusItem(items.length - 1); }
      else if (k === 'Escape') { e.preventDefault(); close(); }
      else if (k === 'Tab') close(false);
    });
  });
  const outside = e => { if (isOpen() && !menu.contains(e.target)) close(false); };
  document.addEventListener('pointerdown', outside);
  onLeave(() => document.removeEventListener('pointerdown', outside));
}

// Show a new choice in a menu without re-rendering the page around it.
export function setMenuValue(menu, value, label) {
  const val = menu.querySelector('.type-menu-val');
  val.textContent = label;
  val.classList.remove('is-placeholder');
  menu.querySelectorAll('[role=menuitemradio]').forEach(it => {
    const on = it.dataset.value === value;
    it.setAttribute('aria-checked', String(on));
    it.querySelector('.type-menu-check').innerHTML = on ? icon('check') : '';
  });
}

// ---- Date field with our own icon. Empty: a calendar that opens the picker.
// Clearable (filters) with a date: an × that clears it. attrs: extra input attributes.
export function dateBox({ id = '', name, value = '', clearable = false, attrs = '' }) {
  const showX = clearable && value;
  return `<div class="date-box" data-datebox ${clearable ? 'data-clearable' : ''}>
    <input class="input" type="date" ${id ? `id="${esc(id)}"` : ''} name="${esc(name)}" value="${esc(value)}" ${attrs}>
    <button type="button" class="date-btn" data-date-btn aria-label="${esc(showX ? t('clearDate') : t('pickDay'))}" title="${esc(showX ? t('clearDate') : t('pickDay'))}">${icon(showX ? 'x' : 'calendar')}</button>
  </div>`;
}

// onClear runs when the × is tapped; otherwise the button opens the picker.
export function bindDateBox(box, onClear) {
  const input = box.querySelector('input');
  const btn = box.querySelector('[data-date-btn]');
  btn.addEventListener('click', () => {
    if (box.hasAttribute('data-clearable') && input.value) {
      input.value = '';
      onClear?.();
      return;
    }
    try { input.showPicker(); } catch { input.focus(); }
  });
}
