import { t, tn } from '../strings.js';
import { esc, fullName, fTime, fDateTime, dayKey, todayKey, isToday, isThisMonth, SUFFIXES } from '../util.js';
import {
  S, me, typesFor, agencyOf, ctName, vtName, violationsFor, activeBooklet, bookletSize, bookletUsed, bookletCurrent,
  currentTypeOf, setCurrentType, registerBooklet, bookletFormCount, getDraft, draftHasEntries, discardDraft, requiredPhotos, nextMissingPhoto, setPhoto,
  setNoId, typeField, missingItems, markDone, cancelForm, incidentCheck, voidForm, subscribe,
} from '../store.js';
import { icon, serial, stamp, toast, dialog, pager, paginate, emptyState, kv, unsyncedTag, menuMarkup, bindMenu, setMenuValue, dateBox, bindDateBox, fitLines } from '../ui.js';
import { takePhoto } from '../camera.js';
import { citationDetail, rowSummary, violatorShort, photoGrid, violationList, photoWhat } from './citation.js';

const PHOTO_LABEL = { form: 'photoForm', id: 'photoId', violator: 'photoViolator', plate: 'photoPlate' };
const myCitations = id => S.citations.filter(c => c.owner === id);

// ------------------------------------------------------------------ Home
export function homeView(root, ctx) {
  const u = me();
  const types = typesFor(u.id);
  const ct = currentTypeOf(u.id);
  const b = activeBooklet(u.id, ct);
  const todays = myCitations(u.id).filter(c => isToday(c.at)).sort((a, b2) => b2.at - a.at);
  // The numbering machine advances: animate once right after a form closes.
  const justClosed = S.justClosed;
  S.justClosed = null;

  // Citation Type dropdown: only for Agencies that issue more than one type.
  const tabs = types.length > 1 ? menuMarkup({
    id: 'type-menu', label: t('citationType'), inlineLabel: true, value: ctName(ct),
    items: types.map(c => {
      const has = !!activeBooklet(u.id, c.id);
      return { value: c.id, name: c.name, checked: c.id === ct, right: has ? t('stateActive') : t('stateNoBooklet'), rightClass: has ? 'is-active' : '' };
    }),
  }) : `
    <div class="type-menu type-menu-static">
      <span class="lbl">${esc(t('citationType'))}</span>
      <span class="type-menu-val">${esc(ctName(ct))}</span>
    </div>`;

  let sheet;
  if (!b) {
    sheet = `
      <div class="sheet sheet-copies home-sheet">
        <header class="sheet-head"><div><p class="det-type">${esc(ctName(ct))}</p></div></header>
        <div class="perf" aria-hidden="true"></div>
        <div class="sheet-body">
          <p class="lead">${esc(t('noBooklet'))}</p>
          <a class="btn btn-primary btn-block btn-lg" href="#/type/${ct}">${icon('plus')}<span>${esc(t('registerBooklet'))}</span></a>
        </div>
      </div>`;
  } else {
    const used = bookletUsed(b), size = bookletSize(b), left = size - used, cur = bookletCurrent(b);
    const d = S.drafts[b.id];
    const started = d && d.no === cur && (d.violations.length || Object.values(d.photos).some(Boolean) || Object.values(d.violator).some(Boolean));
    const cells = [];
    const byNo = new Map(S.citations.filter(c => c.bookletId === b.id).map(c => [c.no, c]));
    for (let n = b.from; n <= b.to; n++) {
      const c = byNo.get(n);
      cells.push(`<i class="${c ? 'c-' + c.status : n === cur ? 'c-cur' : ''}"></i>`);
    }
    sheet = `
      <div class="sheet sheet-copies home-sheet">
        <header class="sheet-head">
          <div>
            <p class="det-type">${esc(ctName(ct))}</p>
            <p class="muted small">${esc(t('booklet'))} <span class="num">${b.from}–${b.to}</span></p>
          </div>
          <div class="det-no"><span class="lbl">${esc(t('currentNumber'))}</span>${serial(cur, 'serial-xl' + (justClosed ? ' roll' : ''))}</div>
        </header>
        <div class="perf" aria-hidden="true"></div>
        <div class="sheet-body">
          <p class="write-this">${esc(t('writeThisNumber', { type: ctName(ct) }))}<br><span class="muted">${esc(t('matchPaper'))}</span></p>
          <div class="tally" style="--n:${size}" role="img" aria-label="${esc(`${t('formsUsed')} ${used}, ${t('formsLeft')} ${left}`)}">${cells.join('')}</div>
          <div class="boxrow">
            <div class="box"><span class="lbl">${esc(t('formsUsed'))}</span><span class="box-n">${used}</span></div>
            <div class="box"><span class="lbl">${esc(t('formsLeft'))}</span><span class="box-n">${left}</span></div>
          </div>
          ${left <= 5 ? `<p class="alert alert-warn">${icon('alert')}<span>${esc(tn('lowForms', left))}</span></p>` : ''}
          <a class="btn btn-primary btn-block btn-xl" href="#/record/${started ? (d.step || 1) : 1}">${esc(started ? t('continueCitation') : t('startCitation'))}${started ? `<span class="btn-note">${esc(t('draftKept'))}</span>` : ''}</a>
          <p class="hint center">${esc(t('startHint'))}</p>
        </div>
      </div>`;
  }

  root.innerHTML = `<div class="home">
    <div class="home-main">
    ${tabs}
    ${sheet}
    </div>
    <section class="today">
      <div class="sec-head"><h2 class="h2">${esc(t('today'))}</h2><a href="#/citations" class="link">${esc(t('seeAll'))}${icon('chevR')}</a></div>
      ${todays.length ? `<ul class="rows">${todays.slice(0, 8).map((c, i) => `
        <li${i >= 5 ? ' class="today-more"' : ''}><a class="row" href="#/citations/${c.no}">
          <span class="row-time">${esc(fTime(c.at))}</span>
          ${serial(c.no)}
          <span class="row-mid">${!c.synced ? unsyncedTag() : ''}</span>
          ${c.no === justClosed ? stamp(c.status).replace('class="stamp ', 'class="stamp land ') : stamp(c.status)}
        </a></li>`).join('')}</ul>` : `<p class="muted">${esc(t('nothingToday'))}</p>`}
    </section>
  </div>`;

  const menu = root.querySelector('[data-menu=type-menu]');
  if (menu) bindMenu(menu, id => {
    if (activeBooklet(u.id, id)) {
      setCurrentType(u.id, id);
      ctx.go('#/home', t('nowRecording', { type: ctName(id), no: bookletCurrent(activeBooklet(u.id, id)) }));
    } else {
      ctx.go('#/type/' + id);
    }
  }, ctx.onLeave);
}

// ------------------------------------------------------------------ Citation Type
export function typeView(root, ctx) {
  const u = me();
  const ag = agencyOf(u.id);
  const types = typesFor(u.id);
  const locked = types.length === 1;
  let sel = ctx.params[0] && types.some(c => c.id === ctx.params[0]) ? ctx.params[0] : (locked ? types[0].id : null);

  const render = () => {
    const b = sel ? activeBooklet(u.id, sel) : null;
    const finished = sel ? S.lastFinished[u.id]?.[sel] : null;
    root.innerHTML = `
      <h1 class="h1">${esc(t('typeTitle'))}</h1>
      <p class="lead">${esc(locked ? t('typeLocked', { agency: ag.name, type: types[0].name }) : t('typeLead'))}</p>
      <div class="type-cols">
      <div class="choice" role="radiogroup" aria-label="${esc(t('citationType'))}">
        ${types.map(c => {
          const has = !!activeBooklet(u.id, c.id);
          return `<label class="choice-row ${c.id === sel ? 'on' : ''} ${locked ? 'locked' : ''}">
            <input type="radio" name="ct" value="${c.id}" ${c.id === sel ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span class="choice-name">${esc(c.name)}</span><span class="sr"> · </span>
            <span class="choice-state ${has ? 'is-active' : ''}">${esc((has ? t('typeActive', { type: '' }) : t('typeNoBooklet', { type: '' })).replace(/^\s*·\s*/, ''))}</span>
          </label>`;
        }).join('')}
      </div>
      <div class="type-side">
      ${!sel ? `<p class="type-guide">${esc(t('typeGuide'))}</p>` : ''}
      ${sel && !b ? `
        <form class="sheet booklet-form" novalidate>
          <header class="sheet-head"><h2 class="h2">${esc(t('registerBookletFor', { type: ctName(sel) }))}</h2></header>
          <div class="perf" aria-hidden="true"></div>
          <div class="sheet-body">
            ${finished ? `<p class="alert alert-ok">${icon('check')}<span>${esc(t('bookletJustFinished', { from: finished.from, to: finished.to }))}</span></p>` : ''}
            <p class="muted">${esc(t('bookletLead'))}</p>
            <div class="grid-2 tight">
              <label class="field"><span class="lbl">${esc(t('from'))}</span><input class="input input-serial" name="from" inputmode="numeric" autocomplete="off" pattern="[0-9]*"></label>
              <label class="field"><span class="lbl">${esc(t('to'))}</span><input class="input input-serial" name="to" inputmode="numeric" autocomplete="off" pattern="[0-9]*"></label>
            </div>
            <p class="count" aria-live="polite"></p>
            <p class="alert alert-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('register'))}</button>
          </div>
        </form>` : ''}
      ${sel && b ? `<p class="muted">${esc(t('activeBookletRange', { from: b.from, to: b.to }))}</p>` : ''}
      </div>
      </div>`;

    root.querySelectorAll('input[name=ct]').forEach(r => r.addEventListener('change', () => {
      const id = r.value;
      if (activeBooklet(u.id, id)) {
        setCurrentType(u.id, id);
        ctx.go('#/home', t('nowRecording', { type: ctName(id), no: bookletCurrent(activeBooklet(u.id, id)) }));
        return;
      }
      sel = id;
      history.replaceState(null, '', '#/type/' + id);
      render();
      root.querySelector('[name=from]')?.focus();
    }));

    const form = root.querySelector('.booklet-form');
    if (form) {
      const count = form.querySelector('.count');
      const err = form.querySelector('.alert-error');
      const upd = () => {
        const n = bookletFormCount(form.from.value.trim(), form.to.value.trim());
        count.textContent = n ? tn('formsInBooklet', n) : '';
      };
      form.addEventListener('input', () => { upd(); err.hidden = true; });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const res = registerBooklet(u.id, sel, form.from.value, form.to.value);
        if (res.error) { err.hidden = false; err.innerHTML = `${icon('alert')}<span>${esc(res.error)}</span>`; return; }
        ctx.go('#/home', res.message);
      });
    }
  };
  render();
}

// ------------------------------------------------------------------ Recording (3 steps)
export function recordView(root, ctx) {
  const u = me();
  const ct = currentTypeOf(u.id);
  const b = activeBooklet(u.id, ct);
  if (!b) { ctx.go('#/home'); return; }
  const d = getDraft(b);
  let step = Math.min(3, Math.max(1, Number(ctx.params[0]) || 1));
  d.step = step;
  let query = '';
  let incident = { paper: '', text: '', open: false };

  const stepsNav = () => {
    const miss = missingItems(d);
    const s1 = d.violations.length > 0;
    const s2 = !miss.some(m => m.step === 2);
    return `<nav class="steps" aria-label="Steps">${[1, 2, 3].map(n => {
      const ok = n === 1 ? s1 : n === 2 ? s2 : miss.length === 0;
      const lbl = t('step' + n);
      return `<a class="step ${n === step ? 'on' : ''} ${ok ? 'ok' : ''}" href="#/record/${n}" ${n === step ? 'aria-current="step"' : ''}>
        <span class="step-n">${ok && n !== step ? icon('check') : n}</span><span class="step-l">${esc(lbl)}</span></a>`;
    }).join('')}</nav>`;
  };

  const shell = body => `
    <div class="rec">
      <header class="rec-bar">
        <button type="button" class="icon-btn" data-discard aria-label="${esc(t('discardCitation'))}" title="${esc(t('discardCitation'))}">${icon('x')}</button>
        <div class="rec-title"><span class="rec-type">${esc(ctName(ct))}</span>${serial(d.no, 'serial-md')}</div>
        <span class="rec-spacer"></span>
      </header>
      ${stepsNav()}
      <div class="rec-body">${body}</div>
    </div>`;

  // ---- Step 1
  const step1 = () => {
    const list = violationsFor(u.id, ct);
    return `
      <h1 class="h1 rec-h">${esc(t('step1'))}</h1>
      <p class="muted">${esc(t('violationsLead'))}</p>
      <label class="search">${icon('search')}<span class="sr">${esc(t('searchViolations'))}</span>
        <input class="input" type="search" name="q" placeholder="${esc(t('searchViolations'))}" value="${esc(query)}" autocomplete="off"></label>
      <ul class="checks" role="group" aria-label="${esc(t('step1'))}">
        ${list.map(v => `<li data-name="${esc((v.id + ' ' + v.name).toLowerCase())}"><label class="check">
          <input type="checkbox" value="${v.id}" ${d.violations.includes(v.id) ? 'checked' : ''}>
          <span class="check-box" aria-hidden="true">${icon('check')}</span>
          <span class="vcode">${esc(v.id)}</span><span class="check-name">${esc(v.name)}</span></label></li>`).join('')}
      </ul>
      <p class="muted no-match" hidden>${esc(t('noViolationMatch'))}</p>
      <div class="rec-foot"><span class="picked">${esc(t('nPicked', { n: d.violations.length }))}</span>
        <a class="btn btn-primary btn-lg" href="#/record/2">${esc(t('next'))}${icon('chevR')}</a></div>`;
  };

  // ---- Step 2
  const fieldHtml = (f, label, opts = {}) => {
    const mark = d.marks[f];
    // Full wording on PC; a short form on phones so it stays on one line in narrow columns.
    const full = mark === 'read' ? t('markRead') : t('markUnread');
    const short = mark === 'read' ? t('markReadShort') : t('markUnreadShort');
    const markHtml = mark ? `<span class="mark mark-${mark}">${icon(mark === 'read' ? 'idcard' : 'alert')}<span class="sr">${esc(full)}</span><span class="mk-full" aria-hidden="true">${esc(full)}</span><span class="mk-short" aria-hidden="true">${esc(short)}</span></span>` : '';
    const tag = opts.div ? 'div' : 'label';
    return `<${tag} class="field ${mark ? 'marked-' + mark : ''}" data-f="${f}"><span class="lbl" id="lbl-${f}">${esc(label)}${opts.optional ? ` <em>${esc(t('optional'))}</em>` : ''}</span>
      ${opts.input}${markHtml}</${tag}>`;
  };
  const step2 = () => {
    const req = requiredPhotos(d);
    const nextKind = nextMissingPhoto(d);
    const v = d.violator;
    const sfx = SUFFIXES.map(s => `<option value="${esc(s)}" ${v.suffix === s ? 'selected' : ''}>${esc(s || t('none'))}</option>`).join('');
    return `
      <h1 class="h1 rec-h">${esc(t('step2'))}</h1>
      <p class="muted">${esc(t('photosLead'))}</p>
      <ol class="shots${req.length === 4 ? ' shots-4' : ''}">
        ${req.map(k => `<li class="shot ${d.photos[k] ? 'has' : ''} ${k === nextKind ? 'next' : ''}">
          <div class="shot-img">${d.photos[k] ? `<img src="${esc(d.photos[k])}" alt="${esc(t('photoAlt', { what: photoWhat(k) }))}">` : icon('camera')}</div>
          <div class="shot-meta"><span class="shot-name" title="${esc(t(PHOTO_LABEL[k]))}">${esc(t(PHOTO_LABEL[k]))}</span>
            ${k === 'id' && d.reading ? `<span class="reading" role="status">${esc(t('readingId'))}</span>` : ''}
            ${d.photos[k] ? `<button type="button" class="btn btn-ghost btn-sm" data-shoot="${k}">${icon('retake')}<span>${esc(t('retake'))}</span></button>` : ''}</div>
        </li>`).join('')}
      </ol>
      ${nextKind
        ? `<button type="button" class="btn btn-primary btn-block btn-xl" data-shoot="${nextKind}">${icon('camera')}<span>${esc(t('takePhoto', { what: photoWhat(nextKind) }))}</span></button>`
        : `<p class="alert alert-ok">${icon('check')}<span>${esc(t('allPhotosTaken'))}</span></p>`}
      <label class="switch">
        <input type="checkbox" role="switch" name="noId" ${d.noId ? 'checked' : ''}>
        <span class="switch-track" aria-hidden="true"></span>
        <span><span class="switch-l">${esc(t('noIdSwitch'))}</span><span class="hint">${esc(t('noIdHint'))}</span></span>
      </label>
      <fieldset class="vdetails">
        <legend class="h2">${esc(t('violatorDetails'))}</legend>
        <div class="grid-2">
          ${fieldHtml('first', t('firstName'), { input: `<input class="input" name="first" value="${esc(v.first)}" autocomplete="off" autocapitalize="words">` })}
          ${fieldHtml('middle', t('middleName'), { optional: true, input: `<input class="input" name="middle" value="${esc(v.middle)}" autocomplete="off" autocapitalize="words">` })}
          ${fieldHtml('last', t('lastName'), { input: `<input class="input" name="last" value="${esc(v.last)}" autocomplete="off" autocapitalize="words">` })}
          ${fieldHtml('suffix', t('suffix'), { optional: true, input: `<select class="input" name="suffix">${sfx}</select>` })}
          ${fieldHtml('birthday', t('birthday'), { div: true, input: dateBox({ name: 'birthday', value: v.birthday, attrs: `max="${todayKey()}" aria-labelledby="lbl-birthday"` }) })}
          ${fieldHtml('sex', t('sex'), { div: true, input: menuMarkup({
            id: 'sex-menu', labelledBy: 'lbl-sex', placeholder: t('choose'),
            value: v.sex === 'M' ? t('male') : v.sex === 'F' ? t('female') : '',
            items: [['M', t('male')], ['F', t('female')]].map(([k, name]) => ({ value: k, name, checked: v.sex === k })),
          }) })}
        </div>
      </fieldset>
      <div class="rec-foot"><a class="btn btn-ghost btn-lg" href="#/record/1">${icon('chevL')}${esc(t('back'))}</a>
        <a class="btn btn-primary btn-lg" href="#/record/3">${esc(t('next'))}${icon('chevR')}</a></div>`;
  };

  // ---- Step 3
  const step3 = () => {
    const miss = missingItems(d);
    const fake = { ...d, status: 'draft' };
    const chk = incidentCheck(d, incident.paper);
    const textOk = incident.text.trim().length >= 15;
    const canVoid = !chk.empty && !chk.error && textOk;
    return `
      <h1 class="h1 rec-h">${esc(t('step3'))}</h1>
      ${miss.length ? `
        <section class="needed" aria-labelledby="needed-h">
          <h2 class="h2" id="needed-h">${icon('alert')}${esc(t('stillNeeded'))}</h2>
          <ul>${miss.map(m => `<li><a href="#/record/${m.step}">${esc(m.text)}${icon('chevR')}</a></li>`).join('')}</ul>
        </section>` : `
        <ul class="notes"><li>${icon('check')}${esc(t('noteTime'))}</li><li>${icon('pin')}${esc(t('noteGps'))}</li></ul>`}
      <section class="sec"><div class="sec-head"><h2 class="h2">${esc(t('reviewViolations'))}</h2><a class="link" href="#/record/1" aria-label="${esc(t('editSection', { what: t('reviewViolations') }))}">${esc(t('edit'))}</a></div>${violationList(d.violations)}</section>
      <section class="sec"><div class="sec-head"><h2 class="h2">${esc(t('reviewPhotos'))}</h2><a class="link" href="#/record/2" aria-label="${esc(t('editSection', { what: t('reviewPhotos') }))}">${esc(t('edit'))}</a></div>${photoGrid(d.photos)}</section>
      <section class="sec"><h2 class="h2">${esc(t('reviewViolator'))}</h2>${reviewViolator(fake)}</section>
      <div class="actions-final">
        <button type="button" class="btn btn-primary btn-block btn-xl" data-act="done" ${miss.length ? 'disabled aria-disabled="true"' : ''}>${icon('check')}<span>${esc(t('markDone'))}</span></button>
        <button type="button" class="btn btn-danger-ghost btn-block btn-lg" data-act="cancel">${icon('ban')}<span>${esc(t('cancelForm'))}</span></button>
      </div>
      <details class="incident" ${incident.open ? 'open' : ''}>
        <summary>${icon('file')}<span>${esc(t('numberMismatch'))} <strong>${esc(t('writeIncident'))}</strong></span></summary>
        <form class="incident-form" novalidate>
          <p class="lead">${esc(t('incidentLead', { no: d.no }))}</p>
          <label class="field ${chk.error ? 'has-err' : ''}"><span class="lbl">${esc(t('paperNo'))}</span>
            <input class="input input-serial" name="paper" inputmode="numeric" autocomplete="off" value="${esc(incident.paper)}" aria-invalid="${chk.error ? 'true' : 'false'}">
            <span class="err" ${chk.error ? '' : 'hidden'}>${esc(chk.error || '')}</span>
            <span class="hint hint-strong" ${chk.hint ? '' : 'hidden'}>${esc(chk.hint || '')}</span></label>
          <label class="field ${incident.text && !textOk ? 'has-err' : ''}"><span class="lbl">${esc(t('whatHappened'))}</span>
            <textarea class="input" name="text" rows="4">${esc(incident.text)}</textarea>
            <span class="${incident.text && !textOk ? 'err' : 'hint'}">${esc(incident.text && !textOk ? t('errShortText', { n: incident.text.trim().length }) : t('whatHappenedHint'))}</span></label>
          <button type="submit" class="btn btn-danger btn-block btn-lg" ${canVoid ? '' : 'disabled'}>${esc(t('submitVoid', { no: d.no }))}</button>
        </form>
      </details>`;
  };

  const reviewViolator = () => {
    const v = d.violator;
    const name = fullName(v);
    return kv([
      [t('fullName'), name ? esc(name) : `<span class="muted">${esc(t('notEntered'))}</span>`],
      [t('birthday'), v.birthday ? esc(v.birthday) : `<span class="muted">${esc(t('notEntered'))}</span>`],
      [t('sex'), v.sex ? esc(v.sex === 'M' ? t('male') : t('female')) : `<span class="muted">${esc(t('notEntered'))}</span>`],
      ['', `<span class="idby">${icon(d.noId ? 'user' : 'idcard')}${esc(d.noId ? t('identifiedNoId') : t('identifiedById'))}</span>`],
    ]);
  };

  // Re-render, keeping focus and caret on the same field.
  const render = () => {
    const a = document.activeElement;
    const keep = a && root.contains(a) && a.name ? { name: a.name, value: a.value, start: a.selectionStart, end: a.selectionEnd, type: a.type } : null;
    root.innerHTML = shell(step === 1 ? step1() : step === 2 ? step2() : step3());
    if (keep) {
      const sel = keep.type === 'radio' || keep.type === 'checkbox' ? `[name="${keep.name}"][value="${CSS.escape(keep.value)}"]` : `[name="${keep.name}"]`;
      const el = root.querySelector(sel);
      if (el) { el.focus({ preventScroll: true }); try { if (keep.start != null) el.setSelectionRange(keep.start, keep.end); } catch { /* not a text field */ } }
    }
    bind();
  };

  const filterList = () => {
    const q = query.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('.checks li').forEach(li => {
      const on = !q || li.dataset.name.includes(q);
      li.hidden = !on; if (on) shown++;
    });
    root.querySelector('.no-match').hidden = shown > 0;
  };

  const bind = () => {
    root.querySelector('[data-discard]').addEventListener('click', async () => {
      if (draftHasEntries(d)) {
        const ok = await dialog({ title: t('discardTitle', { no: d.no }), body: t('discardBody'), confirm: t('discardConfirm'), cancel: t('keepEditing'), danger: true });
        if (!ok) return;
      }
      discardDraft(d);
      ctx.go('#/home');
    });
    if (step === 1) {
      const q = root.querySelector('[name=q]');
      q.addEventListener('input', () => { query = q.value; filterList(); });
      filterList();
      root.querySelectorAll('.checks input').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) { if (!d.violations.includes(cb.value)) d.violations.push(cb.value); }
        else d.violations = d.violations.filter(x => x !== cb.value);
        root.querySelector('.picked').textContent = t('nPicked', { n: d.violations.length });
        root.querySelector('.steps').outerHTML = stepsNav();
      }));
    }
    if (step === 2) {
      root.querySelectorAll('[data-shoot]').forEach(btn => btn.addEventListener('click', async () => {
        const kind = btn.dataset.shoot;
        const label = t(PHOTO_LABEL[kind]);
        const data = await takePhoto(kind, label, d.no);
        if (!data) return;
        setPhoto(d, kind, data);
        render();
      }));
      root.querySelector('[name=noId]').addEventListener('change', e => { setNoId(d, e.target.checked); render(); });
      ['first', 'middle', 'last'].forEach(f => root.querySelector(`[name=${f}]`).addEventListener('input', e => {
        typeField(d, f, e.target.value); clearMark(f);
      }));
      root.querySelector('[name=suffix]').addEventListener('change', e => { typeField(d, 'suffix', e.target.value); clearMark('suffix'); });
      root.querySelector('[name=birthday]').addEventListener('input', e => { typeField(d, 'birthday', e.target.value); clearMark('birthday'); });
      bindDateBox(root.querySelector('[data-f=birthday] [data-datebox]'));
      const sexMenu = root.querySelector('[data-menu=sex-menu]');
      bindMenu(sexMenu, k => {
        typeField(d, 'sex', k); clearMark('sex');
        setMenuValue(sexMenu, k, k === 'M' ? t('male') : t('female'));
        root.querySelector('.steps').outerHTML = stepsNav();
      }, ctx.onLeave);
    }
    if (step === 3) {
      root.querySelector('[data-act=done]').addEventListener('click', () => {
        const res = markDone(d);
        if (res.error) return;
        finishClose(res, res.finished ? t('doneMsgLast', { no: res.rec.no }) : t('doneMsg', { no: res.rec.no, next: res.next }));
      });
      root.querySelector('[data-act=cancel]').addEventListener('click', async () => {
        const ok = await dialog({ title: t('cancelTitle', { no: d.no }), body: t('cancelBody', { no: d.no }), confirm: t('cancelConfirm'), cancel: t('keepEditing'), danger: true, typeToConfirm: d.no });
        if (!ok) return;
        const res = cancelForm(d);
        if (res.error) return;
        finishClose(res, res.finished ? t('cancelledMsgLast', { no: res.rec.no }) : t('cancelledMsg', { no: res.rec.no, next: res.next }));
      });
      const det = root.querySelector('.incident');
      det.addEventListener('toggle', () => { incident.open = det.open; });
      const f = root.querySelector('.incident-form');
      f.paper.addEventListener('input', () => { incident.paper = f.paper.value; render(); });
      f.text.addEventListener('input', () => { incident.text = f.text.value; render(); });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const res = voidForm(d, incident.paper, incident.text);
        if (res.error) return;
        if (res.finished) { finishClose(res, t('voidedMsgLast', { no: res.rec.no })); return; }
        ctx.go('#/record/2', t('voidedMsg', { no: res.rec.no, next: res.next }));
      });
    }
  };

  const clearMark = f => {
    const el = root.querySelector(`[data-f=${f}]`);
    el?.classList.remove('marked-read', 'marked-unread');
    el?.querySelector('.mark')?.remove();
  };

  const finishClose = (res, msg) => {
    S.justClosed = res.rec.no;
    if (res.finished) {
      ctx.go('#/type/' + res.booklet.ctype, t('bookletFinishedMsg', { done: msg }));
    } else ctx.go('#/home', msg);
  };

  // ID reading finishes in the background; refresh step 2 when it lands.
  const off = subscribe((kind, x) => { if (kind === 'draft' && x === d && step === 2 && document.body.contains(root)) render(); });
  ctx.onLeave(off);
  render();
}

// ------------------------------------------------------------------ Citations (own)
const listState = { status: 'all', ctype: '', day: '', page: 1 };

export function citationsView(root, ctx) {
  const u = me();
  if (ctx.params[0]) return citationDetailView(root, ctx, Number(ctx.params[0]));
  const types = typesFor(u.id);
  const multi = types.length > 1;
  if (!multi) listState.ctype = '';

  const render = () => {
    const mine = myCitations(u.id);
    const base = mine.filter(c => (!listState.ctype || c.ctype === listState.ctype) && (!listState.day || dayKey(c.at) === listState.day));
    const count = { all: base.length, done: 0, cancelled: 0, voided: 0, unsynced: 0 };
    base.forEach(c => { count[c.status]++; if (!c.synced) count.unsynced++; });
    const filt = base.filter(c => listState.status === 'all' ? true : listState.status === 'unsynced' ? !c.synced : c.status === listState.status)
      .sort((a, b) => b.at - a.at); // newest first; Enforcers never see Paid
    const pg = paginate(filt, listState.page);
    listState.page = pg.page;
    const unsyncedAll = mine.filter(c => !c.synced).length;

    let empty = '';
    if (!pg.n) {
      if (!mine.length) empty = emptyState(t('emptyAllTitle'), t('emptyAllBody'));
      else if (listState.status === 'unsynced') empty = emptyState(t('emptySyncTitle'), t('emptySyncBody'), 'check');
      else if (listState.day) empty = emptyState(t('emptyDayTitle'), t('emptyDayBody'), 'calendar');
      else empty = emptyState(t('emptyFilterTitle'), t('emptyFilterBody'), 'search');
    }

    const STATUS = [['all', t('all')], ['done', t('stDone')], ['cancelled', t('stCancelled')], ['voided', t('stVoided')], ['unsynced', t('stNotSynced')]];
    // Closed button shows the word only; the open menu shows each count (spec 5.8).
    const statusMenu = menuMarkup({
      id: 'status-menu', label: t('colStatus'), labelledBy: 'status-lbl',
      value: STATUS.find(([k]) => k === listState.status)[1],
      items: STATUS.map(([k, name]) => ({ value: k, name, checked: listState.status === k, right: String(count[k]) })),
    });
    root.innerHTML = `
      <h1 class="h1">${esc(t('citationsTitle'))}</h1>
      ${unsyncedAll ? `<button type="button" class="alert alert-sync alert-btn" data-unsynced>${icon('cloudOff')}<span>${esc(tn('unsyncedReminder', unsyncedAll))}</span>${icon('chevR')}</button>` : ''}
      <div class="cit-filters ${multi ? 'multi' : ''}">
        ${multi ? `<label class="field f-ctype"><span class="lbl">${esc(t('citationType'))}</span>
          <select class="input" name="ctype"><option value="">${esc(t('allTypes'))}</option>${types.map(c => `<option value="${c.id}" ${listState.ctype === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
        <div class="field"><span class="lbl" id="status-lbl">${esc(t('colStatus'))}</span>${statusMenu}</div>
        <div class="field"><label class="lbl" for="f-day">${esc(t('day'))}</label>
          ${dateBox({ id: 'f-day', name: 'day', value: listState.day, clearable: true, attrs: `max="${todayKey()}"` })}</div>
      </div>
      <p class="showing">${esc(pg.n ? t('showing', { a: pg.a, b: pg.b, n: pg.n }) : t('showingNone'))}</p>
      ${pg.n ? `<ul class="rows rows-cit">${pg.slice.map(c => `
        <li><a class="row row-cit" href="#/citations/${c.no}">
          <span class="row-top">${serial(c.no)}<span class="row-type">${esc(S.ct.get(c.ctype).name)}</span>${stamp(c.status)}</span>
          <span class="row-what">${rowSummary(c)}</span>
          <span class="row-bot" data-fit><span class="row-name" data-fit-cut>${violatorShort(c)}</span><span class="row-when">${esc(fDateTime(c.at))}</span></span>
          ${!c.synced ? `<span class="row-tags">${unsyncedTag()}</span>` : ''}
        </a></li>`).join('')}</ul>
      <div class="table-wrap cit-table"><table class="tbl">
        <thead><tr><th scope="col">${esc(t('colNo'))}</th><th scope="col">${esc(t('colType'))}</th><th scope="col">${esc(t('colViolations'))}</th><th scope="col">${esc(t('colViolator'))}</th><th scope="col">${esc(t('colStatus'))}</th><th scope="col">${esc(t('colDate'))}</th></tr></thead>
        <tbody>${pg.slice.map(c => `<tr class="tr-link" data-href="#/citations/${c.no}">
          <th scope="row"><a href="#/citations/${c.no}">${serial(c.no)}</a></th>
          <td>${esc(S.ct.get(c.ctype).name)}</td>
          <td>${rowSummary(c)}</td>
          <td class="nowrap">${violatorShort(c)}</td>
          <td><span class="cell-status${!c.synced ? ' two has-sync' : ''}">${stamp(c.status)}${!c.synced ? unsyncedTag() : ''}</span></td>
          <td class="nowrap">${esc(fDateTime(c.at))}</td></tr>`).join('')}</tbody></table></div>` : empty}
      ${pager(pg.page, pg.pages)}`;
    root.querySelectorAll('.cit-table .tr-link').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));

    bindMenu(root.querySelector('[data-menu=status-menu]'), k => {
      listState.status = k; listState.page = 1; render();
      root.querySelector('#status-menu-btn')?.focus();
    }, ctx.onLeave);
    root.querySelector('[data-unsynced]')?.addEventListener('click', () => { listState.status = 'unsynced'; listState.page = 1; render(); });
    root.querySelector('[name=ctype]')?.addEventListener('change', e => { listState.ctype = e.target.value; listState.page = 1; render(); });
    root.querySelector('[name=day]').addEventListener('change', e => {
      const v = e.target.value;
      listState.day = v && v <= todayKey() ? v : ''; listState.page = 1; render();
    });
    bindDateBox(root.querySelector('.cit-filters [data-datebox]'), () => { listState.day = ''; listState.page = 1; render(); root.querySelector('#f-day')?.focus(); });
    root.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { listState.page = Number(b.dataset.page); render(); root.querySelector('.showing')?.scrollIntoView({ block: 'nearest' }); }));
    fitLines(root);
  };
  render();
  const off = subscribe(k => { if ((k === 'online' || k === 'citations') && document.body.contains(root)) render(); });
  ctx.onLeave(off);
  // Re-fit when the width changes or the web font finishes loading.
  const refit = () => fitLines(root);
  window.addEventListener('resize', refit);
  ctx.onLeave(() => window.removeEventListener('resize', refit));
  document.fonts?.ready.then(() => { if (document.body.contains(root)) refit(); });
}

function citationDetailView(root, ctx, no) {
  const u = me();
  const c = S.citations.find(x => x.no === no && x.owner === u.id);
  if (!c) { ctx.go('#/citations'); return; }
  const render = () => {
    root.innerHTML = `<a class="back" href="#/citations">${icon('arrowL')}<span>${esc(t('backToList'))}</span></a>${citationDetail(c, { role: 'enforcer' })}`;
  };
  render();
  const off = subscribe(k => { if ((k === 'online' || k === 'citations') && document.body.contains(root)) render(); });
  ctx.onLeave(off);
}

// ------------------------------------------------------------------ Stats
export function statsView(root) {
  const u = me();
  const types = typesFor(u.id);
  const mine = myCitations(u.id);
  const calc = list => {
    const done = list.filter(c => c.status === 'done');
    return {
      citations: done.length,
      violations: done.reduce((n, c) => n + c.violations.length, 0),
      cancelled: list.filter(c => c.status === 'cancelled').length,
      voided: list.filter(c => c.status === 'voided').length,
    };
  };
  const today = calc(mine.filter(c => isToday(c.at)));
  const month = calc(mine.filter(c => isThisMonth(c.at)));
  const unsynced = mine.filter(c => !c.synced && isToday(c.at)).length;
  const ROWS = [['citations', 'statCitations'], ['violations', 'statViolations'], ['cancelled', 'statCancelled'], ['voided', 'statVoided']];

  // One card per period: side by side from 600px, stacked on phones
  const card = (title, s) => `
    <section class="sheet stat-sheet">
      <header class="sheet-head"><h2 class="h2">${esc(title)}</h2></header>
      <div class="perf" aria-hidden="true"></div>
      <div class="stat-grid">${ROWS.map(([k, l]) => `<div class="box box-fill box-fill-${k}"><span class="lbl">${esc(t(l))}</span><span class="box-n">${s[k]}</span></div>`).join('')}</div>
    </section>`;

  const short = (full, abbr) => `<span class="lbl-full">${esc(t(full))}</span><span class="lbl-short">${esc(t(abbr))}</span>`;
  const typeRows = types.map(ct => ({ ct, s: calc(mine.filter(c => isThisMonth(c.at) && c.ctype === ct.id)) }))
    .map((r, i) => ({ ...r, i, zero: !r.s.citations && !r.s.violations }))
    .sort((a, b) => (a.zero - b.zero) || (a.i - b.i));
  const byType = types.length > 1 ? `
    <section class="sec">
      <h2 class="h2">${esc(t('byType'))} <span class="muted small">${esc(t('byTypeLead'))}</span></h2>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th scope="col">${esc(t('citationType'))}</th><th scope="col" class="n">${esc(t('statCitations'))}</th><th scope="col" class="n">${short('statViolations', 'statViolationsShort')}</th></tr></thead>
        <tbody>${typeRows.map(({ ct, s, zero }) => `<tr class="${zero ? 'is-zero' : ''}"><th scope="row">${esc(ct.name)}</th><td class="n">${s.citations}</td><td class="n">${s.violations}</td></tr>`).join('')}</tbody></table></div>
    </section>` : '';

  const booklets = `
    <section class="sec">
      <h2 class="h2">${esc(t('booklets'))}</h2>
      <ul class="bk-list">${types.map(ct => {
        const b = activeBooklet(u.id, ct.id);
        if (!b) return `<li class="bk"><div class="bk-top"><span class="strong">${esc(ct.name)}</span><span class="muted">${esc(t('noActiveBooklet'))}</span></div></li>`;
        const size = bookletSize(b), used = bookletUsed(b);
        return `<li class="bk"><div class="bk-top"><span class="strong">${esc(ct.name)}</span><span class="num muted">${b.from}–${b.to}</span></div>
          <div class="bk-bar" aria-hidden="true"><i style="width:${Math.round(used / size * 100)}%"></i></div>
          <span class="bk-left">${esc(tn('formsLeftN', size - used))}</span></li>`;
      }).join('')}</ul>
    </section>`;

  root.innerHTML = `<div class="stats">
    <h1 class="h1">${esc(t('statsTitle'))}</h1>
    ${unsynced ? `<p class="alert alert-sync stats-sync">${icon('cloudOff')}<span>${esc(t('statNotSynced', { n: unsynced }))}</span></p>` : ''}
    <div class="stat-cols">${card(t('today'), today)}${card(t('thisMonth'), month)}</div>
    <div class="stats-lower">${byType}${booklets}</div>
  </div>`;
}
