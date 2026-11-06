// Shared pieces for the Office Admin and Verifier dashboards: the daily chart,
// Booklet progress bars and count tiles.
import { t } from '../strings.js';
import { esc, dayKey, fDate, startOfDay } from '../util.js';
import { bookletSize } from '../store.js';
import { icon } from '../ui.js';

const DAY = 86400000;
export const STATUS_KEYS = ['done', 'cancelled', 'voided'];
const STATUS_LABEL = { done: 'stIssued', cancelled: 'stCancelled', voided: 'stVoided', open: 'notUsedYet' };

// Count tile. `href` makes the footer a link.
// A full-color count tile, the same look as the Verifier Summary tiles.
// The bottom bar only appears when the tile links somewhere.
export function kpi({ kind, label, n, ic, sub = '', href = '', linkText = '' }) {
  return `
  <section class="kpi sm-tile sm-tile-${kind}">
    <div class="sm-tile-body">
      <p class="sm-tile-n">${n}</p>
      <h2 class="sm-tile-lbl">${esc(label)}</h2>
      ${sub ? `<p class="sm-tile-sub">${esc(sub)}</p>` : ''}
      ${ic ? `<span class="sm-tile-ic" aria-hidden="true">${icon(ic)}</span>` : ''}
    </div>
    ${href ? `<a class="sm-tile-foot" href="${href}"><span>${esc(linkText)}</span>${icon('chevR')}</a>` : ''}
  </section>`;
}

// Citations per day for the last `days` days, stacked Issued / Cancelled / Voided.
export function dailyChart(list, { days = 30, title }) {
  const end = startOfDay(Date.now());
  const keys = Array.from({ length: days }, (_, i) => dayKey(end - (days - 1 - i) * DAY));
  const rows = new Map(keys.map(k => [k, { done: 0, cancelled: 0, voided: 0 }]));
  list.forEach(c => { const r = rows.get(dayKey(c.at)); if (r) r[c.status]++; });
  const totals = keys.map(k => STATUS_KEYS.reduce((n, s) => n + rows.get(k)[s], 0));
  const max = Math.max(4, ...totals);
  const sum = s => keys.reduce((n, k) => n + rows.get(k)[s], 0);
  const label = k => fDate(new Date(k + 'T12:00:00'));
  const dayCol = (k, i) => {
    const r = rows.get(k);
    const tip = `${label(k)}: ${STATUS_KEYS.map(s => `${r[s]} ${t(STATUS_LABEL[s])}`).join(', ')}`;
    return `<div class="dc-day ${i === days - 1 ? 'is-today' : ''}" title="${esc(tip)}">${STATUS_KEYS.map(s => r[s]
      ? `<i class="dc-seg s-${s}" style="height:${r[s] / max * 100}%"></i>` : '').join('')}</div>`;
  };
  return `
  <section class="sm-card dc">
    <div class="dc-head">
      <h2 class="sm-h">${esc(title)}</h2>
      <p class="sm-keys sm-keys-sm">${STATUS_KEYS.map(s => `<span><i class="sm-dot s-${s === 'done' ? 'issued' : s}"></i>${esc(t(STATUS_LABEL[s]))} <b>${sum(s)}</b></span>`).join('')}</p>
    </div>
    <div class="dc-plot" aria-hidden="true">
      <div class="dc-tick" style="bottom:100%"><span>${max}</span></div>
      <div class="dc-tick" style="bottom:50%"><span>${Math.round(max / 2)}</span></div>
      <div class="dc-days" style="--n:${days}">${keys.map(dayCol).join('')}</div>
    </div>
    <div class="dc-x" aria-hidden="true"><span>${esc(label(keys[0]))}</span><span>${esc(label(keys[Math.floor(days / 2)]))}</span><span>${esc(t('today'))}</span></div>
    <div class="sr-only"><table><caption>${esc(title)}</caption>
      <thead><tr><th scope="col">${esc(t('day'))}</th>${STATUS_KEYS.map(s => `<th scope="col">${esc(t(STATUS_LABEL[s]))}</th>`).join('')}</tr></thead>
      <tbody>${keys.filter((k, i) => totals[i]).map(k => `<tr><th scope="row">${esc(label(k))}</th>${STATUS_KEYS.map(s => `<td>${rows.get(k)[s]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

// How a Booklet's numbers are split: Issued / Cancelled / Voided / not used yet.
export function bookletSplit(b, citations) {
  const r = { done: 0, cancelled: 0, voided: 0, open: 0 };
  citations.forEach(c => { if (c.bookletId === b.id) r[c.status]++; });
  r.open = bookletSize(b) - r.done - r.cancelled - r.voided;
  return r;
}
export function bookletBar(split, size) {
  return `<div class="bk-split" aria-hidden="true">${['done', 'cancelled', 'voided', 'open'].map(k => split[k]
    ? `<i class="s-${k}" style="width:${split[k] / size * 100}%"></i>` : '').join('')}</div>`;
}
export function splitText(split) {
  return ['done', 'cancelled', 'voided', 'open'].map(k => `${split[k]} ${t(STATUS_LABEL[k])}`).join(' · ');
}
