// Heatmap: where Issued Citations happen, drawn as heat only (no pins, no names).
// The map only ever receives area totals from areaTotals(), never single Citations,
// so a server can later send just those totals.
import { t, tn } from '../strings.js';
import { esc, monthKey, fMonthKey, isToday } from '../util.js';
import { S, me, allEnforcers, MATI_CENTER } from '../store.js';
import { icon } from '../ui.js';

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const HEAT_JS = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
// Map images. OpenStreetMap's tile server is fine for a prototype only; change this before going live.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CELL = 0.0025;        // area size in degrees, about 280 m
const MAX_ZOOM = 16;        // about street level; no single house can be picked out
const OFFICE_MIN = 3;       // Office Admin map: areas with fewer Citations aren't drawn

// Issued Citations with a location, counted per area. Returns [{ lat, lng, n }].
export function areaTotals(list, minCount = 1) {
  const cells = new Map();
  list.forEach(c => {
    if (c.status !== 'done' || !c.gps) return;
    const i = Math.floor(c.gps.lat / CELL), j = Math.floor(c.gps.lng / CELL);
    const k = i + ':' + j;
    const cell = cells.get(k) || { lat: (i + 0.5) * CELL, lng: (j + 0.5) * CELL, n: 0 };
    cell.n++;
    cells.set(k, cell);
  });
  return [...cells.values()].filter(c => c.n >= minCount);
}

let loading = null;
function loadLeaflet() {
  if (window.L?.heatLayer) return Promise.resolve();
  if (loading) return loading;
  const script = src => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = LEAFLET_CSS; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
  loading = (window.L ? Promise.resolve() : script(LEAFLET_JS)).then(() => script(HEAT_JS)).catch(e => { loading = null; throw e; });
  return loading;
}

const hm = { period: 'month', agency: '', ctype: '' };

export function heatmapView(root, ctx) {
  const u = me();
  const office = u.kind === 'office';
  const ag = office ? S.ag.get(u.agency) : null;
  const ctypes = office ? ag.citationTypes.map(id => S.ct.get(id)) : S.ref.citationTypes;
  if (office) { hm.period = 'month'; hm.agency = ''; }
  if (hm.ctype && !ctypes.some(c => c.id === hm.ctype)) hm.ctype = '';
  const months = [...new Set(S.citations.map(c => monthKey(c.at)))].sort().reverse().filter(m => m !== monthKey(Date.now()));
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel === v ? 'selected' : ''}>${esc(label)}</option>`;

  // One screen: title and filters share a row, the count and color scale sit on the map.
  root.innerHTML = `
  <div class="sm hm">
    <header class="hm-head">
      <div><h1 class="h1 sm-title">${esc(t('heatmapTitle'))}</h1>
        <p class="lead">${esc(office ? t('heatmapLeadOffice', { agency: ag.name }) : t('heatmapLead'))}</p></div>
      <div class="hm-filters">
        ${office ? `<div class="field"><span class="lbl">${esc(t('period'))}</span><p class="hm-fixed">${esc(t('thisMonth'))}</p></div>` : `
        <label class="field"><span class="lbl">${esc(t('period'))}</span><select class="input" name="period">${opt('today', t('today'), hm.period)}${opt('month', t('thisMonth'), hm.period)}${months.map(m => opt(m, fMonthKey(m), hm.period)).join('')}</select></label>
        <label class="field"><span class="lbl">${esc(t('agency'))}</span><select class="input" name="agency">${opt('', t('allAgencies'), hm.agency)}${S.ref.agencies.map(a => opt(a.id, a.name, hm.agency)).join('')}</select></label>`}
        <label class="field"><span class="lbl">${esc(t('citationType'))}</span><select class="input" name="ctype">${opt('', t('allTypes'), hm.ctype)}${ctypes.map(c => opt(c.id, c.name, hm.ctype)).join('')}</select></label>
      </div>
    </header>
    <section class="hm-card">
      <div class="hm-map" data-map role="img" aria-label="${esc(t('heatmapAlt'))}"></div>
      <p class="hm-badge hm-count" aria-live="polite" data-count></p>
      <div class="hm-badge hm-legend">
        <span class="hm-scale"><span>${esc(t('fewer'))}</span><i aria-hidden="true"></i><span>${esc(t('more'))}</span></span>
        ${office ? `<span class="hm-note">${esc(t('heatmapNoteOffice', { n: OFFICE_MIN }))}</span>` : ''}
      </div>
    </section>
  </div>`;

  const box = root.querySelector('[data-map]');
  const countEl = root.querySelector('[data-count]');
  let map = null, layer = null, dead = false;

  const pick = () => {
    const owners = office ? new Set(allEnforcers().filter(e => e.agency === u.agency).map(e => e.id)) : null;
    const agencyOwners = !office && hm.agency ? new Set(allEnforcers().filter(e => e.agency === hm.agency).map(e => e.id)) : null;
    const thisMonth = monthKey(Date.now());
    return S.citations.filter(c => {
      if (owners && !owners.has(c.owner)) return false;
      if (agencyOwners && !agencyOwners.has(c.owner)) return false;
      if (hm.ctype && c.ctype !== hm.ctype) return false;
      if (hm.period === 'today') return isToday(c.at);
      return monthKey(c.at) === (hm.period === 'month' ? thisMonth : hm.period);
    });
  };
  const draw = () => {
    const cells = areaTotals(pick(), office ? OFFICE_MIN : 1);
    const total = cells.reduce((n, c) => n + c.n, 0);
    countEl.textContent = total ? tn('onMapN', total) : t('onMapNone');
    if (!layer) return;
    const max = Math.max(3, ...cells.map(c => c.n));
    layer.setOptions({ max });
    layer.setLatLngs(cells.map(c => [c.lat, c.lng, c.n]));
  };
  const showMessage = (key) => {
    box.innerHTML = `<div class="hm-msg">${icon('wifiOff')}<p>${esc(t(key))}</p></div>`;
    box.classList.add('is-msg');
  };

  root.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => { hm[sel.name] = sel.value; draw(); }));
  draw();

  if (!S.online) showMessage('mapOffline');
  else {
    box.innerHTML = `<div class="hm-msg"><p>${esc(t('mapLoading'))}</p></div>`;
    loadLeaflet().then(() => {
      if (dead) return;
      box.innerHTML = '';
      const L = window.L;
      map = L.map(box, { minZoom: 11, maxZoom: MAX_ZOOM, zoomControl: true, scrollWheelZoom: false })
        .setView([MATI_CENTER.lat, MATI_CENTER.lng], 13);
      L.tileLayer(TILES, { maxZoom: MAX_ZOOM, attribution: TILE_CREDIT }).addTo(map);
      layer = L.heatLayer([], { radius: 28, blur: 22, maxZoom: 14, minOpacity: 0.35,
        gradient: { 0.2: '#2b83ba', 0.45: '#abdda4', 0.65: '#ffffbf', 0.8: '#fdae61', 1: '#d7191c' } }).addTo(map);
      draw();
    }).catch(() => { if (!dead) showMessage('mapOffline'); });
  }
  ctx.onLeave(() => { dead = true; if (map) map.remove(); });
}
