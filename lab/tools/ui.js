(function () {
  const E = Engine, L = Lab, $ = id => document.getElementById(id), C = E.CROPS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const REPO = 'kuzakaa/furrow';
  const FIELDS = [
    { id: 'odesa', name: 'Odesa region, Ukraine', lat: 46.85, lon: 30.6, rot: ['wheat', 'sunflower'], soil: 'clay_loam', till: 'conv', slope: 2 },
    { id: 'minsk', name: 'Minsk region, Belarus', lat: 53.7, lon: 27.2, rot: ['wheat', 'canola', 'oats'], soil: 'sandy_loam', till: 'conv', slope: 3 },
    { id: 'iowa', name: 'Central Iowa, USA', lat: 42.03, lon: -93.62, rot: ['corn', 'soy'], soil: 'loam', till: 'reduced', slope: 3 },
    { id: 'freestate', name: 'Free State, South Africa', lat: -27.39, lon: 26.62, rot: ['corn', 'sunflower'], soil: 'sandy_loam', till: 'reduced', slope: 2 },
    { id: 'heilongjiang', name: 'Heilongjiang, China', lat: 45.9, lon: 126.9, rot: ['corn', 'soy'], soil: 'clay_loam', till: 'conv', slope: 2 }
  ];
  const CROP_ORDER = ['wheat', 'sunflower', 'corn', 'soy', 'canola', 'oats', 'pea', 'sorghum', 'alfalfa', 'fallow'];
  const PRI = [
    { k: 'income', name: 'Making a profit', ex: 'Based on typical growing cost and how many buyers each crop has. Local prices are not included.' },
    { k: 'water', name: 'Saving water', ex: 'Share of the season with crop water deficit, rain-fed.' },
    { k: 'soil', name: 'Building healthy soil', ex: 'Organic matter inputs, biological nitrogen fixation, tillage intensity and crop-family diversity.' },
    { k: 'erosion', name: 'Keeping soil from washing away', ex: 'Bare-soil days and erosive rainfall on poorly covered soil, adjusted for slope and tillage.' },
    { k: 'resilience', name: 'Steady harvests in bad years', ex: 'Performance in the hottest, driest years of 2001-2025 rather than the average.' }
  ];
  const LEVEL = ['Not a focus right now', 'A little', 'Somewhat', 'It matters', 'It matters a lot', 'Top priority'];
  const SOILTXT = {
    sand: 'Over 85% sand. Low water-holding capacity and fast drainage, so crops hit drought stress early and nutrients leach.',
    sandy_loam: 'Mostly sand with some silt and clay. Drains well, moderate water-holding capacity, dries out in long dry spells.',
    loam: 'Balanced sand, silt and clay. Good structure and water-holding capacity, suits most crops.',
    silt_loam: 'Over 50% silt. Holds a lot of plant-available water, but crusts and erodes easily when left bare.',
    clay_loam: '27 to 40% clay. High water-holding capacity, slow drainage, compacts if worked when wet.',
    clay: 'Over 40% clay. Stores the most water but drains poorly, waterlogs and compacts. Narrow window when it can be worked.'
  };
  const TILLTXT = {
    conv: 'Ploughing or discing. Little residue left on the surface.',
    reduced: 'Shallow tillage. Part of the residue stays on the surface.',
    notill: 'Direct drilling into stubble, no soil disturbance.'
  };
  const READ = {
    soil: [['How to tell soil type by feel (Wikipedia: soil texture)', 'https://en.wikipedia.org/wiki/Soil_texture'], ['Soil map of the world (SoilGrids)', 'https://soilgrids.org'], ['FAO soils portal', 'https://www.fao.org/soils-portal/en/']],
    slope: [['What slope means for erosion (Wikipedia)', 'https://en.wikipedia.org/wiki/Soil_erosion']],
    till: [['No-till farming (Wikipedia)', 'https://en.wikipedia.org/wiki/No-till_farming'], ['Tillage (Wikipedia)', 'https://en.wikipedia.org/wiki/Tillage']],
    rot: [['Crop rotation (Wikipedia)', 'https://en.wikipedia.org/wiki/Crop_rotation'], ['Cover crops (Wikipedia)', 'https://en.wikipedia.org/wiki/Cover_crop']]
  };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const D = { raw: null, proj: null, soil: null, nd: null, tex: null, terrain: null, ex: null, shared: [], patch: null, qcDrop: [] };
  let R = null, inp = null, fieldKey = '', runId = 0, step = 0;
  const S = Object.assign({ field: 'odesa', lat: 46.85, lon: 30.6, rot: ['wheat', 'sunflower'], soil: 'clay_loam', till: 'conv', slope: 2, w: { income: 4, water: 3, soil: 3, erosion: 3, resilience: 3 }, later: false, w2: { income: 2, water: 3, soil: 5, erosion: 4, resilience: 3 }, years: 3, acc: {}, text: '', exp: null }, store.get('furrowlab:setup', {}));
  const save = () => store.set('furrowlab:setup', S);

  async function getJSON(url, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 20000);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('status ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function cached(key, fn) { const c = store.get(key, null); if (c) return c; const v = await fn(); if (v) store.set(key, v); return v; }
  const why = (id, html, links) => '<button class="why" data-x="' + id + '">What does this mean?</button><div class="explain" id="x_' + id + '">' + html + (links ? '<p class="mute" style="margin:8px 0 0">Not sure? Read more:</p><ul style="margin:4px 0 0;padding-left:20px">' + links.map(l => '<li><a href="' + l[1] + '" target="_blank" rel="noopener">' + esc(l[0]) + '</a></li>').join('') + '</ul>' : '') + '</div>';
  const slopeWords = p => p < 2 ? 'Flat' : p < 6 ? 'Gentle slope' : p < 12 ? 'Clear slope' : 'Steep';

  const STEPS = [
    () => '<h2>Where is your field?</h2><p class="mute">Choose an example field or enter coordinates.</p>'
      + FIELDS.map(f => '<button class="opt' + (S.field === f.id ? ' on' : '') + '" data-field="' + f.id + '"><b>' + esc(f.name) + '</b><span class="mute">' + f.rot.map(c => C[c].short).join(', then ') + '</span></button>').join('')
      + '<button class="opt' + (S.field === 'custom' ? ' on' : '') + '" data-field="custom"><b>My own field</b><span class="mute">Type latitude and longitude</span></button>'
      + '<div id="map"></div><p class="mute">Or tap your field on the map.</p>'
      + (S.field === 'custom' ? '<div class="bar"><input id="lat" type="number" step="0.01" placeholder="Latitude" value="' + S.lat + '"><input id="lon" type="number" step="0.01" placeholder="Longitude" value="' + S.lon + '"></div>' : ''),
    () => '<h2>What do you grow now?</h2><p class="mute">Add crops in rotation order.</p>'
      + '<div class="rotnow"><div class="lab">What you grow now</div><div class="crops">' + (S.rot.length ? S.rot.map(c => esc(C[c].short)).join(', then ') : 'No crops added') + '</div>'
      + (S.rot.length ? '<div class="seq">' + S.rot.map((c, i) => '<button data-del="' + i + '">Remove ' + esc(C[c].short) + '</button>').join('') + '</div>' : '') + '</div>'
      + '<div class="chips">' + CROP_ORDER.map(c => '<button class="chip" data-add="' + c + '">+ ' + esc(C[c].short) + '</button>').join('') + '</div>'
      + '<h3 style="margin-top:20px">How do you work the soil? ' + why('till', 'Less tillage leaves more residue on the surface, which reduces erosion and evaporation.', READ.till) + '</h3>'
      + Object.keys(E.TILLAGE).map(k => '<button class="opt' + (S.till === k ? ' on' : '') + '" data-till="' + k + '"><b>' + esc(E.TILLAGE[k].name) + '</b><span class="mute">' + TILLTXT[k] + '</span></button>').join(''),
    () => '<h2>Soil and slope</h2><p class="mute">Closest texture class. ' + why('soil', 'Texture sets the water-holding capacity of the root zone, which drives drought stress in the model.', READ.soil) + '</p>'
      + (D.tex ? '<div class="row">SoilGrids: <b>' + esc(E.SOILS[D.tex].name) + '</b> <button class="big" data-soil="' + D.tex + '" style="margin-left:8px">Use this</button></div>' : '<button class="big" id="guess" style="margin:6px 0">Get texture from the SoilGrids map</button><div id="guessmsg" class="mute"></div>')
      + Object.keys(E.SOILS).map(k => '<button class="opt' + (S.soil === k ? ' on' : '') + '" data-soil="' + k + '"><b>' + esc(E.SOILS[k].name) + '</b><span class="mute">' + (SOILTXT[k] || '') + '</span></button>').join('')
      + (D.terrain ? '<div class="row">Elevation data: typical slope <b>' + D.terrain.typical.toFixed(1) + '%</b>, steepest ' + D.terrain.steepest.toFixed(1) + '%. <button class="big" id="useslope" style="margin-left:8px">Use this</button></div>' : '')
      + '<div class="row"><div class="head"><h3 style="margin:0">Slope ' + why('slope', 'Slope scales runoff and erosion. 5% means a 5 m rise over 100 m. Erosion risk rises sharply above about 6%.', READ.slope) + '</h3><span class="val" id="slopev">' + S.slope + '%, ' + slopeWords(S.slope) + '</span></div><input type="range" id="slope" min="0" max="20" step="0.5" value="' + S.slope + '"><div class="scale"><span>0% flat</span><span>20% steep</span></div></div>',
    () => '<h2>What matters most to you right now?</h2><p class="mute">Set how important each goal is for the coming seasons.</p>'
      + PRI.map(p => '<div class="row"><div class="head"><b>' + p.name + ' ' + why('p_' + p.k, p.ex) + '</b><span class="val" id="v_' + p.k + '">' + LEVEL[S.w[p.k]] + '</span></div><input type="range" min="0" max="5" step="1" value="' + S.w[p.k] + '" data-w="' + p.k + '"><div class="scale"><span>Not a focus</span><span>Top priority</span></div></div>').join('')
      + '<div class="row"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="later"' + (S.later ? ' checked' : '') + ' style="width:24px;height:24px"> <b>My priorities will change later</b></label><p class="mute" style="margin:6px 0 0">For example: profit first, then invest in soil.</p>'
      + (S.later ? '<div class="row" style="background:var(--panel2)"><div class="head"><b>After how many years?</b><span class="val" id="yv">' + S.years + ' years</span></div><input type="range" id="years" min="1" max="8" value="' + S.years + '"></div>'
        + PRI.map(p => '<div class="head" style="margin-top:10px"><span>' + p.name + '</span><span class="val" id="v2_' + p.k + '">' + LEVEL[S.w2[p.k]] + '</span></div><input type="range" min="0" max="5" step="1" value="' + S.w2[p.k] + '" data-w2="' + p.k + '">').join('') : '') + '</div>',
    () => {
      const keys = needKeys();
      return '<h2>Constraints</h2><p class="mute">The best-scoring options require the following. Rate how feasible each is for you.</p>'
        + (keys.length ? keys.map(k => { const A = L.ACCEPT[k], v = S.acc[k] == null ? 3 : S.acc[k]; return '<div class="row"><div class="head"><b>' + A.q + '</b><span class="val" id="a_' + k + '">' + v + ' of 5</span></div><div class="mute" style="font-size:.9rem">Needed for: ' + esc(needFor(k)) + '</div><input type="range" min="0" max="5" step="1" value="' + v + '" data-acc="' + k + '"><div class="scale"><span>0, ' + A.lo + '</span><span>5, ' + A.hi + '</span></div></div>'; }).join('') : '<p class="mute">Loading options…</p>')
        + '<div class="row"><b>Other constraints</b><p class="mute" style="margin:4px 0 8px">Free text, any language. For example: diesel shortages, no budget for machinery, pollen allergy.</p><textarea id="free">' + esc(S.text) + '</textarea><div class="understood" id="und"></div></div>';
    }
  ];
  const TITLES = ['Field', 'Crops now', 'Soil and slope', 'Priorities', 'What you can do'];

  function needKeys() { if (!R) return []; const ks = new Set(); R.list.slice(0, 6).forEach(s => Object.keys(L.needs(s, inp.rot)).forEach(k => ks.add(k))); return Object.keys(L.ACCEPT).filter(k => ks.has(k)); }
  function needFor(k) { return R.list.slice(0, 6).filter(s => k in L.needs(s, inp.rot)).map(s => s.name).slice(0, 3).join('; '); }
  function understood() {
    const r = L.parseConstraints(S.text), el = $('und'); if (!el) return;
    el.innerHTML = r.length ? '<div class="mute" style="background:none;padding:0">Applied:</div>' + r.map(x => '<div><b>' + esc(x.tag) + '.</b> ' + esc(x.why) + '</div>').join('') : (S.text.trim() ? '<div class="mute" style="background:none;padding:0">Nothing recognised. The text is saved with your notes.</div>' : '');
  }

  function drawSetup() {
    $('setup').innerHTML = '<div class="steps">' + STEPS.map((_, i) => '<i class="' + (i <= step ? 'on' : '') + '"></i>').join('') + '</div><div class="stepno">Step ' + (step + 1) + ' of ' + STEPS.length + ': ' + TITLES[step] + '</div>'
      + STEPS[step]() + '<div class="nav">' + (step ? '<button class="big" id="back">Back</button>' : '') + '<button class="go" id="next">' + (step === STEPS.length - 1 ? 'Show my options' : 'Next') + '</button></div>';
    const A = $('setup');
    A.querySelectorAll('[data-x]').forEach(b => b.onclick = () => $('x_' + b.dataset.x).classList.toggle('on'));
    A.querySelectorAll('[data-field]').forEach(b => b.onclick = () => { const f = FIELDS.find(x => x.id === b.dataset.field); S.field = b.dataset.field; if (f) Object.assign(S, { lat: f.lat, lon: f.lon, rot: f.rot.slice(), soil: f.soil, till: f.till, slope: f.slope }); D.tex = null; save(); drawSetup(); });
    A.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { if (S.rot.length < 6) S.rot.push(b.dataset.add); save(); drawSetup(); });
    A.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.rot.splice(+b.dataset.del, 1); save(); drawSetup(); });
    A.querySelectorAll('[data-till]').forEach(b => b.onclick = () => { S.till = b.dataset.till; save(); drawSetup(); });
    A.querySelectorAll('[data-soil]').forEach(b => b.onclick = () => { S.soil = b.dataset.soil; save(); drawSetup(); });
    A.querySelectorAll('[data-w]').forEach(r => r.oninput = () => { S.w[r.dataset.w] = +r.value; $('v_' + r.dataset.w).textContent = LEVEL[+r.value]; save(); });
    A.querySelectorAll('[data-w2]').forEach(r => r.oninput = () => { S.w2[r.dataset.w2] = +r.value; $('v2_' + r.dataset.w2).textContent = LEVEL[+r.value]; save(); });
    A.querySelectorAll('[data-acc]').forEach(r => r.oninput = () => { S.acc[r.dataset.acc] = +r.value; $('a_' + r.dataset.acc).textContent = r.value + ' of 5'; save(); });
    if ($('slope')) $('slope').oninput = e => { S.slope = +e.target.value; $('slopev').textContent = S.slope + '%, ' + slopeWords(S.slope); save(); };
    if ($('later')) $('later').onchange = e => { S.later = e.target.checked; save(); drawSetup(); };
    if ($('years')) $('years').oninput = e => { S.years = +e.target.value; $('yv').textContent = S.years + ' years'; save(); };
    if ($('lat')) { $('lat').oninput = e => { S.lat = +e.target.value; save(); }; $('lon').oninput = e => { S.lon = +e.target.value; save(); }; }
    if ($('free')) { $('free').oninput = e => { S.text = e.target.value; save(); understood(); }; understood(); }
    if ($('guess')) $('guess').onclick = guessSoil;
    if ($('useslope')) $('useslope').onclick = () => { S.slope = Math.round(D.terrain.typical * 2) / 2; save(); drawSetup(); };
    if ($('map')) pickMap();
    if ($('back')) $('back').onclick = () => { step--; drawSetup(); $('setup').scrollTop = 0; };
    $('next').onclick = () => {
      if (step === 0 && (!isFinite(S.lat) || !isFinite(S.lon) || Math.abs(S.lat) > 70)) { alertBox('Check the coordinates', 'Latitude must be between -70 and 70.'); return; }
      if (step === 1 && !S.rot.length) { alertBox('Add at least one crop', 'Add the crops in rotation order.'); return; }
      if (step < STEPS.length - 1) { step++; drawSetup(); $('setup').scrollTop = 0; if (step === 4 && !R) go(true); return; }
      if (S.exp == null) askExperimental(); else go();
    };
  }

  async function guessSoil() {
    $('guessmsg').textContent = 'Loading SoilGrids…';
    try {
      const j = await getJSON('https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + S.lon + '&lat=' + S.lat + '&property=clay&property=sand&depth=0-30cm&value=mean', 30000), v = {};
      j.properties.layers.forEach(l => v[l.name] = l.depths[0].values.mean / 10);
      if (v.clay == null || v.sand == null) throw new Error('no data here');
      D.tex = E.textureClass(v.sand, v.clay); drawSetup();
    } catch (e) { $('guessmsg').textContent = 'SoilGrids didn’t respond (' + e.message + '). Choose the class manually.'; }
  }

  function modal(html, buttons) {
    $('mbox').innerHTML = html + '<div class="bar">' + buttons.map((b, i) => '<button class="' + (b.go ? 'go' : 'big') + '" data-i="' + i + '">' + b.t + '</button>').join('') + '</div>';
    $('modal').classList.add('on');
    $('mbox').querySelectorAll('button').forEach(b => b.onclick = () => { $('modal').classList.remove('on'); const f = buttons[+b.dataset.i].f; if (f) f(); });
    $('mbox').querySelector('button').focus();
  }
  function alertBox(t, m) { modal('<h2>' + esc(t) + '</h2><p>' + esc(m) + '</p>', [{ t: 'OK', go: true }]); }
  let map1 = null, map2 = null, mk2 = null, cell2 = null, ovl = null;
  const SAT = () => window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
  const pinIcon = () => window.L.divIcon({ className: 'pin', iconSize: [0, 0] });
  function pickMap() {
    if (!window.L) { $('map').remove(); return; }
    if (map1) { map1.remove(); map1 = null; }
    map1 = window.L.map('map', { zoomSnap: 0.5 }).setView([S.lat, S.lon], 11); SAT().addTo(map1);
    const mk = window.L.marker([S.lat, S.lon], { icon: pinIcon(), interactive: false }).addTo(map1);
    map1.on('click', e => { S.field = 'custom'; S.lat = Math.round(e.latlng.lat * 1e4) / 1e4; S.lon = Math.round(e.latlng.lng * 1e4) / 1e4; mk.setLatLng(e.latlng); D.tex = null; D.terrain = null; save(); if ($('lat')) { $('lat').value = S.lat; $('lon').value = S.lon; } else drawSetup(); });
  }
  const GIBS = { ndvi: ['MODIS_Terra_NDVI_8Day', 'GoogleMapsCompatible_Level9', 'png', 9], smap: ['SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', 'GoogleMapsCompatible_Level6', 'png', 6], imerg: ['IMERG_Precipitation_Rate', 'GoogleMapsCompatible_Level6', 'png', 6] };
  function bigMap() {
    if (!window.L) return;
    if (!map2) {
      map2 = window.L.map('map2', { zoomSnap: 0.5 }).setView([S.lat, S.lon], 9); SAT().addTo(map2);
      mk2 = window.L.marker([S.lat, S.lon], { icon: pinIcon(), interactive: false }).addTo(map2);
      cell2 = window.L.rectangle([[0, 0], [1, 1]], { color: '#f5faf2', weight: 1.5, fillOpacity: 0.03, dashArray: '6 5', interactive: false }).addTo(map2);
      map2.on('click', e => { S.field = 'custom'; S.lat = Math.round(e.latlng.lat * 1e4) / 1e4; S.lon = Math.round(e.latlng.lng * 1e4) / 1e4; D.tex = null; D.terrain = null; save(); drawSetup(); go(true); });
      const d = new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10); $('ldate').value = d; $('ldate').max = d;
      $('layer').onchange = $('ldate').onchange = layer;
    }
    setTimeout(() => map2.invalidateSize(), 50);
    mk2.setLatLng([S.lat, S.lon]); map2.setView([S.lat, S.lon], map2.getZoom());
    const cy = Math.round(S.lat / 0.5) * 0.5, cx = Math.round(S.lon / 0.625) * 0.625; cell2.setBounds([[cy - 0.25, cx - 0.3125], [cy + 0.25, cx + 0.3125]]);
  }
  function layer() {
    if (ovl) { map2.removeLayer(ovl); ovl = null; }
    const g = GIBS[$('layer').value]; if (!g) return;
    ovl = window.L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + g[0] + '/default/' + $('ldate').value + '/' + g[1] + '/{z}/{y}/{x}.' + g[2], { maxNativeZoom: g[3], maxZoom: 17, opacity: 0.75, attribution: 'NASA GIBS' }).addTo(map2);
  }

  let MV = null;
  function mainViews() {
    try {
      const raw = D.ex ? Object.assign({}, D.raw, { ex: D.ex }) : D.raw;
      const Sm = { lat: inp.lat, lon: inp.lon, name: (FIELDS.find(f => f.id === S.field) || { name: 'Your field' }).name, rot: inp.rot.map(r => ({ c: r.c, cv: null })), soil: inp.soil, slope: 'custom', till: inp.till, irrigated: false, livestock: inp.livestock, exclude: new Set((inp.avoid || []).filter(c => !S.rot.includes(c))), weights: inp.weights, scen: { rain: 0, temp: 0 }, terrain: D.terrain, ndvi: D.nd && D.nd.by[2024] && D.nd.by[2025] ? { yrs: [2024, 2025], by: { 2024: D.nd.by[2024], 2025: D.nd.by[2025] } } : null, sel: 1, map: null };
      const A = L.withPatch(D.patch, () => E.analyse(raw, Sm));
      MV = window.MainViews(Sm); const v = MV.views(A);
      $('summary').innerHTML = v.result; $('weather').innerHTML = v.climate; $('calendar').innerHTML = v.calendar; $('years').innerHTML = v.years;
    } catch (e) { $('summary').innerHTML = '<p class="bad">' + esc(e.message) + '</p>'; }
  }
  const GO = { result: 'summary', climate: 'weather', calendar: 'calendar', years: 'years', options: 'strat', method: 'method' };
  document.addEventListener('click', e => {
    const g = e.target.closest('.mv [data-go]'); if (g) { setTab(GO[g.dataset.go] || 'summary'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const a = e.target.closest('.mv [data-act]');
    if (a && a.dataset.act === 'print') { window.print(); return; }
    if (a && a.dataset.act === 'share') { const u = location.href.split('#')[0] + '#s=' + L.pack(S); navigator.clipboard.writeText(u).then(() => { a.textContent = 'Link copied'; }, () => { a.textContent = u; }); return; }
    const t = e.target.closest('.mv [data-tip]'), tip = $('tip');
    if (t) { tip.textContent = t.getAttribute('data-tip'); tip.style.display = 'block'; const r = t.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 330, Math.max(8, r.left)) + 'px'; tip.style.top = Math.min(innerHeight - 120, r.bottom + 8) + 'px'; } else tip.style.display = 'none';
  });

  function askExperimental() {
    modal('<h2>Include experimental strategies?</h2><p>Some practices are still in trials or disputed in the literature, and may not have been tried in your region. Evidence is weaker.</p><p class="mute">They are marked separately.</p>',
      [{ t: 'Include them', go: true, f: () => { S.exp = true; save(); go(); } }, { t: 'Established only', f: () => { S.exp = false; save(); go(); } }]);
  }

  const extrasState = {};
  function note(k, v) { extrasState[k] = v; $('extras').innerHTML = Object.keys(extrasState).map(x => x + ': ' + extrasState[x]).join(' · '); }
  async function go(quiet) {
    const lat = +S.lat, lon = +S.lon, id = ++runId;
    $('status').innerHTML = 'Loading NASA POWER 2001-2025…';
    fieldKey = lat.toFixed(2) + ',' + lon.toFixed(2); D.proj = D.soil = D.nd = D.patch = D.ex = null;
    for (const k in extrasState) delete extrasState[k];
    try {
      D.raw = await cached('furrow1:' + fieldKey, async () => E.parsePower(await getJSON('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=20010101&end=20251231&format=JSON', 60000)));
      if (id !== runId) return;
      compute();
      if (!quiet) setTab('stress');
      if (!quiet) { if (innerWidth <= 900) { $('wrap').classList.add('closed'); syncToggle(); } $('out').scrollIntoView({ behavior: 'smooth' }); }
      if (quiet && step === 4) drawSetup();
      loadExtras(id, lat, lon);
      getJSON('https://api.github.com/repos/' + REPO + '/issues?state=all&per_page=100', 20000).then(j => { if (id !== runId) return; D.shared = L.fromIssues(j); store.set('furrowlab:shared', D.shared); compute(); }).catch(() => {});
    } catch (e) { $('status').innerHTML = '<span class="bad">NASA POWER didn’t respond.</span> ' + esc(e.message) + '.'; }
  }

  function makeInp() {
    const cons = L.parseConstraints(S.text), w = Object.assign({}, S.w), acc = Object.assign({}, S.acc), avoid = [];
    let livestock = false;
    cons.forEach(c => { Object.assign(w, c.act.w || {}); for (const k in c.act.acc || {}) acc[k] = Math.min(acc[k] == null ? 5 : acc[k], c.act.acc[k]); (c.act.avoid || []).forEach(x => avoid.push(x)); if (c.act.livestock) livestock = true; });
    if (Object.values(w).every(v => !v)) w.income = 1;
    E.SLOPES.custom = { name: S.slope + '%', f: Math.max(0.3, Math.min(3, S.slope / 4)) };
    return { lat: +S.lat, lon: +S.lon, rot: S.rot.map(c => ({ c, cv: null })), soil: S.soil, slope: 'custom', till: S.till, irrigated: false, livestock, exclude: new Set(), weights: w, acc, avoid, exp: !!S.exp, cons };
  }

  function allRecords() { let t = store.get('furrowlab:farm', {})[fieldKey] || ''; L.summarise(D.shared).recs.forEach(r => { if (r.field !== fieldKey) t += '\n' + r.text; }); return t; }
  function learn() {
    D.patch = null; D.qcDrop = []; const text = allRecords(); if (!text.trim()) return;
    const base = L.calFor(D.raw, inp.lat, null), q = L.qc(L.compareFarm(L.parseFarm(text), base.cal, base.cl.south));
    D.qcDrop = q.drop; if (!q.keep.length) return;
    const patch = L.calibrate(q.keep, base.cal), after = L.calFor(D.raw, inp.lat, patch), again = L.compareFarm(L.parseFarm(text), after.cal, after.cl.south);
    patch._err = { before: L.errors(q.keep), after: L.errors(L.qc(again).keep) };
    D.patch = patch;
  }
  function compute() {
    inp = makeInp(); learn();
    R = L.run(D.raw, inp, D.proj || [], D.patch);
    L.withPatch(D.patch, () => L.confidence(R.list, inp, R.cl.n));
    R.list.forEach(s => { s.need = L.needs(s, inp.rot); s.adj = L.adjust(s, s.need, inp.acc); });
    R.list.sort((a, b) => ((a.id === 'mono') - (b.id === 'mono')) || (a.adj.blocked.length - b.adj.blocked.length) || (b.adj.final - a.adj.final));
    if (S.later) { const ok = R.list.filter(s => !s.adj.blocked.length && s.id !== 'mono'), best = w => ok.slice().sort((a, b) => (E.match(b.sc, w) - b.adj.pen) - (E.match(a.sc, w) - a.adj.pen))[0], f = best(inp.weights), t = best(S.w2); R.plan = { first: f, then: t, switchAfter: S.years, same: f.id === t.id }; } else R.plan = null;
    $('status').innerHTML = '<span class="ok">Ready.</span> ' + R.list.length + ' options, ' + R.cl.n + ' years of weather' + (D.patch ? ', crop dates calibrated on farm records' : '') + '.';
    render();
    mainViews();
  }

  function loadExtras(id, lat, lon) {
    cached('furrowx1:' + fieldKey, async () => E.parseExtra(await getJSON('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,WS2M,RH2M&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=20010101&end=20251231&format=JSON', 60000)))
      .then(x => { if (id !== runId || !x || !(x.n >= D.raw.n)) return; D.ex = x; note('Penman-Monteith inputs', 'loaded'); mainViews(); }).catch(() => {});
    cached('furrowz1:' + fieldKey, async () => {
      const dl = 250 / 111320, dn = 250 / (111320 * Math.cos(lat * Math.PI / 180)), la = [], lo = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { la.push((lat + (2 - r) * dl).toFixed(5)); lo.push((lon + (c - 2) * dn).toFixed(5)); }
      const z = (await getJSON('https://api.open-meteo.com/v1/elevation?latitude=' + la.join(',') + '&longitude=' + lo.join(','), 15000)).elevation;
      return Array.isArray(z) && z.length === 25 && z.every(isFinite) ? z : null;
    }).then(z => { if (id !== runId || !z) return; D.terrain = E.terrain(z, 250); note('Terrain', 'typical slope ' + D.terrain.typical.toFixed(1) + '%'); mainViews(); if (step === 2) drawSetup(); }).catch(() => {});
    note('Climate models', 'loading');
    cached('furrowlabp1:' + fieldKey, async () => getJSON('https://climate-api.open-meteo.com/v1/climate?latitude=' + lat + '&longitude=' + lon + '&start_date=2001-01-01&end_date=2050-12-31&models=' + L.MODELS.join(',') + '&daily=temperature_2m_mean,precipitation_sum', 60000).then(L.projections))
      .then(p => { if (id !== runId) return; D.proj = p && p.length ? p : null; note('Climate models', D.proj ? (D.proj.length - 1) + ' loaded' : 'none'); compute(); })
      .catch(() => note('Climate models', 'failed'));
    note('Soil carbon', 'loading');
    cached('furrowlabs1:' + fieldKey, async () => {
      const j = await getJSON('https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + lon + '&lat=' + lat + '&property=ocs&property=soc&property=nitrogen&property=phh2o&depth=0-30cm&depth=0-5cm&value=mean', 30000);
      const o = {}; (j.properties.layers || []).forEach(l => { const d = l.depths.find(x => x.values.mean != null); if (d) o[l.name] = d.values.mean; });
      if (o.ocs == null) return null;
      return { ocs: o.ocs, soc: o.soc != null ? o.soc / 10 : null, n: o.nitrogen != null ? o.nitrogen / 100 : null, ph: o.phh2o != null ? o.phh2o / 10 : null };
    }).then(v => { if (id !== runId) return; D.soil = v; note('Soil carbon', v ? v.ocs + ' t C/ha' : 'no data here'); render(); })
      .catch(() => note('Soil carbon', 'failed'));
    note('Satellite 2015-2025', 'loading');
    (async () => {
      const yrs = []; for (let y = 2025; y >= 2015; y--) yrs.push(y);
      const parts = [['001', '145'], ['161', '305'], ['321', '365']], by = {}, main = store.get('furrown2:' + fieldKey, null);
      if (main) main.yrs.forEach(y => { by[y] = main.by[y]; store.set('furrowlabny1:' + fieldKey + ':' + y, main.by[y]); });
      const good = () => Object.keys(by).map(Number).filter(y => by[y] && by[y].filter(v => v != null).length >= 15).sort();
      const publish = () => { if (id !== runId) return; const g = good(); note('Satellite 2015-2025', g.length + ' of 11 years'); if (g.length >= 2) { D.nd = { yrs: g, by }; render(); mainViews(); } };
      yrs.forEach(y => { const c = store.get('furrowlabny1:' + fieldKey + ':' + y, null); if (c) by[y] = c; });
      publish();
      const todo = yrs.filter(y => !by[y]);
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          if (id !== runId) return;
          const y = todo[i++], row = new Array(23).fill(null);
          for (const q of parts) {
            const u = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=' + lat + '&longitude=' + lon + '&band=250m_16_days_NDVI&startDate=A' + y + q[0] + '&endDate=A' + y + q[1] + '&kmAboveBelow=0&kmLeftRight=0';
            for (let t = 0; t < 2; t++) {
              try { const j = await getJSON(u, 90000); (j.subset || []).forEach(r => { const m = String(r.modis_date), k = Math.round((+m.slice(5) - 1) / 16), v = Array.isArray(r.data) ? +r.data[0] : NaN; if (k >= 0 && k < 23 && v > -2000 && v <= 10000) row[k] = Math.round(v * 0.1) / 1000; }); break; } catch (e) {}
            }
          }
          if (row.filter(v => v != null).length >= 15) { by[y] = row; store.set('furrowlabny1:' + fieldKey + ':' + y, row); }
          publish();
        }
      };
      await Promise.all([1, 2].map(worker));
      if (id === runId && good().length < 3) note('Satellite 2015-2025', 'NASA’s server is slow, try again later');
    })();
  }
  const rotTxt = s => s.rot.map(r => C[r.c].short + (r.cv ? ' + cover crop' : '')).join(', then ') + (s.till === 'notill' ? ', no ploughing' : s.till === 'reduced' && inp.till !== 'reduced' ? ', light tillage' : '');
  const moist = () => R && R.cl.years.reduce((a, Y) => a + Y.rain, 0) / R.cl.years.reduce((a, Y) => a + Y.et, 0) > 1;
  const carbon = s => D.soil ? L.carbonIPCC(s, R.list.find(x => x.id === 'current'), D.soil.ocs, moist()) : null;
  const INFO = id => L.INFO[id] || L.EXPERIMENTAL[id];

  function render() { if (!R) return; strat(); params(); stress(); veg(); crops(); farm(); shared(); care(); method(); sources(); }

  function confText(s) {
    if (!s.conf) return '';
    const p = Math.round(s.conf.beats / s.conf.runs * 100);
    const word = p >= 90 ? 'Very likely better than the current rotation' : p >= 70 ? 'Probably better than the current rotation' : p >= 40 ? 'Too close to call' : 'Probably not better than the current rotation';
    const cur = R.list.find(x => x.id === 'current'), note = s.adj.final < cur.adj.final && p >= 70 ? ' On the weather alone it does better, but what it asks of you (see above) brings it below your current rotation.' : '';
    return '<b>' + word + (p >= 70 ? ' on the weather alone' : '') + '.</b> Ahead in ' + s.conf.beats + ' of 300 bootstrap resamples of the 25 years, so the result does not hinge on a few unusual seasons.' + note;
  }
  function needText(s) {
    const n = s.need, ks = Object.keys(n); if (!ks.length) return 'Nothing new.';
    return ks.map(k => (s.adj.blocked.includes(k) ? '<span class="bad">' : '') + L.ACCEPT[k].q.replace(/^./, c => c.toLowerCase()) + ': ' + esc(n[k]) + (s.adj.blocked.includes(k) ? ' (you said this isn’t possible)</span>' : '')).join('<br>');
  }

  function strat() {
    const fb = store.get('furrowlab:fb', {}), mine = fb[fieldKey] || {}, sum = L.summarise(D.shared).votes, cur = R.list.find(s => s.id === 'current');
    let h = '';
    if (inp.cons.length) h += '<div class="card"><b>Constraints applied from your notes:</b><ul>' + inp.cons.map(c => '<li>' + esc(c.tag) + '. ' + esc(c.why) + '</li>').join('') + '</ul></div>';
    if (R.plan) {
      const P = R.plan;
      h += '<div class="card"><h3>Phased plan</h3>' + (P.same ? '<p>Same option fits both phases: <b>' + esc(P.first.name) + '</b>. </p>'
        : '<div class="plan"><div><div class="mute">Years 1 to ' + P.switchAfter + '</div><b>' + esc(P.first.name) + '</b><div class="mute">' + esc(rotTxt(P.first)) + '</div></div><div><div class="mute">From year ' + (P.switchAfter + 1) + '</div><b>' + esc(P.then.name) + '</b><div class="mute">' + esc(rotTxt(P.then)) + '</div></div></div><p class="mute" style="margin-top:10px">Switch when priorities change. See Land care rewards for how a soil agreement could fund the second phase.</p>') + '</div>';
    }
    const pre = h; h = '';
    const bestIdx = Math.max(0, R.list.findIndex(s => s.id !== 'current' && s.id !== 'mono' && !s.adj.blocked.length));
    const order = [R.list[bestIdx]].concat(R.list.filter((_, i) => i !== bestIdx));
    order.forEach((s, i) => {
      if (i === 1) h += pre + '<button class="go" id="more" style="width:100%;margin:6px 0 4px">' + (D.showAll ? 'Hide other options' : 'See other options (' + (order.length - 1) + ')') + '</button><div id="others"' + (D.showAll ? '' : ' hidden') + '>';
      const I = INFO(s.id) || {}, f = mine[s.id] || {}, v = sum[s.id], c = carbon(s), isNow = s.id === 'current', blocked = s.adj.blocked.length;
      const badges = (isNow ? '<span class="badge now">What you grow now</span>' : '') + (i === 0 && !isNow && !blocked ? '<span class="badge best">Your best match</span>' : '') + (s.id === 'mono' ? '<span class="badge no">For comparison only, not advice</span>' : '') + (s.exp ? '<span class="badge exp">New, less tested</span>' : '') + (blocked ? '<span class="badge no">Needs something you said isn’t possible</span>' : '');
      const sc = Math.max(0, Math.round(s.adj.final));
      h += '<div class="card' + (isNow ? ' now' : '') + '">' + badges + '<div class="cropline">' + esc(rotTxt(s)) + '</div><div class="mute">' + esc(s.name) + '</div>'
        + '<div class="score"><b>' + sc + '</b><span class="mute">/ 100, weighted by your priorities</span><div class="meter"><i style="width:' + Math.max(2, sc) + '%"></i></div></div>'
        + (!isNow ? '<div class="mute">' + (sc > Math.round(cur.adj.final) ? '+' : '') + (sc - Math.round(cur.adj.final)) + ' vs current rotation</div>' : '')
        + '<details' + (i === 0 ? ' open' : '') + '><summary>Details</summary><dl>'
        + '<dt>Why it’s here</dt><dd>' + esc(I.why) + '</dd><dt>What backs it up</dt><dd>' + esc(I.ev) + '</dd>' + (I.ben ? '<dt>Expected benefit</dt><dd>' + esc(I.ben) + '</dd>' : '')
        + '<dt>Requirements</dt><dd>' + needText(s) + '</dd>'
        + (s.conf ? '<dt>Confidence</dt><dd>' + confText(s) + '</dd>' : '')
        + '<dt>Climate sensitivity</dt><dd>' + (s.spread <= 4 ? 'Robust: ' : s.spread <= 8 ? 'Moderate: ' : 'Sensitive: ') + 'score range of ' + s.spread.toFixed(0) + ' points across all climate scenarios.</dd>'
        + (c ? '<dt>Soil carbon</dt><dd>' + (c.perYear >= 0 ? '+' : '') + c.perYear.toFixed(2) + ' t C/ha/yr over 20 years (IPCC Tier 1)</dd>' : '')
        + '<dt>Gaps</dt><dd>' + esc(I.gap || '') + '</dd><dt>Needs local review</dt><dd>' + esc(I.risk || '') + '</dd>'
        + (I.since ? '<dt>Status</dt><dd>' + esc(I.since) + '</dd>' : '')
        + (v ? '<dt>Other farms</dt><dd>' + v.works + ' positive, ' + v.no + ' negative, ' + v.tried + ' tried' + (v.fields.size >= 2 ? ' (' + v.fields.size + ' fields, confirmed)' : ' (1 field, unconfirmed)') + '</dd>' : '')
        + '</dl><div class="fb" data-s="' + s.id + '">'
        + ['works', 'no', 'tried'].map(k => '<button data-k="' + k + '" class="big' + (f.v === k ? ' on' : '') + '">' + { works: 'Would work here', no: 'Wouldn’t work here', tried: 'We tried this' }[k] + '</button>').join('')
        + '<input placeholder="Note (optional, shared with other farms)" value="' + esc(f.note || '') + '" style="flex:1;min-width:220px"></div></details></div>';
    });
    if (order.length > 1) h += '</div>'; else h += pre;
    $('strat').innerHTML = h;
    if ($('more')) $('more').onclick = () => { D.showAll = !D.showAll; $('others').hidden = !D.showAll; $('more').textContent = D.showAll ? 'Hide other options' : 'See other options (' + (order.length - 1) + ')'; };
    $('strat').querySelectorAll('.fb').forEach(el => {
      const id = el.dataset.s, put = patch => { const all = store.get('furrowlab:fb', {}); all[fieldKey] = all[fieldKey] || {}; all[fieldKey][id] = Object.assign(all[fieldKey][id] || {}, patch, { at: new Date().toISOString() }); store.set('furrowlab:fb', all); };
      el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); put({ v: b.dataset.k }); });
      el.querySelector('input').onchange = e => put({ note: e.target.value });
    });
  }

  function params() {
    const cols = [
      ['Your score', s => Math.round(s.adj.final)], ['Before what you can work with', s => s.match.toFixed(0)], ['Water', s => s.sc.water], ['Soil health', s => s.sc.soil], ['Soil kept in place', s => s.sc.erosion], ['Profit', s => s.sc.income], ['Bad years', s => s.sc.resilience],
      ['Sure (of 300)', s => s.conf ? s.conf.beats : '–'], ['Worst future climate', s => s.worst.toFixed(0)], ['Swing', s => s.spread.toFixed(0)],
      ['Bare soil days a year', s => s.x.bare], ['Heavy rain on bare soil %', s => s.x.heavyBare], ['Nitrogen from legumes kg/ha/yr', s => s.x.nfix],
      ['Crop families', s => s.x.fams], ['Same family in a row', s => s.x.famRun], ['Short of water, average %', s => s.x.waterGap], ['Short of water, worst years %', s => s.x.badYear],
      ['Hot days at flowering', s => s.x.heat], ['Soil carbon t/ha/yr', s => { const c = carbon(s); return c ? c.perYear.toFixed(2) : '–'; }], ['Sowings a year', s => s.x.ops]
    ];
    let h = '';
    if (D.soil) h += '<div class="card">Soil (SoilGrids, 0-30 cm): ' + D.soil.ocs + ' t C/ha' + (D.soil.soc != null ? ', organic carbon ' + D.soil.soc + ' g/kg' : '') + (D.soil.n != null ? ', nitrogen ' + D.soil.n + ' g/kg' : '') + (D.soil.ph != null ? ', pH ' + D.soil.ph : '') + '. Climate class: ' + (moist() ? 'moist' : 'dry') + ' (annual rain ' + (moist() ? 'above' : 'below') + ' reference ET).</div>';
    h += '<div class="card scroll"><table><tr><th>Option</th>' + cols.map(c => '<th class="n">' + c[0] + '</th>').join('') + '</tr>';
    const heat = (v, i) => { const x = +v; if (i > 7 || !isFinite(x)) return v; const g = Math.max(0, Math.min(100, x)) / 100; return '<span class="chip" style="background:rgba(180,236,143,' + (0.08 + g * 0.42).toFixed(2) + ')">' + v + '</span>'; };
    R.list.forEach(s => { h += '<tr><td>' + esc(s.name) + '</td>' + cols.map((c, i) => '<td class="n">' + heat(c[1](s), i) + '</td>').join('') + '</tr>'; });
    $('params').innerHTML = h + '</table></div><p class="mute">Definitions in How it works.</p>';
  }

  function crops() {
    const dots = v => '<span class="dots">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= v ? 'on' : '') + '"></i>').join('') + '</span>';
    const ids = CROP_ORDER.filter(c => c !== 'fallow');
    let h = '<div class="card"><h3>Soil functions by crop type</h3><ul>'
      + '<li><b>Nitrogen-fixing crops</b> (soybean, field pea, alfalfa) host bacteria in their roots that turn nitrogen from the air into fertiliser. The next crop needs less bought nitrogen.</li>'
      + '<li><b>Cover crops</b> (rye, legume mixes) grow between main crops so the soil is never bare. Roots hold the soil, feed soil life and add organic matter; the leaves take the hit from heavy rain.</li>'
      + '<li><b>Deep-rooting crops</b> (sunflower, canola, alfalfa) break up compacted layers and pull up water and nutrients from deep down that shallow crops can’t reach.</li>'
      + '<li><b>Drought-tolerant crops</b> (sorghum, sunflower) keep yielding in dry years, so the farm has income when other crops fail.</li></ul></div>';
    h += '<div class="card scroll"><table><tr><th>Crop</th><th>Cost to grow</th><th>Machinery needed</th><th>Buyers</th><th>Price steadiness</th><th>Few buyers</th><th>Needs nitrogen</th><th>Needs water</th><th>Root depth</th><th>Good for</th><th>Who buys it</th></tr>'
      + ids.map(c => { const I = L.CROPINFO[c]; return '<tr><td><b>' + C[c].short + '</b></td><td>' + dots(I.cost) + '</td><td>' + dots(I.machinery) + '</td><td>' + dots(I.market) + '</td><td>' + dots(I.stable) + '</td><td>' + dots(I.niche) + '</td><td>' + dots(I.nNeed) + '</td><td>' + dots(I.water) + '</td><td>' + dots(I.root) + '</td><td>' + I.roles.join(', ') + '</td><td>' + I.buyers + '</td></tr>'; }).join('')
      + '</table></div><p class="mute">Relative scale 1 to 5 across these crops. “Few buyers” is high when only a few buyers take the crop, so growing much more of it can push the price down. General agronomic comparison, not regional prices.</p>';
    $('crops').innerHTML = h;
  }

  function farmRows(text, cal) { return L.compareFarm(L.parseFarm(text), cal, R.cl.south); }
  function farm() {
    const saved = store.get('furrowlab:farm', {})[fieldKey] || '', p = D.patch;
    let h = '<div class="card"><h3>Your own records</h3><p class="mute">One line per crop: <code>year, crop, sowing date, harvest date, yield t/ha</code>. Used to calibrate crop timing automatically.</p>'
      + '<textarea id="csv" placeholder="2024, wheat, 2023-10-01, 2024-07-05, 5.1&#10;2024, sunflower, 2024-04-25, 2024-09-20, 2.4">' + esc(saved) + '</textarea>'
      + '<div class="bar"><button class="go" id="cmp">Save my records</button></div><div id="cmpout"></div></div>'
      + '<div class="card"><h3>What the model learned</h3>' + (p ? tuneTable(p) : '<p class="mute">No records yet. Calibration uses your records and shared notes.</p>') + '</div>';
    if (D.qcDrop.length) h += '<div class="card"><h3>Records we didn’t use</h3><p class="mute">Records failing quality checks are excluded from calibration.</p><div class="scroll"><table><tr><th>Year</th><th>Crop</th><th>Why not</th></tr>' + D.qcDrop.map(r => '<tr><td>' + r.year + '</td><td>' + esc(r.crop ? C[r.crop].short : r.raw) + '</td><td>' + esc(r.why) + '</td></tr>').join('') + '</table></div></div>';
    $('farm').innerHTML = h;
    const rows = farmRows(saved, R.cal);
    if (rows.length) {
      const d = v => v == null ? '–' : (v > 0 ? '+' : '') + v + ' days';
      $('cmpout').innerHTML = '<div class="scroll"><table><tr><th>Year</th><th>Crop</th><th class="n">Your sowing vs model</th><th class="n">Your harvest vs model</th><th class="n">Yield</th></tr>'
        + rows.map(r => '<tr><td>' + r.year + '</td><td>' + esc(r.crop ? C[r.crop].short : r.raw + ' (unknown)') + '</td><td class="n">' + d(r.sowDiff) + '</td><td class="n">' + d(r.harvDiff) + '</td><td class="n">' + (r.yield || '–') + '</td></tr>').join('') + '</table></div><p class="mute">Positive means later than the model.</p>';
    }
    $('cmp').onclick = () => {
      const t = $('csv').value, all = store.get('furrowlab:farm', {}); all[fieldKey] = t; store.set('furrowlab:farm', all);
      if (t.trim() && !L.parseFarm(t).length) { $('cmpout').innerHTML = '<p class="warn">No readable lines. Each line must start with a 4-digit year.</p>'; return; }
      compute(); setTab('farm');
    };
  }
  function tuneTable(p) {
    const f = v => v == null ? '–' : v.toFixed(0) + ' d', e = p._err;
    let h = '<div class="scroll"><table><tr><th>Crop</th><th>Setting</th><th class="n">Was</th><th class="n">Now</th><th class="n">Records</th></tr>';
    for (const id in p) { if (id[0] === '_') continue; for (const k in p[id]) if (k !== 'n') h += '<tr><td>' + C[id].short + '</td><td>' + ({ off: 'Days after last frost to sow', dry: 'Days from ripe to harvest', lead: 'Days before first frost to sow', gdd: 'Heat needed to ripen' })[k] + '</td><td class="n">' + C[id][k] + '</td><td class="n">' + p[id][k] + '</td><td class="n">' + p[id].n + '</td></tr>'; }
    h += '</table></div>';
    if (e) h += '<p>Average miss went from ' + f(e.before.sow) + ' to ' + f(e.after.sow) + ' for sowing and ' + f(e.before.harv) + ' to ' + f(e.after.harv) + ' for harvest, from ' + e.before.n + ' records.</p>';
    return h;
  }
  function stress() {
    const sc = R.scen, top = R.winners, nm = id => R.list.find(s => s.id === id).name;
    const best = {}; sc.forEach(x => best[x.id] = Math.max.apply(null, R.list.map(s => s.byScen[x.id]))); const bestR = Math.max.apply(null, R.list.map(s => s.recent));
    const col = (v, b) => '<span class="cell" style="background:' + (v === b ? 'rgba(143,196,106,.25)' : 'transparent') + '">' + v.toFixed(0) + '</span>';
    const wins = {}; Object.values(top).forEach(w => wins[w] = (wins[w] || 0) + 1);
    let h = '<div class="card"><b>' + (R.stable ? '<span class="ok">The winner holds up.</span> ' + esc(nm(top.base)) : '<span class="warn">The winner changes.</span>') + '</b><div class="mute">' + Object.keys(wins).sort((a, b) => wins[b] - wins[a]).map(w => esc(nm(w)) + ' wins ' + wins[w] + ' of ' + (sc.length + 1)).join(', ') + '</div></div>';
    if (D.proj) h += '<div class="card scroll"><table><tr><th>Climate model, 2036-2050 vs 2001-2025</th><th class="n">Temperature</th><th class="n">Rain</th></tr>' + D.proj.map(p => '<tr><td>' + esc(p.name) + '</td><td class="n">' + (p.temp > 0 ? '+' : '') + p.temp + ' °C</td><td class="n">' + (p.rain > 0 ? '+' : '') + p.rain + '%</td></tr>').join('') + '</table></div>';
    h += '<div class="card scroll"><table><tr><th>Strategy</th>' + sc.map(s => '<th class="n">' + esc(s.name) + '</th>').join('') + '<th class="n">Only 2013-2025</th><th class="n">Worst</th><th class="n">Swing</th></tr>';
    R.list.forEach(s => { h += '<tr><td>' + esc(s.name) + '</td>' + sc.map(x => '<td class="n">' + col(s.byScen[x.id], best[x.id]) + '</td>').join('') + '<td class="n">' + col(s.recent, bestR) + '</td><td class="n">' + s.worst.toFixed(0) + '</td><td class="n">' + s.spread.toFixed(0) + '</td></tr>'; });
    $('stress').innerHTML = h + '</table></div>';
  }
  function spark(v, labels, unit) {
    const W = 300, H = 60, mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), x = i => 4 + i * (W - 8) / (v.length - 1), y = a => H - 6 - (mx > mn ? (a - mn) / (mx - mn) : 0.5) * (H - 12);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:340px;height:60px"><polyline fill="none" stroke="#8fc46a" stroke-width="2" points="' + v.map((a, i) => x(i) + ',' + y(a)).join(' ') + '"/>' + v.map((a, i) => '<circle cx="' + x(i) + '" cy="' + y(a) + '" r="2.5" fill="#ece6dc"><title>' + labels[i] + ': ' + (Math.round(a * 100) / 100) + unit + '</title></circle>').join('') + '</svg>';
  }
  function veg() {
    const rc = L.rainChange(R.cl), clear = t => t.label === 'clear trend', row = (name, t, unit, ser, u2, up, down) => '<tr><td>' + name + '</td><td class="n">' + (t.perDecade > 0 ? '+' : '') + (Math.round(t.perDecade * 100) / 100) + ' ' + unit + ' per 10 years</td><td class="' + (clear(t) ? 'warn' : 'mute') + '">' + (clear(t) ? 'Real change' : 'Could be chance') + '</td><td>' + spark(ser, rc.series.labels, u2) + '</td><td>' + (t.perDecade > 0 ? up : t.perDecade < 0 ? down : 'No change.') + (clear(t) ? '' : ' The change is small enough that it could be chance, so don’t plan around it yet.') + '</td></tr>';
    let h = '<div class="card scroll"><h3>Is the weather here changing?</h3><table><tr><th>What</th><th class="n">Change</th><th>Real or chance?</th><th>2001-2025</th><th>What it means for you</th></tr>'
      + row('Days with a downpour (25 mm or more)', rc.heavy, 'days', rc.series.heavy, ' days', 'More of the rain comes in downpours. Water runs off instead of soaking in, and bare soil washes away. So keeping the soil covered matters more.', 'Fewer downpours, so less risk of soil washing away.')
      + row('Longest stretch without rain', rc.dry, 'days', rc.series.dry, ' days', 'Dry spells are getting longer. Crops have to live off stored soil water for longer, so soil that holds water and crops with deep roots matter more.', 'Dry spells are getting shorter, so crops go without rain for less time.')
      + row('How uneven rain is between months', rc.cv, '', rc.series.cv, '', 'Rain is getting bunched into fewer months. Some months flood and others are dry, which makes sowing dates and water planning harder.', 'Rain is spreading more evenly across the year.')
      + row('Total rain in a year', rc.rain, 'mm', R.cl.years.map(Y => Y.rain), ' mm', 'More rain overall. Good for water-hungry crops, but watch for waterlogging on heavy soil.', 'Less rain overall. Each millimetre counts more, so saving water and drought-tolerant crops matter more.')
      + row('Days over 32 °C', rc.hot, 'days', R.cl.years.map(Y => Y.hot32), ' days', 'More very hot days. Heat at flowering cuts yields, and crops use more water, so the soil dries faster.', 'Fewer very hot days.') + '</table></div>';
    if (!D.nd) { $('veg').innerHTML = h + '<div class="card mute">Satellite years still loading.</div>'; return; }
    const ys = L.ndviYears(D.nd, R.cl);
    const r1 = L.corr(ys.map(y => y.peak), ys.map(y => y.bal)), r2 = L.corr(ys.map(y => y.peak), ys.map(y => y.hot)), r3 = L.corr(ys.map(y => y.mean), ys.map(y => y.dry));
    const rr = r => r == null ? '–' : (r > 0 ? '+' : '') + r.toFixed(2);
    h += '<div class="card"><h3>What hurts your crops most</h3><p class="mute">MODIS NDVI for the field vs seasonal weather, by year.</p><table><tr><td>Greenest point of the year vs rain minus evaporation</td><td class="n">' + rr(r1) + '</td></tr><tr><td>Greenest point vs days over 32 °C</td><td class="n">' + rr(r2) + '</td></tr><tr><td>Average greenness vs longest dry stretch</td><td class="n">' + rr(r3) + '</td></tr></table><div class="mute">' + ys.length + ' years, Pearson correlation. The strongest link points to the main stress factor for this field.</div></div>';
    h += '<div class="card scroll"><table><tr><th>Year</th><th class="n">Peak NDVI</th><th class="n">Avg NDVI</th><th class="n">Low-green days</th><th class="n">Rain minus ET0, season mm</th><th class="n">Days over 32 °C</th><th class="n">Longest dry spell</th></tr>'
      + ys.map(y => '<tr><td>' + y.year + '</td><td class="n">' + y.peak.toFixed(2) + '</td><td class="n">' + y.mean.toFixed(2) + '</td><td class="n">' + y.low + '</td><td class="n">' + Math.round(y.bal) + '</td><td class="n">' + y.hot + '</td><td class="n">' + y.dry + '</td></tr>').join('') + '</table></div>';
    $('veg').innerHTML = h;
  }
  function myNotes() { return { app: 'furrow-lab', at: new Date().toISOString(), field: fieldKey, feedback: store.get('furrowlab:fb', {}), records: store.get('furrowlab:farm', {}) }; }
  function merge(j) {
    const fb = store.get('furrowlab:fb', {}), fr = store.get('furrowlab:farm', {});
    for (const k in j.feedback || {}) { fb[k] = fb[k] || {}; for (const s in j.feedback[k]) if (!fb[k][s]) fb[k][s] = j.feedback[k][s]; }
    for (const k in j.records || {}) if (!fr[k]) fr[k] = j.records[k];
    store.set('furrowlab:fb', fb); store.set('furrowlab:farm', fr);
  }
  function shared() {
    const sum = L.summarise(D.shared), names = {}; R.list.forEach(s => names[s.id] = s.name);
    let h = '<div class="card"><b>Your notes</b><div class="bar"><button id="exp">Download file</button><button id="impb">Load a file</button><input id="imp" type="file" accept=".json" hidden><button id="lnk">Copy share link</button><button id="post">Post to the shared list</button></div><div id="shmsg" class="mute"></div></div>'
      + '<div class="card"><b>Shared list</b><div class="bar"><button class="go" id="pull">Load everyone’s notes</button></div><div id="pullmsg" class="mute">' + (D.shared.length ? D.shared.length + ' notes loaded.' : '') + '</div>';
    if (Object.keys(sum.votes).length) {
      h += '<div class="scroll"><table><tr><th>Strategy</th><th class="n">Would work</th><th class="n">Wouldn’t</th><th class="n">Tried</th><th class="n">Fields</th></tr>'
        + Object.keys(sum.votes).map(k => { const v = sum.votes[k]; return '<tr><td>' + esc(names[k] || k) + '</td><td class="n">' + v.works + '</td><td class="n">' + v.no + '</td><td class="n">' + v.tried + '</td><td class="n">' + v.fields.size + '</td></tr>'; }).join('') + '</table></div>';
      h += '<p class="mute">' + sum.recs.length + ' sets of field records available for tuning.</p>';
    }
    $('shared').innerHTML = h + '</div>';
    $('exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(myNotes(), null, 1)], { type: 'application/json' })); a.download = 'furrow-notes.json'; a.click(); };
    $('impb').onclick = () => $('imp').click();
    $('imp').onchange = async e => { try { merge(JSON.parse(await e.target.files[0].text())); compute(); setTab('shared'); } catch (er) { $('shmsg').innerHTML = '<span class="bad">That file isn’t a Furrow notes file.</span>'; } };
    $('lnk').onclick = async () => { const u = location.href.split('#')[0] + '#n=' + L.pack(myNotes()); try { await navigator.clipboard.writeText(u); $('shmsg').textContent = 'Link copied.'; } catch (e) { $('shmsg').textContent = u; } };
    $('post').onclick = () => { const body = 'Field notes from the Furrow lab.\n\n```json\n' + JSON.stringify(myNotes()) + '\n```'; window.open('https://github.com/' + REPO + '/issues/new?title=' + encodeURIComponent('Field notes ' + fieldKey) + '&body=' + encodeURIComponent(body).slice(0, 7000), '_blank'); };
    $('pull').onclick = async () => {
      $('pullmsg').textContent = 'Loading…';
      try { const j = await getJSON('https://api.github.com/repos/' + REPO + '/issues?state=all&per_page=100', 20000); D.shared = L.fromIssues(j); store.set('furrowlab:shared', D.shared); compute(); setTab('shared'); }
      catch (e) { $('pullmsg').textContent = 'Couldn’t reach GitHub: ' + e.message; }
    };
  }
  async function sha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  function care() {
    const base = R.list.find(s => s.id === 'current'), opts = R.list.filter(s => s.id !== 'current' && s.id !== 'mono');
    let h = '<div class="card"><b>Soil carbon and payout</b><div class="bar"><select id="cs">' + opts.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + '</select>'
      + '<label>Hectares <input id="ha" type="number" value="100" min="1"></label><label>€ per t CO₂ <input id="pr" type="number" value="40" min="0"></label><label>Years <input id="yr" type="number" value="5" min="1" max="11"></label><label>Max low-green days <input id="mb" type="number" value="90" min="0"></label></div><div id="cres"></div></div>'
      + '<div class="card"><b>Satellite check, replayed on past years</b><div id="orc"></div></div>'
      + '<div class="card"><b>Agreement</b><div class="bar"><button id="sign">Sign (simulation)</button><button id="check">Next year’s check</button><button id="reset">Start over</button></div><div id="ledger"></div></div>'
      + '<div class="card"><b>On a real blockchain (test network)</b><div class="bar"><button id="wal">Connect wallet</button><input id="farmer" placeholder="Farmer address 0x…" style="flex:1;min-width:220px"><input id="eth" type="number" step="0.001" value="0.01" title="Test ETH per year"><button id="dep" disabled>Deploy contract</button><button id="rep" disabled>Send next satellite check</button></div><div id="chain" class="mute"></div>'
      + '<p class="mute"><a href="../contract/CoverAgreement.sol" style="color:var(--green)">Contract code</a></p></div>';
    $('care').innerHTML = h;
    const pick = () => R.list.find(x => x.id === $('cs').value), yrs = () => Math.max(1, Math.min(11, +$('yr').value));
    const calc = () => {
      const s = pick(), c = carbon(s), ha = +$('ha').value, pr = +$('pr').value, y = yrs();
      const tC = c ? c.perYear : Math.max(0, s.x.carbon - base.x.carbon), co2 = Math.max(0, tC) * 44 / 12, money = co2 * ha * y * pr;
      $('cres').innerHTML = '<table><tr><td>Method</td><td class="n">' + (c ? 'IPCC Tier 1, ' + (moist() ? 'moist' : 'dry') + ' temperate, inputs ' + c.level : 'rough average (soil data missing)') + '</td></tr>'
        + (c ? '<tr><td>Soil carbon now, top 30 cm</td><td class="n">' + D.soil.ocs + ' t C/ha</td></tr><tr><td>After 20 years</td><td class="n">' + c.after20.toFixed(1) + ' t C/ha</td></tr>' : '')
        + '<tr><td>Change per year</td><td class="n">' + tC.toFixed(2) + ' t C/ha</td></tr><tr><td>As CO₂</td><td class="n">' + co2.toFixed(2) + ' t/ha/yr</td></tr><tr><td>Over the agreement</td><td class="n">' + (co2 * ha * y).toFixed(0) + ' t CO₂</td></tr><tr><td>Possible payout</td><td class="n"><b>€' + Math.round(money).toLocaleString() + '</b> (€' + (y && ha ? Math.round(money / y / ha) : 0) + '/ha/yr)</td></tr></table>';
      return { money, y };
    };
    const checks = () => {
      if (!D.nd) return [];
      const y = yrs(), last = D.nd.yrs[D.nd.yrs.length - 1], out = [];
      for (let k = y - 1; k >= 0; k--) { const r = L.oracle(D.nd, last - k, R.cl.south, +$('mb').value); if (r) out.push(r); }
      return out;
    };
    const showOrc = () => {
      const c = checks();
      $('orc').innerHTML = !D.nd ? '<span class="mute">Satellite years still loading.</span>' : '<div class="scroll"><table><tr><th>Year</th><th class="n">Low-green days</th><th class="n">Winter NDVI</th><th>Paid?</th></tr>' + c.map(r => '<tr><td>' + r.year + '</td><td class="n">' + r.bare + '</td><td class="n">' + r.winter.toFixed(2) + '</td><td class="' + (r.covered ? 'ok' : 'bad') + '">' + (r.covered ? 'yes' : 'no') + '</td></tr>').join('') + '</table></div>';
    };
    ['cs', 'ha', 'pr', 'yr', 'mb'].forEach(id => $(id).oninput = () => { calc(); showOrc(); }); calc(); showOrc();

    const LK = 'furrowlab:ledger:' + fieldKey;
    const show = () => { const lg = store.get(LK, []); $('ledger').innerHTML = lg.length ? lg.map((e, i) => '<div style="margin:8px 0"><b>' + (i + 1) + '. ' + esc(e.what) + '</b> <span class="mute">' + e.at.slice(0, 16).replace('T', ' ') + '</span><div class="hash">' + e.prev.slice(0, 16) + '…, ' + e.hash.slice(0, 16) + '…</div></div>').join('') + '<div class="mute" id="vfy"></div>' : '<p class="mute">Nothing signed yet.</p>'; verify(lg); };
    const verify = async lg => { let prev = '0'.repeat(64), ok = true; for (const e of lg) { if (e.prev !== prev || await sha(prev + e.what + e.at) !== e.hash) { ok = false; break; } prev = e.hash; } if ($('vfy')) $('vfy').innerHTML = lg.length ? (ok ? '<span class="ok">Chain checks out.</span>' : '<span class="bad">Chain was changed.</span>') : ''; };
    const push = async what => { const lg = store.get(LK, []), prev = lg.length ? lg[lg.length - 1].hash : '0'.repeat(64), at = new Date().toISOString(); lg.push({ what, at, prev, hash: await sha(prev + what + at) }); store.set(LK, lg); show(); };
    $('sign').onclick = () => { const c = calc(); push('Signed: ' + pick().name + ', ' + $('ha').value + ' ha, ' + c.y + ' years, up to €' + Math.round(c.money).toLocaleString() + ', paid if under ' + $('mb').value + ' low-green days'); };
    $('check').onclick = () => {
      const lg = store.get(LK, []); if (!lg.length) return;
      const done = lg.filter(e => e.what.startsWith('Year')).length, ch = checks(), c = calc();
      if (done >= ch.length) { push('Agreement finished'); return; }
      const r = ch[done]; push('Year ' + r.year + ': MODIS shows ' + r.bare + ' low-green days, ' + (r.covered ? 'paid €' + Math.round(c.money / c.y).toLocaleString() : 'not paid'));
    };
    $('reset').onclick = () => { store.set(LK, []); show(); };
    show();
    chainUI(checks, () => yrs());
  }

  let W = null;
  function loadEthers() { return window.ethers ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js'; s.onload = ok; s.onerror = () => no(new Error('couldn’t load ethers')); document.head.appendChild(s); }); }
  function chainUI(checks, yrs) {
    const msg = t => $('chain').innerHTML = t, ST = 'furrowlab:chain:' + fieldKey;
    const st = store.get(ST, null); if (st) { msg('Contract ' + st.addr + ' on chain ' + st.chain + ', ' + st.sent + ' checks sent.'); }
    $('wal').onclick = async () => {
      if (!window.ethereum) { msg('No wallet in this browser. Install MetaMask and switch it to the Sepolia test network.'); return; }
      try {
        await loadEthers(); const p = new ethers.BrowserProvider(window.ethereum); await p.send('eth_requestAccounts', []);
        const net = await p.getNetwork(), s = await p.getSigner(), a = await s.getAddress(); W = { p, s, a, chain: Number(net.chainId) };
        if (!$('farmer').value) $('farmer').value = a;
        msg('Connected ' + a.slice(0, 8) + '… on chain ' + W.chain + (W.chain === 1 ? ' <span class="bad">This is mainnet with real money. Switch to Sepolia.</span>' : ''));
        $('dep').disabled = W.chain === 1; $('rep').disabled = !(st && st.chain === W.chain);
      } catch (e) { msg('<span class="bad">' + esc(e.shortMessage || e.message) + '</span>'); }
    };
    $('dep').onclick = async () => {
      if (!W || W.chain === 1) return;
      try {
        const per = ethers.parseEther(String(+$('eth').value || 0.001)), n = yrs(), c = checks();
        const first = c.length ? c[0].year : 2021;
        msg('Confirm in your wallet…');
        const f = new ethers.ContractFactory(window.COVER_ABI, window.COVER_BIN, W.s), k = await f.deploy($('farmer').value, W.a, first, n, per, { value: per * BigInt(n) });
        await k.waitForDeployment(); const addr = await k.getAddress();
        store.set(ST, { addr, chain: W.chain, sent: 0, first, n }); msg('Deployed ' + addr + '. Funded ' + ethers.formatEther(per * BigInt(n)) + ' test ETH.'); $('rep').disabled = false;
      } catch (e) { msg('<span class="bad">' + esc(e.shortMessage || e.message) + '</span>'); }
    };
    $('rep').onclick = async () => {
      const s0 = store.get(ST, null); if (!W || !s0) return;
      const c = checks().find(r => r.year === s0.first + s0.sent); if (!c) { msg('All years reported.'); return; }
      try {
        msg('Confirm in your wallet…');
        const k = new ethers.Contract(s0.addr, window.COVER_ABI, W.s), tx = await k.report(c.year, c.covered, c.bare, Math.round(c.winter * 1000)); await tx.wait();
        s0.sent++; store.set(ST, s0); msg('Year ' + c.year + ' sent: ' + (c.covered ? 'paid' : 'not paid') + '. Tx ' + tx.hash.slice(0, 12) + '…');
      } catch (e) { msg('<span class="bad">' + esc(e.shortMessage || e.message) + '</span>'); }
    };
  }
  function method() {
    $('method').innerHTML = '<div class="card method">'
      + '<h3>1. Weather</h3><p>We download every day from 2001 to 2025 for your field from NASA POWER: highest and lowest temperature, rain, and how wet the root zone is. That is about 9,100 days. NASA builds these from satellites and weather models on a grid about 50 km wide, so neighbouring fields get the same weather.</p>'
      + '<h3>2. How much water the crop could use (ET0)</h3><p>For each day we work out how much water a field of grass would evaporate, using the Hargreaves formula from the FAO’s guide to crop water needs (FAO-56). It needs only temperature and the sun’s angle for your latitude. The main app uses the fuller Penman-Monteith formula when sunlight, wind and humidity are available.</p>'
      + '<h3>3. When each crop is sown and harvested</h3><p>From the temperatures we find the last spring frost and first autumn frost each year. Summer crops are sown a set number of days after the last frost; winter crops a set number of days before the first frost. Then we add up warmth day by day (growing degree days, the temperature above the crop’s base) until the crop has had enough to ripen, plus a few days of drying before harvest. The numbers per crop were tuned so the dates match the US Department of Agriculture’s usual dates for Iowa and Kansas, and they keep tuning themselves from farm records (step 10).</p>'
      + '<h3>4. Water in the soil</h3><p>We treat the root zone as a bucket. Its size depends on your soil type. Each day rain fills it, the crop drinks from it (ET0 times a crop factor that changes as the crop grows, from FAO-56), and anything extra drains away. When the bucket runs low the crop is short of water. We run this for every day of all 25 years, and start the rotation in every possible year so no crop gets only the lucky years.</p>'
      + '<h3>5. The five scores</h3><ul><li><b>Water</b>: how often crops were short of water, compared with growing nothing special.</li><li><b>Soil health</b>: more points for legumes (nitrogen), cover crops, perennial crops, less tillage, and changing crop families; fewer for the same family year after year.</li><li><b>Soil kept in place</b>: bare soil days and heavy rain (over 12.7 mm a day) that fell on poorly covered soil, made worse by slope and ploughing.</li><li><b>Profit</b>: based on how much each crop usually costs to grow and how many buyers it has (see Crop facts). There are no local prices in it.</li><li><b>Bad years</b>: how the rotation did in the hottest, driest years of the 25.</li></ul><p>Each score runs from 0 to 100. Your score is the average of the five, weighted by how much each matters to you (step 4 of the setup).</p>'
      + '<h3>6. What you can work with</h3><p>Each option is checked for what it would ask of you: new machinery, a new crop, a new buyer, cover crop seed, a dip in income, more field work, or an untested method. For each thing you rated below 5, the option loses a little (1.2 points per step below 5). If you rated something 0, options that need it go to the bottom and are marked. What you write in your own words is matched against a list of common problems (fuel, money, workers, water, allergies, buyers, storage, livestock, rented land, organic) and changes the ratings and priorities. You see exactly what we understood.</p>'
      + '<h3>7. Confidence (the 300 shuffles)</h3><p>An answer based on 25 years could be luck. So we build 300 new 25-year histories by picking years at random from the real ones (some twice, some not at all) and score every option again on each. If an option beats your current rotation in 280 of 300, the result doesn’t depend on a few unusual years. Statisticians call this a bootstrap.</p>'
      + '<h3>8. The future climate</h3><p>We don’t forecast the weather. We take the 25 real years and replay them warmer and drier: by hand (+1.5 °C, +3 °C, less or more rain), and using seven global climate models (CMIP6, high resolution) that say how much warmer and wetter or drier your spot will be in 2036-2050 than in 2001-2025. If the same option wins in all of them, the advice holds even if the future isn’t like the past. “Swing” is how far an option’s score moves across these futures.</p>'
      + '<h3>9. Rain and plant stress</h3><p>For each of the 25 years we count days with over 25 mm of rain, the longest run of days with almost no rain, and how unevenly rain fell across the months. We test whether these rise or fall over time with the Mann-Kendall test, a standard trend test that doesn’t assume a straight line. Then we compare MODIS satellite greenness (NDVI) for your exact field in 2015-2025 with the weather of each year, to see which weather hurts your crops most.</p>'
      + '<h3>10. Learning from farmers, with checks</h3><p>Farmers can enter when they really sowed and harvested. Before the model uses a record it checks it: records more than 2 months off are treated as typos, and records far from the others for the same crop are set aside. From the rest it shifts the crop settings to cut the average error. Notes shared by other farms are used too, and a vote on an option only counts as confirmed when farmers from at least two different fields agree.</p>'
      + '<h3>11. Soil carbon</h3><p>We take the carbon in your top 30 cm of soil from SoilGrids, then apply the IPCC’s standard factors (Tier 1) for tillage and for how much plant material goes back into the soil. Covers and alfalfa count as high input, mostly fallow as low. The change is spread over 20 years. It is an estimate, not a measurement.</p>'
      + '<h3>Where people have to check our work</h3><ul><li>Whether a crop actually sells, and at what price, near you.</li><li>Local varieties, which can be sown a week or two earlier or later than our dates.</li><li>Pests, weeds and diseases, which we only cover through the change of crop families.</li><li>Whether there is enough rain after the wheat harvest for a cover crop or second crop to establish.</li><li>Irrigation, fertiliser and the farm’s machinery, which we don’t model.</li><li>Laws, subsidies and contracts.</li></ul><p>When farmers mark an option as working or not and add their dates, the tool uses it to improve (step 10).</p>'
      + '</div>';
  }
  function sources() {
    const on = (x, a, b) => x ? '<span class="ok">' + a + '</span>' : b;
    const rows = [
      ['Weather 2001-2025', 'NASA POWER', on(D.raw, 'In use', 'Loading')],
      ['Climate 2036-2050', '7 CMIP6 high-res models via Open-Meteo', on(D.proj, 'In use: climate stress test', 'Loading or failed')],
      ['Greenness 2015-2025', 'MODIS NDVI via ORNL DAAC', on(D.nd, 'In use: plant stress, satellite check', 'Loading or failed')],
      ['Soil carbon, nitrogen, pH', 'ISRIC SoilGrids', on(D.soil, 'In use: carbon estimate', 'Loading or failed')],
      ['Farmer records and votes', 'Farmers, through the shared list', on(D.shared.length, 'In use: ' + D.shared.length + ' notes', 'Ready, none loaded')],
      ['Soil moisture from space', 'NASA SMAP L4', 'Needs a NASA Earthdata login and a server'],
      ['Plant water stress', 'NASA ECOSTRESS', 'Needs a NASA Earthdata login and a server'],
      ['Groundwater', 'NASA GRACE-FO', 'Needs a NASA Earthdata login and a server'],
      ['Sharper field images', 'Sentinel-2', 'Needs a server'],
      ['Crop prices', 'FAOSTAT', 'Not reachable from a browser'],
      ['Field sensors', 'Farm stations', 'Would come in through the shared list']
    ];
    $('sources').innerHTML = '<div class="card scroll"><table><tr><th>What</th><th>From</th><th>Status</th></tr>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table></div>';
  }
  function setTab(t) { if (t === 'mapt') setTimeout(bigMap, 30);
    setTab0(t); }
  function setTab0(t) { document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === t)); }
  function syncToggle() { return; const c = $('wrap').classList.contains('closed'); $('toggle').textContent = c ? 'Show setup' : 'Hide setup'; $('toggle').setAttribute('aria-expanded', String(!c)); }

  $('tabs').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.t); };
  const m = /#n=([\w-]+)/.exec(location.hash); if (m) { try { merge(L.unpack(m[1])); history.replaceState(null, '', location.pathname); } catch (e) {} }
  const sm = /#s=([\w-]+)/.exec(location.hash); if (sm) { try { Object.assign(S, L.unpack(sm[1])); save(); history.replaceState(null, '', location.pathname); } catch (e) {} }
  D.shared = store.get('furrowlab:shared', []);
  drawSetup(); sources(); method();
  const nm = (FIELDS.find(f => f.id === S.field) || { name: 'Your field' }).name;
  $('fieldline').textContent = nm + ', ' + S.rot.map(c => C[c].short).join(', then ');
  (function bg() {
    const z = 14, n = Math.pow(2, z), x = (S.lon + 180) / 360 * n, la = S.lat * Math.PI / 180, y = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n;
    const cx = Math.floor(x), cy = Math.floor(y), el = $('bgmap'), size = 256, cols = Math.ceil(innerWidth / size) + 2, rows = Math.ceil(innerHeight / size) + 2;
    let h = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const tx = cx - Math.floor(cols / 2) + c, ty = cy - Math.floor(rows / 2) + r; h += '<img alt="" loading="lazy" src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + ty + '/' + tx + '" style="left:' + (c * size - (x - cx) * size + innerWidth / 2 - Math.floor(cols / 2) * size) + 'px;top:' + (r * size - (y - cy) * size + innerHeight / 2 - Math.floor(rows / 2) * size) + 'px">'; }
    el.innerHTML = h;
  })();
  if (S.exp == null) S.exp = false;
  go();
  ['summary', 'weather', 'calendar', 'years', 'strat', 'stress', 'veg', 'crops', 'params', 'farm', 'shared', 'care'].forEach(id => $(id).innerHTML = '<p class="mute">Complete the setup first.</p>');
  crops();
})();
