// Edit details and Reset password, shared by the Super Admin and Office Admins.
import { t } from '../strings.js';
import { esc, displayName, fPhone, SUFFIXES } from '../util.js';
import { updateDetails, resetPassword, removePicture } from '../store.js';
import { icon, toast, dialog } from '../ui.js';

function openDialog(html, cls = '') {
  const dlg = document.createElement('dialog');
  dlg.className = `dlg ${cls}`;
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

// Resolves true when something was saved.
export function editDetailsDialog(actorId, acc) {
  return new Promise(resolve => {
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
    const fld = (name, label, value, attrs = '') => `<label class="field" data-f="${name}"><span class="lbl">${esc(label)}</span>
      <input class="input" name="${name}" value="${esc(value || '')}" ${attrs}><span class="err" hidden></span></label>`;
    const dlg = openDialog(`
      <form method="dialog" class="dlg-form" novalidate>
        <h2 class="dlg-title">${esc(t('editDetailsTitle', { name: displayName(acc) }))}</h2>
        <div class="edit-grid">
          ${fld('first', t('firstName'), acc.first, 'autocomplete="off"')}
          ${fld('middle', t('middleName'), acc.middle, 'autocomplete="off"')}
          ${fld('last', t('lastName'), acc.last, 'autocomplete="off"')}
          <label class="field" data-f="suffix"><span class="lbl">${esc(t('suffix'))}</span>
            <select class="input" name="suffix">${SUFFIXES.map(s => opt(s, s || t('none'), acc.suffix || '')).join('')}</select></label>
          <label class="field" data-f="gender"><span class="lbl">${esc(t('gender'))}</span>
            <select class="input" name="gender">${opt('M', t('male'), acc.gender)}${opt('F', t('female'), acc.gender)}</select><span class="err" hidden></span></label>
          ${fld('contact', t('contactNumber'), fPhone(acc.contact), 'type="tel" inputmode="tel" autocomplete="off"')}
          ${fld('rank', t('rankPosition'), acc.rank, 'autocomplete="off"')}
          ${fld('badge', t('badgeId'), acc.badge, 'autocomplete="off"')}
          <div class="edit-wide">${fld('address', t('address'), acc.address, 'autocomplete="off"')}</div>
        </div>
        <p class="muted small">${esc(t('editNameNote'))}</p>
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(t('saveChanges'))}</button>
        </div>
      </form>`, 'dlg-edit');
    const f = dlg.querySelector('form');
    let saved = false;
    dlg.querySelector('[data-act=cancel]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => resolve(saved));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const vals = Object.fromEntries(['first', 'middle', 'last', 'suffix', 'gender', 'contact', 'address', 'rank', 'badge'].map(k => [k, f[k].value]));
      const res = updateDetails(actorId, acc.id, vals);
      f.querySelectorAll('[data-f]').forEach(el => {
        const msg = res.errors?.[el.dataset.f] || '';
        const errEl = el.querySelector('.err');
        if (errEl) { errEl.hidden = !msg; errEl.textContent = msg; }
        el.classList.toggle('has-err', !!msg);
      });
      if (res.errors) { f.querySelector('.has-err input, .has-err select')?.focus(); return; }
      if (res.error) { toast(res.error, 'error'); return; }
      saved = true;
      toast(res.message);
      dlg.close();
    });
    f.first.focus();
  });
}

// Resolves true when the picture was removed.
export async function removePictureFlow(actorId, acc) {
  const ok = await dialog({ title: t('removePicTitle', { name: displayName(acc) }), body: t('removePicBody'), confirm: t('removePicture'), danger: true });
  if (!ok) return false;
  const res = removePicture(actorId, acc.id);
  if (res.error) { toast(res.error, 'error'); return false; }
  toast(res.message);
  return true;
}

// Confirm, then show the Temporary password once.
export async function resetPasswordFlow(actorId, acc) {
  const ok = await dialog({ title: t('resetTitle', { name: displayName(acc) }), body: t('resetBody'), confirm: t('resetPassword') });
  if (!ok) return false;
  const res = await resetPassword(actorId, acc.id);
  if (res.error) { toast(res.error, 'error'); return false; }
  await new Promise(resolve => {
    const dlg = openDialog(`
      <form method="dialog" class="dlg-form">
        <h2 class="dlg-title">${esc(t('tempTitle'))}</h2>
        <p class="dlg-body">${esc(t('tempBody', { name: displayName(acc) }))}</p>
        <div class="temp-pw"><code class="temp-code">${esc(res.temp)}</code>
          <button type="button" class="btn btn-ghost btn-sm" data-copy>${icon('copy')}<span>${esc(t('copy'))}</span></button></div>
        <p class="muted small">${esc(t('tempNote'))}</p>
        <div class="dlg-actions"><button type="submit" class="btn btn-primary">${esc(t('done'))}</button></div>
      </form>`);
    dlg.addEventListener('close', resolve);
    dlg.querySelector('[data-copy]').addEventListener('click', async e => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(res.temp); b.querySelector('span').textContent = t('copied'); }
      catch { toast(t('copyFailed'), 'error'); }
    });
    dlg.querySelector('[type=submit]').focus();
  });
  return true;
}
