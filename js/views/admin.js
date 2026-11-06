import { t, tn } from '../strings.js';
import { esc, fullName, displayName, fDate, fDateTime, isToday, isThisMonth, fPhone, normName, downloadCsv, todayKey } from '../util.js';
import { S, me, allEnforcers, enforcer, changeStatus, personName, subscribe, activeBooklets, bookletSize, ctName } from '../store.js';
import { icon, toast, dialog, pager, paginate, emptyState, kv, menuMarkup, bindMenu } from '../ui.js';
import { kpi, dailyChart, bookletSplit, bookletBar, splitText } from './dash.js';

const STATUS_LABEL = { active: 'acActive', pending: 'acPending', rejected: 'acRejected', inactive: 'acInactive' };
const statusTag = s => `<span class="acct acct-${s}">${esc(t(STATUS_LABEL[s]))}</span>`;

function counts(enfId) {
  const r = { today: { done: 0, cancelled: 0, voided: 0 }, month: { done: 0, cancelled: 0, voided: 0 } };
  for (const c of S.citations) {
    if (c.owner !== enfId) continue;
    if (isToday(c.at)) r.today[c.status]++;
    if (isThisMonth(c.at)) r.month[c.status]++;
  }
  return r;
}

function cell(x) {
  return `<span class="n-main">${x.done}</span>${x.cancelled || x.voided ? `<span class="n-sub">${esc(t('issuedUnder', { c: x.cancelled, v: x.voided }))}</span>` : ''}`;
}

const agencyEnforcers = () => {
  const u = me();
  return allEnforcers().filter(e => e.agency === u.agency);
};

// ------------------------------------------------------------------ Overview
const DAY = 86400000;
const IDLE_DAYS = 7;
const SPOILED_SHARE = 0.2;
const SPOILED_MIN_FORMS = 5;
// Citations of this Agency's Enforcers. Office Admins only ever see counts of these.
const agencyCitations = ids => S.citations.filter(c => ids.has(c.owner));

export function overviewView(root, ctx) {
  const render = () => {
    const u = me();
    const ag = S.ag.get(u.agency);
    const enfs = agencyEnforcers();
    const ids = new Set(enfs.map(e => e.id));
    const mine = agencyCitations(ids);
    const month = mine.filter(c => isThisMonth(c.at));
    const n = (list, s) => list.filter(c => c.status === s).length;
    const waiting = enfs.filter(e => e.status === 'pending').length;

    // Top 5 Enforcers by Issued this month
    const per = new Map(enfs.map(e => [e.id, { e, done: 0, cancelled: 0, voided: 0, last: 0 }]));
    mine.forEach(c => { const r = per.get(c.owner); if (c.at > r.last) r.last = c.at; });
    month.forEach(c => { per.get(c.owner)[c.status]++; });
    const top = [...per.values()].filter(r => r.done).sort((a, b) => b.done - a.done || displayName(a.e).localeCompare(displayName(b.e))).slice(0, 5);
    const topMax = top[0]?.done || 1;

    // Needs attention
    const att = [];
    if (waiting) att.push({ rank: 0, kind: 'wait', icon: 'inbox', href: '#/registrations', text: tn('attWaiting', waiting) });
    [...per.values()].filter(r => r.e.status === 'active').forEach(r => {
      const days = r.last ? Math.floor((Date.now() - r.last) / DAY) : null;
      if (days !== null && days >= IDLE_DAYS) att.push({ rank: 2, score: days, kind: 'idle', icon: 'clock', href: `#/enforcers/${r.e.id}`, text: t('attIdle', { name: displayName(r.e), d: days }) });
      const used = r.done + r.cancelled + r.voided, bad = r.cancelled + r.voided;
      if (used >= SPOILED_MIN_FORMS && bad / used > SPOILED_SHARE) att.push({ rank: 1, score: bad / used, kind: 'spoiled', icon: 'fileX', href: `#/enforcers/${r.e.id}`, text: t('attSpoiled', { name: displayName(r.e), k: bad, n: used, p: Math.round(bad / used * 100) }) });
    });
    // Most urgent first: Registrations waiting, then the highest spoiled share, then the longest idle.
    att.sort((a, b) => a.rank - b.rank || (b.score || 0) - (a.score || 0));

    root.innerHTML = `
    <div class="sm ov">
      <header class="sm-head">
        <div><h1 class="h1 sm-title">${esc(t('overviewTitle'))}</h1><p class="lead">${esc(t('overviewLead', { agency: ag.name }))}</p></div>
      </header>
      <div class="kpis">
        ${kpi({ kind: 'unpaid', ic: 'clock', label: t('kpiIssuedToday'), n: n(mine.filter(c => isToday(c.at)), 'done') })}
        ${kpi({ kind: 'unpaid', ic: 'check', label: t('kpiIssuedMonth'), n: n(month, 'done') })}
        ${kpi({ kind: 'cancelled', ic: 'fileX', label: t('kpiCancelledMonth'), n: n(month, 'cancelled') })}
        ${kpi({ kind: 'voided', ic: 'ban', label: t('kpiVoidedMonth'), n: n(month, 'voided') })}
        ${kpi({ kind: 'waiting', ic: 'users', label: t('kpiWaiting'), n: waiting, href: '#/registrations', linkText: t('openRegistrations') })}
      </div>
      <div class="ov-grid">
        ${dailyChart(mine, { title: t('perDay30') })}
        <section class="sm-card ov-att">
          <h2 class="sm-h">${esc(t('needsAttention'))}${att.length ? ` <span class="att-count">(${att.length})</span>` : ''}</h2>
          ${att.length ? `<ul class="att-list" data-att>${att.map(a => `<li class="att att-${a.kind}"><a href="${a.href}">${icon(a.icon)}<span>${esc(a.text)}</span>${icon('chevR')}</a></li>`).join('')}</ul>`
            : `<p class="att-clear">${icon('check')}<span>${esc(t('allClear'))}</span></p>`}
        </section>
        <section class="sm-card ov-top">
          <h2 class="sm-h">${esc(t('topEnforcers'))}</h2>
          <p class="muted small">${esc(t('topEnforcersLead'))}</p>
          ${top.length ? `<ol class="top-list">${top.map((r, i) => `<li>
            <span class="top-rank">${i + 1}</span>
            <a class="top-name" href="#/enforcers/${r.e.id}">${esc(displayName(r.e))}</a>
            <span class="top-bar" aria-hidden="true"><i style="width:${r.done / topMax * 100}%"></i></span>
            <b class="top-n">${r.done}</b></li>`).join('')}</ol>` : `<p class="muted">${esc(t('noIssuedMonth'))}</p>`}
        </section>
      </div>
    </div>`;
    // The list scrolls after about 5 rows; fade its bottom edge while more rows sit below.
    const list = root.querySelector('[data-att]');
    if (list) {
      const fade = () => list.classList.toggle('has-more', list.scrollTop + list.clientHeight < list.scrollHeight - 4);
      list.addEventListener('scroll', fade, { passive: true });
      fade();
    }
  };
  render();
  const off = subscribe(k => { if ((k === 'accounts' || k === 'citations') && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ Enforcers
const enfState = { status: 'all', q: '', page: 1 };

export function enforcersView(root, ctx) {
  if (ctx.params[0]) return enforcerDetail(root, ctx, ctx.params[0]);
  const u = me();
  const ag = S.ag.get(u.agency);

  root.innerHTML = `
    <div class="page-head">
      <h1 class="h1">${esc(t('enforcersTitle'))}</h1>
      <p class="lead" data-lead></p>
    </div>
    <div class="filters filters-desk">
      <div class="enf-filters">
        <div class="field" data-statusbox></div>
        <div class="field"><label class="lbl" for="enf-q">${esc(t('search'))}</label>
          <div class="search">${icon('search')}
            <input class="input" type="search" id="enf-q" name="q" placeholder="${esc(t('searchEnforcers'))}" value="${esc(enfState.q)}" autocomplete="off"></div></div>
      </div>
    </div>
    <div data-table></div>`;

  const renderTable = () => {
    const all = agencyEnforcers();
    const c = { all: all.length, active: 0, pending: 0, rejected: 0, inactive: 0 };
    all.forEach(e => c[e.status]++);
    // Spec 6.2: the counts stay visible without opening the menu.
    root.querySelector('[data-lead]').textContent = tn('enforcersLeadCounts', all.length, { agency: ag.name, a: c.active, p: c.pending, i: c.inactive, r: c.rejected });
    const label = k => (k === 'all' ? t('all') : t(STATUS_LABEL[k]));
    const box = root.querySelector('[data-statusbox]');
    box.innerHTML = `<span class="lbl" id="enf-status-lbl">${esc(t('colStatus'))}</span>` + menuMarkup({
      id: 'enf-status', labelledBy: 'enf-status-lbl', value: label(enfState.status),
      items: ['all', 'active', 'pending', 'rejected', 'inactive'].map(k => ({ value: k, name: label(k), checked: enfState.status === k, right: String(c[k]) })),
    });
    bindMenu(box.querySelector('[data-menu=enf-status]'), k => {
      enfState.status = k; enfState.page = 1; renderTable();
      root.querySelector('#enf-status-btn')?.focus();
    }, ctx.onLeave);

    const q = normName(enfState.q);
    const list = all
      .filter(e => enfState.status === 'all' || e.status === enfState.status)
      .filter(e => !q || normName(`${fullName(e)} ${e.badge} ${e.rank}`).includes(q))
      .sort((a, b) => normName(`${a.last} ${a.first}`).localeCompare(normName(`${b.last} ${b.first}`)) || normName(a.first).localeCompare(normName(b.first)));
    const pg = paginate(list, enfState.page);
    enfState.page = pg.page;
    const tot = { today: { done: 0, cancelled: 0, voided: 0 }, month: { done: 0, cancelled: 0, voided: 0 } };
    const rows = new Map(list.map(e => {
      const k = counts(e.id);
      ['today', 'month'].forEach(p => ['done', 'cancelled', 'voided'].forEach(s => { tot[p][s] += k[p][s]; }));
      return [e.id, k];
    }));
    root.querySelector('[data-table]').innerHTML = `
      <div class="list-tools"><p class="showing">${esc(pg.n ? t('showingEnf', { a: pg.a, b: pg.b, n: pg.n }) : t('showingEnfNone'))}</p>
        ${pg.n ? `<button type="button" class="btn btn-ghost btn-sm" data-csv>${icon('download')}<span>${esc(t('downloadCsv'))}</span></button>` : ''}</div>
      ${pg.n ? `<div class="table-wrap"><table class="tbl tbl-enf">
        <thead><tr><th scope="col">${esc(t('colName'))}</th><th scope="col">${esc(t('colStatus'))}</th><th scope="col" class="n">${esc(t('colToday'))}</th><th scope="col" class="n">${esc(t('colMonth'))}</th></tr></thead>
        <tbody>${pg.slice.map(e => {
          const k = rows.get(e.id);
          return `<tr class="tr-link" data-href="#/enforcers/${e.id}">
            <th scope="row"><a href="#/enforcers/${e.id}" class="cell-name">${esc(displayName(e))}</a><span class="cell-sub">${esc([e.rank, e.badge].filter(Boolean).join(' · ') || t('dash'))}</span></th>
            <td data-label="${esc(t('colStatus'))}">${statusTag(e.status)}</td>
            <td class="n" data-label="${esc(t('colToday'))}">${cell(k.today)}</td>
            <td class="n" data-label="${esc(t('colMonth'))}">${cell(k.month)}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">${esc(t('totalIssued'))}</th><td class="n" data-label="${esc(t('colToday'))}">${cell(tot.today)}</td><td class="n" data-label="${esc(t('colMonth'))}">${cell(tot.month)}</td></tr></tfoot>
      </table></div>` : emptyState(t('noEnforcersMatch'), t('noEnforcersMatchBody'), 'users')}
      ${pager(pg.page, pg.pages)}`;
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { enfState.page = Number(b.dataset.page); renderTable(); }));
    root.querySelectorAll('.tr-link').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
    root.querySelector('[data-csv]')?.addEventListener('click', () => {
      const header = ['csvName', 'csvRank', 'csvBadge', 'csvStatus', 'csvTodayIssued', 'csvTodayCancelled', 'csvTodayVoided', 'csvMonthIssued', 'csvMonthCancelled', 'csvMonthVoided'].map(k => t(k));
      const csvRows = list.map(e => {
        const k = rows.get(e.id);
        return [fullName(e), e.rank || '', e.badge || '', t(STATUS_LABEL[e.status]), k.today.done, k.today.cancelled, k.today.voided, k.month.done, k.month.cancelled, k.month.voided];
      });
      downloadCsv(`enforcers-${ag.id.toLowerCase()}-${todayKey()}.csv`, header, csvRows);
      toast(tn('csvSaved', csvRows.length));
    });
  };
  root.querySelector('[name=q]').addEventListener('input', e => { enfState.q = e.target.value; enfState.page = 1; renderTable(); });
  renderTable();
  const off = subscribe(k => { if ((k === 'accounts' || k === 'citations') && document.body.contains(root)) renderTable(); });
  ctx.onLeave(off);
}

function historyList(h) {
  if (!h || !h.length) return `<p class="muted">${esc(t('noHistory'))}</p>`;
  const key = { approved: 'hApproved', rejected: 'hRejected', inactive: 'hInactive', active: 'hActive' };
  return `<ol class="hist">${[...h].reverse().map(x => `<li>
    <span class="hist-what">${esc(t(key[x.action], { by: personName(x.by) }))}</span>
    <span class="hist-when">${esc(fDateTime(x.at))}</span>
    ${x.reason ? `<span class="hist-reason">${esc(t('reason'))}: ${esc(x.reason)}</span>` : ''}</li>`).join('')}</ol>`;
}

async function decide(e, to, after) {
  const u = me();
  let reason = '';
  if (to === 'rejected') {
    const r = await dialog({ title: t('rejectTitle', { name: displayName(e) }), confirm: t('reject'), danger: true, textarea: { label: t('rejectReason'), hint: t('rejectReasonHint'), max: 200 } });
    if (!r) return;
    reason = r.text;
  }
  if (to === 'inactive') {
    const r = await dialog({ title: t('setInactive'), body: t('inactiveConfirm', { name: displayName(e) }), confirm: t('setInactive'), danger: true });
    if (!r) return;
  }
  const res = changeStatus(u.id, e.id, to, reason);
  if (res.error) toast(res.error, 'error'); else toast(res.message);
  after();
}

function enforcerDetail(root, ctx, id) {
  const u = me();
  const render = () => {
    const e = enforcer(id);
    if (!e || e.agency !== u.agency) {
      root.innerHTML = `<a class="back" href="#/enforcers">${icon('arrowL')}<span>${esc(t('backToEnforcers'))}</span></a><p class="alert alert-error">${icon('alert')}<span>${esc(t('errNotYourAgency'))}</span></p>`;
      return;
    }
    const k = counts(e.id);
    const own = S.citations.filter(c => c.owner === e.id);
    const books = activeBooklets(e.id);
    const acts = {
      pending: [['rejected', t('reject'), 'btn-danger-ghost'], ['active', t('approve'), 'btn-primary']],
      rejected: [['active', t('approveAfterAll'), 'btn-primary']],
      active: [['inactive', t('setInactive'), 'btn-danger-ghost']],
      inactive: [['active', t('setActive'), 'btn-primary']],
    }[e.status] || [];
    root.innerHTML = `
      <a class="back" href="#/enforcers">${icon('arrowL')}<span>${esc(t('backToEnforcers'))}</span></a>
      <article class="sheet">
        <header class="sheet-head">
          <div><h1 class="det-type">${esc(fullName(e))}</h1><p class="muted small">${esc([e.rank, e.badge].filter(Boolean).join(' · '))}</p></div>
          <div>${statusTag(e.status)}</div>
        </header>
        <div class="perf" aria-hidden="true"></div>
        <div class="det-cols">
          <section class="sec">
            ${kv([
              [t('rank'), esc(e.rank || t('dash'))], [t('badge'), esc(e.badge || t('dash'))],
              [t('gender'), esc(e.gender === 'M' ? t('male') : t('female'))], [t('contactNumber'), esc(fPhone(e.contact))],
              [t('address'), esc(e.address || t('dash'))], [t('registered'), esc(e.registeredAt ? fDate(e.registeredAt) : t('fromRecords'))],
            ])}
          </section>
          <section class="sec">
            <h2 class="h2">${esc(t('citationsIssued'))}</h2>
            <div class="table-wrap"><table class="tbl tbl-compact">
              <thead><tr><th scope="col"><span class="sr">${esc(t('period'))}</span></th><th scope="col" class="n">${esc(t('stIssued'))}</th><th scope="col" class="n">${esc(t('stCancelled'))}</th><th scope="col" class="n">${esc(t('stVoided'))}</th></tr></thead>
              <tbody>
                <tr><th scope="row">${esc(t('colToday'))}</th><td class="n">${k.today.done}</td><td class="n">${k.today.cancelled}</td><td class="n">${k.today.voided}</td></tr>
                <tr><th scope="row">${esc(t('colMonth'))}</th><td class="n">${k.month.done}</td><td class="n">${k.month.cancelled}</td><td class="n">${k.month.voided}</td></tr>
              </tbody></table></div>
          </section>
        </div>
        <div class="det-dash">
          <section class="sm-card">
            <h2 class="sm-h">${esc(t('bookletsInHand'))}</h2>
            ${books.length ? `<ul class="bkh-list">${books.map(b => {
              const sp = bookletSplit(b, own), size = bookletSize(b);
              return `<li class="bkh">
                <div class="bkh-top"><span class="strong">${esc(ctName(b.ctype))}</span><span class="bkh-range">${b.from}–${b.to}</span></div>
                ${bookletBar(sp, size)}
                <div class="bkh-top"><span class="bkh-meta">${esc(splitText(sp))}</span><b class="small">${esc(tn('formsLeftN', sp.open))}</b></div></li>`;
            }).join('')}</ul>` : `<p class="muted">${esc(t('noBookletInHand'))}</p>`}
          </section>
          ${dailyChart(own, { title: t('activity30') })}
        </div>
        <section class="sec"><h2 class="h2">${esc(t('history'))}</h2>${historyList(e.history)}</section>
        ${acts.length ? `<div class="actions-row">${acts.map(([to, label, cls]) => `<button type="button" class="btn ${cls} btn-lg" data-to="${to}">${esc(label)}</button>`).join('')}</div>` : ''}
      </article>`;
    root.querySelectorAll('[data-to]').forEach(b => b.addEventListener('click', () => decide(e, b.dataset.to, render)));
  };
  render();
}

// ------------------------------------------------------------------ Registrations
const regState = { page: 1 };
export function pendingCount() {
  const u = me();
  return u && u.kind === 'office' ? agencyEnforcers().filter(e => e.status === 'pending').length : 0;
}

export function registrationsView(root, ctx) {
  const render = () => {
    const list = agencyEnforcers().filter(e => e.status === 'pending' && e.source === 'reg').sort((a, b) => b.createdAt - a.createdAt);
    const pg = paginate(list, regState.page);
    regState.page = pg.page;
    root.innerHTML = `
      <div class="page-head">
        <h1 class="h1">${esc(t('registrationsTitle'))}</h1>
        <p class="lead">${esc(tn('registrationsLead', list.length))}</p>
      </div>
      ${pg.n ? `<p class="showing">${esc(t('showingReg', { a: pg.a, b: pg.b, n: pg.n }))}</p>
      <div class="table-wrap"><table class="tbl tbl-reg">
        <thead><tr>
          <th scope="col">${esc(t('colFullName'))}</th><th scope="col">${esc(t('colGender'))}</th><th scope="col">${esc(t('colRank'))}</th>
          <th scope="col">${esc(t('colBadge'))}</th><th scope="col">${esc(t('colContact'))}</th><th scope="col">${esc(t('colAddress'))}</th>
          <th scope="col">${esc(t('colRegistered'))}</th><th scope="col"><span class="sr">${esc(t('colDecision'))}</span></th></tr></thead>
        <tbody>${pg.slice.map(e => `<tr>
          <th scope="row">${esc(fullName(e))}</th>
          <td data-label="${esc(t('colGender'))}">${esc(e.gender === 'M' ? t('male') : t('female'))}</td>
          <td data-label="${esc(t('colRank'))}">${esc(e.rank || t('dash'))}</td>
          <td data-label="${esc(t('colBadge'))}">${esc(e.badge || t('dash'))}</td>
          <td data-label="${esc(t('colContact'))}" class="nowrap">${esc(fPhone(e.contact))}</td>
          <td data-label="${esc(t('colAddress'))}">${esc(e.address)}</td>
          <td data-label="${esc(t('colRegistered'))}" class="nowrap">${esc(fDateTime(e.createdAt))}</td>
          <td class="cell-actions"><button type="button" class="btn btn-danger-ghost btn-sm" data-reject="${e.id}">${esc(t('reject'))}</button>
            <button type="button" class="btn btn-primary btn-sm" data-approve="${e.id}">${esc(t('approve'))}</button></td></tr>`).join('')}</tbody>
      </table></div>` : emptyState(t('noRegistrations'), t('noRegistrationsBody'), 'inbox')}
      ${pager(pg.page, pg.pages)}`;
    root.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => decide(enforcer(b.dataset.approve), 'active', render)));
    root.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => decide(enforcer(b.dataset.reject), 'rejected', render)));
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { regState.page = Number(b.dataset.page); render(); }));
  };
  render();
  const off = subscribe(k => { if (k === 'accounts' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}
