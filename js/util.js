// Small shared helpers: escaping, names, dates, hashing.

export const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Names compare ignoring capitals, dots and extra spaces.
export function normName(s) {
  return String(s ?? '').toLowerCase().replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

export function displayName(p) {
  return [p.first, p.last, p.suffix].filter(Boolean).join(' ');
}
export function fullName(p) {
  return [p.first, p.middle, p.last, p.suffix].filter(Boolean).join(' ');
}

// Every way a person may type their name at sign-in.
export function nameVariants(p) {
  const out = new Set();
  for (const mid of [p.middle, '']) {
    for (const suf of [p.suffix, '']) {
      out.add(normName([p.first, mid, p.last, suf].filter(Boolean).join(' ')));
    }
  }
  return out;
}

// ---- Dates (all local time) ----
const pad = n => String(n).padStart(2, '0');
export function dayKey(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function monthKey(d) { return dayKey(d).slice(0, 7); }
export function todayKey() { return dayKey(Date.now()); }
export function isToday(ts) { return dayKey(ts) === todayKey(); }
export function isThisMonth(ts) { return monthKey(ts) === monthKey(Date.now()); }
export function startOfDay(ts = Date.now()) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function startOfMonth(ts = Date.now()) { const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function parseDayKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
  return d;
}
export function addDaysKey(k, n) {
  const d = parseDayKey(k); d.setDate(d.getDate() + n); return dayKey(d);
}

const fmtDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
export function fDate(ts) { return fmtDate.format(new Date(ts)); }
export function fTime(ts) { return fmtTime.format(new Date(ts)); }
export function fDateTime(ts) { return `${fDate(ts)} · ${fTime(ts)}`; }
export function fDayKey(k) { const d = parseDayKey(k); return d ? fDate(d) : k; }
const fmtMonth = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });
export function fMonthKey(k) { const [y, m] = k.split('-').map(Number); return y && m ? fmtMonth.format(new Date(y, m - 1, 1)) : k; }

// ---- Phone ----
// Accepts 09XXXXXXXXX or +639XXXXXXXXX with spaces/dashes. Returns +639… or null.
export function normPhone(s) {
  const raw = String(s ?? '').replace(/[\s-]/g, '');
  if (/^09\d{9}$/.test(raw)) return '+63' + raw.slice(1);
  if (/^\+639\d{9}$/.test(raw)) return raw;
  return null;
}
export function fPhone(p) {
  const m = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(p || '');
  return m ? `+63 ${m[1]} ${m[2]} ${m[3]}` : (p || '');
}

// ---- Hashing: salted SHA-256 ----
// crypto.subtle only exists on https/localhost, so a small fallback keeps
// phone testing over a LAN address working.
function sha256Fallback(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, bitLen = l * 8;
  const total = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 4, bitLen >>> 0); dv.setUint32(total - 8, Math.floor(bitLen / 2 ** 32));
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15], 7) ^ rotr(w[j-15], 18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2], 17) ^ rotr(w[j-2], 19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(bytes);
}

export function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(salt, password) { return sha256Hex(salt + ':' + password); }

// ---- Storage (never fatal) ----
export function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep in memory */ }
}
export function ssGet(key, fallback) {
  try { const v = sessionStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function ssSet(key, value) {
  try { if (value == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// CSV download. Cells that start like a spreadsheet formula get a leading ' so they stay text.
export function downloadCsv(filename, header, rows) {
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const text = '\uFEFF' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// 2026-11-04 14:05, for files.
export function isoDateTime(ts) {
  const d = new Date(ts);
  return `${dayKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
