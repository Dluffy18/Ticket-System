// App state and every domain rule. Views call these functions; nothing else
// changes state.
import {
  normName, fullName, displayName, nameVariants, dayKey, todayKey, startOfDay, startOfMonth,
  lsGet, lsSet, ssGet, ssSet, randomSalt, hashPassword, normPhone, parseDayKey, fDateTime, SUFFIXES,
} from './util.js';
import { t } from './strings.js';

const LS_REG = 'vt.registrations';
const LS_STATUS = 'vt.accountStatus';
const LS_PW = 'vt.passwords';   // accountId -> { salt, hash, changedAt } after a Change password
const LS_EDITS = 'vt.edits';   // accountId -> corrected details of a JSON account
const LS_ROLES = 'vt.roles';   // accountId -> { kind, agency, enfAgency } given by the Super Admin
const LS_AVATAR = 'vt.avatars'; // accountId -> profile picture (JPEG data URL), kept on this device
const SS_SESSION = 'vt.session';

export const S = {
  ref: null,
  ct: new Map(), vt: new Map(), ag: new Map(), admins: new Map(),
  booklets: [],
  citations: [],
  violators: [],
  registrations: [],
  statusOverrides: {},
  roles: {},
  edits: {},
  passwords: {},
  avatars: {},
  online: true,
  session: null,
  currentType: {},   // enforcerId -> ctype being recorded
  drafts: {},        // bookletId -> draft
  lastFinished: {},  // enforcerId -> { ctype -> booklet }
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(kind, detail) { listeners.forEach(fn => fn(kind, detail)); }

// ------------------------------------------------------------------ init
export function init(ref) {
  S.ref = ref;
  ref.citationTypes.forEach(c => S.ct.set(c.id, c));
  ref.violationTypes.forEach(v => S.vt.set(v.id, v));
  ref.agencies.forEach(a => S.ag.set(a.id, a));
  ref.admins.forEach(a => S.admins.set(a.id, a));
  S.violators = ref.violators.map(v => ({ ...v }));
  S.registrations = lsGet(LS_REG, []);
  S.statusOverrides = lsGet(LS_STATUS, {});
  S.roles = lsGet(LS_ROLES, {});
  S.edits = lsGet(LS_EDITS, {});
  S.passwords = lsGet(LS_PW, {});
  S.avatars = lsGet(LS_AVATAR, {});
  S.online = navigator.onLine !== false;
  seed();
  const sess = ssGet(SS_SESSION, null);
  if (sess && findAccount(sess.id)) {
    const acc = findAccount(sess.id);
    if (acc.status === 'active') S.session = { id: acc.id, kind: acc.kind };
  }
}

// ------------------------------------------------------------------ accounts
// Accounts come from the JSON files or from sign-ups. Status decisions on JSON accounts
// live in statusOverrides; roles the Super Admin gave live in S.roles.
function fromJson(a, kind) {
  const o = S.statusOverrides[a.id] || {};
  return {
    ...a, ...S.edits[a.id], kind, source: 'json',
    status: o.status || 'active', reason: o.reason || '', history: o.history || [], registeredAt: null,
  };
}
// enfAgency: the office whose Citations they issued, kept after they stop being an Enforcer.
function withRole(a) {
  const r = S.roles[a.id];
  if (!r) return a;
  const position = r.kind === 'office' ? t('posOffice', { agency: S.ag.get(r.agency)?.name || '' })
    : r.kind === 'verifier' ? t('posVerifier') : a.position;
  return { ...a, kind: r.kind, agency: r.agency, enfAgency: r.enfAgency || '', position };
}

// Registrations, newest per full name (a re-registration replaces a rejected one).
function liveRegistrations() {
  const byName = new Map();
  [...S.registrations].sort((a, b) => a.createdAt - b.createdAt).forEach(r => byName.set(normName(fullName(r)), r));
  return [...byName.values()];
}

export function allAccounts() {
  return [
    ...S.ref.enforcers.map(e => fromJson(e, 'enforcer')),
    ...liveRegistrations().map(r => ({ ...r, kind: 'enforcer', source: 'reg' })),
    ...S.ref.admins.map(a => fromJson(a, a.role)),
  ].map(withRole);
}
export function allEnforcers() { return allAccounts().filter(a => a.kind === 'enforcer'); }
export function findAccount(id) { return allAccounts().find(a => a.id === id) || null; }
export function enforcer(id) { return allEnforcers().find(e => e.id === id) || null; }
export function personName(id) {
  const a = findAccount(id);
  return a ? displayName(a) : id;
}

export function me() { return S.session ? findAccount(S.session.id) : null; }

export async function signIn(nameInput, password) {
  const n = normName(nameInput);
  if (!n || !password) return { error: t('enterNameAndPassword') };
  let cands = allAccounts().filter(a => nameVariants(a).has(n));
  if (cands.length > 1) {
    const exact = cands.filter(a => normName(fullName(a)) === n);
    if (exact.length !== 1) return { error: t('errAmbiguousName') };
    cands = exact;
  }
  if (!cands.length) return { error: t('errNameOrPassword') };
  const acc = cands[0];
  if (!(await passwordMatches(acc, password))) return { error: t('errNameOrPassword') };
  // Status is only revealed after the password checks out.
  if (acc.status === 'pending') return { error: t('errPending') };
  if (acc.status === 'rejected') return { error: acc.reason ? t('errRejectedReason', { reason: acc.reason }) : t('errRejected') };
  if (acc.status === 'inactive') return { error: t('errInactive') };
  startSession(acc);
  return { ok: true, account: acc };
}

// A changed password wins; otherwise registrations check their own hash.
// Sample accounts from the JSON files have no stored password until they change it.
async function passwordMatches(acc, password) {
  const stored = S.passwords[acc.id] || (acc.source === 'reg' && acc.hash ? acc : null);
  if (!stored) return true;
  const typed = stored.temp ? normTemp(password) : password;
  return (await hashPassword(stored.salt, typed)) === stored.hash;
}
const normTemp = s => String(s || '').toUpperCase().replace(/[\s-]/g, '');

// After a reset, the person must set their own password before anything else.
export function mustSetPassword(id) { return !!S.passwords[id]?.temp; }

export async function setOwnPassword(f) {
  const acc = me();
  const err = {};
  if ((f.password || '').length < 8) err.password = t('errPasswordShort');
  if (f.password !== f.confirm) err.confirm = t('errPasswordMatch');
  if (Object.keys(err).length) return { errors: err };
  const salt = randomSalt();
  S.passwords[acc.id] = { salt, hash: await hashPassword(salt, f.password), changedAt: Date.now() };
  lsSet(LS_PW, S.passwords);
  return { ok: true };
}

export function passwordChangedAt(id) { return S.passwords[id]?.changedAt || null; }

export async function changePassword(f) {
  const acc = me();
  const err = {};
  if (!f.current) err.current = t('errCurrentRequired');
  if ((f.password || '').length < 8) err.password = t('errPasswordShort');
  if (f.password !== f.confirm) err.confirm = t('errPasswordMatch');
  if (!err.current && !(await passwordMatches(acc, f.current))) err.current = t('errCurrentWrong');
  if (Object.keys(err).length) return { errors: err };
  const salt = randomSalt();
  S.passwords[acc.id] = { salt, hash: await hashPassword(salt, f.password), changedAt: Date.now() };
  lsSet(LS_PW, S.passwords);
  return { ok: true };
}

export function avatarOf(id) { return S.avatars[id] || null; }
export function setAvatar(id, dataUrl) {
  if (dataUrl) S.avatars[id] = dataUrl; else delete S.avatars[id];
  lsSet(LS_AVATAR, S.avatars);
}

export function startSession(acc) {
  S.session = { id: acc.id, kind: acc.kind };
  ssSet(SS_SESSION, S.session);
}
export function signOut() { S.session = null; ssSet(SS_SESSION, null); }

export function validateRegistration(f) {
  const err = {};
  if (!f.first.trim()) err.first = t('errFirstRequired');
  if (!f.last.trim()) err.last = t('errLastRequired');
  if (!['M', 'F'].includes(f.gender)) err.gender = t('errGenderRequired');
  if (f.agency && !S.ag.has(f.agency)) err.agency = t('errAgencyRequired');
  if (!normPhone(f.contact)) err.contact = t('errContact');
  if (!f.address.trim()) err.address = t('errAddress');
  if ((f.password || '').length < 8) err.password = t('errPasswordShort');
  if (f.password !== f.confirm) err.confirm = t('errPasswordMatch');
  if (!err.first && !err.last) {
    const k = normName(fullName(f));
    if (allAccounts().some(a => a.status !== 'rejected' && normName(fullName(a)) === k)) err.first = t('errNameTaken');
  }
  return err;
}

export async function register(f) {
  const err = validateRegistration(f);
  if (Object.keys(err).length) return { errors: err };
  const salt = randomSalt();
  const hash = await hashPassword(salt, f.password);
  const now = Date.now();
  const r = {
    id: 'R' + now.toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(),
    first: f.first.trim(), middle: f.middle.trim(), last: f.last.trim(), suffix: SUFFIXES.includes(f.suffix) ? f.suffix : '',
    gender: f.gender, agency: S.ag.has(f.agency) ? f.agency : '', rank: f.rank.trim(), badge: f.badge.trim(),
    contact: normPhone(f.contact), address: f.address.trim(),
    salt, hash, status: 'pending', reason: '', createdAt: now, registeredAt: now,
    history: [],
  };
  S.registrations.push(r);
  lsSet(LS_REG, S.registrations);
  return { ok: true };
}

const MOVES = {
  'pending>active': 'approved', 'pending>rejected': 'rejected', 'rejected>active': 'approved',
  'active>inactive': 'inactive', 'inactive>active': 'active',
};
export const ROLES = ['enforcer', 'office', 'verifier'];

// "Enforcer · Police", "Office Admin · Police", "Verifier · Treasury Office", "Super Admin · CICT Office"
export function roleLabel(kind, agency) {
  const ag = S.ag.get(agency)?.name;
  if (kind === 'enforcer') return ag ? t('roleEnforcerOf', { office: ag }) : t('roleEnforcer');
  if (kind === 'office') return t('roleOfficeOf', { office: ag || '' });
  if (kind === 'super') return t('roleSuper');
  return t('roleVerifier');
}

// Who may decide on an account: the Super Admin on anyone but themselves; an Office Admin
// on the Enforcers of their own office.
export function canManage(actor, acc) {
  if (!actor || !acc || actor.status !== 'active') return false;
  if (actor.kind === 'super') return acc.id !== actor.id && acc.kind !== 'super';
  return actor.kind === 'office' && acc.kind === 'enforcer' && !!acc.agency && acc.agency === actor.agency;
}

function saveDecision(acc, patch, entry) {
  const rec = acc.source === 'reg' ? S.registrations.find(x => x.id === acc.id)
    : (S.statusOverrides[acc.id] ||= { history: [] });
  Object.assign(rec, patch);
  rec.history = [...(rec.history || []), entry];
  if (acc.source === 'reg') lsSet(LS_REG, S.registrations); else lsSet(LS_STATUS, S.statusOverrides);
}

export function changeStatus(actorId, accId, to, reason = '') {
  const actor = findAccount(actorId);
  const acc = findAccount(accId);
  if (!canManage(actor, acc)) return { error: t(actor?.kind === 'super' ? 'errNotAllowed' : 'errNotYourAgency') };
  const action = MOVES[`${acc.status}>${to}`];
  if (!action) return { error: t('errNotAllowed') };
  if (action === 'approved' && acc.kind === 'enforcer' && !S.ag.has(acc.agency)) return { error: t('errNeedOffice') };
  reason = to === 'rejected' ? String(reason || '').trim().slice(0, 200) : '';
  saveDecision(acc, { status: to, reason }, { action, by: actorId, at: Date.now(), reason });
  const msg = { approved: 'msgApproved', rejected: 'msgRejected', inactive: 'msgInactive', active: 'msgActive' }[action];
  emit('accounts');
  return { ok: true, message: t(msg, { name: displayName(acc) }) };
}

function giveRole(acc, kind, agency) {
  const enfAgency = acc.kind === 'enforcer' ? acc.agency : acc.enfAgency || '';
  S.roles[acc.id] = { kind, agency: kind === 'verifier' ? '' : agency, enfAgency: kind === 'enforcer' ? '' : enfAgency };
  lsSet(LS_ROLES, S.roles);
}
function roleCheck(actorId, acc, kind, agency) {
  if (findAccount(actorId)?.kind !== 'super' || !canManage(findAccount(actorId), acc)) return t('errNotAllowed');
  if (!ROLES.includes(kind)) return t('errNotAllowed');
  if (kind !== 'verifier' && !S.ag.has(agency)) return t('errNeedOffice');
  return '';
}

// Super Admin: approve a Pending (or Rejected) sign-up as Enforcer, Office Admin or Verifier.
export function approveAs(actorId, accId, kind, agency) {
  const acc = findAccount(accId);
  const err = roleCheck(actorId, acc, kind, agency);
  if (err) return { error: err };
  if (!['pending', 'rejected'].includes(acc.status)) return { error: t('errNotAllowed') };
  giveRole(acc, kind, agency);
  saveDecision(acc, { status: 'active', reason: '' }, { action: 'approved', as: kind, agency: kind === 'verifier' ? '' : agency, by: actorId, at: Date.now(), reason: '' });
  emit('accounts');
  return { ok: true, message: t('msgApprovedAs', { name: displayName(acc), role: roleLabel(kind, agency) }) };
}

// Super Admin: change an approved account's role or office. Their Citations and Booklets stay.
export function changeRole(actorId, accId, kind, agency) {
  const acc = findAccount(accId);
  const err = roleCheck(actorId, acc, kind, agency);
  if (err) return { error: err };
  if (!['active', 'inactive'].includes(acc.status)) return { error: t('errNotAllowed') };
  if (kind === acc.kind && (kind === 'verifier' || agency === acc.agency)) return { error: t('errSameRole') };
  giveRole(acc, kind, agency);
  saveDecision(acc, {}, { action: 'role', as: kind, agency: kind === 'verifier' ? '' : agency, by: actorId, at: Date.now(), reason: '' });
  emit('accounts');
  return { ok: true, message: t('msgRoleChanged', { name: displayName(acc), role: roleLabel(kind, agency) }) };
}

// Super Admin on anyone but themselves; an Office Admin on their own Enforcers.
// Returns the Temporary password, shown once: 8 characters with no 0/O or 1/I/L, as XXXX-XXXX.
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export async function resetPassword(actorId, accId) {
  const actor = findAccount(actorId);
  const acc = findAccount(accId);
  if (!canManage(actor, acc)) return { error: t(actor?.kind === 'super' ? 'errNotAllowed' : 'errNotYourAgency') };
  const r = crypto.getRandomValues(new Uint32Array(8));
  const raw = [...r].map(n => TEMP_CHARS[n % TEMP_CHARS.length]).join('');
  const salt = randomSalt();
  S.passwords[acc.id] = { salt, hash: await hashPassword(salt, raw), changedAt: Date.now(), temp: true };
  lsSet(LS_PW, S.passwords);
  saveDecision(acc, {}, { action: 'reset', by: actorId, at: Date.now(), reason: '' });
  emit('accounts');
  return { ok: true, temp: raw.slice(0, 4) + '-' + raw.slice(4) };
}

export const DETAIL_FIELDS = ['first', 'middle', 'last', 'suffix', 'gender', 'contact', 'address', 'rank', 'badge'];

// Correct someone's details. Every changed field is kept in their history as old → new.
export function updateDetails(actorId, accId, f) {
  const actor = findAccount(actorId);
  const acc = findAccount(accId);
  if (!canManage(actor, acc)) return { error: t(actor?.kind === 'super' ? 'errNotAllowed' : 'errNotYourAgency') };
  const v = {
    first: String(f.first || '').trim(), middle: String(f.middle || '').trim(), last: String(f.last || '').trim(),
    suffix: SUFFIXES.includes(f.suffix) ? f.suffix : '', gender: f.gender,
    contact: normPhone(f.contact), address: String(f.address || '').trim(),
    rank: String(f.rank || '').trim(), badge: String(f.badge || '').trim(),
  };
  const err = {};
  if (!v.first) err.first = t('errFirstRequired');
  if (!v.last) err.last = t('errLastRequired');
  if (!['M', 'F'].includes(v.gender)) err.gender = t('errGenderRequired');
  if (!v.contact) err.contact = t('errContact');
  if (!v.address && acc.address) err.address = t('errAddress');
  if (!err.first && !err.last) {
    const k = normName(fullName(v));
    if (allAccounts().some(a => a.id !== acc.id && a.status !== 'rejected' && normName(fullName(a)) === k)) err.first = t('errNameTakenOther');
  }
  if (Object.keys(err).length) return { errors: err };
  const changes = DETAIL_FIELDS.filter(k => (acc[k] || '') !== v[k]).map(k => ({ field: k, from: acc[k] || '', to: v[k] }));
  if (!changes.length) return { error: t('errNoChanges') };
  const patch = Object.fromEntries(changes.map(c => [c.field, c.to]));
  if (acc.source === 'json') {
    S.edits[acc.id] = { ...S.edits[acc.id], ...patch };
    lsSet(LS_EDITS, S.edits);
    saveDecision(acc, {}, { action: 'edited', changes, by: actorId, at: Date.now(), reason: '' });
  } else {
    saveDecision(acc, patch, { action: 'edited', changes, by: actorId, at: Date.now(), reason: '' });
  }
  emit('accounts');
  const renamed = changes.some(c => ['first', 'middle', 'last', 'suffix'].includes(c.field));
  return { ok: true, message: renamed ? t('msgSavedRenamed', { name: fullName(v) }) : t('msgSaved') };
}

// Activity log: every sign-up, and every decision in every account's history, newest first.
export function activityLog() {
  const out = [];
  allAccounts().forEach(a => {
    if (a.source === 'reg' && a.createdAt) out.push({ action: 'signup', at: a.createdAt, by: a.id, acc: a });
    (a.history || []).forEach(h => out.push({ ...h, acc: a }));
  });
  return out.sort((x, y) => y.at - x.at);
}

// ------------------------------------------------------------------ reference helpers
// The office an account issues (or issued) Citations for.
export function agencyOf(id) {
  const a = findAccount(id);
  if (!a) return null;
  return S.ag.get(a.kind === 'enforcer' ? a.agency : a.enfAgency || a.agency) || null;
}
export function typesFor(enfId) { const a = agencyOf(enfId); return a ? a.citationTypes.map(id => S.ct.get(id)) : []; }
export function violationsFor(enfId, ctype) {
  const a = agencyOf(enfId);
  if (!a) return [];
  return a.violationTypes.map(id => S.vt.get(id)).filter(v => v.citationType === ctype);
}
export function ctName(id) { return S.ct.get(id)?.name || id; }
export function vtName(id) { return S.vt.get(id)?.name || id; }

// ------------------------------------------------------------------ booklets
export function bookletSize(b) { return b.to - b.from + 1; }
export function bookletUsed(b) { return S.citations.filter(c => c.bookletId === b.id).length; }
export function bookletCurrent(b) { return b.from + bookletUsed(b); }
export function bookletActive(b) { return bookletUsed(b) < bookletSize(b); }
export function activeBooklet(owner, ctype) {
  return S.booklets.find(b => b.owner === owner && b.ctype === ctype && bookletActive(b)) || null;
}
export function activeBooklets(owner) { return S.booklets.filter(b => b.owner === owner && bookletActive(b)); }

export function currentTypeOf(enfId) {
  const types = typesFor(enfId).map(c => c.id);
  let ct = S.currentType[enfId];
  if (!types.includes(ct)) ct = null;
  if (!ct || !activeBooklet(enfId, ct)) {
    const withBooklet = types.find(id => activeBooklet(enfId, id));
    ct = withBooklet || ct || types[0];
  }
  S.currentType[enfId] = ct;
  return ct;
}
export function setCurrentType(enfId, ctype) { S.currentType[enfId] = ctype; }

export function bookletFormCount(fromStr, toStr) {
  if (!/^\d+$/.test(fromStr || '') || !/^\d+$/.test(toStr || '')) return null;
  const n = Number(toStr) - Number(fromStr) + 1;
  return n > 0 ? n : null;
}

export function registerBooklet(owner, ctype, fromStr, toStr) {
  const a = agencyOf(owner);
  if (!a || !a.citationTypes.includes(ctype)) return { error: t('errBk1') };
  if (activeBooklet(owner, ctype)) return { error: t('errBk2', { type: ctName(ctype) }) };
  fromStr = String(fromStr ?? '').trim(); toStr = String(toStr ?? '').trim();
  if (!/^\d+$/.test(fromStr) || !/^\d+$/.test(toStr)) return { error: t('errBk3') };
  const from = Number(fromStr), to = Number(toStr);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return { error: t('errBk3') };
  if (to < from) return { error: t('errBk4') };
  if (to - from + 1 > 500) return { error: t('errBk5') };
  const clash = S.booklets.find(b => from <= b.to && to >= b.from);
  if (clash) return { error: t('errBk6', { from: clash.from, to: clash.to }) };
  const b = { id: 'B' + (S.booklets.length + 1) + '-' + from, owner, ctype, from, to, at: Date.now() };
  S.booklets.push(b);
  delete (S.lastFinished[owner] || {})[ctype];
  setCurrentType(owner, ctype);
  return { ok: true, booklet: b, message: t('bookletRegistered', { type: ctName(ctype), n: bookletSize(b), from }) };
}

// ------------------------------------------------------------------ drafts
const VIOLATOR_FIELDS = ['first', 'middle', 'last', 'suffix', 'birthday', 'sex'];
function emptyViolator() { return { first: '', middle: '', last: '', suffix: '', birthday: '', sex: '' }; }

export function getDraft(b) {
  const no = bookletCurrent(b);
  let d = S.drafts[b.id];
  if (!d || d.no !== no) {
    d = S.drafts[b.id] = {
      bookletId: b.id, ctype: b.ctype, no,
      violations: [], photos: { form: null, id: null, violator: null, plate: null }, noId: false,
      violator: emptyViolator(), marks: {}, typed: {}, reading: false, readToken: 0,
    };
  }
  return d;
}

export function requiredPhotos(d) {
  const list = ['form'];
  if (!d.noId) list.push('id');
  list.push('violator');
  if (S.ct.get(d.ctype)?.needsPlatePhoto) list.push('plate');
  return list;
}
export function nextMissingPhoto(d) { return requiredPhotos(d).find(k => !d.photos[k]) || null; }

// Has the Enforcer entered anything for this Control Number yet?
export function draftHasEntries(d) {
  return d.violations.length > 0 || d.noId || Object.values(d.photos).some(Boolean)
    || VIOLATOR_FIELDS.some(f => d.violator[f]);
}

// Discard: clear the draft without recording a Status. The Control Number stays open.
export function discardDraft(d) {
  if (S.drafts[d.bookletId] === d) delete S.drafts[d.bookletId];
  d.readToken++; // an ID reading still in progress must not write into a fresh draft
}

export function setPhoto(d, kind, dataUrl) {
  // Writes straight into the live draft, so a photo taken while the ID is
  // still being read is never dropped or overwritten by the read.
  d.photos[kind] = dataUrl;
  if (kind === 'id' && !d.noId) startIdRead(d);
}

export function setNoId(d, on) {
  d.noId = on;
  if (on) {
    d.photos.id = null;
    d.marks = {};
    d.reading = false;
    d.readToken++;
  }
}

export function typeField(d, field, value) {
  d.violator[field] = value;
  d.typed[field] = true;
  delete d.marks[field];
}

// Prototype ID reading: ~1.4 s, a random sample person, and a 60% chance
// that the first name, middle name or birthday comes back blank.
export function startIdRead(d) {
  const token = ++d.readToken;
  d.reading = true;
  emit('draft', d);
  setTimeout(() => {
    if (d.readToken !== token || d.noId || !d.photos.id) return;
    const src = S.ref.violators[Math.floor(Math.random() * S.ref.violators.length)];
    const read = { ...emptyViolator(), ...pick(src, VIOLATOR_FIELDS) };
    if (Math.random() < 0.6) read[['first', 'middle', 'birthday'][Math.floor(Math.random() * 3)]] = '';
    for (const f of VIOLATOR_FIELDS) {
      if (d.typed[f] && d.violator[f] !== '') continue; // never overwrite what the Enforcer typed
      d.violator[f] = read[f] || '';
      if (read[f]) d.marks[f] = 'read';
      else if (f !== 'suffix') d.marks[f] = 'unread';
      else delete d.marks[f];
    }
    d.reading = false;
    emit('draft', d);
  }, 1400);
}
function pick(o, keys) { const r = {}; keys.forEach(k => { r[k] = o[k] ?? ''; }); return r; }

export function missingItems(d) {
  const out = [];
  if (!d.violations.length) out.push({ step: 1, text: t('needViolation') });
  if (!d.photos.form) out.push({ step: 2, text: t('needFormPhoto') });
  if (!d.noId && !d.photos.id) out.push({ step: 2, text: t('needIdPhoto') });
  if (!d.photos.violator) out.push({ step: 2, text: t('needViolatorPhoto') });
  if (S.ct.get(d.ctype)?.needsPlatePhoto && !d.photos.plate) out.push({ step: 2, text: t('needPlatePhoto') });
  const v = d.violator;
  const miss = [];
  if (!v.first.trim()) miss.push(t('fFirst'));
  if (!v.last.trim()) miss.push(t('fLast'));
  if (!v.birthday) miss.push(t('fBirthday'));
  if (!v.sex) miss.push(t('fSex'));
  if (miss.length) out.push({ step: 2, text: t('needViolatorFields', { fields: miss.join(', ') }), field: true });
  if (v.birthday && (!parseDayKey(v.birthday) || v.birthday > todayKey())) out.push({ step: 2, text: t('needBirthdayPast') });
  return out;
}

// ------------------------------------------------------------------ violator records
function violatorKey(v) { return normName(fullName(v)) + '|' + (v.birthday || ''); }
export function linkViolator(v) {
  if (v.birthday) {
    const k = violatorKey(v);
    const hit = S.violators.find(r => r.birthday && violatorKey(r) === k);
    if (hit) return hit.id;
  }
  const max = S.violators.reduce((m, r) => Math.max(m, Number(r.id.slice(3)) || 0), 0);
  const id = 'VL-' + String(max + 1).padStart(4, '0');
  S.violators.push({ id, first: v.first, middle: v.middle, last: v.last, suffix: v.suffix, birthday: v.birthday, sex: v.sex });
  return id;
}
export function violatorRecord(id) { return S.violators.find(v => v.id === id) || null; }

// ------------------------------------------------------------------ closing a form
function trimmedViolator(v) {
  const o = {}; VIOLATOR_FIELDS.forEach(f => { o[f] = String(v[f] || '').trim(); }); return o;
}

function closeForm(d, status, extra) {
  const b = S.booklets.find(x => x.id === d.bookletId);
  if (!b || bookletCurrent(b) !== d.no) return { error: 'This number is already closed.' };
  const rec = {
    no: d.no, owner: b.owner, ctype: b.ctype, bookletId: b.id, status, at: Date.now(), synced: S.online,
    violations: [...d.violations], photos: { ...d.photos }, noId: d.noId, violator: trimmedViolator(d.violator),
    violatorId: null, gps: null, incident: null, payment: null, payHistory: [],
    ...extra,
  };
  S.citations.push(rec);
  delete S.drafts[b.id];
  const finished = !bookletActive(b);
  if (finished) {
    S.lastFinished[b.owner] = { ...(S.lastFinished[b.owner] || {}), [b.ctype]: b };
  }
  return { ok: true, rec, booklet: b, finished, next: finished ? null : bookletCurrent(b) };
}

export function markDone(d) {
  if (missingItems(d).length) return { error: 'Missing items.' };
  const v = trimmedViolator(d.violator);
  const res = closeForm(d, 'done', { violatorId: linkViolator(v) });
  if (res.ok) requestGps(res.rec);
  return res;
}

export function cancelForm(d) { return closeForm(d, 'cancelled', {}); }

export function incidentCheck(d, paperRaw) {
  const p = String(paperRaw ?? '').trim();
  if (!p) return { empty: true };
  if (!/^\d+$/.test(p)) return { error: t('errNumbersOnly') };
  const n = Number(p);
  if (n === d.no) return { error: t('errSameNumber') };
  const b = S.booklets.find(x => x.id === d.bookletId);
  const existing = S.citations.find(c => c.no === n);
  if (existing) {
    return { hint: t('hintDuplicate', { p: n, status: statusWord(existing.status), time: fDateTime(existing.at) }) };
  }
  if (b && n > d.no && n <= b.to) return { hint: t('hintLater', { p: n }) };
  return { hint: t('hintOutside', { p: n }) };
}

export function voidForm(d, paperRaw, text) {
  const chk = incidentCheck(d, paperRaw);
  if (chk.error || chk.empty || String(text || '').trim().length < 15) return { error: 'Invalid' };
  const carry = { violations: [...d.violations], violator: { ...d.violator }, noId: d.noId, marks: { ...d.marks }, typed: { ...d.typed } };
  const res = closeForm(d, 'voided', { incident: { paperNo: String(paperRaw).trim(), text: String(text).trim(), hint: chk.hint } });
  if (res.ok && !res.finished) {
    // Next number starts at step 2 with the same Violations and Violator Details, and no photos.
    const nd = getDraft(res.booklet);
    nd.violations = carry.violations; nd.violator = carry.violator; nd.noId = carry.noId;
    nd.typed = carry.typed; nd.marks = carry.marks;
  }
  return res;
}

export function statusWord(s, admin = false) {
  return { done: admin ? t('stIssued') : t('stDone'), cancelled: t('stCancelled'), voided: t('stVoided') }[s] || s;
}

function requestGps(rec) {
  if (!navigator.geolocation) return;
  try {
    navigator.geolocation.getCurrentPosition(
      pos => { rec.gps = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }; emit('citations'); },
      () => { /* not allowed: location stays empty */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  } catch { /* ignore */ }
}

// ------------------------------------------------------------------ online / offline
export function setOnline(on) {
  if (S.online === on) return;
  S.online = on;
  let synced = 0;
  if (on) S.citations.forEach(c => { if (!c.synced) { c.synced = true; synced++; } });
  emit('online', { online: on, synced });
}

// ------------------------------------------------------------------ payment (Verifier)
export function validatePayment(c, orRaw, dateKey) {
  const err = {};
  const or = String(orRaw || '').trim().toUpperCase();
  if (!or) err.or = t('errOrRequired');
  else if (!/^[A-Z0-9-]+$/.test(or)) err.or = t('errOrFormat');
  else {
    const used = S.citations.find(x => x !== c && x.payment && x.payment.orNo.toUpperCase() === or);
    if (used) err.or = t('errOrUsed', { or, no: used.no });
  }
  const d = parseDayKey(dateKey);
  if (!d) err.date = t('required');
  else if (dateKey > todayKey()) err.date = t('errPaidFuture');
  else if (dateKey < dayKey(c.at)) err.date = t('errPaidBefore', { date: dayKey(c.at) });
  return { err, or };
}

export function markPaid(verifierId, c, orRaw, dateKey) {
  if (c.status !== 'done' || c.payment) return { error: 'Not allowed.' };
  const { err, or } = validatePayment(c, orRaw, dateKey);
  if (Object.keys(err).length) return { errors: err };
  c.payment = { orNo: or, date: dateKey };
  c.payHistory.push({ action: 'paid', orNo: or, date: dateKey, by: verifierId, at: Date.now() });
  emit('citations');
  return { ok: true, message: t('msgPaid', { no: c.no, or }) };
}

export function setUnpaid(verifierId, c) {
  if (!c.payment) return { error: 'Not paid.' };
  c.payHistory.push({ action: 'unpaid', orNo: c.payment.orNo, date: c.payment.date, by: verifierId, at: Date.now() });
  c.payment = null;
  emit('citations');
  return { ok: true, message: t('msgUnpaid', { no: c.no }) };
}

// ------------------------------------------------------------------ sample data
function samplePhoto(kind, no) {
  const label = { form: 'Ticket form', id: 'Violator’s ID', violator: 'Violator’s photo', plate: 'Plate number' }[kind];
  const bg = { form: '#F3EEDF', id: '#DCE6EF', violator: '#E4ECE2', plate: '#E6E6E1' }[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
<rect width="400" height="300" fill="${bg}"/>
<rect x="24" y="24" width="352" height="252" fill="none" stroke="#1C2B4A" stroke-width="2" stroke-dasharray="6 6"/>
<text x="200" y="140" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-size="24" font-weight="700" fill="#1C2B4A">${label}</text>
<text x="200" y="172" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-size="16" fill="#44506B">Sample photo · #${no}</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export { samplePhoto };

function seed() {
  const now = Date.now();
  const DAY = 86400000;
  const monthStart = startOfMonth(now);
  const dayStart = startOfDay(now);
  let slot = 0;
  const past = (daysAgo) => {
    // A time N days ago, kept inside the current month and before today.
    const d = new Date(now - daysAgo * DAY);
    d.setHours(9 + (slot % 8), (slot * 17) % 60, 0, 0);
    slot++;
    let ts = d.getTime();
    if (ts < monthStart) ts = monthStart + 8 * 3600000 + slot * 600000;
    if (ts >= dayStart) ts = Math.min(dayStart + slot * 60000, now - 3600000);
    return ts;
  };
  const todaySeq = (count) => {
    const start = Math.max(dayStart, now - 6 * 3600000);
    const end = Math.max(start, now - 120000);
    return Array.from({ length: count }, (_, i) => Math.round(start + (end - start) * (i + 1) / (count + 1)));
  };

  const B = (owner, ctype, from, to) => { const b = { id: `B-${ctype}-${from}`, owner, ctype, from, to, at: monthStart }; S.booklets.push(b); return b; };
  const bPolT = B('E001', 'TRAFFIC', 18104550, 18104600);
  const bPolO = B('E001', 'ORD', 30215100, 30215149);
  const bTra = B('E002', 'TRAFFIC', 18104601, 18104650);
  B('X-OTHER', 'ORD', 30215000, 30215049);
  B('X-OTHER', 'TRAFFIC', 18104651, 18104700);
  const bPso = B('E003', 'ORD', 30215200, 30215205);
  const bCsu = B('E004', 'ORD', 30215300, 30215304);

  let doneIdx = 0;
  const vl = S.ref.violators;
  const gpsRnd = rng(7);
  const gpsNear = () => matiGps(gpsRnd);
  const add = (b, no, status, at, opts = {}) => {
    const ag = agencyOf(b.owner);
    const pool = ag.violationTypes.filter(id => S.vt.get(id).citationType === b.ctype);
    let rec = {
      no, owner: b.owner, ctype: b.ctype, bookletId: b.id, status, at, synced: true,
      violations: [], photos: { form: null, id: null, violator: null, plate: null }, noId: false,
      violator: { first: '', middle: '', last: '', suffix: '', birthday: '', sex: '' },
      violatorId: null, gps: null, incident: null, payment: null, payHistory: [],
    };
    if (status === 'done') {
      const i = doneIdx++;
      const count = 1 + (i % 2);
      rec.violations = Array.from({ length: count }, (_, k) => pool[(i * 3 + k * 5) % pool.length]).filter((v, k, arr) => arr.indexOf(v) === k);
      const p = vl[i % vl.length];
      rec.violator = { first: p.first, middle: p.middle, last: p.last, suffix: p.suffix, birthday: p.birthday, sex: p.sex };
      rec.violatorId = p.id;
      rec.noId = i % 4 === 3;
      rec.photos.form = samplePhoto('form', no);
      if (!rec.noId) rec.photos.id = samplePhoto('id', no);
      rec.photos.violator = samplePhoto('violator', no);
      if (S.ct.get(b.ctype).needsPlatePhoto) rec.photos.plate = samplePhoto('plate', no);
      rec.gps = gpsNear(i);
    }
    rec = { ...rec, ...opts };
    S.citations.push(rec);
    return rec;
  };

  // POLICE Traffic
  add(bPolT, 18104550, 'done', past(5));
  add(bPolT, 18104551, 'done', past(4));
  add(bPolT, 18104552, 'done', past(3));
  const tp = todaySeq(5);
  add(bPolT, 18104553, 'done', tp[0]);
  add(bPolT, 18104554, 'cancelled', tp[1]);
  add(bPolT, 18104555, 'done', tp[2]);
  add(bPolT, 18104556, 'done', tp[3]);
  add(bPolT, 18104557, 'done', tp[4]);
  // POLICE Ordinance
  add(bPolO, 30215100, 'done', past(2));
  const to = todaySeq(2);
  add(bPolO, 30215101, 'done', to[0]);
  add(bPolO, 30215102, 'done', to[1]);
  // TRAFFIC
  add(bTra, 18104601, 'done', past(8));
  add(bTra, 18104602, 'done', past(2));
  const tt = todaySeq(2);
  add(bTra, 18104603, 'done', tt[0]);
  add(bTra, 18104604, 'done', tt[1]);
  // PSO (used up)
  add(bPso, 30215200, 'done', past(9));
  add(bPso, 30215201, 'done', past(6));
  add(bPso, 30215202, 'done', past(2));
  const ts = todaySeq(3);
  const r203 = add(bPso, 30215203, 'done', ts[0]);
  const k = vl.find(v => v.id === 'VL-0004');
  add(bPso, 30215204, 'voided', Math.round((ts[0] + ts[1]) / 2), {
    violations: ['O02'],
    violator: { first: k.first, middle: k.middle, last: k.last, suffix: k.suffix, birthday: k.birthday, sex: k.sex },
    photos: { form: samplePhoto('form', 30215204), id: null, violator: null, plate: null },
    incident: {
      paperNo: '30215203',
      text: 'The next form in the Booklet is also printed 30215203. I wrote the ticket on it before noticing.',
      hint: t('hintDuplicate', { p: 30215203, status: statusWord('done'), time: fDateTime(r203.at) }),
    },
  });
  add(bPso, 30215205, 'done', ts[2]);
  // CSU (used up)
  add(bCsu, 30215300, 'done', past(7));
  add(bCsu, 30215301, 'done', past(1));
  const tc = todaySeq(3);
  add(bCsu, 30215302, 'cancelled', tc[0]);
  add(bCsu, 30215303, 'done', tc[1]);
  add(bCsu, 30215304, 'done', tc[2]);

  // Paid samples: every second Done Citation from before today, paid by V001
  // one day after issue (never in the future), OR-7700120, OR-7700121, …
  let orN = 7700120;
  S.citations.filter(c => c.status === 'done' && c.at < dayStart).sort((a, b) => a.at - b.at)
    .forEach((c, i) => {
      if (i % 2 !== 1) return;
      const paidTs = Math.min(c.at + DAY, now);
      const date = dayKey(paidTs);
      const orNo = 'OR-' + orN++;
      c.payment = { orNo, date };
      c.payHistory = [{ action: 'paid', orNo, date, by: 'V001', at: paidTs }];
    });

  seedHistory(now);

  // Sign-ups waiting for approval. Kept in memory only, and skipped once the
  // Office Admin has approved or rejected them (that decision is saved with their id).
  [
    { id: 'R-SAMPLE-1', first: 'Jessa', middle: 'Villar', last: 'Obando', gender: 'F', rank: 'Patrolwoman', badge: 'PNP-05441',
      contact: '+639171234531', address: '27 Mabini Avenue, Barangay Central, Sample City', createdAt: now - DAY - 5 * 3600000 },
    { id: 'R-SAMPLE-2', first: 'Leonardo', middle: 'Pineda', last: 'Quijano', gender: 'M', rank: 'Patrolman', badge: 'PNP-05458',
      contact: '+639171234532', address: '15 Rizal Street, Barangay Dahican, Sample City', createdAt: now - 3 * 3600000 },
    // No office picked: only the Super Admin sees this one (e.g. to approve as Verifier).
    { id: 'R-SAMPLE-3', first: 'Rowena', middle: 'Lim', last: 'Sarmiento', gender: 'F', rank: '', badge: '', agency: '',
      contact: '+639171234533', address: '8 Quezon Street, Barangay Poblacion, Sample City', createdAt: now - 2 * 3600000 },
  ].forEach(r => {
    if (S.registrations.some(x => x.id === r.id)) return;
    S.registrations.push({ suffix: '', agency: 'POLICE', ...r, status: 'pending', reason: '', registeredAt: r.createdAt, history: [] });
  });
}

// ------------------------------------------------------------------ sample history
// Made-up activity for the last ~75 days so the Overview, charts and Booklets
// have something to show. Deterministic: the same data on every load.
function rng(seedN) {
  let a = seedN >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// Busy spots around Mati City, weighted by how often Citations happen there.
const MATI_SPOTS = [
  { lat: 6.9575, lng: 126.2160, w: 9, r: 0.002 },   // public market and downtown
  { lat: 6.9600, lng: 126.2115, w: 6, r: 0.002 },   // plaza and Rizal Street
  { lat: 6.9620, lng: 126.2250, w: 5, r: 0.0025 },  // national highway, Sainz
  { lat: 6.9475, lng: 126.2330, w: 3, r: 0.002 },   // Matiao
  { lat: 6.9455, lng: 126.2620, w: 3, r: 0.003 },   // Dahican beach road
  { lat: 6.9680, lng: 126.2075, w: 2, r: 0.003 },   // Central
  { lat: 6.9750, lng: 126.2350, w: 1, r: 0.004 },   // inland barangays
];
function matiGps(rnd) {
  const total = MATI_SPOTS.reduce((n, p) => n + p.w, 0);
  let pick = rnd() * total;
  const spot = MATI_SPOTS.find(p => (pick -= p.w) < 0) || MATI_SPOTS[0];
  const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5; // rough bell curve, -1..1
  return { lat: +(spot.lat + g() * spot.r).toFixed(6), lng: +(spot.lng + g() * spot.r).toFixed(6) };
}

const FIRSTS = ['Antonio', 'Bea', 'Cesar', 'Dina', 'Efren', 'Fe', 'Gilbert', 'Hazel', 'Ismael', 'Jenny', 'Karlo', 'Lorna', 'Manuel', 'Nina', 'Oscar', 'Pia', 'Romeo', 'Sheila', 'Teodoro', 'Vilma', 'Wilfredo', 'Yolanda', 'Arnel', 'Cristina', 'Danilo', 'Edna', 'Fernando', 'Gemma', 'Herminio', 'Imelda'];
const LASTS = ['Abella', 'Bacani', 'Cabrera', 'Dacanay', 'Espino', 'Fajardo', 'Galang', 'Hidalgo', 'Ilagan', 'Jimenez', 'Lacson', 'Macaraeg', 'Nepomuceno', 'Ocampo', 'Pascual', 'Quiambao', 'Rosales', 'Salazar', 'Tolentino', 'Umali', 'Valdez', 'Yap', 'Zamora', 'Belmonte', 'Corpuz', 'Dimaculangan', 'Estrada', 'Francisco', 'Guevarra', 'Lagman'];
const MIDDLES = ['', 'Santos', 'Cruz', 'Ramos', 'Diaz', 'Gomez', 'Lopez', 'Rivera'];

function seedHistory(now) {
  const DAY = 86400000;
  const rnd = rng(42);
  const monthStart = startOfMonth(now);
  const pickOf = a => a[Math.floor(rnd() * a.length)];
  const nextNo = { TRAFFIC: 18103000, ORD: 30214000 };
  const people = [];
  let vlN = 100;
  let orN = 7600100;
  const newPerson = () => {
    const y = 1960 + Math.floor(rnd() * 46), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
    const p = {
      id: 'VL-' + String(++vlN).padStart(4, '0'), first: pickOf(FIRSTS), middle: pickOf(MIDDLES), last: pickOf(LASTS), suffix: '',
      birthday: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, sex: rnd() < 0.62 ? 'M' : 'F',
    };
    S.violators.push(p);
    people.push(p);
    return p;
  };
  // About one in six Citations goes to someone already cited: the Repeat Violators.
  const violatorFor = () => (people.length > 8 && rnd() < 0.17 ? pickOf(people) : newPerson());
  const INCIDENTS = [
    'The form tore while I was writing it, so I used the next form instead.',
    'Rain soaked the form and the writing could no longer be read.',
    'I wrote the wrong Citation Type on this form and started over on the next one.',
  ];

  // [Enforcer, Citation Type, forms per day, days since last activity (null: history
  // ends before this month because the original sample already covers it), share of
  // this month's forms that are spoiled (true: one in three)]
  const PLAN = [
    ['E001', 'TRAFFIC', 0.55, null, 0], ['E001', 'ORD', 0.3, null, 0],
    ['E002', 'TRAFFIC', 0.7, null, 0],
    ['E003', 'ORD', 0.5, null, 0],
    ['E004', 'ORD', 0.45, null, 0],
    ['E005', 'TRAFFIC', 0.9, 0, 0], ['E005', 'ORD', 0.35, 0, 0],
    ['E006', 'TRAFFIC', 0.6, 12, 0],
    ['E007', 'TRAFFIC', 1.4, 0, true],
    ['E008', 'TRAFFIC', 0.8, 0, 0],
    ['E009', 'ORD', 0.75, 0, 0],
    ['E010', 'ORD', 0.6, 0, 0],
    // More Police Enforcers so the Overview's Needs attention list is long enough to scroll:
    // eight who stopped issuing Citations, four with many spoiled forms this month.
    ['E011', 'TRAFFIC', 0.6, 8, 0], ['E012', 'ORD', 0.5, 11, 0], ['E013', 'TRAFFIC', 0.7, 15, 0], ['E014', 'ORD', 0.4, 19, 0],
    ['E015', 'TRAFFIC', 0.5, 23, 0], ['E016', 'ORD', 0.45, 27, 0], ['E017', 'TRAFFIC', 0.6, 33, 0], ['E018', 'ORD', 0.5, 40, 0],
    ['E019', 'TRAFFIC', 1.8, 0, 0.5], ['E020', 'TRAFFIC', 1.6, 0, 0.4], ['E021', 'ORD', 2, 0, 0.3], ['E022', 'TRAFFIC', 2.2, 0, 0.25],
  ];
  const SIZE = 25;
  PLAN.forEach(([owner, ctype, perDay, idleDays, spoilShare]) => {
    const ag = agencyOf(owner);
    const pool = ag.violationTypes.filter(id => S.vt.get(id).citationType === ctype);
    // Their current Booklets stay the active ones, so the history fills whole Booklets only.
    const keepsCurrent = idleDays === null;
    const start = now - 75 * DAY;
    const end = keepsCurrent ? startOfMonth(now) - 3600000 : now - idleDays * DAY - 3600000;
    let count = Math.max(1, Math.round((end - start) / DAY * perDay));
    if (keepsCurrent) count = Math.max(SIZE, Math.round(count / SIZE) * SIZE);
    else if (count % SIZE === 0) count++; // keep one Booklet in hand
    const times = Array.from({ length: count }, () => start + rnd() * (end - start))
      .map(ts => { const d = new Date(ts); d.setHours(7 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0); return Math.min(d.getTime(), end); })
      .sort((a, b) => a - b);
    let b = null;
    let spoilN = 0;
    const share = spoilShare === true ? 1 / 3 : spoilShare;
    times.forEach((at, i) => {
      if (i % SIZE === 0) {
        const from = nextNo[ctype];
        nextNo[ctype] += SIZE;
        b = { id: `B-${ctype}-${from}`, owner, ctype, from, to: from + SIZE - 1, at: at - DAY };
        S.booklets.push(b);
      }
      const no = b.from + (i % SIZE);
      const r = rnd();
      // A planned share of spoiled forms this month is fixed (every third form), not left to chance.
      const spoiledMonth = spoilShare && at >= monthStart;
      if (spoiledMonth) spoilN++;
      const spoiledNow = spoiledMonth && Math.floor(spoilN * share) > Math.floor((spoilN - 1) * share);
      const status = spoiledMonth ? (spoiledNow ? (spoilN % 2 ? 'voided' : 'cancelled') : 'done')
        : r < 0.075 ? 'cancelled' : r < 0.1 ? 'voided' : 'done';
      const rec = {
        no, owner, ctype, bookletId: b.id, status, at, synced: true,
        violations: [], photos: { form: null, id: null, violator: null, plate: null }, noId: false,
        violator: { first: '', middle: '', last: '', suffix: '', birthday: '', sex: '' },
        violatorId: null, gps: null, incident: null, payment: null, payHistory: [],
      };
      if (status === 'done') {
        const n = rnd() < 0.35 ? 2 : 1;
        rec.violations = [...new Set(Array.from({ length: n }, () => pickOf(pool)))];
        const p = violatorFor();
        rec.violator = { first: p.first, middle: p.middle, last: p.last, suffix: p.suffix, birthday: p.birthday, sex: p.sex };
        rec.violatorId = p.id;
        rec.noId = rnd() < 0.2;
        rec.photos.form = samplePhoto('form', no);
        if (!rec.noId) rec.photos.id = samplePhoto('id', no);
        rec.photos.violator = samplePhoto('violator', no);
        if (S.ct.get(ctype).needsPlatePhoto) rec.photos.plate = samplePhoto('plate', no);
        rec.gps = matiGps(rnd);
        // Older Citations are more likely to be Paid already.
        const age = (now - at) / DAY;
        if (rnd() < (age > 30 ? 0.7 : age > 7 ? 0.5 : 0.25)) {
          const paidTs = Math.min(at + (1 + Math.floor(rnd() * 9)) * DAY, now - 60000);
          const date = dayKey(paidTs);
          const orNo = 'OR-' + orN++;
          rec.payment = { orNo, date };
          rec.payHistory = [{ action: 'paid', orNo, date, by: 'V001', at: paidTs }];
        }
      } else if (status === 'cancelled') {
        if (rnd() < 0.5) rec.violations = [pickOf(pool)];
        rec.photos.form = samplePhoto('form', no);
      } else {
        rec.violations = [pickOf(pool)];
        rec.photos.form = samplePhoto('form', no);
        rec.incident = { paperNo: String(no), text: pickOf(INCIDENTS), hint: '' };
      }
      S.citations.push(rec);
    });
  });
}
