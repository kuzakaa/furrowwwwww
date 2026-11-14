(function () {
  const E = Engine, L = Lab, $ = id => document.getElementById(id), C = E.CROPS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const REPO = 'kuzakaa/furrow';
  const FIELDS = [
    { id: 'odesa', name: 'Odesa region, Ukraine', lat: 46.85, lon: 30.6, rot: 'wheat-sunflower', soil: 'clay_loam', till: 'conv' },
    { id: 'minsk', name: 'Minsk region, Belarus', lat: 53.7, lon: 27.2, rot: 'wheat-canola-oats', soil: 'sandy_loam', till: 'conv' },
    { id: 'iowa', name: 'Central Iowa, USA', lat: 42.03, lon: -93.62, rot: 'corn-soy', soil: 'loam', till: 'reduced' },
    { id: 'freestate', name: 'Free State, South Africa', lat: -27.39, lon: 26.62, rot: 'corn-sunflower', soil: 'sandy_loam', till: 'reduced' },
    { id: 'heilongjiang', name: 'Heilongjiang, China', lat: 45.9, lon: 126.9, rot: 'corn-soy', soil: 'clay_loam', till: 'conv' }
  ];
  const ROTS = ['wheat-sunflower', 'wheat-canola-oats', 'corn-soy', 'corn-sunflower', 'corn', 'wheat-fallow', 'wheat-corn-sunflower', 'sunflower-wheat-wheat'];
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const D = { raw: null, proj: null, soil: null, nd: null, shared: [], tuned: false };
  let R = null, inp = null, fieldKey = '', runId = 0;

  async function getJSON(url, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 20000);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('status ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function cached(key, fn) { const c = store.get(key, null); if (c) return c; const v = await fn(); if (v) store.set(key, v); return v; }

  function fillSelects() {
    const saved = store.get('furrow:choices1', null);
    let o = FIELDS.map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('');
    if (saved && isFinite(saved.lat)) o = '<option value="saved">Your field from the main app</option>' + o;
    $('field').innerHTML = o + '<option value="custom">Type coordinates</option>';
    $('rot').innerHTML = ROTS.map(r => '<option>' + r + '</option>').join('');
    $('soil').innerHTML = Object.keys(E.SOILS).map(k => '<option value="' + k + '">' + E.SOILS[k].name + '</option>').join('');
    $('till').innerHTML = Object.keys(E.TILLAGE).map(k => '<option value="' + k + '">' + E.TILLAGE[k].name + '</option>').join('');
    pickField();
  }
  function pickField() {
    const v = $('field').value, saved = store.get('furrow:choices1', null);
    let f = FIELDS.find(x => x.id === v);
    if (v === 'saved' && saved) {
      const r = saved.rot.map(x => x.c).join('-'); if (!ROTS.includes(r)) { ROTS.push(r); $('rot').innerHTML += '<option>' + r + '</option>'; }
      f = { lat: saved.lat, lon: saved.lon, soil: saved.soil, till: saved.till, rot: r };
    }
    if (!f) return;
    $('lat').value = f.lat; $('lon').value = f.lon; $('rot').value = f.rot; $('soil').value = f.soil; $('till').value = f.till;
  }

  const extrasState = {};
  function note(k, v) { extrasState[k] = v; $('extras').innerHTML = Object.keys(extrasState).map(x => x + ': ' + extrasState[x]).join(' · '); }

  async function go() {
    const lat = +$('lat').value, lon = +$('lon').value, id = ++runId;
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 70) { $('status').textContent = 'Need a real latitude and longitude.'; return; }
    $('status').textContent = 'Getting 25 years of NASA weather…';
    fieldKey = lat.toFixed(2) + ',' + lon.toFixed(2); D.proj = D.soil = D.nd = null; D.tuned = false;
    for (const k in extrasState) delete extrasState[k];
    try {
      D.raw = await cached('furrow1:' + fieldKey, async () => E.parsePower(await getJSON('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=20010101&end=20251231&format=JSON', 60000)));
      if (id !== runId) return;
      inp = { lat, lon, rot: $('rot').value.split('-').map(c => ({ c, cv: null })), soil: $('soil').value, slope: 'gentle', till: $('till').value, irrigated: false, livestock: false, exclude: new Set(), weights: { water: 3, soil: 3, erosion: 3, income: 3, resilience: 3 } };
      compute();
      loadExtras(id, lat, lon);
    } catch (e) { $('status').innerHTML = '<span class="bad">Couldn’t load NASA data.</span> ' + esc(e.message); }
  }

  function patchNow() { return D.tuned ? store.get('furrowlab:patch', {})[fieldKey] || null : null; }
  function compute() {
    R = L.run(D.raw, inp, D.proj || [], patchNow());
    $('status').innerHTML = '<span class="ok">Done.</span> ' + R.list.length + ' strategies, ' + R.cl.n + ' years, ' + R.scen.length + ' climate versions' + (D.tuned ? ', tuned crop settings' : '') + '.';
    render();
  }

  function loadExtras(id, lat, lon) {
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
    cached('furrowlabn1:' + fieldKey, async () => {
      const yrs = []; for (let y = 2015; y <= 2025; y++) yrs.push(y);
      const parts = [['001', '145'], ['161', '305'], ['321', '365']], jobs = [], by = {};
      yrs.forEach(y => { by[y] = new Array(23).fill(null); parts.forEach(q => jobs.push('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=' + lat + '&longitude=' + lon + '&band=250m_16_days_NDVI&startDate=A' + y + q[0] + '&endDate=A' + y + q[1] + '&kmAboveBelow=0&kmLeftRight=0')); });
      let i = 0, done = 0;
      const worker = async () => { while (i < jobs.length) { const u = jobs[i++]; try { const j = await getJSON(u, 30000); (j.subset || []).forEach(r => { const m = String(r.modis_date), y = +m.slice(1, 5), k = Math.round((+m.slice(5) - 1) / 16), v = Array.isArray(r.data) ? +r.data[0] : NaN; if (by[y] && k >= 0 && k < 23 && v > -2000 && v <= 10000) by[y][k] = Math.round(v * 0.1) / 1000; }); } catch (e) {} done++; if (id === runId) note('Satellite 2015-2025', done + '/' + jobs.length); } };
      await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
      const good = yrs.filter(y => by[y].filter(v => v != null).length >= 15);
      return good.length >= 4 ? { yrs: good, by } : null;
    }).then(v => { if (id !== runId) return; D.nd = v; note('Satellite 2015-2025', v ? v.yrs.length + ' years' : 'not enough'); render(); })
      .catch(() => note('Satellite 2015-2025', 'failed'));
  }

  const rotTxt = s => s.rot.map(r => C[r.c].short + (r.cv ? ' + cover' : '')).join(', then ') + (s.till === 'notill' ? ' (no-till)' : '');
  const meter = v => '<div class="meter"><i style="width:' + Math.max(2, Math.min(100, v)) + '%"></i></div>';
  const moist = () => R && R.cl.years.reduce((a, Y) => a + Y.rain, 0) / R.cl.years.reduce((a, Y) => a + Y.et, 0) > 1;
  const carbon = s => D.soil ? L.carbonIPCC(s, R.list.find(x => x.id === 'current'), D.soil.ocs, moist()) : null;

  function render() { if (!R) return; strat(); params(); stress(); veg(); farm(); shared(); care(); sources(); }

  function strat() {
    const fb = store.get('furrowlab:fb', {}), mine = fb[fieldKey] || {}, sum = L.summarise(D.shared).votes;
    let h = '';
    R.list.forEach((s, i) => {
      const I = L.INFO[s.id], f = mine[s.id] || {}, v = sum[s.id], c = carbon(s);
      h += '<div class="card"><details' + (i === 0 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + esc(s.name) + ' <span class="mute">' + s.match.toFixed(0) + '</span></summary>'
        + '<div class="mute" style="margin-top:6px">' + esc(rotTxt(s)) + '</div>' + meter(s.match)
        + '<dl><dt>Why it’s here</dt><dd>' + esc(I.why) + '</dd><dt>Evidence</dt><dd>' + esc(I.ev) + '</dd><dt>Could help with</dt><dd>' + esc(I.ben) + '</dd><dt>What we don’t know</dt><dd>' + esc(I.gap) + '</dd><dt>Ask someone local</dt><dd>' + esc(I.risk) + '</dd>'
        + '<dt>Holds up?</dt><dd>Worst climate ' + s.worst.toFixed(0) + ', swing ' + s.spread.toFixed(0) + '</dd>'
        + (c ? '<dt>Soil carbon</dt><dd>' + (c.perYear >= 0 ? '+' : '') + c.perYear.toFixed(2) + ' t C/ha/yr for 20 years (IPCC Tier 1)</dd>' : '')
        + (v ? '<dt>Other farms</dt><dd>' + v.works + ' would work, ' + v.no + ' wouldn’t, ' + v.tried + ' tried it (' + v.fields.size + ' fields)</dd>' : '')
        + '</dl><div class="fb" data-s="' + s.id + '">'
        + ['works', 'no', 'tried'].map(k => '<button data-k="' + k + '" class="' + (f.v === k ? 'on' : '') + '">' + { works: 'Would work here', no: 'Wouldn’t work here', tried: 'We tried this' }[k] + '</button>').join('')
        + '<input placeholder="Why? (optional)" value="' + esc(f.note || '') + '" style="flex:1;min-width:180px"></div></details></div>';
    });
    $('strat').innerHTML = h;
    $('strat').querySelectorAll('.fb').forEach(el => {
      const id = el.dataset.s, save = patch => { const all = store.get('furrowlab:fb', {}); all[fieldKey] = all[fieldKey] || {}; all[fieldKey][id] = Object.assign(all[fieldKey][id] || {}, patch, { at: new Date().toISOString() }); store.set('furrowlab:fb', all); };
      el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); save({ v: b.dataset.k }); });
      el.querySelector('input').onchange = e => save({ note: e.target.value });
    });
  }

  function params() {
    const cols = [
      ['Overall', s => s.match.toFixed(0)], ['Water', s => s.sc.water], ['Soil', s => s.sc.soil], ['Storms', s => s.sc.erosion], ['Selling', s => s.sc.income], ['Bad weather', s => s.sc.resilience],
      ['Worst climate', s => s.worst.toFixed(0)], ['Swing', s => s.spread.toFixed(0)],
      ['Bare days/yr', s => s.x.bare], ['Heavy rain on open soil %', s => s.x.heavyBare], ['N from legumes kg/ha/yr', s => s.x.nfix],
      ['Crop families', s => s.x.fams], ['Same family in a row', s => s.x.famRun], ['Water short avg %', s => s.x.waterGap], ['Water short worst 10% yrs %', s => s.x.badYear],
      ['Hot days at flowering', s => s.x.heat], ['Inputs (IPCC)', s => L.inputLevel(s.rot)], ['Soil C t/ha/yr', s => { const c = carbon(s); return c ? c.perYear.toFixed(2) : s.x.carbon.toFixed(2) + '*'; }], ['Sowings/yr', s => s.x.ops]
    ];
    let h = '';
    if (D.soil) h += '<div class="card">Soil now (SoilGrids): ' + D.soil.ocs + ' t C/ha in the top 30 cm' + (D.soil.soc != null ? ', organic carbon ' + D.soil.soc + ' g/kg' : '') + (D.soil.n != null ? ', nitrogen ' + D.soil.n + ' g/kg' : '') + (D.soil.ph != null ? ', pH ' + D.soil.ph : '') + '. Climate: ' + (moist() ? 'moist' : 'dry') + '.</div>';
    h += '<div class="card scroll"><table><tr><th>Strategy</th>' + cols.map(c => '<th class="n">' + c[0] + '</th>').join('') + '</tr>';
    R.list.forEach(s => { h += '<tr><td>' + esc(s.name) + '</td>' + cols.map(c => '<td class="n">' + c[1](s) + '</td>').join('') + '</tr>'; });
    $('params').innerHTML = h + '</table></div>';
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
    const rc = L.rainChange(R.cl), row = (name, t, unit, ser, u2) => '<tr><td>' + name + '</td><td class="n">' + (t.perDecade > 0 ? '+' : '') + (Math.round(t.perDecade * 100) / 100) + ' ' + unit + '/decade</td><td class="' + (t.label === 'clear trend' ? 'warn' : 'mute') + '">' + t.label + '</td><td>' + spark(ser, rc.series.labels, u2) + '</td></tr>';
    let h = '<div class="card scroll"><b>Is the weather here getting less predictable?</b><table><tr><th>What</th><th class="n">Change</th><th>Sure?</th><th>2001-2025</th></tr>'
      + row('Days with 25 mm+ rain', rc.heavy, 'days', rc.series.heavy, ' days')
      + row('Longest dry spell', rc.dry, 'days', rc.series.dry, ' days')
      + row('How uneven rain is across months', rc.cv, '', rc.series.cv, '')
      + row('Total rain', rc.rain, 'mm', R.cl.years.map(Y => Y.rain), ' mm')
      + row('Days over 32 °C', rc.hot, 'days', R.cl.years.map(Y => Y.hot32), ' days') + '</table></div>';
    if (!D.nd) { $('veg').innerHTML = h + '<div class="card mute">Satellite years still loading.</div>'; return; }
    const ys = L.ndviYears(D.nd, R.cl);
    const r1 = L.corr(ys.map(y => y.peak), ys.map(y => y.bal)), r2 = L.corr(ys.map(y => y.peak), ys.map(y => y.hot)), r3 = L.corr(ys.map(y => y.mean), ys.map(y => y.dry));
    const rr = r => r == null ? '–' : (r > 0 ? '+' : '') + r.toFixed(2);
    h += '<div class="card"><b>Plant stress from space vs weather</b><table><tr><td>Peak greenness vs water balance</td><td class="n">' + rr(r1) + '</td></tr><tr><td>Peak greenness vs hot days</td><td class="n">' + rr(r2) + '</td></tr><tr><td>Average greenness vs longest dry spell</td><td class="n">' + rr(r3) + '</td></tr></table><div class="mute">Correlation, ' + ys.length + ' years. Close to +1 or −1 means they move together.</div></div>';
    h += '<div class="card scroll"><table><tr><th>Year</th><th class="n">Peak NDVI</th><th class="n">Avg NDVI</th><th class="n">Low-green days</th><th class="n">Rain minus ET0, season mm</th><th class="n">Days over 32 °C</th><th class="n">Longest dry spell</th></tr>'
      + ys.map(y => '<tr><td>' + y.year + '</td><td class="n">' + y.peak.toFixed(2) + '</td><td class="n">' + y.mean.toFixed(2) + '</td><td class="n">' + y.low + '</td><td class="n">' + Math.round(y.bal) + '</td><td class="n">' + y.hot + '</td><td class="n">' + y.dry + '</td></tr>').join('') + '</table></div>';
    $('veg').innerHTML = h;
  }

  function farmRows(text, cal) { return L.compareFarm(L.parseFarm(text), cal, R.cl.south); }
  function farm() {
    const saved = store.get('furrowlab:farm', {})[fieldKey] || '', patches = store.get('furrowlab:patch', {}), p = patches[fieldKey];
    $('farm').innerHTML = '<div class="card"><b>Your own records</b><p class="mute"><code>year, crop, sowing date, harvest date, yield t/ha</code></p>'
      + '<textarea id="csv" placeholder="2024, wheat, 2023-10-01, 2024-07-05, 5.1&#10;2024, sunflower, 2024-04-25, 2024-09-20, 2.4">' + esc(saved) + '</textarea>'
      + '<div class="bar"><button class="go" id="cmp">Compare</button><button id="tune">Tune the model to my records</button><label><input type="checkbox" id="pool"> include shared notes</label></div><div id="cmpout"></div></div>'
      + '<div class="card"><b>Tuned crop settings</b><div id="tuneout">' + (p ? tuneTable(p) : '<span class="mute">None yet.</span>') + '</div>'
      + '<div class="bar"><label><input type="checkbox" id="usetune"' + (D.tuned ? ' checked' : '') + (p ? '' : ' disabled') + '> use them for all results</label><button id="untune"' + (p ? '' : ' disabled') + '>Forget</button></div></div>';
    $('cmp').onclick = () => {
      const t = $('csv').value, all = store.get('furrowlab:farm', {}); all[fieldKey] = t; store.set('furrowlab:farm', all);
      const rows = farmRows(t, R.cal);
      if (!rows.length) { $('cmpout').innerHTML = '<p class="warn">No lines we could read. Start each with a 4-digit year.</p>'; return; }
      const d = v => v == null ? '–' : (v > 0 ? '+' : '') + v + ' d', e = L.errors(rows);
      $('cmpout').innerHTML = '<div class="scroll"><table><tr><th>Year</th><th>Crop</th><th class="n">Sowing vs ours</th><th class="n">Harvest vs ours</th><th class="n">Yield</th></tr>'
        + rows.map(r => '<tr><td>' + r.year + '</td><td>' + esc(r.crop ? C[r.crop].short : r.raw + ' (unknown)') + '</td><td class="n">' + d(r.sowDiff) + '</td><td class="n">' + d(r.harvDiff) + '</td><td class="n">' + (r.yield || '–') + '</td></tr>').join('') + '</table></div>'
        + '<p>Average miss: sowing ' + (e.sow == null ? '–' : e.sow.toFixed(0) + ' days') + ', harvest ' + (e.harv == null ? '–' : e.harv.toFixed(0) + ' days') + '.</p>';
    };
    $('tune').onclick = () => {
      $('cmp').click();
      let text = $('csv').value;
      if ($('pool').checked) L.summarise(D.shared).recs.forEach(r => { text += '\n' + r.text; });
      const base = L.calFor(D.raw, inp.lat, null), rows = farmRows(text, base.cal);
      if (!rows.filter(r => r.sowDiff != null).length) { $('tuneout').innerHTML = '<span class="warn">Need at least one line with a crop we know and a sowing date.</span>'; return; }
      const patch = L.calibrate(rows, base.cal), after = L.calFor(D.raw, inp.lat, patch), e0 = L.errors(rows), e1 = L.errors(farmRows(text, after.cal));
      patch._err = { before: e0, after: e1 };
      const all = store.get('furrowlab:patch', {}); all[fieldKey] = patch; store.set('furrowlab:patch', all);
      D.tuned = true; compute(); setTab('farm');
    };
    $('usetune').onchange = e => { D.tuned = e.target.checked; compute(); setTab('farm'); };
    $('untune').onclick = () => { const all = store.get('furrowlab:patch', {}); delete all[fieldKey]; store.set('furrowlab:patch', all); D.tuned = false; compute(); setTab('farm'); };
  }
  function tuneTable(p) {
    const f = v => v == null ? '–' : v.toFixed(0) + ' d', e = p._err;
    let h = '<div class="scroll"><table><tr><th>Crop</th><th>Setting</th><th class="n">Was</th><th class="n">Now</th><th class="n">Records</th></tr>';
    for (const id in p) { if (id[0] === '_') continue; for (const k in p[id]) if (k !== 'n') h += '<tr><td>' + C[id].short + '</td><td>' + ({ off: 'Days after last frost to sow', dry: 'Days from ripe to harvest', lead: 'Days before first frost to sow', gdd: 'Heat needed to ripen' })[k] + '</td><td class="n">' + C[id][k] + '</td><td class="n">' + p[id][k] + '</td><td class="n">' + p[id].n + '</td></tr>'; }
    h += '</table></div>';
    if (e) h += '<p>Average miss went from ' + f(e.before.sow) + ' to ' + f(e.after.sow) + ' for sowing and ' + f(e.before.harv) + ' to ' + f(e.after.harv) + ' for harvest.</p>';
    return h;
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
    $('imp').onchange = async e => { try { merge(JSON.parse(await e.target.files[0].text())); render(); setTab('shared'); } catch (er) { $('shmsg').innerHTML = '<span class="bad">That file isn’t a Furrow notes file.</span>'; } };
    $('lnk').onclick = async () => { const u = location.href.split('#')[0] + '#n=' + L.pack(myNotes()); try { await navigator.clipboard.writeText(u); $('shmsg').textContent = 'Link copied.'; } catch (e) { $('shmsg').textContent = u; } };
    $('post').onclick = () => { const body = 'Field notes from the Furrow lab.\n\n```json\n' + JSON.stringify(myNotes()) + '\n```'; window.open('https://github.com/' + REPO + '/issues/new?title=' + encodeURIComponent('Field notes ' + fieldKey) + '&body=' + encodeURIComponent(body).slice(0, 7000), '_blank'); };
    $('pull').onclick = async () => {
      $('pullmsg').textContent = 'Loading…';
      try { const j = await getJSON('https://api.github.com/repos/' + REPO + '/issues?state=all&per_page=100', 20000); D.shared = L.fromIssues(j); render(); setTab('shared'); }
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
      + '<p class="mute"><a href="contract/CoverAgreement.sol" style="color:var(--green)">Contract code</a></p></div>';
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

  function setTab(t) { document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === t)); }
  $('tabs').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.t); };
  $('field').onchange = pickField; $('run').onclick = go;
  const m = /#n=([\w-]+)/.exec(location.hash); if (m) { try { merge(L.unpack(m[1])); history.replaceState(null, '', location.pathname); } catch (e) {} }
  fillSelects(); sources();
  ['strat', 'params', 'stress', 'veg', 'farm', 'shared', 'care'].forEach(id => $(id).innerHTML = '<p class="mute">Run a field first.</p>');
})();
