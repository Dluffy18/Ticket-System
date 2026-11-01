import { t } from '../strings.js';
import { esc, SUFFIXES } from '../util.js';
import { S, signIn, register, validateRegistration } from '../store.js';
import { icon, menuMarkup, bindMenu, setMenuValue } from '../ui.js';

function brand() {
  return `<div class="auth-brand"><img class="auth-seal" src="img/logo-mati-160.png" alt="${esc(t('cityLogoAlt'))}" width="40" height="40"><span>${esc(t('cityName'))}</span></div>`;
}

// Sign-in and Create account share one layout: city name, illustration and tagline, then the form.
function splitPage(formHtml, extraClass = '') {
  return `
  <main id="main" class="auth auth-split ${extraClass}">
    <div class="split-side">
      <header class="split-brand">${brand()}</header>
      <figure class="split-art">
        <img src="img/login-illustration.png" alt="" width="1200" height="1205" decoding="async">
      </figure>
      <p class="split-tagline">${esc(t('signInTagline'))}</p>
    </div>
${formHtml}
  </main>`;
}

export function signInView(root, ctx) {
  root.innerHTML = splitPage(`
    <form class="split-form" novalidate>
      <h1 class="split-title">${esc(t('signInTitle'))}</h1>
      <p class="split-lead">${esc(t('signInLead'))}</p>
      <p class="split-tagline-inline">${esc(t('signInTagline'))}</p>
      <div class="alert alert-error" role="alert" hidden></div>
      <label class="field"><span class="lbl">${esc(t('fullName'))}</span>
        <input class="input" name="name" placeholder="${esc(t('fullNamePlaceholder'))}" autocomplete="username" autocapitalize="words" spellcheck="false" required>
        <span class="hint">${esc(t('fullNameHint'))}</span></label>
      <label class="field"><span class="lbl">${esc(t('password'))}</span>
        <input class="input" name="password" type="password" placeholder="${esc(t('passwordPlaceholder'))}" autocomplete="current-password" required></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('signIn'))}</button>
      <p class="split-links">
        <button type="button" class="split-link" aria-expanded="false" aria-controls="forgot-note">${esc(t('forgotPassword'))}</button>
        <span class="split-sep" aria-hidden="true"></span>
        <a class="split-link" href="#/register">${esc(t('createAccount'))}</a>
      </p>
      <p class="split-note" id="forgot-note" hidden>${esc(t('forgotPasswordNote'))}</p>
    </form>`);
  const forgot = root.querySelector('[aria-controls=forgot-note]');
  const note = root.querySelector('#forgot-note');
  forgot.addEventListener('click', () => {
    note.hidden = !note.hidden;
    forgot.setAttribute('aria-expanded', String(!note.hidden));
  });
  const form = root.querySelector('form');
  const alert = root.querySelector('.alert');
  const btn = form.querySelector('button[type=submit]');
  if (matchMedia('(min-width: 900px)').matches) form.name.focus(); // on phones, don't pop the keyboard over the page
  form.addEventListener('submit', async e => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = t('signingIn');
    const res = await signIn(form.name.value, form.password.value);
    btn.disabled = false; btn.textContent = t('signIn');
    if (res.error) {
      alert.hidden = false;
      alert.innerHTML = `${icon('alert')}<span>${esc(res.error)}</span>`;
      return;
    }
    ctx.afterSignIn();
  });
}

export function registerView(root, ctx) {
  const agencies = S.ref.agencies;
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
  root.innerHTML = splitPage(`
    <form class="split-form reg-form" novalidate>
      <h1 class="split-title">${esc(t('registerTitle'))}</h1>
      <p class="split-sub">${esc(t('registerLead'))}</p>
      <fieldset class="boxes">
        <div class="grid-2 tight">
          ${field('first', t('firstName'), 'given-name', false, t('phFirst'))}
          ${field('middle', t('middleName'), 'additional-name', true, t('phMiddle'))}
          ${field('last', t('lastName'), 'family-name', false, t('phLast'))}
          <label class="field" data-f="suffix"><span class="lbl">${esc(t('suffix'))} <em>${esc(t('optional'))}</em></span>
            <select class="input" name="suffix">${SUFFIXES.map(s => opt(s, s || t('none'))).join('')}</select></label>
        </div>
        <div class="grid-ga">
          <div class="field" data-f="gender">
            <span class="lbl" id="g-lbl">${esc(t('gender'))}</span>
            ${menuMarkup({ id: 'gender-menu', labelledBy: 'g-lbl', placeholder: t('choose'), value: '',
              items: [['M', t('male')], ['F', t('female')]].map(([k, name]) => ({ value: k, name })) })}
            <span class="err" hidden></span>
          </div>
          <label class="field" data-f="agency"><span class="lbl">${esc(t('agency'))}</span>
            <select class="input" name="agency">${opt('', t('chooseAgency'))}${agencies.map(a => opt(a.id, a.name)).join('')}</select>
            <span class="err" hidden></span></label>
        </div>
        <div class="grid-2 tight align-end">
          ${field('rank', t('rankPosition'), 'organization-title', true, t('phRank'))}
          ${field('badge', t('badgeId'), 'off', true, t('phBadge'))}
        </div>
        ${field('contact', t('contactNumber'), 'tel', false, t('phContact'), 'tel', t('contactHint'))}
        ${field('address', t('address'), 'street-address', false, t('phAddress'))}
        <div class="field-pair">
          <div class="grid-2 tight">
            ${field('password', t('password'), 'new-password', false, t('phPassword'), 'password')}
            ${field('confirm', t('confirmPassword'), 'new-password', false, t('phConfirm'), 'password')}
          </div>
          <span class="hint">${esc(t('passwordHint'))}</span>
        </div>
      </fieldset>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('submitRegistration'))}</button>
      <p class="split-alt">${esc(t('haveAccount'))} <a class="split-link" href="#/signin">${esc(t('signIn'))}</a></p>
    </form>`, 'auth-register');

  const form = root.querySelector('form');
  let tried = false;
  let gender = '';
  const genderMenu = form.querySelector('[data-menu=gender-menu]');
  bindMenu(genderMenu, k => {
    gender = k;
    setMenuValue(genderMenu, k, k === 'M' ? t('male') : t('female'));
    if (tried) show(validateRegistration(values()));
  }, ctx.onLeave);
  const values = () => ({
    first: form.first.value, middle: form.middle.value, last: form.last.value, suffix: form.suffix.value,
    gender, agency: form.agency.value,
    rank: form.rank.value, badge: form.badge.value, contact: form.contact.value, address: form.address.value,
    password: form.password.value, confirm: form.confirm.value,
  });
  const show = errs => {
    form.querySelectorAll('[data-f]').forEach(f => {
      const k = f.dataset.f;
      const el = f.querySelector('.err');
      if (!el) return;
      el.hidden = !errs[k];
      el.textContent = errs[k] || '';
      f.classList.toggle('has-err', !!errs[k]);
      const inp = f.querySelector('input,select');
      if (inp && inp.type !== 'radio') inp.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
    });
  };
  form.addEventListener('input', () => { if (tried) show(validateRegistration(values())); });
  form.addEventListener('change', () => { if (tried) show(validateRegistration(values())); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    tried = true;
    const res = await register(values());
    if (res.errors) {
      show(res.errors);
      const first = form.querySelector('.has-err input, .has-err select, .has-err .type-menu-btn');
      first?.focus();
      return;
    }
    form.innerHTML = `
      <div class="done-panel" role="status">
        <span class="stamp stamp-pending">${esc(t('acPending'))}</span>
        <h1 class="split-title">${esc(t('registeredTitle'))}</h1>
        <p class="split-sub">${esc(t('registeredBody').replace(t('registeredTitle') + ' ', ''))}</p>
        <a class="btn btn-primary btn-block btn-lg" href="#/signin">${esc(t('backToSignIn'))}</a>
      </div>`;
    form.scrollIntoView({ block: 'start' });
  });
}

function field(name, label, autocomplete, optional = false, placeholder = '', type = 'text', hint = '') {
  return `<label class="field" data-f="${name}"><span class="lbl">${esc(label)}${optional ? ` <em>${esc(t('optional'))}</em>` : ''}</span>
    <input class="input" name="${name}" type="${type}" autocomplete="${autocomplete}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${type === 'tel' ? 'inputmode="tel"' : ''}>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    <span class="err" hidden></span></label>`;
}
