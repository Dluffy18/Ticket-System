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
function enforcerFromJson(e) {
  const o = S.statusOverrides[e.id] || {};
  return {
    ...e, kind: 'enforcer', source: 'json',
    status: o.status || 'active', reason: o.reason || '', history: o.history || [], registeredAt: null,
  };
}
function enforcerFromReg(r) {
  return { ...r, kind: 'enforcer', source: 'reg' };
}

// Registrations, newest per full name (a re-registration replaces a rejected one).
function liveRegistrations() {
  const byName = new Map();
  [...S.registrations].sort((a, b) => a.createdAt - b.createdAt).forEach(r => byName.set(normName(fullName(r)), r));
  return [...byName.values()];
}

export function allEnforcers() {
  return [...S.ref.enforcers.map(enforcerFromJson), ...liveRegistrations().map(enforcerFromReg)];
}
export function allAccounts() {
  const admins = S.ref.admins.map(a => ({ ...a, kind: a.role === 'verifier' ? 'verifier' : 'office', status: 'active', source: 'json' }));
  return [...allEnforcers(), ...admins];
}
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
  const stored = S.passwords[acc.id] || (acc.source === 'reg' ? acc : null);
  if (!stored) return true;
  return (await hashPassword(stored.salt, password)) === stored.hash;
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
  if (!S.ag.has(f.agency)) err.agency = t('errAgencyRequired');
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
    gender: f.gender, agency: f.agency, rank: f.rank.trim(), badge: f.badge.trim(),
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

export function changeStatus(adminId, enforcerId, to, reason = '') {
  const admin = S.admins.get(adminId);
  const e = enforcer(enforcerId);
  if (!admin || admin.role !== 'office' || !e || e.agency !== admin.agency) return { error: t('errNotYourAgency') };
  const action = MOVES[`${e.status}>${to}`];
  if (!action) return { error: 'Not allowed.' };
  reason = to === 'rejected' ? String(reason || '').trim().slice(0, 200) : '';
  const entry = { action, by: adminId, at: Date.now(), reason };
  if (e.source === 'reg') {
    const r = S.registrations.find(x => x.id === enforcerId);
    r.status = to; r.reason = reason; r.history = [...(r.history || []), entry];
    lsSet(LS_REG, S.registrations);
  } else {
    const o = S.statusOverrides[enforcerId] || { history: [] };
    o.status = to; o.reason = reason; o.history = [...(o.history || []), entry];
    S.statusOverrides[enforcerId] = o;
    lsSet(LS_STATUS, S.statusOverrides);
  }
  const name = displayName(e);
  const msg = { approved: 'msgApproved', rejected: 'msgRejected', inactive: 'msgInactive', active: 'msgActive' }[action];
  emit('accounts');
  return { ok: true, message: t(msg, { name }) };
}

// ------------------------------------------------------------------ reference helpers
export function agencyOf(enfId) { const e = enforcer(enfId); return e ? S.ag.get(e.agency) : null; }
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
  const gpsNear = (i) => ({ lat: +(10.3157 + ((i * 37) % 100 - 50) / 10000).toFixed(6), lng: +(123.8854 + ((i * 53) % 100 - 50) / 10000).toFixed(6) });
  const add = (b, no, status, at, opts = {}) => {
    const ag = S.ag.get(enforcer(b.owner).agency);
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
}
