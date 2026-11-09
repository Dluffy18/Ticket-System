// Super Admin: Overview, every account in one list, and the Activity log.
// Approve sign-ups as Enforcer, Office Admin or Verifier, change roles, correct details,
// reset passwords, and set accounts Inactive or Active again.
import { t, tn } from '../strings.js';
import { esc, fullName, displayName, fDate, fDateTime, fPhone, normName, isToday, isThisMonth, downloadCsv, todayKey } from '../util.js';
import {
  S, me, allAccounts, findAccount, changeStatus, approveAs, changeRole, canManage, roleLabel, ROLES,
  activeBooklets, bookletSize, bookletUsed, subscribe, activityLog, personName, avatarOf,
} from '../store.js';
import { icon, toast, dialog, pager, paginate, emptyState } from '../ui.js';
import { statusTag, historyList, changeLines, STATUS_LABEL } from './admin.js';
import { kpi } from './dash.js';
import { editDetailsDialog, resetPasswordFlow, removePictureFlow } from './acctools.js';
import { reviewPage, card, roleName, agencyText } from './review.js';

const DAY = 86400000;
const WAIT_DAYS = 2;
const ROLE_ICON = { enforcer: 'shield', office: 'users', verifier: 'check' };
const ROLE_DESC = { enforcer: 'roleDescEnforcer', office: 'roleDescOffice', verifier: 'roleDescVerifier' };

export function superPendingCount() {
  const u = me();
  return u && u.kind === 'super' ? allAccounts().filter(a => a.status === 'pending').length : 0;
}

export function accountsView(root, ctx) {
  if (ctx.params[0]) return accountDetail(root, ctx, ctx.params[0]);
  return accountsList(root, ctx);
}

// ------------------------------------------------------------------ Overview
// Links carry a filter for the Accounts list: data-acc="role=office&agency=POLICE".
const accLink = (filter, inner, cls = '') => `<a class="${cls}" href="#/accounts" data-acc="${esc(filter)}">${inner}</a>`;
function bindAccLinks(root) {
  root.querySelectorAll('[data-acc]').forEach(a => a.addEventListener('click', () => {
    const p = new URLSearchParams(a.dataset.acc);
    Object.assign(accState, { q: '', role: p.get('role') || '', agency: p.get('agency') || '', status: p.get('status') || '', page: 1 });
  }));
}

export function superOverviewView(root, ctx) {
  const render = () => {
    const all = allAccounts();
    const active = all.filter(a => a.status === 'active');
    const pending = all.filter(a => a.status === 'pending');
    const now = Date.now();

    // Needs attention: an Agency with no active Office Admin, no active Verifier, sign-ups waiting too long.
    const att = [];
    S.ref.agencies.forEach(ag => {
      if (!active.some(a => a.kind === 'office' && a.agency === ag.id)) {
        att.push({ rank: 0, kind: 'spoiled', icon: 'users', filter: `role=office&agency=${ag.id}`, text: t('attNoOffice', { agency: ag.name }) });
      }
    });
    if (!active.some(a => a.kind === 'verifier')) att.push({ rank: 1, kind: 'spoiled', icon: 'shield', filter: 'role=verifier', text: t('attNoVerifier') });
    const old = pending.filter(a => a.createdAt && now - a.createdAt > WAIT_DAYS * DAY).length;
    if (old) att.push({ rank: 2, kind: 'wait', icon: 'inbox', filter: 'status=pending', text: tn('attWaitingLong', old, { d: WAIT_DAYS }) });
    att.sort((a, b) => a.rank - b.rank);

    // One row per Agency, plus sign-ups with no Agency when there are any.
    const cnt = (agency, kind, status) => all.filter(a => a.agency === agency && (!kind || a.kind === kind) && a.status === status).length;
    const num = (n, filter) => n ? accLink(filter, String(n), 'sa-num') : `<span class="muted">0</span>`;
    const rows = S.ref.agencies.map(ag => `<tr>
      <th scope="row">${esc(ag.name)}</th>
      <td class="n" data-label="${esc(t('saActiveEnf'))}">${num(cnt(ag.id, 'enforcer', 'active'), `role=enforcer&status=active&agency=${ag.id}`)}</td>
      <td class="n" data-label="${esc(t('acPending'))}">${num(cnt(ag.id, '', 'pending'), `status=pending&agency=${ag.id}`)}</td>
      <td class="n" data-label="${esc(t('acInactive'))}">${num(cnt(ag.id, '', 'inactive'), `status=inactive&agency=${ag.id}`)}</td>
      <td class="n" data-label="${esc(t('saOfficeAdmins'))}">${num(cnt(ag.id, 'office', 'active'), `role=office&status=active&agency=${ag.id}`)}</td></tr>`).join('');
    const noAg = pending.filter(a => !S.ag.has(a.agency) && a.kind === 'enforcer').length;

    root.innerHTML = `
    <div class="sm sa-ov">
      <header class="sm-head"><div><h1 class="h1 sm-title">${esc(t('overviewTitle'))}</h1></div></header>
      <div class="kpis st-tiles">
        ${kpi({ kind: 'waiting', ic: 'inbox', label: t('saPending'), n: pending.length, href: '#/accounts', linkText: t('viewAccounts'), linkAttrs: 'data-acc="status=pending"' })}
        ${kpi({ kind: 'paid', ic: 'users', label: t('saActiveEnf'), n: active.filter(a => a.kind === 'enforcer').length, href: '#/accounts', linkText: t('viewAccounts'), linkAttrs: 'data-acc="role=enforcer&status=active"' })}
        ${kpi({ kind: 'unpaid', ic: 'user', label: t('saOfficeAdmins'), n: active.filter(a => a.kind === 'office').length, href: '#/accounts', linkText: t('viewAccounts'), linkAttrs: 'data-acc="role=office&status=active"' })}
        ${kpi({ kind: 'cancelled', ic: 'shield', label: t('saVerifiers'), n: active.filter(a => a.kind === 'verifier').length, href: '#/accounts', linkText: t('viewAccounts'), linkAttrs: 'data-acc="role=verifier&status=active"' })}
      </div>
      <div class="sa-grid">
        <section class="sm-card sa-att-card">
          <h2 class="sm-h">${esc(t('needsAttention'))}${att.length ? ` <span class="att-count">(${att.length})</span>` : ''}</h2>
          ${att.length ? `<ul class="att-list sa-att">${att.map(a => `<li class="att att-${a.kind}">${accLink(a.filter, `${icon(a.icon)}<span>${esc(a.text)}</span>${icon('chevR')}`)}</li>`).join('')}</ul>`
            : `<p class="att-clear">${icon('check')}<span>${esc(t('allClear'))}</span></p>`}
        </section>
        <section class="sm-card sa-ag-card">
          <h2 class="sm-h">${esc(t('saByAgency'))}</h2>
          <p class="muted small">${esc(t('saByAgencyLead'))}</p>
          <div class="table-wrap"><table class="tbl tbl-compact tbl-sa">
            <thead><tr><th scope="col">${esc(t('agency'))}</th><th scope="col" class="n">${esc(t('saActiveEnf'))}</th><th scope="col" class="n">${esc(t('acPending'))}</th>
              <th scope="col" class="n">${esc(t('acInactive'))}</th><th scope="col" class="n">${esc(t('saOfficeAdmins'))}</th></tr></thead>
            <tbody>${rows}${noAg ? `<tr><th scope="row">${esc(t('noAgency'))}</th><td class="n" data-label="${esc(t('saActiveEnf'))}"><span class="muted">—</span></td>
              <td class="n" data-label="${esc(t('acPending'))}">${num(noAg, 'status=pending&agency=-')}</td><td class="n" data-label="${esc(t('acInactive'))}"><span class="muted">—</span></td>
              <td class="n" data-label="${esc(t('saOfficeAdmins'))}"><span class="muted">—</span></td></tr>` : ''}</tbody>
          </table></div>
        </section>
      </div>
    </div>`;
    bindAccLinks(root);
  };
  render();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ Accounts list
const accState = { q: '', role: '', agency: '', status: '', page: 1 };

function accountsList(root, ctx) {
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
  root.innerHTML = `
    <div class="page-head">
      <h1 class="h1">${esc(t('accountsTitle'))}</h1>
      <p class="lead" data-lead></p>
    </div>
    <div class="acc-filters">
      <div class="field f-q"><label class="lbl" for="acc-q">${esc(t('search'))}</label>
        <div class="search">${icon('search')}
          <input class="input" type="search" id="acc-q" name="q" placeholder="${esc(t('searchAccounts'))}" value="${esc(accState.q)}" autocomplete="off"></div></div>
      <label class="field"><span class="lbl">${esc(t('role'))}</span>
        <select class="input" name="role">${opt('', t('allRoles'), accState.role)}${ROLES.map(k => opt(k, roleName(k), accState.role)).join('')}</select></label>
      <label class="field"><span class="lbl">${esc(t('agency'))}</span>
        <select class="input" name="agency">${opt('', t('allAgencies'), accState.agency)}${S.ref.agencies.map(a => opt(a.id, a.name, accState.agency)).join('')}${opt('-', t('noAgency'), accState.agency)}</select></label>
      <label class="field"><span class="lbl">${esc(t('colStatus'))}</span>
        <select class="input" name="status">${opt('', t('allStatuses'), accState.status)}${Object.keys(STATUS_LABEL).map(k => opt(k, t(STATUS_LABEL[k]), accState.status)).join('')}</select></label>
    </div>
    <div data-table></div>`;

  const renderTable = () => {
    const all = allAccounts();
    const waiting = all.filter(a => a.status === 'pending').length;
    root.querySelector('[data-lead]').textContent = tn('accountsLead', all.length, { p: waiting });
    const q = normName(accState.q);
    const byName = (a, b) => normName(`${a.last} ${a.first}`).localeCompare(normName(`${b.last} ${b.first}`));
    const list = all
      .filter(a => !accState.role || a.kind === accState.role)
      .filter(a => !accState.agency || (accState.agency === '-' ? !S.ag.has(a.agency) : a.agency === accState.agency))
      .filter(a => !accState.status || a.status === accState.status)
      .filter(a => !q || normName(`${fullName(a)} ${a.badge || ''} ${a.rank || ''}`).includes(q))
      // Pending first, newest sign-up on top; then everyone A–Z.
      .sort((a, b) => (b.status === 'pending') - (a.status === 'pending')
        || (a.status === 'pending' ? (b.createdAt || 0) - (a.createdAt || 0) : 0) || byName(a, b));
    const pg = paginate(list, accState.page);
    accState.page = pg.page;
    root.querySelector('[data-table]').innerHTML = `
      <div class="list-tools"><p class="showing">${esc(pg.n ? t('showingAcc', { a: pg.a, b: pg.b, n: pg.n }) : '')}</p>
        ${pg.n ? `<button type="button" class="btn btn-ghost btn-sm" data-csv>${icon('download')}<span>${esc(t('downloadCsv'))}</span></button>` : ''}</div>
      ${pg.n ? `<div class="table-wrap"><table class="tbl tbl-reg tbl-acc">
        <thead><tr><th scope="col">${esc(t('colName'))}</th><th scope="col">${esc(t('role'))}</th><th scope="col">${esc(t('agency'))}</th>
          <th scope="col">${esc(t('colStatus'))}</th><th scope="col">${esc(t('colContact'))}</th><th scope="col">${esc(t('colRegistered'))}</th></tr></thead>
        <tbody>${pg.slice.map(a => `<tr class="tr-link" data-href="#/accounts/${esc(a.id)}">
          <th scope="row"><a href="#/accounts/${esc(a.id)}" class="cell-name">${esc(displayName(a))}</a>
            <span class="cell-sub">${esc((a.kind === 'enforcer' ? [a.rank, a.badge].filter(Boolean).join(' · ') : a.position) || t('dash'))}</span></th>
          <td data-label="${esc(t('role'))}">${esc(roleName(a.kind))}</td>
          <td data-label="${esc(t('agency'))}">${esc(agencyText(a))}</td>
          <td data-label="${esc(t('colStatus'))}">${statusTag(a.status)}</td>
          <td data-label="${esc(t('colContact'))}" class="nowrap">${esc(fPhone(a.contact))}</td>
          <td data-label="${esc(t('colRegistered'))}" class="nowrap">${esc(a.registeredAt ? fDate(a.registeredAt) : t('fromRecords'))}</td></tr>`).join('')}</tbody>
      </table></div>` : emptyState(t('noAccountsMatch'), t('noAccountsMatchBody'), 'users')}
      ${pager(pg.page, pg.pages)}`;
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { accState.page = Number(b.dataset.page); renderTable(); }));
    root.querySelectorAll('.tr-link').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
    root.querySelector('[data-csv]')?.addEventListener('click', () => {
      const header = ['csvName', 'csvRole', 'csvAgency', 'csvStatus', 'csvRank', 'csvBadge', 'csvContact', 'csvAddress', 'csvRegistered'].map(k => t(k));
      const csvRows = list.map(a => [fullName(a), roleName(a.kind), agencyText(a), t(STATUS_LABEL[a.status]), a.rank || '', a.badge || '',
        fPhone(a.contact), a.address || '', a.registeredAt ? fDate(a.registeredAt) : t('fromRecords')]);
      downloadCsv(`accounts-${todayKey()}.csv`, header, csvRows);
      toast(tn('csvSaved', csvRows.length));
    });
  };
  root.querySelector('[name=q]').addEventListener('input', e => { accState.q = e.target.value; accState.page = 1; renderTable(); });
  ['role', 'agency', 'status'].forEach(k => root.querySelector(`[name=${k}]`).addEventListener('change', e => {
    accState[k] = e.target.value; accState.page = 1; renderTable();
  }));
  renderTable();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) renderTable(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ Account detail
// Booklets still in use: "2 · 31 forms left".
function bookletsInUse(id) {
  const books = activeBooklets(id);
  return { n: books.length, left: books.reduce((s, b) => s + bookletSize(b) - bookletUsed(b), 0) };
}

// Role and Agency picker. Resolves { kind, agency } or null.
function roleDialog({ title, confirm, kind, agency, fixedKind = '', acc }) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
    dlg.innerHTML = `
      <form method="dialog" class="dlg-form" novalidate>
        <h2 class="dlg-title">${esc(title)}</h2>
        ${fixedKind ? '' : `<label class="field"><span class="lbl">${esc(t('role'))}</span>
          <select class="input" name="kind">${ROLES.map(k => opt(k, roleName(k), kind)).join('')}</select></label>`}
        <label class="field" data-ag><span class="lbl">${esc(t('agency'))}</span>
          <select class="input" name="agency">${opt('', t('chooseAgency'), S.ag.has(agency) ? agency : '')}${S.ref.agencies.map(a => opt(a.id, a.name, agency)).join('')}</select>
          <span class="err" hidden>${esc(t('errNeedOffice'))}</span></label>
        <p class="alert alert-warn" data-warn hidden>${icon('alert')}<span></span></p>
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(confirm)}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const f = dlg.querySelector('form');
    const curKind = () => fixedKind || f.kind.value;
    const books = acc ? bookletsInUse(acc.id) : { n: 0 };
    const sync = () => {
      const k = curKind();
      dlg.querySelector('[data-ag]').hidden = k === 'verifier';
      // Warn before an Enforcer with forms left stops being one.
      const warn = dlg.querySelector('[data-warn]');
      warn.hidden = !(books.n && acc.kind === 'enforcer' && k !== 'enforcer');
      if (!warn.hidden) warn.querySelector('span').textContent = tn('bookletWarn', books.n, { name: displayName(acc), left: books.left });
    };
    f.kind?.addEventListener('change', sync);
    sync();
    let result = null;
    dlg.querySelector('[data-act=cancel]').addEventListener('click', () => dlg.close());
    f.addEventListener('submit', e => {
      e.preventDefault();
      const k = curKind();
      const ag = f.agency.value;
      const err = dlg.querySelector('[data-ag] .err');
      if (k !== 'verifier' && !ag) { err.hidden = false; f.agency.setAttribute('aria-invalid', 'true'); f.agency.focus(); return; }
      result = { kind: k, agency: k === 'verifier' ? '' : ag };
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    (f.kind || f.agency).focus();
  });
}

function accountDetail(root, ctx, id) {
  const u = me();
  let pick = null; // the role card picked; starts on their current or signed-up role
  const render = () => {
    const a = findAccount(id);
    const back = `<a class="back" href="#/accounts">${icon('arrowL')}<span>${esc(t('backToAccounts'))}</span></a>`;
    if (!a) { root.innerHTML = `${back}<p class="alert alert-error">${icon('alert')}<span>${esc(t('noAccountsMatch'))}</span></p>`; return; }
    if (!ROLES.includes(pick)) pick = ROLES.includes(a.kind) ? a.kind : 'enforcer';
    const can = canManage(u, a);
    const books = bookletsInUse(a.id);
    const cits = S.citations.filter(c => c.owner === a.id).length;
    const issuer = a.kind === 'enforcer' || cits || books.n;
    const deciding = ['pending', 'rejected'].includes(a.status);
    const changing = !deciding && pick !== a.kind;
    // Edit details for anyone the Super Admin manages; Reset password once they can sign in.
    const tools = !can ? [] : [['edit', t('editDetails'), 'pencil'], ...(['active', 'inactive'].includes(a.status) ? [['reset', t('resetPassword'), 'key']] : []),
      ...(avatarOf(a.id) ? [['picture', t('removePicture'), 'camera']] : [])];
    const go = deciding ? [['approve', t('approveAsRole', { role: roleName(pick) }), 'btn-go']]
      : changing ? [['role', t('changeTo', { role: roleName(pick) }), a.status === 'active' ? 'btn-go' : 'btn-ghost']] : [];
    const buttons = !can ? [] : {
      pending: [['reject', t('reject'), 'btn-danger-ghost'], ...go],
      rejected: go,
      active: [['inactive', t('setInactive'), 'btn-danger-ghost'], ...go],
      inactive: [...go, ['active', t('setActive'), 'btn-go']],
    }[a.status] || [];
    const lastReason = [...(a.history || [])].reverse().find(h => h.action === 'rejected')?.reason;
    const text = a.status === 'pending' ? t('rvPendingAs', { role: roleName(pick) })
      : a.status === 'rejected' ? t('rvRejectedAs', { role: roleName(pick) }) + (lastReason ? ` · ${t('reason')}: ${lastReason}` : '')
      : changing ? t('rvChangeTo', { status: t(STATUS_LABEL[a.status]), role: roleName(pick) })
      : a.status === 'active' ? t('rvActive', { role: roleLabel(a.kind, a.agency) }) : t('rvInactive');

    const roleCards = can ? card(t('giveRole'), `<div class="rv-roles" role="radiogroup" aria-label="${esc(t('giveRole'))}">
      ${ROLES.map(k => `<button type="button" class="rv-role ${pick === k ? 'on' : ''}" role="radio" aria-checked="${pick === k}" tabindex="${pick === k ? 0 : -1}" data-pick="${k}">
        <span class="rv-role-ic">${icon(ROLE_ICON[k])}</span>
        <span class="rv-role-name">${esc(roleName(k))}</span>
        <span class="rv-role-desc">${esc(t(ROLE_DESC[k]))}</span>
        ${pick === k ? `<span class="rv-role-check">${icon('check')}</span>` : ''}
      </button>`).join('')}</div>`, 'rv-first') : '';
    const note = a.id === u.id ? `<p class="muted rv-note">${esc(t('ownAccount'))}</p>` : '';
    const stats = issuer ? `<div class="rv-stats">
      <div class="rv-stat"><b>${esc(books.n ? tn('bookletsLeftN', books.n, { left: books.left }) : t('none'))}</b><span>${esc(t('bookletsInUse'))}</span></div>
      <div class="rv-stat"><b>${cits}</b><span>${esc(t('citationsRecorded'))}</span></div></div>` : '';
    root.innerHTML = reviewPage({
      back, tools, a,
      main: `${note}${roleCards}${stats}${card(t('history'), `<div class="rv-scroll" tabindex="0" role="region" aria-label="${esc(t('history'))}">${historyList(a.history)}</div>`, can ? 'rv-hist' : 'rv-first')}`,
      bar: { text, buttons },
    });
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(a, b.dataset.act)));
    const choose = k => { pick = k; render(); root.querySelector(`[data-pick="${pick}"]`)?.focus(); };
    root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => choose(b.dataset.pick)));
    // Arrow keys move between role cards, like radio buttons.
    root.querySelector('.rv-roles')?.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      choose(ROLES[(ROLES.indexOf(pick) + d + ROLES.length) % ROLES.length]);
    });
  };

  const done = res => { if (res.error) toast(res.error, 'error'); else toast(res.message); render(); };
  async function act(a, what) {
    if (what === 'edit') {
      if (await editDetailsDialog(u.id, a)) render();
    } else if (what === 'reset') {
      if (await resetPasswordFlow(u.id, a)) render();
    } else if (what === 'picture') {
      if (await removePictureFlow(u.id, a)) render();
    } else if (what === 'reject') {
      const r = await dialog({ title: t('rejectTitle', { name: displayName(a) }), confirm: t('reject'), danger: true, textarea: { label: t('rejectReason'), hint: t('rejectReasonHint'), max: 200 } });
      if (r) done(changeStatus(u.id, a.id, 'rejected', r.text));
    } else if (what === 'inactive') {
      const r = await dialog({ title: t('setInactive'), body: t('inactiveConfirm', { name: displayName(a) }), confirm: t('setInactive'), danger: true });
      if (r) done(changeStatus(u.id, a.id, 'inactive'));
    } else if (what === 'active') {
      done(changeStatus(u.id, a.id, 'active'));
    } else if (what === 'approve' && pick === 'verifier') {
      const r = await dialog({ title: t('approveAsTitle', { name: displayName(a), role: roleName('verifier') }), body: t('approveVerifierBody'), confirm: t('approveAsVerifier') });
      if (r) done(approveAs(u.id, a.id, 'verifier', ''));
    } else if (what === 'approve') {
      const r = await roleDialog({ title: t('approveAsTitle', { name: displayName(a), role: roleName(pick) }), confirm: t('approveAsRole', { role: roleName(pick) }), kind: pick, fixedKind: pick, agency: a.agency, acc: a });
      if (r) done(approveAs(u.id, a.id, r.kind, r.agency));
    } else if (what === 'role') {
      const r = await roleDialog({ title: t('changeRoleTitle', { name: displayName(a) }), confirm: t('changeTo', { role: roleName(pick) }), kind: pick, fixedKind: pick, agency: a.agency || a.enfAgency, acc: a });
      if (r) done(changeRole(u.id, a.id, r.kind, r.agency));
    }
  }

  render();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ Activity log
const ACTIONS = ['signup', 'approved', 'rejected', 'role', 'inactive', 'active', 'edited', 'reset', 'picture'];
const ACTION_LABEL = {
  signup: 'actSignup', approved: 'actApproved', rejected: 'actRejected', role: 'actRole',
  inactive: 'actInactive', active: 'actActive', edited: 'actEdited', reset: 'actReset', picture: 'actPicture',
};
const actState = { what: '', who: '', agency: '', when: '', page: 1 };
const inWhen = at => actState.when === 'today' ? isToday(at) : actState.when === '7d' ? Date.now() - at < 7 * DAY
  : actState.when === 'month' ? isThisMonth(at) : true;

// "Approved as Office Admin · Police", "Contact number: … → …", "Reason: …"
function entryDetail(x) {
  if (x.as) return `<span class="cell-sub">${esc(roleLabel(x.as, x.agency))}</span>`;
  if (x.action === 'edited') return changeLines(x.changes);
  if (x.reason) return `<span class="cell-sub">${esc(t('reason'))}: ${esc(x.reason)}</span>`;
  return '';
}

export function activityView(root, ctx) {
  const render = () => {
    const log = activityLog();
    const agencyOfEntry = x => x.acc.agency || x.acc.enfAgency || '';
    const actors = [...new Set(log.filter(x => x.action !== 'signup').map(x => x.by))]
      .map(id => ({ id, name: personName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    const list = log
      .filter(x => !actState.what || x.action === actState.what)
      .filter(x => !actState.who || (x.action !== 'signup' && x.by === actState.who))
      .filter(x => !actState.agency || (actState.agency === '-' ? !S.ag.has(agencyOfEntry(x)) : agencyOfEntry(x) === actState.agency))
      .filter(x => inWhen(x.at));
    const pg = paginate(list, actState.page, 20);
    actState.page = pg.page;
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
    root.innerHTML = `
      <div class="page-head">
        <h1 class="h1">${esc(t('activityTitle'))}</h1>
        <p class="lead">${esc(t('activityLead'))}</p>
      </div>
      <div class="acc-filters act-filters">
        <label class="field"><span class="lbl">${esc(t('actWhat'))}</span>
          <select class="input" name="what">${opt('', t('allStatuses'), actState.what)}${ACTIONS.map(k => opt(k, t(ACTION_LABEL[k]), actState.what)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('actWho'))}</span>
          <select class="input" name="who">${opt('', t('actAnyone'), actState.who)}${actors.map(a => opt(a.id, a.name, actState.who)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('agency'))}</span>
          <select class="input" name="agency">${opt('', t('allAgencies'), actState.agency)}${S.ref.agencies.map(a => opt(a.id, a.name, actState.agency)).join('')}${opt('-', t('noAgency'), actState.agency)}</select></label>
        <label class="field"><span class="lbl">${esc(t('date'))}</span>
          <select class="input" name="when">${opt('', t('allDates'), actState.when)}${opt('today', t('today'), actState.when)}${opt('7d', t('last7Days'), actState.when)}${opt('month', t('thisMonth'), actState.when)}</select></label>
      </div>
      <p class="showing">${esc(pg.n ? t('showingAct', { a: pg.a, b: pg.b, n: pg.n }) : '')}</p>
      ${pg.n ? `<div class="table-wrap"><table class="tbl tbl-reg tbl-act">
        <thead><tr><th scope="col">${esc(t('actAccount'))}</th><th scope="col">${esc(t('actWhat'))}</th><th scope="col">${esc(t('actWho'))}</th><th scope="col">${esc(t('actWhen'))}</th></tr></thead>
        <tbody>${pg.slice.map(x => `<tr>
          <th scope="row"><a href="#/accounts/${esc(x.acc.id)}" class="cell-name">${esc(displayName(x.acc))}</a>
            <span class="cell-sub">${esc(roleLabel(x.acc.kind, x.acc.agency))}</span></th>
          <td data-label="${esc(t('actWhat'))}"><span class="strong">${esc(t(ACTION_LABEL[x.action]))}</span>${entryDetail(x)}</td>
          <td data-label="${esc(t('actWho'))}">${esc(x.action === 'signup' ? t('actThemselves') : personName(x.by))}</td>
          <td data-label="${esc(t('actWhen'))}" class="nowrap">${esc(fDateTime(x.at))}</td></tr>`).join('')}</tbody>
      </table></div>` : emptyState(t('noActivity'), t('noActivityBody'), 'activity')}
      ${pager(pg.page, pg.pages)}`;
    ['what', 'who', 'agency', 'when'].forEach(k => root.querySelector(`[name=${k}]`).addEventListener('change', e => {
      actState[k] = e.target.value; actState.page = 1; render();
      root.querySelector(`[name=${k}]`)?.focus();
    }));
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { actState.page = Number(b.dataset.page); render(); }));
  };
  render();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}
