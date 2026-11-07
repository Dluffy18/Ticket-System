// Verifier: the Booklet ledger. Every Control Number in every Booklet and its recorded outcome.
import { t } from '../strings.js';
import { esc, displayName, fDate, fDateTime } from '../util.js';
import { S, findAccount, agencyOf, ctName, bookletSize, bookletActive, bookletCurrent, subscribe } from '../store.js';
import { icon, serial, pager, paginate, emptyState } from '../ui.js';
import { kpi, bookletSplit, bookletBar, splitText } from './dash.js';

const st = { agency: '', ctype: '', state: '', page: 1 };
const STATE_LABEL = { done: 'stIssued', cancelled: 'stCancelled', voided: 'stVoided', open: 'notUsedYet' };

const ownerName = b => { const e = findAccount(b.owner); return e ? displayName(e) : t('unknownEnforcer'); };

export function bookletsView(root, ctx) {
  if (ctx.params[0]) return bookletDetail(root, ctx, ctx.params[0]);
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel === v ? 'selected' : ''}>${esc(label)}</option>`;
  const render = () => {
    const all = S.booklets.map(b => ({ b, active: bookletActive(b), ag: agencyOf(b.owner) }));
    const inUse = all.filter(r => r.active);
    const formsOut = inUse.reduce((n, r) => n + bookletSplit(r.b, S.citations).open, 0);
    const list = all
      .filter(r => !st.agency || r.ag?.id === st.agency)
      .filter(r => !st.ctype || r.b.ctype === st.ctype)
      .filter(r => !st.state || (st.state === 'inuse' ? r.active : !r.active))
      .sort((a, b) => (b.active - a.active) || (b.b.at - a.b.at) || (b.b.from - a.b.from));
    const pg = paginate(list, st.page);
    st.page = pg.page;
    root.innerHTML = `
    <div class="sm">
      <header class="sm-head"><div><h1 class="h1 sm-title">${esc(t('bookletsTitle'))}</h1><p class="lead">${esc(t('bookletsLead'))}</p></div></header>
      <div class="kpis kpis-3">
        ${kpi({ kind: 'unpaid', ic: 'book', label: t('kpiBkInUse'), n: inUse.length })}
        ${kpi({ kind: 'paid', ic: 'check', label: t('kpiBkUsedUp'), n: all.length - inUse.length })}
        ${kpi({ kind: 'cancelled', ic: 'file', label: t('kpiFormsOut'), n: formsOut, sub: t('kpiFormsOutSub') })}
      </div>
      <div class="filters filters-desk bk-filters">
        <div class="filter-grid">
          <label class="field"><span class="lbl">${esc(t('agency'))}</span><select class="input" name="agency">${opt('', t('allAgencies'), st.agency)}${S.ref.agencies.map(a => opt(a.id, a.name, st.agency)).join('')}</select></label>
          <label class="field"><span class="lbl">${esc(t('citationType'))}</span><select class="input" name="ctype">${opt('', t('allTypes'), st.ctype)}${S.ref.citationTypes.map(c => opt(c.id, c.name, st.ctype)).join('')}</select></label>
          <label class="field"><span class="lbl">${esc(t('bkState'))}</span><select class="input" name="state">${opt('', t('all'), st.state)}${opt('inuse', t('bkInUse'), st.state)}${opt('usedup', t('bkUsedUp'), st.state)}</select></label>
        </div>
      </div>
      <div>
        <p class="showing">${esc(pg.n ? t('showingBk', { a: pg.a, b: pg.b, n: pg.n }) : t('showingBkNone'))}</p>
        ${pg.n ? `<div class="table-wrap"><table class="tbl tbl-bk">
          <thead><tr><th scope="col">${esc(t('colRange'))}</th><th scope="col">${esc(t('colType'))}</th><th scope="col">${esc(t('colEnforcer'))}</th><th scope="col">${esc(t('colProgress'))}</th><th scope="col">${esc(t('bkState'))}</th></tr></thead>
          <tbody>${pg.slice.map(({ b, active, ag }) => {
            const sp = bookletSplit(b, S.citations), size = bookletSize(b);
            return `<tr class="tr-link" data-href="#/booklets/${encodeURIComponent(b.id)}">
              <th scope="row"><a href="#/booklets/${encodeURIComponent(b.id)}" class="bk-range-link">${serial(b.from)}<span class="muted">–</span>${serial(b.to)}</a></th>
              <td data-label="${esc(t('colType'))}">${esc(ctName(b.ctype))}</td>
              <td data-label="${esc(t('colEnforcer'))}"><span class="cell-name">${esc(ownerName(b))}</span><span class="cell-sub">${esc(ag?.name || '')}</span></td>
              <td data-label="${esc(t('colProgress'))}" class="bk-prog">${bookletBar(sp, size)}<span class="cell-sub">${esc(splitText(sp))}</span></td>
              <td data-label="${esc(t('bkState'))}">${active ? `<span class="tag tag-inuse">${esc(t('bkInUse'))}</span>` : `<span class="tag tag-usedup">${esc(t('bkUsedUp'))}</span>`}</td></tr>`;
          }).join('')}</tbody></table></div>` : emptyState(t('noBkMatch'), t('noBkMatchBody'), 'search')}
        ${pager(pg.page, pg.pages)}
      </div>
    </div>`;
    ['agency', 'ctype', 'state'].forEach(k => root.querySelector(`[name=${k}]`).addEventListener('change', e => { st[k] = e.target.value; st.page = 1; render(); root.querySelector(`[name=${k}]`).focus(); }));
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { st.page = Number(b.dataset.page); render(); }));
    root.querySelectorAll('.tr-link').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
  };
  render();
  const off = subscribe(k => { if (k === 'citations' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

function bookletDetail(root, ctx, id) {
  const render = () => {
    const b = S.booklets.find(x => x.id === id);
    if (!b) { ctx.go('#/booklets'); return; }
    const byNo = new Map(S.citations.filter(c => c.bookletId === b.id).map(c => [c.no, c]));
    const sp = bookletSplit(b, S.citations), size = bookletSize(b);
    const active = bookletActive(b);
    const next = active ? bookletCurrent(b) : null;
    const ag = agencyOf(b.owner);
    const cells = Array.from({ length: size }, (_, i) => {
      const no = b.from + i;
      const c = byNo.get(no);
      const short = String(no).slice(-2);
      if (!c) return `<span class="bkg-cell s-open ${no === next ? 'is-next' : ''}" title="${esc(`#${no} · ${no === next ? t('bkNextNo') : t('notUsedYet')}`)}">${short}</span>`;
      const tip = `#${no} · ${t(STATE_LABEL[c.status])} · ${fDateTime(c.at)}`;
      return `<a class="bkg-cell s-${c.status}" href="#/v/citations/${no}" title="${esc(tip)}" aria-label="${esc(tip)}">${short}</a>`;
    }).join('');
    root.innerHTML = `
    <div class="sm">
      <a class="back" href="#/booklets">${icon('arrowL')}<span>${esc(t('backToBooklets'))}</span></a>
      <section class="sm-card bkd">
        <header class="bkd-head">
          <div>
            <p class="det-type">${esc(ctName(b.ctype))}</p>
            <p class="bkd-range">${serial(b.from, 'serial-lg')}<span class="muted">–</span>${serial(b.to, 'serial-lg')}</p>
          </div>
          <dl class="bkd-facts">
            <div><dt>${esc(t('enforcer'))}</dt><dd>${esc(ownerName(b))}</dd></div>
            <div><dt>${esc(t('agency'))}</dt><dd>${esc(ag?.name || t('dash'))}</dd></div>
            <div><dt>${esc(t('registered'))}</dt><dd>${esc(fDate(b.at))}</dd></div>
            <div><dt>${esc(t('bkState'))}</dt><dd>${esc(active ? t('bkInUse') : t('bkUsedUp'))}</dd></div>
          </dl>
        </header>
        ${bookletBar(sp, size)}
        <p class="sm-keys">${['done', 'cancelled', 'voided', 'open'].map(k => `<span><i class="sm-dot s-${k === 'done' ? 'issued' : k}"></i>${esc(t(STATE_LABEL[k]))} <b>${sp[k]}</b></span>`).join('')}</p>
        ${!active ? `<p class="alert alert-ok">${icon('check')}<span>${esc(t('bkAllAccounted'))}</span></p>` : ''}
        <h2 class="sm-h bkg-h">${esc(t('bkGridTitle'))}</h2>
        <p class="muted small">${esc(active ? t('bkGridLead') : t('bkGridLeadDone'))}</p>
        <div class="bkg">${cells}</div>
      </section>
    </div>`;
  };
  render();
  const off = subscribe(k => { if (k === 'citations' && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

