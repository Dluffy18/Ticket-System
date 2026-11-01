// Profile page shared by Enforcers, Office Admins and the Verifier.
// Everything is read-only except the profile picture and the password.
import { t } from '../strings.js';
import { esc, fPhone, fDate } from '../util.js';
import { S, me, typesFor, agencyOf, avatarOf, setAvatar, passwordChangedAt, changePassword } from '../store.js';
import { icon, toast } from '../ui.js';
import { themeButton } from './common.js';

const AVATAR_PX = 320;

// Light outlines of city buildings on the band behind the cards.
const CITY = `<svg class="pf-city" viewBox="0 0 640 200" preserveAspectRatio="xMaxYMin slice" aria-hidden="true" focusable="false">
  <g fill="none" stroke-width="2">
    <rect x="40" y="70" width="110" height="160"/><rect x="56" y="88" width="22" height="22"/><rect x="112" y="88" width="22" height="22"/>
    <rect x="170" y="20" width="140" height="210"/><rect x="194" y="44" width="30" height="30"/><rect x="256" y="44" width="30" height="30"/><rect x="194" y="100" width="30" height="30"/><rect x="256" y="100" width="30" height="30"/>
    <rect x="330" y="96" width="120" height="140"/><rect x="350" y="116" width="22" height="22"/>
    <rect x="470" y="50" width="150" height="190"/><rect x="494" y="74" width="30" height="30"/><rect x="566" y="74" width="30" height="30"/><rect x="494" y="130" width="30" height="30"/><rect x="566" y="130" width="30" height="30"/>
  </g></svg>`;

const initials = u => ((u.first || '').trim()[0] || '') + ((u.last || '').trim()[0] || '');

function avatarInner(u) {
  const pic = avatarOf(u.id);
  return pic ? `<img src="${esc(pic)}" alt="">` : `<span aria-hidden="true">${esc(initials(u).toUpperCase())}</span>`;
}

const item = (label, value, cls = '') =>
  `<div class="pf-item ${cls}"><dt>${esc(label)}</dt><dd>${esc(value || t('dash'))}</dd></div>`;

const card = (title, body, lead = '', cls = '') => `
  <section class="pf-card ${cls}">
    <h2 class="pf-h">${esc(title)}</h2>
    ${lead ? `<p class="pf-lead">${esc(lead)}</p>` : ''}
    ${body}
  </section>`;

export function profilePage(root, ctx) {
  const u = me();
  const isEnf = u.kind === 'enforcer';
  const ag = isEnf ? agencyOf(u.id) : u.agency ? S.ag.get(u.agency) : null;
  const roleName = u.kind === 'verifier' ? t('roleVerifier') : u.kind === 'office' ? t('roleOffice') : t('roleEnforcer');
  const sub = isEnf ? (u.rank || roleName) : (u.position || roleName);
  const name = [u.first, u.middle, u.last, u.suffix].filter(Boolean).join(' ');

  const personal = `<dl class="pf-grid">
    ${item(t('firstName'), u.first)}${item(t('middleName'), u.middle)}${item(t('lastName'), u.last)}
    ${item(t('suffix'), u.suffix || t('none'))}${item(t('gender'), u.gender === 'M' ? t('male') : t('female'))}
  </dl>`;
  const contact = `<dl class="pf-grid">
    ${item(t('contactNumber'), fPhone(u.contact), 'pf-wide')}
    ${'address' in u ? item(t('address'), u.address, 'pf-wide') : ''}
  </dl>`;
  const work = `<dl class="pf-grid">
    ${isEnf ? '' : item(t('role'), roleName, 'pf-wide')}
    ${ag ? item(t('agency'), ag.name, 'pf-wide') : ''}
    ${isEnf ? item(t('rankPosition'), u.rank) + item(t('badgeId'), u.badge) : item(t('position'), u.position)}
  </dl>
  <p class="pf-note">${esc(t(isEnf ? 'askOfficeAdmin' : 'askIctOffice'))}</p>`;
  const types = isEnf ? card(t('canIssueTitle'), `<ul class="pf-chips">${typesFor(u.id)
    .map(c => `<li class="pf-chip">${icon('check')}<span>${esc(c.name)}</span></li>`).join('')}</ul>`, '', 'pf-types') : '';

  root.innerHTML = `
  <div class="pf">
    ${CITY}
    <aside class="pf-card pf-me">
      <div class="pf-avatar-wrap">
        <div class="pf-avatar">${avatarInner(u)}</div>
        <button type="button" class="pf-cam" data-pic aria-label="${esc(t('changePictureLabel'))}">${icon('camera')}</button>
      </div>
      <h1 class="pf-name">${esc(name)}</h1>
      <p class="pf-sub">${esc(sub)}</p>
      <hr class="pf-rule">
      <button type="button" class="btn btn-primary btn-block pf-btn" data-pic data-pic-label></button>
      ${themeButton('pf-btn pf-theme-btn')}
      <button type="button" class="pf-out pf-out-side" data-signout>${esc(t('signOut'))}</button>
      <input type="file" accept="image/*" hidden data-file>
    </aside>
    <div class="pf-main">
      ${card(t('personalInfo'), personal)}
      ${card(t('contactDetails'), contact)}
      ${card(t('workInfo'), work)}
      ${types}
      <section class="pf-card pf-pw">
        <span class="pf-lock" aria-hidden="true">${icon('lock')}</span>
        <div class="pf-pw-text"><h2 class="pf-h">${esc(t('passwordTitle'))}</h2><p class="pf-lead" data-pw-when></p></div>
        <button type="button" class="btn btn-ghost pf-btn" data-pw>${esc(t('changePassword'))}</button>
      </section>
      <button type="button" class="pf-out pf-out-foot" data-signout>${esc(t('signOut'))}</button>
    </div>
  </div>`;

  const avatar = root.querySelector('.pf-avatar');
  const picLabel = root.querySelector('[data-pic-label]');
  const fileInput = root.querySelector('[data-file]');
  const pwWhen = root.querySelector('[data-pw-when]');
  const refreshPic = () => {
    avatar.innerHTML = avatarInner(u);
    picLabel.textContent = t(avatarOf(u.id) ? 'editPicture' : 'uploadPicture');
  };
  const refreshPw = () => {
    const at = passwordChangedAt(u.id);
    pwWhen.textContent = at ? t('pwLastChanged', { date: fDate(at) }) : t('pwNeverChanged');
  };
  refreshPic();
  refreshPw();

  root.querySelectorAll('[data-pic]').forEach(b => b.addEventListener('click', async () => {
    if (!avatarOf(u.id)) { fileInput.click(); return; }
    const choice = await pictureChoice();
    if (choice === 'new') fileInput.click();
    if (choice === 'remove') { setAvatar(u.id, null); refreshPic(); toast(t('pictureRemoved')); }
  }));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      setAvatar(u.id, await squareImage(file));
      refreshPic();
      toast(t('pictureUpdated'));
    } catch {
      toast(t('pictureFailed'), 'error');
    }
  });
  root.querySelector('[data-pw]').addEventListener('click', async () => {
    if (await passwordDialog()) { refreshPw(); toast(t('passwordChanged')); }
  });
  ctx.bindCommon(root);
}

// Center-crop to a square and shrink, so the picture stays small on the device.
function squareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const out = Math.min(AVATAR_PX, side);
      const c = document.createElement('canvas');
      c.width = c.height = out;
      c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function openDialog(html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg';
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}

function pictureChoice() {
  return new Promise(resolve => {
    const dlg = openDialog(`
      <div class="dlg-form">
        <h2 class="dlg-title">${esc(t('editPicture'))}</h2>
        <button type="button" class="btn btn-primary btn-block" data-c="new">${esc(t('chooseNewPhoto'))}</button>
        <button type="button" class="btn btn-danger-ghost btn-block" data-c="remove">${esc(t('removePhoto'))}</button>
        <button type="button" class="btn btn-ghost btn-block" data-c="">${esc(t('cancel'))}</button>
      </div>`);
    let result = null;
    dlg.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { result = b.dataset.c || null; dlg.close(); }));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.querySelector('[data-c=new]').focus();
  });
}

function passwordDialog() {
  return new Promise(resolve => {
    const f = (name, label, ac, hint = '') => `<label class="field" data-f="${name}"><span class="lbl">${esc(label)}</span>
      <input class="input" name="${name}" type="password" autocomplete="${ac}">
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}<span class="err" hidden></span></label>`;
    const dlg = openDialog(`
      <form class="dlg-form" novalidate>
        <h2 class="dlg-title">${esc(t('changePassword'))}</h2>
        <input type="text" name="username" autocomplete="username" value="${esc(me() ? [me().first, me().last].join(' ') : '')}" hidden>
        ${f('current', t('currentPassword'), 'current-password')}
        ${f('password', t('newPassword'), 'new-password', t('passwordHint'))}
        ${f('confirm', t('confirmNewPassword'), 'new-password')}
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" data-cancel>${esc(t('cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(t('savePassword'))}</button>
        </div>
      </form>`);
    const form = dlg.querySelector('form');
    let ok = false;
    const show = errs => form.querySelectorAll('[data-f]').forEach(el => {
      const k = el.dataset.f;
      const err = el.querySelector('.err');
      err.hidden = !errs[k]; err.textContent = errs[k] || '';
      el.classList.toggle('has-err', !!errs[k]);
      el.querySelector('input').setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
    });
    dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      const res = await changePassword({ current: form.current.value, password: form.password.value, confirm: form.confirm.value });
      btn.disabled = false;
      if (res.errors) { show(res.errors); form.querySelector('.has-err input')?.focus(); return; }
      ok = true;
      dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(ok); });
    form.current.focus();
  });
}
