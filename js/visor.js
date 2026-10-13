/* =========================================================
   Visor UGA · POEL Atoyac de Álvarez, Guerrero
   Leaflet 1.9.4 · datos en /data/*.js (GeoJSON WGS84)
   ========================================================= */
(function () {
'use strict';

/* ---------------- Datos ---------------- */
const CAT = window.CATALOGOS, UG = window.UGAS, EJ = window.EJIDOS, LO = window.LOCALIDADES;
const USOS = CAT.usos;                         // [[clave, descripción], …] — mismo orden que props.u
const fmt = (n, d = 0) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const $ = s => document.querySelector(s);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* ---------------- Simbología ---------------- */
const COL = { ugaLine: '#98E600', guinda: '#611232', guinda2: '#8E1D3F', dorado: '#A57F2C', cafe: '#32260D', compat: '#8FD16A', incompat: '#C9500E', ejido: '#E8740C', loc: '#FFD400' };
const POL = {
  'Aprovechamiento sustentable': { c: '#F2D33B', fill: '#F2D33B' },
  'Preservación':               { c: '#A6D96A', fill: '#A6D96A' },
  'Protección':                 { c: '#1E6B38', fill: '#1E6B38' },
  'Protección-ADVC':            { c: '#1E6B38', fill: 'url(#p-advc)', pat: 'advc', label: 'Protección ADVC' },
  'Protección-ANP':             { c: '#1E6B38', fill: 'url(#p-anp)', pat: 'anp', label: 'Protección ANP' },
  'Restauración':               { c: '#8C5A2B', fill: '#8C5A2B' }
};
const POL_ORDER = Object.keys(POL);
const polLabel = p => (POL[p] && POL[p].label) || p;

/* patrones SVG globales (referenciados por url(#id)) */
function patternDefs(prefix = 'p') {
  return `<pattern id="${prefix}-advc" patternUnits="userSpaceOnUse" width="9" height="9">
      <rect width="9" height="9" fill="#1E6B38"/><line x1="4.5" y1="0" x2="4.5" y2="9" stroke="#7B2FA8" stroke-width="2.4"/></pattern>
    <pattern id="${prefix}-anp" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)">
      <rect width="9" height="9" fill="#1E6B38"/><line x1="4.5" y1="0" x2="4.5" y2="9" stroke="#FF5FA8" stroke-width="2.4"/></pattern>`;
}
document.body.insertAdjacentHTML('afterbegin',
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${patternDefs('p')}${patternDefs('lg')}</defs></svg>`);

function swatch(pol, size = 18, shape = 'rect') {
  const P = POL[pol] || { fill: '#ccc' };
  const fill = P.pat ? `url(#lg-${P.pat})` : P.fill;
  return shape === 'circle'
    ? `<svg width="${size}" height="${size}" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${fill}" stroke="#fff" stroke-width="2"/></svg>`
    : `<svg width="${size + 4}" height="${size - 4}" viewBox="0 0 22 14"><rect x=".5" y=".5" width="21" height="13" rx="2" fill="${fill}" stroke="#3b2f22" stroke-width=".8"/></svg>`;
}

/* ---------------- Estado ---------------- */
const S = { theme: 'contorno', transp: 30, uso: null, sel: null, selEj: null, base: 'satref', show: { uga: true, ugaLbl: true, ej: false, ejLbl: true, loc: false, locLbl: true } };

/* ---------------- Mapa ---------------- */
const map = L.map('map', { zoomControl: true, minZoom: 8, maxZoom: 19, zoomSnap: 0.25, attributionControl: true });
map.createPane('ugaPane').style.zIndex = 410;
map.createPane('ejPane').style.zIndex = 430;
map.createPane('locPane').style.zIndex = 460;
map.createPane('labelPane').style.zIndex = 620;
map.getPane('labelPane').style.pointerEvents = 'none';
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

const BASES = {
  osm: { name: 'Referencia (OpenStreetMap)', layers: [L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' })] },
  sat: { name: 'Imagen de satélite', sat: true, layers: [L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagen &copy; Esri, Maxar, Earthstar Geographics' })] },
  satref: { name: 'Satélite con referencias', sat: true, layers: [
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagen &copy; Esri' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 })] },
  none: { name: 'Sin mapa base', layers: [] }
};
function setBase(k) {
  Object.values(BASES).forEach(b => b.layers.forEach(l => map.hasLayer(l) && map.removeLayer(l)));
  BASES[k].layers.forEach(l => l.addTo(map));
  S.base = k;
  map.getContainer().classList.toggle('sat', !!BASES[k].sat);
}
setBase('satref');

/* ---------------- Capa UGA ---------------- */
const ugaById = new Map();
function ugaStyle(f) {
  const p = f.properties, op = 1 - S.transp / 100, sel = S.sel === p.id;
  let st;
  if (S.uso !== null) {
    const ok = p.u[S.uso] === '1';
    st = { fillColor: ok ? COL.compat : COL.incompat, fillOpacity: op, color: '#3b2f22', weight: .7, opacity: .85 };
  } else if (S.theme === 'politica') {
    const P = POL[p.pol] || { fill: '#bbb' };
    st = { fillColor: P.fill, fillOpacity: op, color: '#3b2f22', weight: .6, opacity: .8 };
  } else {
    st = { fillColor: '#ffffff', fillOpacity: 0, color: COL.ugaLine, weight: 1.7, opacity: Math.max(op, .08) };
  }
  if (sel) Object.assign(st, { color: COL.dorado, weight: 4.5, opacity: 1 });
  return st;
}
const ugaLayer = L.geoJSON(UG, {
  pane: 'ugaPane',
  style: ugaStyle,
  onEachFeature(f, layer) {
    ugaById.set(f.properties.id, { f, layer });
    layer.on({
      click: e => { L.DomEvent.stopPropagation(e); selectUga(f.properties.id, { latlng: e.latlng }); },
      mouseover: () => { if (S.sel !== f.properties.id) layer.setStyle({ weight: (ugaStyle(f).weight || 1) + 1.5 }); },
      mouseout: () => layer.setStyle(ugaStyle(f))
    });
  }
}).addTo(map);
const restyle = () => ugaLayer.eachLayer(l => l.setStyle(ugaStyle(l.feature)));

/* ---------------- Capa Ejidos ---------------- */
const ejByName = new Map();
function ejStyle(f) {
  const sel = S.selEj === f.properties.n;
  return { color: COL.ejido, weight: sel ? 4 : 2, opacity: 1, fill: sel, fillColor: COL.ejido, fillOpacity: .12, dashArray: sel ? null : '6 3' };
}
const ejLayer = L.geoJSON(EJ, {
  pane: 'ejPane', style: ejStyle,
  onEachFeature(f, layer) {
    ejByName.set(f.properties.n, { f, layer });
    layer.on('click', e => { L.DomEvent.stopPropagation(e); selectEjido(f.properties.n, { latlng: e.latlng, noZoom: true }); });
  }
});

/* ---------------- Capa Localidades ---------------- */
const locRad = p => p >= 10000 ? 8 : p >= 2500 ? 6.5 : p >= 500 ? 5.2 : p >= 100 ? 4.2 : 3.4;
const locs = [];
const locLayer = L.geoJSON(LO, {
  pane: 'locPane',
  pointToLayer: (f, ll) => L.circleMarker(ll, { pane: 'locPane', radius: locRad(f.properties.pob || 0), color: '#4a3a12', weight: 1.3, fillColor: COL.loc, fillOpacity: 1 }),
  onEachFeature(f, layer) {
    locs.push({ f, layer });
    layer.on('click', e => { L.DomEvent.stopPropagation(e); openLocPopup(f, layer); });
  }
});

/* ---------------- Etiquetas con jerarquía (declutter) ---------------- */
const labels = [];
function addLabel(latlng, text, group, prio, minZ, cls = '') {
  const m = L.marker(latlng, {
    pane: 'labelPane', interactive: false, keyboard: false,
    icon: L.divIcon({ className: 'lbl-anchor', iconSize: [0, 0], html: `<span class="lbl lbl-${group} ${cls}">${esc(text)}</span>` })
  }).addTo(map);
  labels.push({ m, group, prio, minZ, ll: L.latLng(latlng), w: 0, h: 0, text });
}
UG.features.forEach(f => addLabel([f.properties.lx[1], f.properties.lx[0]], f.properties.id, 'uga',
  1000 + Math.log10(f.properties.hac + 1) * 10, f.properties.hac < 3 ? 14 : f.properties.hac < 25 ? 12.5 : 0));
LO.features.forEach(f => {
  const p = f.properties.pob || 0;
  addLabel([f.geometry.coordinates[1], f.geometry.coordinates[0]], f.properties.n, 'loc', 500 + Math.log10(p + 1) * 10,
    p >= 5000 ? 0 : p >= 1000 ? 11 : p >= 250 ? 12 : p >= 50 ? 13 : 14, p >= 2500 ? 'big' : '');
});
EJ.features.forEach(f => addLabel([f.properties.lx[1], f.properties.lx[0]], f.properties.n, 'ej', 100 + Math.log10(f.properties.ha + 1) * 10,
  f.properties.ha > 3000 ? 10.5 : f.properties.ha > 800 ? 11.5 : 12.5));
labels.sort((a, b) => b.prio - a.prio);
const groupOn = g => g === 'uga' ? (S.show.uga && S.show.ugaLbl) : g === 'ej' ? (S.show.ej && S.show.ejLbl) : (S.show.loc && S.show.locLbl);

function declutter() {
  const z = map.getZoom(), size = map.getSize(), placed = [], pad = 3;
  for (const L_ of labels) {
    const span = L_.m.getElement() && L_.m.getElement().firstChild;
    if (!span) continue;
    let show = groupOn(L_.group) && z >= L_.minZ;
    if (show) {
      const pt = map.latLngToContainerPoint(L_.ll);
      if (pt.x < -50 || pt.y < -20 || pt.x > size.x + 50 || pt.y > size.y + 20) show = false;
      else {
        if (!L_.w) { span.style.display = ''; L_.w = span.offsetWidth || String(L_.text).length * 7; L_.h = span.offsetHeight || 13; }
        const x0 = L_.group === 'loc' ? pt.x + 7 : pt.x - L_.w / 2, y0 = pt.y - L_.h / 2;
        const box = [x0 - pad, y0 - pad, x0 + L_.w + pad, y0 + L_.h + pad];
        for (const b of placed) if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) { show = false; break; }
        if (show) placed.push(box);
      }
    }
    span.style.display = show ? '' : 'none';
  }
}
map.on('zoomend moveend resize', declutter);

/* ---------------- Encabezado ---------------- */
$('#verModelo').textContent = (UG.features[0].properties.ver || '').split('-').reverse().join('/');

/* ---------------- Controles de mapa ---------------- */
const Home = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const d = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-home');
    d.innerHTML = `<a href="#" title="Vista completa del municipio" role="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 11 12 3l9 8M5 9.5V21h14V9.5"/></svg></a>`;
    L.DomEvent.on(d, 'click', e => { L.DomEvent.preventDefault(e); fitAll(); });
    L.DomEvent.disableClickPropagation(d);
    return d;
  }
});
map.addControl(new Home());

const Layers = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const d = L.DomUtil.create('div', 'leaflet-control lyr-ctrl');
    const sw = (id, label, on, color, extra = '') => `<label><span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span>${color ? `<i class="sw" style="${color}"></i>` : ''}${label}${extra}</label>`;
    const ck = (id, label, on) => `<label class="sub"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
    d.innerHTML = `<button class="lyr-btn" id="lyrBtn" aria-expanded="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>Capas</button>
      <div class="lyr-panel hidden" id="lyrPanel">
        <h5>Capas temáticas</h5>
        ${sw('lyUga', 'Unidades de Gestión Ambiental', true, 'border:2px solid #98E600;background:#fff')}
        ${ck('lyUgaLbl', 'Número de UGA', true)}
        ${sw('lyEj', 'Ejidos (RAN)', false, 'border:2px dashed #E8740C;background:#fff')}
        ${ck('lyEjLbl', 'Nombres de ejidos', true)}
        ${sw('lyLoc', 'Localidades ITER', false, 'background:#FFD400;border:1.5px solid #4a3a12;border-radius:50%;width:12px;flex-basis:12px')}
        ${ck('lyLocLbl', 'Nombres de localidades', true)}
        <h5>Mapa base</h5>
        ${Object.entries(BASES).map(([k, b]) => `<label><input type="radio" name="base" value="${k}" ${k === S.base ? 'checked' : ''}> ${b.name}</label>`).join('')}
      </div>`;
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    return d;
  }
});
map.addControl(new Layers());
$('#lyrBtn').addEventListener('click', () => { const p = $('#lyrPanel'); p.classList.toggle('hidden'); $('#lyrBtn').setAttribute('aria-expanded', !p.classList.contains('hidden')); });
function toggleLayer(layer, on) { on ? (map.hasLayer(layer) || layer.addTo(map)) : map.removeLayer(layer); }
const bindSw = (id, key, layer) => $(id).addEventListener('change', e => { S.show[key] = e.target.checked; if (layer) toggleLayer(layer, e.target.checked); declutter(); renderLegend(); });
bindSw('#lyUga', 'uga', ugaLayer); bindSw('#lyUgaLbl', 'ugaLbl');
bindSw('#lyEj', 'ej', ejLayer); bindSw('#lyEjLbl', 'ejLbl');
bindSw('#lyLoc', 'loc', locLayer); bindSw('#lyLocLbl', 'locLbl');
document.querySelectorAll('input[name=base]').forEach(r => r.addEventListener('change', e => setBase(e.target.value)));
function ensureOn(key, layer, id) { if (!S.show[key]) { S.show[key] = true; $(id).checked = true; toggleLayer(layer, true); } }

/* Tema y transparencia */
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('active', x === b));
  S.theme = b.dataset.theme;
  if (S.theme === 'politica' && S.transp === 30 && !S._touched) setTransp(15);
  restyle(); renderLegend();
}));
function setTransp(v) { S.transp = +v; $('#opRange').value = v; $('#opOut').textContent = v + '%'; restyle(); }
$('#opRange').addEventListener('input', e => { S._touched = true; setTransp(e.target.value); });
setTransp(30);

/* ---------------- Leyenda ---------------- */
function renderLegend() {
  const el = $('#legend');
  if (!S.show.uga && !S.show.ej && !S.show.loc) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  let h = '';
  if (S.show.uga) {
    if (S.uso !== null) {
      const [k, d] = USOS[S.uso];
      h += `<h4>Uso: ${esc(k)}</h4><div style="font-size:11.5px;margin:-2px 0 6px;color:#5E544B">${esc(cap(d))}</div>
        <div class="li">${box(COL.compat)} Compatible</div><div class="li">${box(COL.incompat)} Incompatible</div>`;
    } else if (S.theme === 'politica') {
      h += `<h4>Política ambiental</h4>` + POL_ORDER.map(p => `<div class="li">${swatch(p)} ${esc(polLabel(p))}</div>`).join('');
    } else {
      h += `<h4>Unidades de Gestión Ambiental</h4><div class="li"><svg width="22" height="14"><rect x="1" y="1" width="20" height="12" rx="2" fill="none" stroke="${COL.ugaLine}" stroke-width="2"/></svg> Límite de UGA</div>`;
    }
  }
  if (S.show.ej || S.show.loc) h += `<div class="sep"></div>`;
  if (S.show.ej) h += `<div class="li"><svg width="22" height="14"><rect x="1" y="1" width="20" height="12" rx="2" fill="none" stroke="${COL.ejido}" stroke-width="2" stroke-dasharray="5 2"/></svg> Ejido (RAN)</div>`;
  if (S.show.loc) h += `<div class="li"><svg width="22" height="14"><circle cx="11" cy="7" r="5" fill="${COL.loc}" stroke="#4a3a12" stroke-width="1.3"/></svg> Localidad ITER</div>`;
  el.innerHTML = h;
}
const box = c => `<svg width="22" height="14"><rect x=".5" y=".5" width="21" height="13" rx="2" fill="${c}" stroke="#3b2f22" stroke-width=".8"/></svg>`;

/* ---------------- Utilidades de vista ---------------- */
function padOpts() {
  const fichaOpen = $('#ficha').classList.contains('open') && window.innerWidth > 760;
  return { paddingTopLeft: [30, S.uso !== null ? 130 : 80], paddingBottomRight: [fichaOpen ? $('#ficha').offsetWidth + 30 : 30, 30] };
}
const ppOpts = (extra = {}) => Object.assign({ maxWidth: 300, autoPanPaddingTopLeft: [20, S.uso !== null ? 130 : 80], autoPanPaddingBottomRight: padOpts().paddingBottomRight }, extra);
function fitAll() { map.fitBounds(ugaLayer.getBounds(), padOpts()); }
function fitTo(bounds, maxZoom = 16) { map.flyToBounds(bounds, Object.assign({ maxZoom, duration: .6 }, padOpts())); }

/* ---------------- UGA: popup + selección ---------------- */
function supTxt(p) { return p.ha >= 1 ? `${fmt(p.ha)} ha` : `${fmt(p.hac, 2)} ha`; }
function ugaPopupHtml(p) {
  return `<div class="pp-head" style="border-bottom:4px solid ${(POL[p.pol] || {}).c || COL.dorado}">
      <div class="pp-t">UGA ${p.id}</div><div class="pp-s">${esc(p.cl)} · ${esc(p.lin)}</div>
      <span class="pp-pol">${swatch(p.pol, 16, 'circle')}${esc(polLabel(p.pol))}</span></div>
    <div class="pp-body"><table>
      <tr><td>ID UGA</td><td>${p.id} <span style="font-weight:500;color:#5E544B">(${esc(p.cl)})</span></td></tr>
      <tr><td>Superficie</td><td>${supTxt(p)}</td></tr>
      <tr><td>Política</td><td>${esc(polLabel(p.pol))}</td></tr>
      <tr><td>Población</td><td>${fmt(p.pob)} hab.</td></tr>
      <tr><td>Grupo</td><td style="font-weight:500">${esc(p.grp)}</td></tr>
      ${S.uso !== null ? `<tr><td>Uso ${esc(USOS[S.uso][0])}</td><td style="color:${p.u[S.uso] === '1' ? '#2f7d1a' : COL.incompat}">${p.u[S.uso] === '1' ? 'Compatible' : 'Incompatible'}</td></tr>` : ''}
    </table></div>
    <div class="pp-foot"><button class="btn btn-prim" data-ficha="${p.id}">Ver ficha completa</button></div>`;
}
function selectUga(id, o = {}) {
  const it = ugaById.get(+id); if (!it) return;
  if (!S.show.uga) ensureOn('uga', ugaLayer, '#lyUga');
  const prev = S.sel; S.sel = +id;
  if (prev && ugaById.get(prev)) ugaById.get(prev).layer.setStyle(ugaStyle(ugaById.get(prev).f));
  it.layer.setStyle(ugaStyle(it.f)); it.layer.bringToFront();
  if (o.zoom) fitTo(it.layer.getBounds());
  const ll = o.latlng || L.latLng(it.f.properties.lx[1], it.f.properties.lx[0]);
  if (!o.noPopup) {
    const open = () => L.popup(ppOpts())
      .setLatLng(ll).setContent(ugaPopupHtml(it.f.properties)).openOn(map);
    o.zoom ? map.once('moveend', open) : open();
  }
  markList('#listUga', id);
  if ($('#ficha').classList.contains('open') && o.ficha !== false) openFicha(+id, true);
  try { history.replaceState(null, '', '#uga=' + id); } catch (e) {}
}
map.on('click', () => { /* clic fuera: no se pierde la selección para mantener contexto */ });

/* ---------------- Ejidos ---------------- */
function selectEjido(name, o = {}) {
  const it = ejByName.get(name); if (!it) return;
  ensureOn('ej', ejLayer, '#lyEj');
  const prev = S.selEj; S.selEj = name;
  if (prev && ejByName.get(prev)) ejByName.get(prev).layer.setStyle(ejStyle(ejByName.get(prev).f));
  it.layer.setStyle(ejStyle(it.f)); it.layer.bringToFront();
  const p = it.f.properties;
  const nloc = LO.features.filter(f => f.properties.ejido === name);
  const pob = nloc.reduce((a, f) => a + (f.properties.pob || 0), 0);
  const html = `<div class="pp-head ej"><div class="pp-s" style="margin:0 0 3px;text-transform:uppercase;letter-spacing:.8px;font-size:10.5px">Núcleo agrario · RAN</div><div class="pp-t" style="font-size:16px;line-height:1.2">${esc(p.n)}</div></div>
    <div class="pp-body"><table>
      <tr><td>Superficie</td><td>${fmt(p.ha)} ha</td></tr>
      <tr><td>Localidades</td><td>${nloc.length} · ${fmt(pob)} hab.</td></tr>
      <tr><td>UGA (${p.ugas.length})</td><td><div class="ugachips" style="display:flex;flex-wrap:wrap;gap:4px">${p.ugas.map(u => `<button class="uchip" data-uga="${u}">${u}</button>`).join('')}</div></td></tr>
    </table></div><div style="height:8px"></div>`;
  const ll = o.latlng || L.latLng(p.lx[1], p.lx[0]);
  const open = () => L.popup(ppOpts()).setLatLng(ll).setContent(html).openOn(map);
  if (!o.noZoom) { fitTo(it.layer.getBounds(), 15); map.once('moveend', open); } else open();
  // caja en panel
  $('#ejResult').classList.remove('hidden');
  $('#ejResult').innerHTML = `<h3>${esc(p.n)}</h3><div style="margin-bottom:6px;color:#5E544B">${fmt(p.ha)} ha · ${nloc.length} localidades · ${p.ugas.length} UGA</div>
     <div class="ugachips">${p.ugas.map(u => `<button class="uchip" data-uga="${u}" title="${esc(ugaById.get(u).f.properties.pol)}">${u}</button>`).join('')}</div>
     <div style="margin-top:8px"><button class="btn-link" id="ejClear">Quitar selección</button></div>`;
  $('#ejClear').onclick = () => { const q = S.selEj; S.selEj = null; if (q) ejByName.get(q).layer.setStyle(ejStyle(ejByName.get(q).f)); $('#ejResult').classList.add('hidden'); markList('#listEj', null); map.closePopup(); };
  markList('#listEj', name);
}

/* ---------------- Localidades ---------------- */
function openLocPopup(f, layer) {
  const p = f.properties, u = p.uga && ugaById.get(p.uga);
  const html = `<div class="pp-head loc"><div class="pp-s" style="margin:0 0 3px;text-transform:uppercase;letter-spacing:.8px;font-size:10.5px">Localidad ITER · INEGI</div><div class="pp-t" style="font-size:16px;line-height:1.2">${esc(p.n)}</div></div>
    <div class="pp-body"><table>
      <tr><td>Clave</td><td>${esc(p.cve)}</td></tr>
      <tr><td>Población</td><td>${fmt(p.pob)} hab.</td></tr>
      <tr><td>Mujeres / Hombres</td><td>${fmt(p.fem)} / ${fmt(p.mas)}</td></tr>
      <tr><td>Altitud</td><td>${fmt(p.alt)} msnm</td></tr>
      <tr><td>Ejido</td><td>${esc(p.ejido) || '<span style="color:#5E544B;font-weight:500">Fuera de núcleo agrario</span>'}</td></tr>
      <tr><td>UGA</td><td>${u ? `<button class="uchip" data-uga="${p.uga}">UGA ${p.uga}</button> <span style="font-weight:500">${esc(polLabel(u.f.properties.pol))}</span>` : '—'}</td></tr>
    </table></div>
    <div class="pp-foot">${u ? `<button class="btn btn-sec" data-ficha="${p.uga}">Ficha de la UGA ${p.uga}</button>` : ''}</div>`;
  L.popup(ppOpts({ offset: [0, -4] })).setLatLng(layer.getLatLng()).setContent(html).openOn(map);
  markList('#listLoc', p.cve);
}
function selectLoc(cve) {
  const it = locs.find(x => x.f.properties.cve === cve); if (!it) return;
  ensureOn('loc', locLayer, '#lyLoc');
  map.flyTo(it.layer.getLatLng(), Math.max(map.getZoom(), 15), { duration: .6 });
  map.once('moveend', () => openLocPopup(it.f, it.layer));
}

/* ---------------- Uso de suelo (compatibilidad) ---------------- */
const usoStats = USOS.map((u, i) => {
  let c = 0, ha = 0;
  UG.features.forEach(f => { if (f.properties.u[i] === '1') { c++; ha += f.properties.hac; } });
  return { c, ha };
});
function setUso(i) {
  S.uso = (i === null || S.uso === i) ? null : i;
  restyle(); renderLegend();
  const box = $('#usoResult'), ban = $('#usoBanner');
  markList('#listUsos', S.uso === null ? null : String(S.uso));
  if (S.uso === null) { box.classList.add('hidden'); ban.classList.add('hidden'); return; }
  const [k, d] = USOS[S.uso], st = usoStats[S.uso];
  const comp = [], inc = [];
  UG.features.forEach(f => (f.properties.u[S.uso] === '1' ? comp : inc).push(f.properties.id));
  comp.sort((a, b) => a - b); inc.sort((a, b) => a - b);
  const haInc = CAT.sup_total - st.ha;
  box.classList.remove('hidden');
  box.innerHTML = `<h3>${esc(cap(d))} <span style="color:#846623">(${esc(k)})</span></h3>
    <div class="row"><div class="kpi c"><b>${comp.length}</b><span>UGA compatibles</span><div style="font-size:11px">${fmt(st.ha)} ha</div></div>
    <div class="kpi i"><b>${inc.length}</b><span>UGA incompatibles</span><div style="font-size:11px">${fmt(haInc)} ha</div></div></div>
    <div class="sublbl">UGA compatibles</div>
    <div class="ugachips">${comp.map(u => `<button class="uchip c" data-uga="${u}">${u}</button>`).join('') || '<em style="color:#5E544B">Ninguna</em>'}</div>
    <div style="margin-top:8px;display:flex;justify-content:space-between"><button class="btn-link" id="usoClear">Quitar filtro</button><button class="btn-link" id="usoFit">Ver compatibles</button></div>`;
  $('#usoClear').onclick = () => setUso(null);
  $('#usoFit').onclick = () => { if (!comp.length) return; const b = L.latLngBounds([]); comp.forEach(u => b.extend(ugaById.get(u).layer.getBounds())); fitTo(b, 15); };
  ban.classList.remove('hidden');
  ban.innerHTML = `<span class="bt">Uso: <b>${esc(cap(d))} (${esc(k)})</b></span><span class="bn"><span style="color:${COL.compat}">●</span> ${comp.length} &nbsp;<span style="color:#ff8a3d">●</span> ${inc.length}</span><button id="banClear">Quitar</button>`;
  $('#banClear').onclick = () => setUso(null);
}

/* ---------------- Listas del panel izquierdo ---------------- */
function markList(sel, key) {
  document.querySelectorAll(sel + ' li').forEach(li => li.classList.toggle('sel', key !== null && li.dataset.k === String(key)));
}
function renderUsos(q = '') {
  const nq = norm(q);
  const html = USOS.map(([k, d], i) => ({ k, d, i })).filter(o => !nq || norm(o.k + ' ' + o.d).includes(nq))
    .map(o => `<li data-k="${o.i}" class="${S.uso === o.i ? 'sel' : ''}"><span class="code">${esc(o.k)}</span><span class="txt"><b>${esc(cap(o.d))}</b></span><span class="num" title="UGA donde es compatible">${usoStats[o.i].c}/${CAT.n_ugas}</span></li>`).join('');
  $('#listUsos').innerHTML = html || '<li class="empty">Sin coincidencias</li>';
}
const polOn = new Set();
function renderPolFilter() {
  $('#polFilter').innerHTML = POL_ORDER.map(p => `<button data-p="${esc(p)}" class="${polOn.has(p) ? 'on' : ''}">${swatch(p, 12, 'circle')}${esc(polLabel(p).replace('Aprovechamiento sustentable', 'Aprovechamiento'))}</button>`).join('');
}
function renderUgas(q = '') {
  const nq = norm(q).trim();
  const list = UG.features.map(f => f.properties).filter(p => {
    if (polOn.size && !polOn.has(p.pol)) return false;
    if (!nq) return true;
    if (/^\d+$/.test(nq)) return String(p.id).startsWith(nq);
    return norm(`uga ${p.id} ${p.cl} ${p.pol} ${p.grp} ${p.loc} ${p.ej}`).includes(nq);
  }).sort((a, b) => a.id - b.id);
  $('#listUga').innerHTML = list.map(p => `<li data-k="${p.id}" class="${S.sel === p.id ? 'sel' : ''}"><span class="ugaid">${p.id}</span>${swatch(p.pol, 14, 'circle')}<span class="txt"><b>${esc(polLabel(p.pol))}</b><span class="muted">${esc(p.grp)}</span></span><span class="num">${p.ha >= 1 ? fmt(p.ha) : '<1'} ha</span></li>`).join('') || '<li class="empty">Sin coincidencias</li>';
}
function renderEj(q = '') {
  const nq = norm(q);
  const list = EJ.features.map(f => f.properties).filter(p => !nq || norm(p.n).includes(nq)).sort((a, b) => a.n.localeCompare(b.n, 'es'));
  $('#listEj').innerHTML = list.map(p => `<li data-k="${esc(p.n)}" class="${S.selEj === p.n ? 'sel' : ''}"><span class="sw" style="border:2px solid ${COL.ejido};background:#fff3e8"></span><span class="txt"><b>${esc(p.n)}</b><span class="muted">${p.ugas.length} UGA</span></span><span class="num">${fmt(p.ha)} ha</span></li>`).join('') || '<li class="empty">Sin coincidencias</li>';
}
function renderLoc(q = '') {
  const nq = norm(q);
  const list = LO.features.map(f => f.properties).filter(p => !nq || norm(p.n).includes(nq));
  $('#listLoc').innerHTML = list.map(p => `<li data-k="${esc(p.cve)}"><span class="sw" style="background:${COL.loc};border-radius:50%;border:1.5px solid #4a3a12"></span><span class="txt"><b>${esc(p.n)}</b><span class="muted">UGA ${p.uga ?? '—'}${p.ejido ? ' · ' + esc(p.ejido) : ''}</span></span><span class="num">${fmt(p.pob)} hab.</span></li>`).join('') || '<li class="empty">Sin coincidencias</li>';
}
renderUsos(); renderPolFilter(); renderUgas(); renderEj(); renderLoc();
$('#qUsos').addEventListener('input', e => renderUsos(e.target.value));
$('#qUga').addEventListener('input', e => renderUgas(e.target.value));
$('#qUga').addEventListener('keydown', e => { if (e.key === 'Enter') { const li = $('#listUga li[data-k]'); if (li) selectUga(+li.dataset.k, { zoom: true }); } });
$('#qEj').addEventListener('input', e => renderEj(e.target.value));
$('#qLoc').addEventListener('input', e => renderLoc(e.target.value));
$('#polFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; polOn.has(b.dataset.p) ? polOn.delete(b.dataset.p) : polOn.add(b.dataset.p); renderPolFilter(); renderUgas($('#qUga').value); });
$('#listUsos').addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) setUso(+li.dataset.k); });
$('#listUga').addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) { selectUga(+li.dataset.k, { zoom: true }); closeSideMobile(); } });
$('#listEj').addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) { selectEjido(li.dataset.k); closeSideMobile(); } });
$('#listLoc').addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) { selectLoc(li.dataset.k); closeSideMobile(); } });

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
function switchTab(k) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === k));
  document.querySelectorAll('.tabpane').forEach(x => x.classList.toggle('active', x.id === 'tab-' + k));
}
$('#btnPanel').addEventListener('click', () => {
  const open = $('#sidebar').classList.toggle('open');
  $('#btnPanel').setAttribute('aria-expanded', open);
  if (window.innerWidth > 760) setTimeout(() => { map.invalidateSize(); declutter(); }, 280);
});
function closeSideMobile() { if (window.innerWidth <= 760) $('#sidebar').classList.remove('open'); }

/* Delegación global: chips de UGA y botones de ficha */
document.addEventListener('click', e => {
  const f = e.target.closest('[data-ficha]');
  if (f) { openFicha(+f.dataset.ficha); return; }
  const u = e.target.closest('[data-uga]');
  if (u) { selectUga(+u.dataset.uga, { zoom: true }); return; }
  const c = e.target.closest('[data-crit]');
  if (c) { showCrit(c.dataset.crit); return; }
  const us = e.target.closest('[data-uso]');
  if (us) { showUso(+us.dataset.uso, +us.dataset.of); return; }
});

/* ---------------- Ficha completa (panel derecho) ---------------- */
const APT = [['apt_agr', 'Agrícola'], ['apt_ahr', 'Asent. humanos rurales'], ['apt_ahu', 'Asent. humanos urbanos'], ['apt_api', 'Apícola'], ['apt_cafe', 'Café'], ['apt_coco', 'Coco'], ['apt_ect', 'Ecoturismo'], ['apt_fnm', 'Forestal no maderable'], ['apt_fom', 'Forestal maderable'], ['apt_gex', 'Ganadería extensiva'], ['apt_gin', 'Ganadería intensiva'], ['apt_mango', 'Mango']];
const PRIO = [['apceb', 'Conservación de ecosistemas y biodiversidad'], ['apmsa1', 'Mantenimiento de servicios ambientales'], ['eco_pri', 'Ecosistemas prioritarios'], ['frg_veg', 'Fragmentación de la vegetación'], ['ret_sue', 'Retención de suelo']];
const NOSEC = { Ecog: 'Equipamiento comercial de gran escala', Sfc: 'Sistemas fotovoltaicos complementarios', AgR: 'Agricultura de riego' };
const tagCol = v => ({ 'Muy bajo': '#2f7d1a', 'Bajo': '#6aa84f', 'Baja': '#6aa84f', 'Medio': '#C9A54F', 'Alto': '#E07A1F', 'Alta': '#E07A1F', 'Muy alto': '#C0392B' }[v] || '#999');

function parsePct(s) {
  const out = []; const re = /([^,(]+?)\s*\(([\d.]+)%\)/g; let m;
  while ((m = re.exec(s || ''))) out.push([m[1].trim(), +m[2]]);
  return out;
}
function usvColor(n, i) {
  const t = norm(n);
  if (t.startsWith('otras coberturas')) return '#E6DED2';
  if (t.includes('asentamiento') || t.includes('urbano')) return '#9E9E9E';
  if (t.includes('agua')) return '#4A90C2';
  if (t.includes('agric') || t.includes('cultivo')) return '#E8C547';
  if (t.includes('pastizal')) return '#C9DB74';
  if (t.includes('mesofilo')) return '#1E6B38';
  if (t.includes('pino') || t.includes('encino') || t.includes('bosque')) return '#3E8E55';
  if (t.includes('selva')) return t.includes('perturb') || t.includes('secund') ? '#8DBF6A' : '#4F9A45';
  if (t.includes('palmar') || t.includes('manglar')) return '#2E8B7A';
  return ['#846623', '#C9A54F', '#8E1D3F', '#5B4718', '#D9C08A'][i % 5];
}
function stackHtml(items, colorFn) {
  if (!items.length) return '';
  return `<div class="stack">${items.map(([n, v], i) => `<i style="width:${v}%;background:${colorFn(n, i)}" title="${esc(n)} ${v}%"></i>`).join('')}</div>
    <div class="stack-leg">${items.map(([n, v], i) => `<span><i style="background:${colorFn(n, i)}"></i>${esc(cap(n))}<em>${fmt(v, v % 1 ? 1 : 0)}%</em></span>`).join('')}</div>`;
}
function bar(label, v, max = 10) {
  const w = v == null ? 0 : Math.max(0, Math.min(100, v / max * 100));
  return `<div class="bar"><span>${esc(label)}</span><div class="t"><i style="width:${w}%"></i></div><span class="v">${v == null ? '—' : fmt(v, 1)}</span></div>`;
}
function metric(label, v, unit = '', d = 1, tag = null, zeroNA = false) {
  const na = v == null || (zeroNA && v === 0);
  return `<div class="metric"><span>${esc(label)}</span><b>${na ? 's/d' : fmt(v, d)}</b>${!na && unit ? `<small>${unit}</small>` : ''}${tag ? `<span class="tag" style="background:${tagCol(tag)}22;color:${tagCol(tag)}">${esc(tag)}</span>` : ''}</div>`;
}

function openFicha(id, keepScroll) {
  const it = ugaById.get(+id); if (!it) return;
  const p = it.f.properties, I = p.ind, P = POL[p.pol] || {};
  if (S.sel !== p.id) selectUga(p.id, { noPopup: true, ficha: false });
  // usos
  const comp = [], inc = [];
  USOS.forEach(([k, d], i) => (p.u[i] === '1' ? comp : inc).push({ k, d, i }));
  const pc = comp.length / USOS.length * 100;
  // criterios agrupados por uso
  const groups = new Map();
  p.cr.forEach(k => {
    const c = CAT.crit[k];
    const pre = (k.match(/^[A-Za-zñÑ]+/) || [''])[0];
    const sec = c ? c.s : (NOSEC[pre] || 'Otros');
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec).push(k);
  });
  const critHtml = [...groups.entries()].map(([s, ks], gi) => `<details class="cg" ${gi === 0 && groups.size < 4 ? 'open' : ''}><summary>${esc(cap(s))}<span class="n">${ks.length}</span></summary>
      <div class="cc">${ks.map(k => `<button class="crit ${CAT.crit[k] ? '' : 'nd'}" data-crit="${esc(k)}" title="${esc(CAT.crit[k] ? CAT.crit[k].d.slice(0, 140) + '…' : 'Sin descripción en catálogo')}">${esc(k)}</button>`).join('')}</div></details>`).join('');
  // estrategias por eje
  const eg = new Map();
  p.es.forEach(k => { const e = CAT.est[k]; const s = e ? e.s : 'Otras'; if (!eg.has(s)) eg.set(s, []); eg.get(s).push(k); });
  const estHtml = [...eg.entries()].map(([s, ks]) => `<div class="est-g"><div class="sublbl">${esc(s)}</div>${ks.map(k => `<div class="est"><b>${esc(k)}</b><span>${esc(CAT.est[k] ? CAT.est[k].d : '—')}</span></div>`).join('')}</div>`).join('');
  const usv = parsePct(p.usv), ejs = parsePct(p.ej), conaf = parsePct(p.conaf);
  const usvSum = usv.reduce((a, x) => a + x[1], 0);
  if (usv.length && usvSum < 99) usv.push(['otras coberturas', Math.round((100 - usvSum) * 10) / 10]);
  const aptSorted = APT.map(([k, l]) => [l, I[k]]).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));

  $('#fichaBody').innerHTML = `
    <div class="f-hero" style="--fpol:${P.c || COL.dorado}">
      <div class="k">Unidad de Gestión Ambiental</div>
      <h2>UGA ${p.id}<small>${esc(p.cl)}</small></h2>
      <div class="grp">${esc(p.grp)}</div>
      <span class="polbadge">${swatch(p.pol, 18, 'circle')}Política: ${esc(polLabel(p.pol))}</span>
    </div>
    <div class="f-kpis">
      <div><b>${p.ha >= 1 ? fmt(p.ha) : fmt(p.hac, 2)}</b><span>Hectáreas</span></div>
      <div><b>${fmt(p.pob)}</b><span>Habitantes</span></div>
      <div><b>${fmt(p.den)}</b><span>Hab/km²</span></div>
      <div><b>${fmt(I.MDE)}</b><span>Altitud media (m)</span></div>
      <div><b>${fmt(I.pend_porc, 1)}%</b><span>Pendiente media</span></div>
      <div><b>${comp.length}/${USOS.length}</b><span>Usos compatibles</span></div>
    </div>
    <nav class="f-nav">
      <a href="#f-lin">Lineamiento</a><a href="#f-usos">Usos</a><a href="#f-crit">Criterios</a><a href="#f-est">Estrategias</a><a href="#f-terr">Territorio</a><a href="#f-ind">Indicadores</a>
    </nav>
    <section class="f-sec" id="f-lin"><h3>Lineamiento ecológico</h3>
      <div class="lin-box"><span class="lc">${esc(p.lin)}</span>${esc(p.lint)}</div></section>

    <section class="f-sec" id="f-usos"><h3>Usos del suelo</h3>
      <div class="compat-bar"><i style="width:${pc}%;background:${COL.compat}"></i><i style="width:${100 - pc}%;background:${COL.incompat}"></i></div>
      <div class="compat-leg"><span><b>${comp.length}</b> compatibles</span><span><b>${inc.length}</b> incompatibles</span></div>
      <div class="sublbl">Compatibles</div>
      <div class="usechips">${comp.map(o => `<button class="usechip c" data-uso="${o.i}" data-of="${p.id}" title="${esc(cap(o.d))}">${esc(o.k)}</button>`).join('')}</div>
      <div class="sublbl">Incompatibles</div>
      <div class="usechips">${inc.map(o => `<button class="usechip i" data-uso="${o.i}" data-of="${p.id}" title="${esc(cap(o.d))}">${esc(o.k)}</button>`).join('')}</div>
      <div style="font-size:11px;color:#5E544B">Toca una clave para ver su significado.</div>
    </section>

    <section class="f-sec" id="f-crit"><h3>Criterios de regulación ecológica <span class="cnt">${p.cr.length}</span></h3>
      ${p.nt.map(n => `<div class="note">${esc(n)}</div>`).join('')}
      ${critHtml || (p.nt.length ? '' : '<div style="font-size:12.5px;color:#5E544B">Sin criterios asignados.</div>')}
      <div style="font-size:11px;color:#5E544B;margin-top:6px">Agrupados por uso o actividad. Toca un criterio para leer su contenido.</div>
    </section>

    <section class="f-sec" id="f-est"><h3>Estrategias ecológicas <span class="cnt">${p.es.length}</span></h3>${estHtml || '—'}</section>

    <section class="f-sec" id="f-terr"><h3>Contexto territorial</h3>
      <div class="sublbl">Uso de suelo y vegetación (cobertura predominante)</div>${stackHtml(usv, usvColor) || `<div style="font-size:12.5px">${esc(p.usv)}</div>`}
      <div style="height:12px"></div>
      <dl class="dl">
        <dt>Ejidos</dt><dd>${ejs.length ? ejs.map(([n, v]) => `${esc(n)} <span style="color:#5E544B">(${fmt(v, 1)}%)</span>`).join('<br>') : (esc(p.ej) || '—')}</dd>
        <dt>Localidades</dt><dd>${esc(p.loc) || '—'}</dd>
        <dt>Zonificación CONAFOR</dt><dd>${conaf.length ? conaf.map(([n, v]) => `${esc(n)} <span style="color:#5E544B">(${fmt(v, 1)}%)</span>`).join('<br>') : (esc(p.conaf) || '—')}</dd>
        <dt>Clave(s) previa(s)</dt><dd>${esc(p.pas)}</dd>
      </dl>
      ${p.prob ? `<div class="sublbl" style="margin-top:14px">Problemática identificada</div><div class="prob">${esc(p.prob)}</div>` : ''}
    </section>

    <section class="f-sec" id="f-ind"><h3>Indicadores del modelo</h3>
      <div class="sublbl">Aptitud territorial (0–10)</div>
      <div class="bars">${aptSorted.map(([l, v]) => bar(l, v)).join('')}</div>
      <div class="sublbl" style="margin-top:14px">Prioridad ambiental (0–10)</div>
      <div class="bars">${PRIO.map(([k, l]) => bar(l, I[k])).join('')}</div>
      <div class="sublbl" style="margin-top:14px">Servicios ambientales y riesgo</div>
      <div class="metrics">
        ${metric('Fijación de carbono · actual', I.capt_carb, 't/ha/año')}
        ${metric('Fijación de carbono · tendencial', I.capt_carb_, 't/ha/año')}
        ${metric('Recarga de acuífero', I.rec_acu, 'mm/año', 0)}
        ${metric('Balance hídrico', I.balan_hi, '', 1)}
        ${metric('Retención de suelo', I.ret_sue, '/10', 1, I.ret_sue_De)}
        ${metric('Riesgo de ocurrencia de incendio', I.roinc, '', 1, I.roinc_Desc)}
        ${metric('Riqueza de especies', I.RIQ_SPS, '', 0)}
        ${metric('Riesgo de extinción de especies', I.risg_extin, '', 1)}
      </div>
      <div class="sublbl" style="margin-top:14px">Clima y potencial energético</div>
      <div class="metrics">
        ${metric('Precipitación media anual', I.PP_MA, 'mm', 0, null, true)}
        ${metric('Temperatura media anual', I.TA_MA, '°C', 1, null, true)}
        ${metric('Irradiación global horizontal', I.GHI, 'kWh/m²', 0, null, true)}
        ${metric('Potencial fotovoltaico', I.PVOUT, 'kWh/kWp', 2, null, true)}
        ${metric('Viento (WDM)', I.WDM, '', 2, null, true)}
        ${metric('Pendiente media', I.pend_grad, '°', 1)}
      </div>
    </section>
    <div class="f-foot">Fuente: Modelo de Ordenamiento Ecológico Local de Atoyac de Álvarez, Gro. · versión ${esc(p.ver)} · s/d = sin dato.</div>`;
  const fi = $('#ficha');
  const wasOpen = fi.classList.contains('open');
  fi.classList.add('open'); fi.setAttribute('aria-hidden', 'false'); document.body.classList.add('ficha-open');
  if (!keepScroll) $('#fichaBody').scrollTop = 0;
  map.closePopup();
  if (!wasOpen) setTimeout(() => { map.invalidateSize(); fitTo(it.layer.getBounds()); }, 300);
}
$('#fichaClose').addEventListener('click', () => { $('#ficha').classList.remove('open'); $('#ficha').setAttribute('aria-hidden', 'true'); document.body.classList.remove('ficha-open'); });
$('#fichaBody').addEventListener('click', e => {
  const a = e.target.closest('.f-nav a'); if (!a) return;
  e.preventDefault(); const t = $(a.getAttribute('href')); if (t) $('#fichaBody').scrollTo({ top: t.offsetTop - 50, behavior: 'smooth' });
});

/* ---------------- Ventanas emergentes ---------------- */
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modalX').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function showCrit(k) {
  const c = CAT.crit[k];
  const pre = (k.match(/^[A-Za-zñÑ]+/) || [''])[0];
  modal(`<div class="m-head"><div class="k">Criterio de regulación ecológica</div><h3>${esc(k)}</h3>
      <div style="font-size:12px;opacity:.9;margin-top:2px">${esc(cap(c ? c.s : (NOSEC[pre] || '')))}</div></div>
    <div class="m-body">${c ? esc(c.d) : '<em>La descripción de este criterio no se encuentra en el catálogo de criterios del modelo.</em>'}
      ${c && c.n ? `<div class="norma"><b>Referencia normativa:</b> ${esc(c.n)}</div>` : ''}</div>`);
}
function showUso(i, of) {
  const [k, d] = USOS[i], p = ugaById.get(of) && ugaById.get(of).f.properties;
  const ok = p && p.u[i] === '1';
  modal(`<div class="m-head g"><div class="k">Uso del suelo</div><h3>${esc(cap(d))}</h3><div style="font-size:12px;opacity:.9">Clave ${esc(k)}</div></div>
    <div class="m-body">${p ? `En la <b>UGA ${p.id}</b> este uso es <b style="color:${ok ? '#2f7d1a' : COL.incompat}">${ok ? 'compatible' : 'incompatible'}</b>.<br>` : ''}
      Es compatible en <b>${usoStats[i].c}</b> de ${CAT.n_ugas} UGA (${fmt(usoStats[i].ha)} ha).
      <div class="actions"><button class="btn btn-prim" id="mUso">Ver en el mapa</button><button class="btn btn-sec" id="mClose">Cerrar</button></div></div>`);
  $('#mUso').onclick = () => { closeModal(); switchTab('usos'); if (S.uso !== i) setUso(i); };
  $('#mClose').onclick = closeModal;
}

/* ---------------- Inicio ---------------- */
renderLegend();
fitAll();
setTimeout(declutter, 50);
const h = location.hash.match(/uga=(\d+)/);
if (h) setTimeout(() => selectUga(+h[1], { zoom: true }), 300);
})();
