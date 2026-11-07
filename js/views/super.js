// Super Admin: every account in one list. Approve sign-ups as Enforcer, Office Admin or
// Verifier, change roles, and set accounts Inactive or Active again.
import { t, tn } from '../strings.js';
import { esc, fullName, displayName, fDate, fPhone, normName } from '../util.js';
import {
  S, me, allAccounts, findAccount, changeStatus, approveAs, changeRole, canManage, roleLabel, ROLES,
  activeBooklets, bookletSize, bookletUsed, subscribe,
} from '../store.js';
import { icon, toast, dialog, pager, paginate, emptyState, kv } from '../ui.js';
import { statusTag, historyList, STATUS_LABEL } from './admin.js';

const ROLE_NAME = { enforcer: 'roleEnforcer', office: 'roleOffice', verifier: 'roleVerifierShort', super: 'roleSuperShort' };
const roleName = k => t(ROLE_NAME[k]);
// The Agency column: Verifiers belong to the Treasury Office, the Super Admin to the CICT Office.
const agencyText = a => a.kind === 'verifier' ? t('treasuryOffice') : a.kind === 'super' ? t('cictOffice')
  : S.ag.get(a.agency)?.name || t('noAgency');

export function superPendingCount() {
  const u = me();
  return u && u.kind === 'super' ? allAccounts().filter(a => a.status === 'pending').length : 0;
}

export function accountsView(root, ctx) {
  if (ctx.params[0]) return accountDetail(root, ctx, ctx.params[0]);
  return accountsList(root, ctx);
}

// ------------------------------------------------------------------ list
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
      <p class="showing">${esc(pg.n ? t('showingAcc', { a: pg.a, b: pg.b, n: pg.n }) : '')}</p>
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
  };
  root.querySelector('[name=q]').addEventListener('input', e => { accState.q = e.target.value; accState.page = 1; renderTable(); });
  ['role', 'agency', 'status'].forEach(k => root.querySelector(`[name=${k}]`).addEventListener('change', e => {
    accState[k] = e.target.value; accState.page = 1; renderTable();
  }));
  renderTable();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) renderTable(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ detail
// Booklets still in use: "2 Booklets with 31 forms left".
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
  const render = () => {
    const a = findAccount(id);
    const back = `<a class="back" href="#/accounts">${icon('arrowL')}<span>${esc(t('backToAccounts'))}</span></a>`;
    if (!a) { root.innerHTML = `${back}<p class="alert alert-error">${icon('alert')}<span>${esc(t('noAccountsMatch'))}</span></p>`; return; }
    const can = canManage(u, a);
    const books = bookletsInUse(a.id);
    const cits = S.citations.filter(c => c.owner === a.id).length;
    const issuer = a.kind === 'enforcer' || cits || books.n;
    const acts = !can ? [] : {
      pending: [['reject', t('reject'), 'btn-danger-ghost'], ['as-verifier', t('approveAsVerifier'), 'btn-ghost'], ['as-office', t('approveAsOffice'), 'btn-ghost'], ['as-enforcer', t('approveAsEnforcer'), 'btn-primary']],
      rejected: [['as-verifier', t('approveAsVerifier'), 'btn-ghost'], ['as-office', t('approveAsOffice'), 'btn-ghost'], ['as-enforcer', t('approveAsEnforcer'), 'btn-primary']],
      active: [['inactive', t('setInactive'), 'btn-danger-ghost'], ['role', t('changeRole'), 'btn-primary']],
      inactive: [['role', t('changeRole'), 'btn-ghost'], ['active', t('setActive'), 'btn-primary']],
    }[a.status] || [];
    root.innerHTML = `${back}
      <article class="sheet">
        <header class="sheet-head">
          <div><h1 class="det-type">${esc(fullName(a))}</h1><p class="muted small">${esc(roleLabel(a.kind, a.agency))}</p></div>
          <div>${statusTag(a.status)}</div>
        </header>
        <div class="perf" aria-hidden="true"></div>
        <section class="sec">
          ${kv([
            [t('role'), esc(roleName(a.kind))], [t('agency'), esc(agencyText(a))],
            ...(a.kind === 'enforcer' || a.rank || a.badge ? [[t('rank'), esc(a.rank || t('dash'))], [t('badge'), esc(a.badge || t('dash'))]] : [[t('position'), esc(a.position || t('dash'))]]),
            [t('gender'), esc(a.gender === 'M' ? t('male') : t('female'))], [t('contactNumber'), esc(fPhone(a.contact))],
            [t('address'), esc(a.address || t('dash'))], [t('registered'), esc(a.registeredAt ? fDate(a.registeredAt) : t('fromRecords'))],
            ...(issuer ? [[t('bookletsInUse'), esc(books.n ? tn('bookletsLeftN', books.n, { left: books.left }) : t('none'))], [t('citationsRecorded'), String(cits)]] : []),
          ])}
        </section>
        <section class="sec"><h2 class="h2">${esc(t('history'))}</h2>${historyList(a.history)}</section>
        ${a.id === u.id ? `<p class="muted">${esc(t('ownAccount'))}</p>` : ''}
        ${acts.length ? `<div class="actions-row acc-actions">${acts.map(([act, label, cls]) => `<button type="button" class="btn ${cls} btn-lg" data-act="${act}">${esc(label)}</button>`).join('')}</div>` : ''}
      </article>`;
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(a, b.dataset.act)));
  };

  const done = res => { if (res.error) toast(res.error, 'error'); else toast(res.message); render(); };
  async function act(a, what) {
    if (what === 'reject') {
      const r = await dialog({ title: t('rejectTitle', { name: displayName(a) }), confirm: t('reject'), danger: true, textarea: { label: t('rejectReason'), hint: t('rejectReasonHint'), max: 200 } });
      if (r) done(changeStatus(u.id, a.id, 'rejected', r.text));
    } else if (what === 'inactive') {
      const r = await dialog({ title: t('setInactive'), body: t('inactiveConfirm', { name: displayName(a) }), confirm: t('setInactive'), danger: true });
      if (r) done(changeStatus(u.id, a.id, 'inactive'));
    } else if (what === 'active') {
      done(changeStatus(u.id, a.id, 'active'));
    } else if (what === 'as-verifier') {
      const r = await dialog({ title: t('approveAsTitle', { name: displayName(a), role: roleName('verifier') }), body: t('approveVerifierBody'), confirm: t('approveAsVerifier') });
      if (r) done(approveAs(u.id, a.id, 'verifier', ''));
    } else if (what === 'as-office' || what === 'as-enforcer') {
      const kind = what === 'as-office' ? 'office' : 'enforcer';
      const r = await roleDialog({ title: t('approveAsTitle', { name: displayName(a), role: roleName(kind) }), confirm: t(kind === 'office' ? 'approveAsOffice' : 'approveAsEnforcer'), kind, fixedKind: kind, agency: a.agency, acc: a });
      if (r) done(approveAs(u.id, a.id, r.kind, r.agency));
    } else if (what === 'role') {
      const r = await roleDialog({ title: t('changeRoleTitle', { name: displayName(a) }), confirm: t('changeRole'), kind: a.kind, agency: a.agency || a.enfAgency, acc: a });
      if (r) done(changeRole(u.id, a.id, r.kind, r.agency));
    }
  }

  render();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}
