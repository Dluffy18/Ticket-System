import { t } from '../strings.js';
import { esc, fullName, displayName, fDateTime, fDayKey, dayKey, monthKey, fMonthKey, todayKey, isToday, isThisMonth, normName } from '../util.js';
import { S, me, enforcer, agencyOf, ctName, markPaid, setUnpaid, validatePayment, personName, subscribe } from '../store.js';
import { icon, serial, stamp, toast, dialog, pager, paginate, emptyState, dateBox, bindDateBox } from '../ui.js';
import { citationDetail, violatorShort } from './citation.js';

const st = { q: '', agency: '', ctype: '', outcome: '', pay: '', age: '', month: '', day: '', page: 1 };
const clearState = () => Object.assign(st, { q: '', agency: '', ctype: '', outcome: '', pay: '', age: '', month: '', day: '', page: 1 });
const activeCount = () => ['agency', 'ctype', 'outcome', 'pay', 'age', 'month', 'day'].filter(k => st[k]).length;
let filtersOpen = false;
const isFiltered = () => !!(st.q || st.agency || st.ctype || st.outcome || st.pay || st.age || st.month || st.day);

function matches(c) {
  if (st.q) {
    const q = st.q.trim();
    const digits = q.replace(/\D/g, '');
    const byNo = /^\d+$/.test(q) && String(c.no).includes(digits);
    const byName = normName(fullName(c.violator || {})).includes(normName(q));
    if (!byNo && !byName) return false;
  }
  const e = enforcer(c.owner);
  if (st.agency && e?.agency !== st.agency) return false;
  if (st.ctype && c.ctype !== st.ctype) return false;
  if (st.outcome && c.status !== st.outcome) return false;
  if (st.pay === 'paid' && !(c.status === 'done' && c.payment)) return false;
  if (st.pay === 'unpaid' && !(c.status === 'done' && !c.payment)) return false;
  if (st.age && !(c.status === 'done' && !c.payment && unpaidAge(c) === st.age)) return false;
  if (st.month && monthKey(c.at) !== st.month) return false;
  if (st.day && dayKey(c.at) !== st.day) return false;
  return true;
}

// How long an Unpaid Citation has waited since it was issued.
const DAY = 86400000;
export const AGE_KEYS = ['0-7', '8-30', '30+'];
function unpaidAge(c) {
  const d = Math.floor((Date.now() - c.at) / DAY);
  return d <= 7 ? '0-7' : d <= 30 ? '8-30' : '30+';
}
// Months that have Citations, newest first; this month is always listed so the Summary can link to it.
function monthsWithCitations() {
  const set = new Set(S.citations.map(c => monthKey(c.at)));
  set.add(monthKey(Date.now()));
  return [...set].sort().reverse();
}

export function vCitationsView(root, ctx) {
  if (ctx.params[0]) return vDetail(root, ctx, Number(ctx.params[0]));
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel === v ? 'selected' : ''}>${esc(label)}</option>`;

  const renderFilters = () => {
    root.querySelector('[data-filters]').innerHTML = `
      <label class="search search-wide">${icon('search')}<span class="sr">${esc(t('search'))}</span>
        <input class="input" type="search" name="q" placeholder="${esc(t('searchCitations'))}" value="${esc(st.q)}" autocomplete="off"></label>
      <div class="filter-grid filter-grid-wide">
        <label class="field"><span class="lbl">${esc(t('agency'))}</span><select class="input" name="agency">${opt('', t('allAgencies'), st.agency)}${S.ref.agencies.map(a => opt(a.id, a.name, st.agency)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('citationType'))}</span><select class="input" name="ctype">${opt('', t('allTypes'), st.ctype)}${S.ref.citationTypes.map(c => opt(c.id, c.name, st.ctype)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('outcome'))}</span><select class="input" name="outcome">${opt('', t('allOutcomes'), st.outcome)}${opt('done', t('stIssued'), st.outcome)}${opt('cancelled', t('stCancelled'), st.outcome)}${opt('voided', t('stVoided'), st.outcome)}</select></label>
        <label class="field"><span class="lbl">${esc(t('payment'))}</span><select class="input" name="pay">${opt('', t('payBoth'), st.pay)}${opt('unpaid', t('stUnpaid'), st.pay)}${opt('paid', t('stPaid'), st.pay)}</select></label>
        <label class="field"><span class="lbl">${esc(t('unpaidFor'))}</span><select class="input" name="age">${opt('', t('anyAge'), st.age)}${AGE_KEYS.map(k => opt(k, t('age_' + k), st.age)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('month'))}</span><select class="input" name="month">${opt('', t('allMonths'), st.month)}${monthsWithCitations().map(m => opt(m, fMonthKey(m), st.month)).join('')}</select></label>
        <div class="field"><label class="lbl" for="v-day">${esc(t('day'))}</label>${dateBox({ id: 'v-day', name: 'day', value: st.day, clearable: true, attrs: `max="${todayKey()}"` })}</div>
      </div>`;
    const box = root.querySelector('[data-filters]');
    box.classList.toggle('collapsed', !filtersOpen);
    const n = activeCount();
    box.querySelector('.search').outerHTML = `<div class="filter-top">${box.querySelector('.search').outerHTML}<button type="button" class="btn btn-ghost btn-sm filter-toggle" aria-expanded="${filtersOpen}" data-toggle>${icon('sliders')}<span>${esc(n ? t('filtersBtnN', { n }) : t('filtersBtn'))}</span></button>
<button type="button" class="btn btn-ghost btn-sm" data-clear ${isFiltered() ? '' : 'disabled'}>${icon('x')}<span>${esc(t('clearFilters'))}</span></button></div>`;
    const f = root.querySelector('[data-filters]');
    // On phones the panel closes once a filter is picked or cleared; focus returns to the Filters button.
    const applied = () => {
      filtersOpen = false; st.page = 1; renderFilters(); renderList();
      const tg = root.querySelector('[data-toggle]'); if (tg?.offsetParent) tg.focus();
    };
    f.querySelector('[name=q]').addEventListener('input', e => { st.q = e.target.value; st.page = 1; renderList(); f.querySelector('[data-clear]').disabled = !isFiltered(); });
    ['agency', 'ctype', 'outcome', 'pay', 'age'].forEach(k => f.querySelector(`[name=${k}]`).addEventListener('change', e => { st[k] = e.target.value; applied(); }));
    // Month and Day narrow the same date, so picking one clears the other.
    f.querySelector('[name=month]').addEventListener('change', e => { st.month = e.target.value; if (st.month) st.day = ''; applied(); });
    f.querySelector('[name=day]').addEventListener('change', e => { const v = e.target.value; st.day = v && v <= todayKey() ? v : ''; if (st.day) st.month = ''; applied(); });
    f.querySelector('[data-toggle]').addEventListener('click', () => { filtersOpen = !filtersOpen; renderFilters(); });
    f.querySelector('[data-clear]').addEventListener('click', () => { clearState(); applied(); });
    bindDateBox(f.querySelector('[data-datebox]'), () => {
      st.day = ''; applied();
      const day = root.querySelector('#v-day'); if (day?.offsetParent) day.focus(); // desktop: panel stays visible
    });
  };

  const renderList = () => {
    const all = S.citations;
    const list = all.filter(matches).sort((a, b) => b.at - a.at);
    const pg = paginate(list, st.page);
    st.page = pg.page;
    const line = !isFiltered()
      ? (pg.n ? t('showingAll', { a: pg.a, b: pg.b, n: pg.n }) : t('showingNone'))
      : (pg.n ? t('showingMatching', { a: pg.a, b: pg.b, m: pg.n, n: all.length }) : t('showingMatchingNone', { n: all.length }));
    root.querySelector('[data-list]').innerHTML = `
      <p class="showing">${esc(line)}</p>
      ${pg.n ? `<div class="table-wrap"><table class="tbl tbl-cit">
        <thead><tr><th scope="col">${esc(t('colNo'))}</th><th scope="col">${esc(t('colType'))}</th><th scope="col">${esc(t('colEnforcer'))}</th><th scope="col">${esc(t('colViolator'))}</th><th scope="col">${esc(t('colOutcome'))}</th><th scope="col">${esc(t('colPayment'))}</th><th scope="col">${esc(t('colDate'))}</th></tr></thead>
        <tbody>${pg.slice.map(c => {
          const e = enforcer(c.owner); const ag = agencyOf(c.owner);
          return `<tr class="tr-link" data-href="#/v/citations/${c.no}">
            <th scope="row"><a href="#/v/citations/${c.no}">${serial(c.no)}</a></th>
            <td data-label="${esc(t('colType'))}">${esc(ctName(c.ctype))}</td>
            <td data-label="${esc(t('colEnforcer'))}"><span class="cell-name">${esc(e ? displayName(e) : c.owner)}</span><span class="cell-sub">${esc(ag?.name || '')}</span></td>
            <td data-label="${esc(t('colViolator'))}">${violatorShort(c)}</td>
            <td data-label="${esc(t('colOutcome'))}">${stamp(c.status, { admin: true })}</td>
            <td data-label="${esc(t('colPayment'))}">${c.status !== 'done' ? `<span class="muted">${esc(t('dash'))}</span>` : c.payment ? `<span class="stamp stamp-paid stamp-sm">${esc(t('stPaid'))}</span><span class="cell-sub">${esc(c.payment.orNo)}</span>` : `<span class="tag tag-unpaid">${esc(t('stUnpaid'))}</span>`}</td>
            <td data-label="${esc(t('colDate'))}" class="nowrap">${esc(fDateTime(c.at))}</td></tr>`;
        }).join('')}</tbody></table></div>` : emptyState(t('emptyFilterTitle'), t('emptyFilterBody'), 'search')}
      ${pager(pg.page, pg.pages)}`;
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderList(); }));
    root.querySelectorAll('.tr-link').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
  };

  root.innerHTML = `
    <div class="page-head"><h1 class="h1">${esc(t('vCitationsTitle'))}</h1><p class="lead">${esc(t('vCitationsLead'))}</p></div>
    <div class="filters filters-desk" data-filters></div>
    <div data-list></div>`;
  renderFilters();
  renderList();
  const off = subscribe(k => { if (k === 'citations' && document.body.contains(root)) renderList(); });
  ctx.onLeave(off);
}

function vDetail(root, ctx, no) {
  const u = me();
  const c = S.citations.find(x => x.no === no);
  if (!c) { ctx.go('#/v/citations'); return; }
  let form = { or: '', date: todayKey(), errors: {} };

  const payHtml = () => {
    let inner;
    if (c.status !== 'done') inner = `<p class="muted">${esc(t('notIssuedNoPayment'))}</p>`;
    else if (c.payment) inner = `
      <div class="paid-line"><span class="stamp stamp-paid stamp-lg">${esc(t('stPaid'))}</span>
        <span class="paid-or">${esc(t('paidLine', { or: c.payment.orNo, date: fDayKey(c.payment.date) }))}</span></div>
      <button type="button" class="btn btn-danger-ghost" data-unpaid>${esc(t('setUnpaid'))}</button>`;
    else inner = `
      <form class="pay-form" novalidate>
        <div class="grid-2 tight">
          <label class="field ${form.errors.or ? 'has-err' : ''}"><span class="lbl">${esc(t('orNumber'))}</span>
            <input class="input input-serial" name="or" value="${esc(form.or)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-invalid="${form.errors.or ? 'true' : 'false'}">
            <span class="err" ${form.errors.or ? '' : 'hidden'}>${esc(form.errors.or || '')}</span></label>
          <label class="field ${form.errors.date ? 'has-err' : ''}"><span class="lbl">${esc(t('datePaid'))}</span>
            ${dateBox({ name: 'date', value: form.date, attrs: `max="${todayKey()}" min="${dayKey(c.at)}" aria-invalid="${form.errors.date ? 'true' : 'false'}"` })}
            <span class="err" ${form.errors.date ? '' : 'hidden'}>${esc(form.errors.date || '')}</span></label>
        </div>
        <button type="submit" class="btn btn-primary btn-lg">${icon('check')}<span>${esc(t('markPaid'))}</span></button>
      </form>`;
    const hist = [...c.payHistory].reverse();
    return `
      <section class="sec sec-pay">
        <h2 class="h2">${esc(t('payment'))}</h2>
        ${inner}
        <h3 class="h3">${esc(t('payHistory'))}</h3>
        ${hist.length ? `<ol class="hist">${hist.map(h => `<li><span class="hist-what">${esc(h.action === 'paid'
          ? t('hPaid', { or: h.orNo, date: fDayKey(h.date), by: personName(h.by), at: fDateTime(h.at) })
          : t('hUnpaid', { or: h.orNo, by: personName(h.by), at: fDateTime(h.at) }))}</span></li>`).join('')}</ol>`
          : `<p class="muted">${esc(t('noPayHistory'))}</p>`}
      </section>`;
  };

  const render = () => {
    root.innerHTML = `<a class="back" href="#/v/citations">${icon('arrowL')}<span>${esc(t('backToList'))}</span></a>
      ${citationDetail(c, { role: 'verifier', paymentHtml: payHtml() })}`;
    const f = root.querySelector('.pay-form');
    if (f) {
      f.or.addEventListener('input', () => { form.or = f.or.value; if (form.errors.or) { form.errors = validatePayment(c, form.or, form.date).err; refreshErr(f); } });
      bindDateBox(f.querySelector('[data-datebox]'));
      f.date.addEventListener('change', () => { form.date = f.date.value; form.errors = validatePayment(c, form.or, form.date).err; refreshErr(f); });
      f.addEventListener('submit', e => {
        e.preventDefault();
        form.or = f.or.value; form.date = f.date.value;
        const res = markPaid(u.id, c, form.or, form.date);
        if (res.errors) { form.errors = res.errors; render(); root.querySelector('.has-err input')?.focus(); return; }
        form = { or: '', date: todayKey(), errors: {} };
        toast(res.message);
        render();
      });
    }
    root.querySelector('[data-unpaid]')?.addEventListener('click', async () => {
      const ok = await dialog({ title: t('setUnpaid'), body: t('unpaidConfirm', { no: c.no }), confirm: t('setUnpaid'), danger: true });
      if (!ok) return;
      const res = setUnpaid(u.id, c);
      if (res.ok) toast(res.message);
      render();
    });
  };
  const refreshErr = f => {
    ['or', 'date'].forEach(k => {
      const lab = f[k].closest('.field');
      const er = lab.querySelector('.err');
      er.hidden = !form.errors[k]; er.textContent = form.errors[k] || '';
      lab.classList.toggle('has-err', !!form.errors[k]);
      f[k].setAttribute('aria-invalid', form.errors[k] ? 'true' : 'false');
    });
  };
  render();
}

// ------------------------------------------------------------------ Summary
const sumState = { period: 'today' };
export function summaryView(root) {
  const calc = list => ({
    issued: list.filter(c => c.status === 'done').length,
    unpaid: list.filter(c => c.status === 'done' && !c.payment).length,
    paid: list.filter(c => c.status === 'done' && c.payment).length,
    cancelled: list.filter(c => c.status === 'cancelled').length,
    voided: list.filter(c => c.status === 'voided').length,
  });
  const inPeriod = (c, p) => p === 'today' ? isToday(c.at) : isThisMonth(c.at);
  const render = () => {
    const p = sumState.period;
    const list = S.citations.filter(c => inPeriod(c, p));
    const rows = S.ref.agencies.map(a => ({ a, s: calc(list.filter(c => enforcer(c.owner)?.agency === a.id)) }));
    const tot = calc(list);
    const seg = (k, l) => `<button type="button" class="sm-seg-btn ${p === k ? 'on' : ''}" data-p="${k}" aria-pressed="${p === k}">${esc(t(l))}</button>`;
    root.innerHTML = `
    <div class="sm">
      <header class="sm-head">
        <div><h1 class="h1 sm-title">${esc(t('summaryTitle'))}</h1><p class="lead">${esc(t('summaryNote'))}</p></div>
        <div class="sm-seg" role="group" aria-label="${esc(t('period'))}">${seg('today', 'today')}${seg('month', 'thisMonth')}</div>
      </header>
      <div class="sm-cards">
        ${tile('unpaid', t('stUnpaid'), tot.unpaid, 'clock')}
        ${tile('paid', t('stPaid'), tot.paid, 'check')}
        ${tile('cancelled', t('stCancelled'), tot.cancelled, 'fileX')}
        ${tile('voided', t('stVoided'), tot.voided, 'ban')}
      </div>
      <div class="sm-charts">
        ${donutCard(rows, tot.issued)}
        ${barsCard(rows)}
      </div>
      ${ageCard()}
    </div>`;
    root.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { sumState.period = b.dataset.p; render(); }));
    // "View citations": open the list showing exactly what the tile counted.
    root.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => {
      clearState();
      const k = a.dataset.go;
      if (k === 'unpaid' || k === 'paid') st.pay = k; else st.outcome = k;
      if (p === 'today') st.day = todayKey(); else st.month = monthKey(Date.now());
    }));
    root.querySelectorAll('[data-age]').forEach(a => a.addEventListener('click', () => { clearState(); st.age = a.dataset.age; }));
  };
  render();
}

// Every Issued Citation not yet Paid, by days since it was issued. Not limited to the period above.
function ageCard() {
  const unpaid = S.citations.filter(c => c.status === 'done' && !c.payment);
  const n = Object.fromEntries(AGE_KEYS.map(k => [k, 0]));
  unpaid.forEach(c => { n[unpaidAge(c)]++; });
  const max = Math.max(1, ...Object.values(n));
  return `
  <section class="sm-card age-card">
    <div class="age-head">
      <div><h2 class="sm-h">${esc(t('unpaidByAge'))}</h2><p class="muted small">${esc(t('unpaidByAgeLead', { n: unpaid.length }))}</p></div>
    </div>
    <ul class="age-list">${AGE_KEYS.map(k => `<li class="age-${k === '30+' ? 'old' : k === '8-30' ? 'mid' : 'new'}">
      <a href="#/v/citations" data-age="${k}" aria-label="${esc(t('viewCitationsOf', { what: t('age_' + k) }))}">
        <span class="age-lbl">${esc(t('age_' + k))}</span>
        <span class="age-bar" aria-hidden="true"><i style="width:${n[k] / max * 100}%"></i></span>
        <b class="age-n">${n[k]}</b>${icon('chevR')}
      </a></li>`).join('')}</ul>
  </section>`;
}
const agColor = a => `--c: var(--ag-${a.id}, var(--ink-3))`;
const pct = (n, d) => d ? Math.round(n / d * 100) : null;

function tile(kind, label, n, ic) {
  return `
  <section class="sm-tile sm-tile-${kind}">
    <div class="sm-tile-body">
      <p class="sm-tile-n">${n}</p>
      <h2 class="sm-tile-lbl">${esc(label)}</h2>
      <span class="sm-tile-ic" aria-hidden="true">${icon(ic)}</span>
    </div>
    <a class="sm-tile-foot" href="#/v/citations" data-go="${kind}" aria-label="${esc(t('viewCitationsOf', { what: label }))}"><span>${esc(t('viewCitations'))}</span>${icon('chevR')}</a>
  </section>`;
}

function donutCard(rows, total) {
  const R = 80, C = 2 * Math.PI * R;
  const live = rows.filter(r => r.s.issued > 0);
  let at = 0;
  const arcs = live.map(({ a, s }) => {
    const len = s.issued / total * C;
    const gap = live.length > 1 ? Math.min(2, len / 3) : 0;
    const arc = `<circle r="${R}" cx="100" cy="100" style="${agColor(a)}" stroke-dasharray="${len - gap} ${C - len + gap}" stroke-dashoffset="${-at}"/>`;
    at += len;
    return arc;
  }).join('');
  return `
  <section class="sm-card sm-donut-card">
    <h2 class="sm-h">${esc(t('issuedByAgency'))}</h2>
    <div class="sm-donut">
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g transform="rotate(-90 100 100)">
        <circle r="${R}" cx="100" cy="100" class="sm-ring"/>${arcs}</g></svg>
      <p class="sm-donut-mid"><b>${total}</b>${esc(t('issuedInTotal'))}</p>
    </div>
    <ul class="sm-legend">${rows.map(({ a, s }) => `
      <li style="${agColor(a)}"><i class="sm-dot"></i><span class="sm-legend-name">${esc(a.name)}</span><b>${s.issued}</b><span class="sm-legend-pct">${total ? pct(s.issued, total) + '%' : t('dash')}</span></li>`).join('')}
    </ul>
  </section>`;
}

const BAR_KEYS = [['unpaid', 'stUnpaid'], ['paid', 'stPaid'], ['cancelled', 'stCancelled'], ['voided', 'stVoided']];

// Axis top: 5 at least, then 10, 20, 40, 60, 80, 100, 200...
function niceMax(m) {
  if (m <= 5) return 5;
  if (m <= 10) return 10;
  const n = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 4, 6, 8, 10].map(f => f * n).find(v => v >= m);
}

function barsCard(rows) {
  const max = niceMax(Math.max(0, ...rows.flatMap(({ s }) => BAR_KEYS.map(([k]) => s[k]))));
  const ticks = max % 2 ? [max, 0] : [max, max / 2, 0];
  return `
  <section class="sm-card sm-bars-card">
    <div class="sm-bars-head">
      <h2 class="sm-h">${esc(t('statusByAgency'))}</h2>
      <p class="sm-keys sm-keys-sm">${BAR_KEYS.map(([k, l]) => `<span><i class="sm-dot s-${k}"></i>${esc(t(l))}</span>`).join('')}</p>
    </div>
    <div class="sm-plot" aria-hidden="true">
      ${ticks.map(v => `<div class="sm-tick" style="bottom:${v / max * 100}%"><span>${v}</span></div>`).join('')}
      <div class="sm-groups">${rows.map(({ s }) => `<div class="sm-group">${BAR_KEYS.map(([k]) => `
        <div class="sm-bar s-${k} ${s[k] ? '' : 'is-zero'}" style="height:${s[k] / max * 100}%"><span>${s[k]}</span></div>`).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="sm-xlabels" aria-hidden="true">${rows.map(({ a }) => `<span style="${agColor(a)}"><i class="sm-dot"></i><span class="sm-x-full">${esc(a.name)}</span><span class="sm-x-short">${esc(a.short || a.name)}</span></span>`).join('')}</div>
    <div class="sr-only"><table>
      <caption>${esc(t('statusByAgency'))}</caption>
      <thead><tr><th scope="col">${esc(t('agency'))}</th><th scope="col">${esc(t('stIssued'))}</th>${BAR_KEYS.map(([, l]) => `<th scope="col">${esc(t(l))}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(({ a, s }) => `<tr><th scope="row">${esc(a.name)}</th><td>${s.issued}</td>${BAR_KEYS.map(([k]) => `<td>${s[k]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}
