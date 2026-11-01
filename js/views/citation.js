// Shared rendering of one Citation (detail page) and list-row summaries.
import { t } from '../strings.js';
import { esc, fullName, fDateTime, fDayKey } from '../util.js';
import { ctName, vtName, enforcer, agencyOf, statusWord } from '../store.js';
import { icon, serial, stamp, kv } from '../ui.js';

const PHOTO_LABEL = { form: 'photoForm', id: 'photoId', plate: 'photoPlate' };

export function photoGrid(photos, { empty = t('noPhotos') } = {}) {
  const keys = ['form', 'id', 'plate'].filter(k => photos && photos[k]);
  if (!keys.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<div class="photos">${keys.map(k => `
    <figure class="photo"><a href="${esc(photos[k])}" target="_blank" rel="noopener"><img src="${esc(photos[k])}" alt="${esc(t('photoAlt', { what: t(PHOTO_LABEL[k]).toLowerCase() }))}" loading="lazy"></a>
    <figcaption>${esc(t(PHOTO_LABEL[k]))}</figcaption></figure>`).join('')}</div>`;
}

function sexWord(s) { return s === 'M' ? t('male') : s === 'F' ? t('female') : ''; }

export function violatorSummary(c) {
  const v = c.violator || {};
  const name = fullName(v);
  const anything = name || v.birthday || v.sex;
  if (!anything && c.status !== 'done') return `<p class="muted">${esc(t('notEntered'))}</p>`;
  return kv([
    [t('fullName'), name ? esc(name) : `<span class="muted">${esc(t('notEntered'))}</span>`],
    [t('birthday'), v.birthday ? esc(fDayKey(v.birthday)) : `<span class="muted">${esc(t('notEntered'))}</span>`],
    [t('sex'), v.sex ? esc(sexWord(v.sex)) : `<span class="muted">${esc(t('notEntered'))}</span>`],
    ['', `<span class="idby">${icon(c.noId ? 'user' : 'idcard')}${esc(c.noId ? t('identifiedNoId') : t('identifiedById'))}</span>`],
  ]);
}

export function violationList(ids) {
  if (!ids || !ids.length) return `<p class="muted">${esc(t('nothingPicked'))}</p>`;
  return `<ul class="vlist">${ids.map(id => `<li><span class="vcode">${esc(id)}</span>${esc(vtName(id))}</li>`).join('')}</ul>`;
}

// One line describing a Citation in a list.
export function rowSummary(c) {
  if (c.status === 'done') return esc(c.violations.map(vtName).join(', '));
  if (c.status === 'cancelled') return c.violations.length ? esc(t('cancelledNames', { names: c.violations.map(vtName).join(', ') })) : esc(t('formCancelled'));
  return esc(t('paperSaid', { p: c.incident?.paperNo || '' }));
}

export function violatorShort(c) {
  const n = fullName(c.violator || {});
  return n ? esc(n) : `<span class="muted">${esc(t('dash'))}</span>`;
}

function gpsText(g) {
  if (!g) return `<span class="muted">${esc(t('locationNone'))}</span>`;
  const q = `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}`;
  return `<a href="https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=18/${g.lat}/${g.lng}" target="_blank" rel="noopener">${icon('pin')}${esc(q)}</a>`;
}

// role: 'enforcer' | 'verifier'
export function citationDetail(c, { role = 'enforcer', paymentHtml = '' } = {}) {
  const admin = role !== 'enforcer';
  const e = enforcer(c.owner);
  const ag = agencyOf(c.owner);
  const head = `
    <header class="sheet-head det-head">
      <div>
        <p class="det-type">${esc(ctName(c.ctype))}</p>
        <div class="det-stamps">${stamp(c.status, { admin })}${c.payment ? `<span class="stamp stamp-paid">${esc(t('stPaid'))}</span>` : ''}${!c.synced ? `<span class="tag tag-sync">${icon('cloudOff')}${esc(t('notSyncedYet'))}</span>` : ''}</div>
      </div>
      <div class="det-no"><span class="lbl">${esc(t('currentNumber'))}</span>${serial(c.no, 'serial-lg')}</div>
    </header>`;

  const incident = c.status === 'voided' && c.incident ? `
    <section class="sec sec-incident">
      <h2 class="h2">${icon('file')}${esc(t('incidentTitle'))}</h2>
      ${kv([
        [t('incidentPaperNo'), serial(c.incident.paperNo)],
        [t('whatHappened'), esc(c.incident.text)],
        [t('incidentHint'), esc(c.incident.hint || '')],
      ])}
    </section>` : '';

  const who = admin && e ? `
    <section class="sec">
      <h2 class="h2">${esc(t('enforcer'))}</h2>
      ${kv([[t('fullName'), esc(fullName(e))], [t('agency'), esc(ag?.name || '')], [t('badge'), esc(e.badge || t('dash'))]])}
    </section>` : '';

  const nothing = c.status !== 'done' && !c.violations.length && !Object.values(c.photos || {}).some(Boolean) && !fullName(c.violator || {}) && !c.violator?.birthday;

  const body = nothing ? `<section class="sec"><p class="muted">${esc(t('nothingEntered'))}</p></section>` : `
    <section class="sec"><h2 class="h2">${esc(t('reviewViolations'))}</h2>${violationList(c.violations)}</section>
    <section class="sec"><h2 class="h2">${esc(t('reviewPhotos'))}</h2>${photoGrid(c.photos)}</section>
    <section class="sec"><h2 class="h2">${esc(t('reviewViolator'))}</h2>${violatorSummary(c)}
      ${admin && c.violatorId ? `<p class="muted small">${esc(t('violatorRecord'))}: ${esc(c.violatorId)}</p>` : ''}</section>`;

  const when = `
    <section class="sec">
      ${kv([
        [c.status === 'done' ? t('markedDoneAt') : t('recordedAt'), esc(fDateTime(c.at))],
        c.status === 'done' ? [t('location'), gpsText(c.gps)] : null,
      ])}
    </section>`;

  const finalNote = c.status === 'done'
    ? (admin ? t('issuedFinal') : t('doneFinal'))
    : t('closedFinal', { what: c.status === 'cancelled' ? t('wordCancelled') : t('wordVoided') });

  return `
    <article class="sheet det">
      ${head}
      <div class="perf" aria-hidden="true"></div>
      ${incident}
      ${who}
      ${c.status === 'done' ? body : `<div class="sec-entered">${body}</div>`}
      ${when}
      ${paymentHtml}
      <p class="final-note">${icon('ban')}${esc(finalNote)}</p>
    </article>`;
}

export { statusWord, fDayKey };
