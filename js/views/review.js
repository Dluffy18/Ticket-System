// Review account: the two-column account page shared by the Super Admin and Office Admins.
// Left: ID card and contact details. Right: whatever the page needs. Bottom: status and buttons.
import { t } from '../strings.js';
import { esc, fullName, fDate, fPhone } from '../util.js';
import { S, avatarOf } from '../store.js';
import { icon } from '../ui.js';
import { statusTag } from './admin.js';

const ROLE_NAME = { enforcer: 'roleEnforcer', office: 'roleOffice', verifier: 'roleVerifierShort', super: 'roleSuperShort' };
export const roleName = k => t(ROLE_NAME[k]);
export const agencyText = a => a.kind === 'verifier' ? t('treasuryOffice') : a.kind === 'super' ? t('cictOffice')
  : S.ag.get(a.agency)?.name || t('noAgency');

const initials = a => (((a.first || '').trim()[0] || '') + ((a.last || '').trim()[0] || '')).toUpperCase();

// Dark navy card: who they are at a glance.
export function idCard(a) {
  const pic = avatarOf(a.id);
  const sub = a.kind === 'enforcer' || a.rank ? [a.rank, S.ag.get(a.agency)?.name].filter(Boolean).join(' · ') : a.position || agencyText(a);
  const left = a.badge ? [t('badgeNo'), a.badge] : [t('agency'), agencyText(a)];
  return `<section class="idc rv-id" aria-label="${esc(fullName(a))}">
    <div class="idc-top"><span class="idc-eyebrow">${esc(t('cityOfMati'))} · ${esc(roleName(a.kind))}</span>${statusTag(a.status)}</div>
    <div class="idc-who">
      <div class="idc-pic">${pic ? `<img src="${esc(pic)}" alt="">` : `<span aria-hidden="true">${esc(initials(a))}</span>`}</div>
      <div class="idc-name"><h2>${esc(fullName(a))}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    </div>
    <dl class="idc-foot">
      <div><dt>${esc(left[0])}</dt><dd>${esc(left[1])}</dd></div>
      <div><dt>${esc(t('role'))}</dt><dd>${esc(roleName(a.kind))}</dd></div>
    </dl>
  </section>`;
}

// Contact number, address, gender, registered: one row each with an icon.
export function infoCard(a) {
  const row = (ic, label, value) => `<div class="rv-info-row"><span class="rv-info-ic">${icon(ic)}</span><div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div></div>`;
  return `<section class="rv-card rv-info"><dl>
    ${row('phone', t('contactNumber'), fPhone(a.contact) || t('dash'))}
    ${row('pin', t('address'), a.address || t('dash'))}
    ${row('user', t('gender'), a.gender === 'M' ? t('male') : t('female'))}
    ${row('calendar', t('registered'), a.registeredAt ? fDate(a.registeredAt) : t('fromRecords'))}
  </dl></section>`;
}

export const card = (title, body, cls = '') =>
  `<section class="rv-card ${cls}">${title ? `<h2 class="rv-h">${esc(title)}</h2>` : ''}${body}</section>`;

// tools: [[act, label, icon]]; buttons: [[act, label, cls]]; main: cards for the right column, in phone order.
export function reviewPage({ back, tools = [], a, main, after = '', bar }) {
  const toolBtns = tools.map(([act, label, ic]) => `<button type="button" class="btn btn-ghost btn-sm" data-act="${act}">${icon(ic)}<span>${esc(label)}</span></button>`).join('');
  return `${back}
    <div class="rv-head"><h1 class="h1">${esc(t('reviewAccount'))}</h1>${toolBtns ? `<div class="rv-tools">${toolBtns}</div>` : ''}</div>
    <div class="rv">
      <div class="rv-col rv-side">${idCard(a)}${infoCard(a)}</div>
      <div class="rv-col rv-main">${main}${after}</div>
    </div>
    ${bar && bar.buttons.length ? `<div class="rv-bar">
      <p class="rv-status"><span class="rv-dot rv-dot-${a.status}" aria-hidden="true"></span><span>${esc(bar.text)}</span></p>
      <div class="rv-btns">${bar.buttons.map(([act, label, cls]) => `<button type="button" class="btn ${cls}" data-act="${act}">${esc(label)}</button>`).join('')}</div>
    </div>` : ''}`;
}
