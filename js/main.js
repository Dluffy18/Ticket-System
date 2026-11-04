import { t, tn } from './strings.js';
import { esc, displayName } from './util.js';
import { loadReference } from './data.js';
import { S, init, me, signOut, startSession, setOnline, subscribe, activeBooklets, findAccount, enforcer, agencyOf } from './store.js';
import { icon, toast } from './ui.js';
import { applyTheme, setTheme, currentTheme } from './views/common.js';
import { signInView, registerView } from './views/auth.js';
import { homeView, typeView, recordView, citationsView, statsView } from './views/enforcer.js';
import { profilePage } from './views/profile.js';
import { overviewView, enforcersView, registrationsView, pendingCount } from './views/admin.js';
import { vCitationsView, summaryView } from './views/verifier.js';
import { bookletsView } from './views/booklets.js';

const app = document.getElementById('app');
let leaveFns = [];
let flash = null;

const NAV = {
  enforcer: [
    ['home', '#/home', 'navHome', 'home'],
    ['type', '#/type', 'navTypeShort', 'layers', 'navType'],
    ['citations', '#/citations', 'navCitations', 'list'],
    ['stats', '#/stats', 'navStats', 'chart'],
    ['profile', '#/profile', 'navProfile', 'user'],
  ],
  office: [
    ['overview', '#/overview', 'navOverview', 'chart'],
    ['enforcers', '#/enforcers', 'navEnforcers', 'users'],
    ['registrations', '#/registrations', 'navRegistrations', 'inbox'],
    ['profile', '#/profile', 'navProfile', 'user'],
  ],
  verifier: [
    ['v', '#/v/citations', 'navCitations', 'list'],
    ['summary', '#/summary', 'navSummary', 'summary'],
    ['booklets', '#/booklets', 'navBooklets', 'book'],
    ['profile', '#/profile', 'navProfile', 'user'],
  ],
};

const ROUTES = {
  enforcer: { home: homeView, type: typeView, record: recordView, citations: citationsView, stats: statsView, profile: profilePage },
  office: { overview: overviewView, enforcers: enforcersView, registrations: registrationsView, profile: profilePage },
  verifier: { v: (root, ctx) => vCitationsView(root, { ...ctx, params: ctx.params.slice(1) }), summary: summaryView, booklets: bookletsView, profile: profilePage },
};

function defaultRoute(u) {
  if (!u) return '#/signin';
  if (u.kind === 'office') return '#/enforcers';
  if (u.kind === 'verifier') return '#/v/citations';
  return activeBooklets(u.id).length ? '#/home' : '#/type';
}

function go(hash, message) {
  flash = message || null;
  if (location.hash === hash) render(); else location.hash = hash;
}

function shell(u, active, focus) {
  const nav = NAV[u.kind];
  const ag = u.kind === 'enforcer' ? agencyOf(u.id) : u.agency ? S.ag.get(u.agency) : null;
  const sub = u.kind === 'enforcer' ? `${ag?.name || ''}${u.badge ? ' · ' + u.badge : ''}` : u.kind === 'office' ? `${t('roleOffice')} · ${ag?.name || ''}` : t('roleVerifier');
  const waiting = u.kind === 'office' ? pendingCount() : 0;
  return `
  <div class="app role-${u.kind} ${focus ? 'is-focus' : ''}">
    <header class="topbar">
      <a class="brand" href="${defaultRoute(u)}"><span class="brand-mark" aria-hidden="true">${icon('file')}</span><span class="brand-name">${esc(t('appName'))}</span></a>
      <div class="who"><span class="who-name">${esc(displayName(u))}</span><span class="who-sub">${esc(sub)}</span></div>
      <button type="button" class="icon-btn topbar-out" data-signout aria-label="${esc(t('signOut'))}" title="${esc(t('signOut'))}">${icon('logout')}</button>
    </header>
    <p class="offline-banner" role="status" ${S.online ? 'hidden' : ''}>${icon('wifiOff')}<span>${esc(t('offlineBanner'))}</span></p>
    ${focus ? '' : `<nav class="nav" aria-label="Main">
      ${nav.map(([key, href, label, ic, long]) => `<a class="nav-a ${key === 'home' ? 'nav-home' : ''} ${key === active ? 'on' : ''}" href="${href}" ${key === active ? 'aria-current="page"' : ''}>
        ${icon(ic)}<span class="nav-l"><span class="nav-short">${esc(t(label))}</span>${long ? `<span class="nav-long">${esc(t(long))}</span>` : ''}</span>
        ${key === 'registrations' && waiting ? `<span class="badge" aria-label="${waiting} waiting">${waiting}</span>` : ''}</a>`).join('')}
      <button type="button" class="nav-a nav-out" data-signout>${icon('logout')}<span class="nav-l">${esc(t('signOut'))}</span></button>
    </nav>`}
    <main id="main" class="main" tabindex="-1"><div class="page" id="page"></div></main>
  </div>`;
}

// On the bottom bar (under 900px) the Enforcer's Home tab sits in the center.
// The element is moved rather than CSS-ordered so keyboard order matches what's seen.
const bottomBar = matchMedia('(max-width: 899px)');
function orderNav() {
  const nav = document.querySelector('.role-enforcer .nav');
  const home = nav?.querySelector('.nav-a[href="#/home"]');
  if (!home) return;
  const anchor = bottomBar.matches ? nav.querySelector('.nav-a[href="#/stats"]') : nav.firstElementChild;
  if (anchor && anchor !== home) nav.insertBefore(home, anchor);
}
bottomBar.addEventListener?.('change', orderNav);

function bindCommon(root) {
  root.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', () => { signOut(); go('#/signin'); }));
  root.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    const dark = currentTheme() === 'dark';
    b.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>${esc(t(dark ? 'lightMode' : 'darkMode'))}</span>`;
  }));
}

function render() {
  leaveFns.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  leaveFns = [];
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const u = me();
  const ctx = {
    params: parts.slice(1), go, rerender: render, onLeave: fn => leaveFns.push(fn),
    afterSignIn: () => go(defaultRoute(me())), bindCommon,
  };
  if (!u) {
    if (parts[0] === 'register') registerView(app, ctx);
    else { if (parts[0] !== 'signin') { history.replaceState(null, '', '#/signin'); } signInView(app, ctx); }
  } else {
    const routes = ROUTES[u.kind];
    const key = parts[0];
    if (!routes[key]) { go(defaultRoute(u), flash); return; }
    const focus = u.kind === 'enforcer' && key === 'record';
    app.innerHTML = shell(u, key === 'record' ? 'home' : key, focus);
    orderNav();
    watchStickTop();
    bindCommon(app);
    const page = document.getElementById('page');
    routes[key](page, ctx);
  }
  window.scrollTo(0, 0);
  if (flash) { const m = flash; flash = null; toast(m); }
  renderDemo();
}

// ------------------------------------------------------------------ offline
// Pinned bars (the recording bar) sit below the header band and, when shown, the offline banner.
const stickRO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => setStickTop()) : null;
function setStickTop() {
  const bar = document.querySelector('.topbar');
  const banner = document.querySelector('.offline-banner');
  if (!bar) return;
  const h = bar.offsetHeight + (banner && !banner.hidden ? banner.offsetHeight : 0);
  document.documentElement.style.setProperty('--stick-top', h + 'px');
}
function watchStickTop() {
  stickRO?.disconnect();
  document.querySelectorAll('.topbar, .offline-banner').forEach(el => stickRO?.observe(el));
  setStickTop();
}

function refreshNet() {
  document.querySelectorAll('.offline-banner').forEach(el => { el.hidden = S.online; });
  setStickTop();
  renderDemo();
}
subscribe((kind, d) => {
  if (kind === 'online') {
    refreshNet();
    if (!d.online) toast(t('offlineToast'), 'offline');
    else toast(d.synced ? tn('backOnlineSynced', d.synced) : t('backOnline'));
  }
  if (kind === 'accounts') {
    const b = document.querySelector('.nav-a[href="#/registrations"] .badge');
    const n = pendingCount();
    const a = document.querySelector('.nav-a[href="#/registrations"]');
    if (a) { if (b) b.remove(); if (n) a.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`); }
  }
});
window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

// ------------------------------------------------------------------ demo panel (testing only)
function renderDemo() {
  let host = document.getElementById('demo');
  if (!host) {
    host = document.createElement('div');
    host.id = 'demo';
    document.body.appendChild(host);
  }
  const open = host.dataset.open === '1';
  const cur = S.session?.id;
  const people = [
    ...S.ref.enforcers.map(e => ({ id: e.id, label: displayName(e), sub: S.ag.get(e.agency).name })),
  ];
  const admins = S.ref.admins.map(a => ({ id: a.id, label: displayName(a), sub: a.role === 'verifier' ? t('roleVerifier') : `${t('roleOffice')} · ${S.ag.get(a.agency).name}` }));
  const btn = p => `<button type="button" class="demo-p ${p.id === cur ? 'on' : ''}" data-as="${p.id}"><span>${esc(p.label)}</span><small>${esc(p.sub)}</small></button>`;
  host.innerHTML = `
    <button type="button" class="demo-fab" aria-expanded="${open}" aria-controls="demo-panel">${icon('sliders')}<span>${esc(t('demo'))}</span>${S.online ? '' : `<span class="demo-dot" aria-label="${esc(t('offline'))}"></span>`}</button>
    <div class="demo-panel" id="demo-panel" ${open ? '' : 'hidden'}>
      <div class="demo-head"><strong>${esc(t('demoTitle'))}</strong><button type="button" class="icon-btn" data-close aria-label="${esc(t('close'))}">${icon('x')}</button></div>
      <p class="demo-note">${esc(t('demoNote'))}</p>
      <p class="demo-h">${esc(t('demoNetwork'))}</p>
      <button type="button" class="btn ${S.online ? 'btn-ghost' : 'btn-primary'} btn-block btn-sm" data-net>${icon(S.online ? 'wifiOff' : 'check')}<span>${esc(S.online ? t('goOffline') : t('goOnline'))}</span></button>
      <p class="demo-h">${esc(t('demoEnforcers'))}</p>
      <div class="demo-list">${people.map(btn).join('')}</div>
      <p class="demo-h">${esc(t('demoAdmins'))}</p>
      <div class="demo-list">${admins.map(btn).join('')}</div>
    </div>`;
  host.querySelector('.demo-fab').addEventListener('click', () => { host.dataset.open = open ? '0' : '1'; renderDemo(); });
  host.querySelector('[data-close]')?.addEventListener('click', () => { host.dataset.open = '0'; renderDemo(); });
  host.querySelector('[data-net]')?.addEventListener('click', () => setOnline(!S.online));
  host.querySelectorAll('[data-as]').forEach(b => b.addEventListener('click', () => {
    const acc = findAccount(b.dataset.as);
    if (!acc) return;
    if (acc.status !== 'active') {
      toast(acc.status === 'inactive' ? t('errInactive') : acc.status === 'pending' ? t('errPending') : t('errRejected'), 'error');
      return;
    }
    startSession(acc);
    host.dataset.open = '0';
    go(defaultRoute(acc));
  }));
}

// ------------------------------------------------------------------ boot
async function boot() {
  applyTheme();
  if (location.protocol === 'file:') {
    app.innerHTML = `<main class="auth"><div class="sheet auth-sheet"><div class="sheet-body"><p class="alert alert-error">${icon('alert')}<span>${esc(t('needServer'))}</span></p></div></div></main>`;
    return;
  }
  app.innerHTML = `<main class="auth"><p class="muted" role="status">${esc(t('loading'))}</p></main>`;
  const { ref, problems } = await loadReference();
  if (problems.length) {
    app.innerHTML = `<main class="auth"><div class="sheet auth-sheet auth-sheet-wide">
      <header class="sheet-head"><h1 class="h1">${esc(t('dataProblemsTitle'))}</h1></header>
      <div class="sheet-body"><p class="lead">${esc(t('dataProblemsLead'))}</p>
      <ul class="problems">${problems.map(p => `<li><span class="p-file">${esc(p.file)}</span>${p.entry ? `<span class="p-entry">${esc(p.entry)}</span>` : ''}<span>${esc(p.text)}</span></li>`).join('')}</ul></div></div></main>`;
    return;
  }
  init(ref);
  window.addEventListener('hashchange', render);
  render();
}

boot().catch(e => {
  console.error(e);
  app.innerHTML = `<main class="auth"><p class="alert alert-error">${esc(e.message)}</p></main>`;
});
