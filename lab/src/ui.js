(function () {
  'use strict';
  const E = window.Engine, C = E.CROPS, CV = E.COVERS, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r0 = x => Math.round(x), pc = x => Math.round(x * 100) + '%';
  const DEMOS = [
    { id: 'odesa', name: 'Odesa region, Ukraine', short: 'Odesa', lab: 'bottom', lat: 46.85, lon: 30.6, rot: [{ c: 'wheat' }, { c: 'sunflower' }], soil: 'clay_loam', slope: 2, till: 'conv' },
    { id: 'minsk', name: 'Minsk region, Belarus', short: 'Minsk', lab: 'top', lat: 53.7, lon: 27.2, rot: [{ c: 'wheat' }, { c: 'canola' }, { c: 'oats' }], soil: 'sandy_loam', slope: 4, till: 'conv' },
    { id: 'iowa', name: 'Central Iowa, USA', short: 'Iowa, USA', lab: 'top', lat: 42.03, lon: -93.62, rot: [{ c: 'corn' }, { c: 'soy' }], soil: 'loam', slope: 'custom', till: 'reduced' },
    { id: 'freestate', name: 'Free State, South Africa', short: 'South Africa', lab: 'top', lat: -27.39, lon: 26.62, rot: [{ c: 'corn' }, { c: 'sunflower' }], soil: 'sandy_loam', slope: 2, till: 'reduced' },
    { id: 'heilongjiang', name: 'Heilongjiang, China', short: 'Northeast China', lab: 'top', lat: 45.9, lon: 126.9, rot: [{ c: 'corn' }, { c: 'soy' }], soil: 'clay_loam', slope: 4, till: 'conv' }
  ];
  const DIMS = [['income', 'Profit after costs'], ['water', 'Saving water'], ['soil', 'Building soil health'], ['erosion', 'Keeping soil in place'], ['resilience', 'Steady harvest in bad years']];
  const LEVEL = ['Not a focus now', 'Minor', 'Some', 'Important', 'Very important', 'Top priority'];
  const CORDER = ['wheat', 'sunflower', 'corn', 'soy', 'canola', 'oats', 'pea', 'sorghum', 'alfalfa', 'fallow'];
  const SOILTXT = { sand: 'Over 85% sand. Low water-holding capacity, fast drainage; drought stress comes early and nutrients leach.', sandy_loam: 'Mostly sand with some silt and clay. Drains well, moderate water-holding capacity.', loam: 'Balanced sand, silt and clay. Good structure and water-holding capacity.', silt_loam: 'Over 50% silt. Holds plenty of water, but crusts and erodes easily when bare.', clay_loam: '27 to 40% clay. High water-holding capacity, slow drainage, compacts if worked wet.', clay: 'Over 40% clay. Stores the most water but drains poorly and compacts; narrow working window.' };
  const MEANS = {
    rain: ['More precipitation: less drought risk, but watch waterlogging on heavy soils.', 'Less precipitation: every mm counts more, so water-saving rotations and drought-tolerant crops gain value.'],
    et: ['Higher evaporative demand: crops draw down soil water faster, so the same rain goes less far.', 'Lower evaporative demand: soil water lasts longer.'],
    hot35: ['More extreme heat days: yield losses at flowering become more likely; earlier-maturing crops or later sowing can avoid the hottest weeks.', 'Fewer extreme heat days.'],
    heavy: ['More downpours: more runoff and soil loss on bare ground, so keeping the soil covered matters more.', 'Fewer downpours: lower erosion pressure.'],
    drySpell: ['Longer dry spells: crops depend longer on stored soil water, which favours deep roots and residue cover.', 'Shorter dry spells.'],
    frostFree: ['Longer frost-free season: more room for a second crop or a cover crop after harvest.', 'Shorter season: less room after harvest for covers or second crops.']
  };
  const DIMTIP = { water: 'How much of the water your crops wanted they actually got from rain and the soil. 100 means they never ran short.', soil: 'Estimated from days with living roots, nitrogen from legumes, leftover residue, how many crop families you grow, deep roots, and few bare days.', erosion: 'How much of the heavy rain lands on covered ground instead of bare soil. 100 means none of it hits bare soil.', income: 'Margin after costs, estimated from typical production cost and market depth per crop (1 to 5), reduced when the crop runs short of water. Local prices are not included.', resilience: 'How rarely crops get stressed by drought or heat, whether they ripen before frost, and how spread out your crops are across families and seasons.' };
  const TREND = { 'clear trend': 'trend, p < 0.05', 'possible trend': 'weak signal, p < 0.2', 'no clear trend': 'no clear trend' };
  const S = { area: 100, stockOn: false, stockType: 'beef', stockN: 0, maxDrop: 15, mY: 4.5, mP: 200, mC: 550, slopePct: 3, later: false, years: 3, w2: { water: 3, soil: 5, erosion: 4, income: 2, resilience: 3 }, acc: {}, text: '', exp: null, lat: 0, lon: 0, name: '', rot: [], soil: 'loam', slope: 'custom', till: 'reduced', irrigated: false, livestock: false, exclude: new Set(), weights: { water: 3, soil: 3, erosion: 3, income: 3, resilience: 3 }, scen: { rain: 0, temp: 0 }, raw: null, demo: null, sel: 0, terrain: null, soilSug: null, touched: {} };
  const COL = { bare: '#F2A541', et: '#F2907E', straw: '#B7A98A', crop: '#8FD694', cover: '#D6EBAE', peren: '#3E8E5A', water: '#7CC6E8', waterSoft: '#2F5D6B', ink: '#EEF2E6', muted: '#A8A89C', line: 'rgba(240,236,220,.13)', panel: '#171816' };

  async function fetchPower(lat, lon) {
    const key = 'furrow1:' + lat.toFixed(2) + ',' + lon.toFixed(2);
    try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    const url = 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=20010101&end=20251231&format=JSON';
    const r = await fetch(url);
    if (!r.ok) throw new Error('NASA POWER answered with status ' + r.status + '.');
    const raw = E.parsePower(await r.json());
    if (raw.n < 365 * 10) throw new Error('NASA POWER returned too little data for this point.');
    cset(key, raw);
    return raw;
  }
  async function getJSON(url, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 9000);
    try { const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error('status ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  const cget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const cset = (k, v) => {
    const val = JSON.stringify(v), big = /^furrow[x]?1:/.test(k);
    if (big) { const pre = k.slice(0, k.indexOf(':') + 1), old = Object.keys(localStorage).filter(q => q.indexOf(pre) === 0 && q !== k); if (old.length >= 4) old.forEach(q => localStorage.removeItem(q)); }
    try { localStorage.setItem(k, val); } catch (e) {
      try { Object.keys(localStorage).filter(q => /^furrow[x]?1:/.test(q) && q !== k).forEach(q => localStorage.removeItem(q)); localStorage.setItem(k, val); } catch (e2) {}
    }
  };
  function extras(id) {
    const lat = S.lat, lon = S.lon, k = lat.toFixed(2) + ',' + lon.toFixed(2);
    (async () => {
      try {
        let ex = cget('furrowx1:' + k);
        if (!ex) { ex = E.parseExtra(await getJSON('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,WS2M,RH2M&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=20010101&end=20251231&format=JSON', 30000)); cset('furrowx1:' + k, ex); }
        if (id !== req || !S.raw || !ex || !(ex.n >= S.raw.n)) return;
        S.raw.ex = ex; const keep = S.sel; recompute(); if (keep < 1 + LAST.alts.length) { S.sel = keep; render(); }
      } catch (e) {}
    })();
    (async () => {
      try {
        let nd = cget('furrown2:' + k);
        if (!nd) {
          const yrs = [2024, 2025], parts = [['001', '145'], ['161', '305'], ['321', '365']], by = {};
          yrs.forEach(y => { by[y] = new Array(23).fill(null); });
          const got = await Promise.all(yrs.reduce((a, y) => a.concat(parts.map(q => getJSON('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=' + lat + '&longitude=' + lon + '&band=250m_16_days_NDVI&startDate=A' + y + q[0] + '&endDate=A' + y + q[1] + '&kmAboveBelow=0&kmLeftRight=0', 25000))), []));
          got.forEach(j => (j.subset || []).forEach(r => { const m = String(r.modis_date), y = +m.slice(1, 5), i = Math.round((+m.slice(5) - 1) / 16), v = Array.isArray(r.data) ? +r.data[0] : NaN; if (by[y] && i >= 0 && i < 23 && v > -2000 && v <= 10000) by[y][i] = Math.round(v * 0.1) / 1000; }));
          if (yrs.some(y => by[y].filter(v => v !== null).length < 15)) return; nd = { yrs, by }; cset('furrown2:' + k, nd);
        }
        if (id !== req) return; S.ndvi = nd; render();
      } catch (e) {}
    })();
    (async () => {
      try {
        let z = cget('furrowz1:' + k);
        if (!z) {
          const dl = 250 / 111320, dn = 250 / (111320 * Math.cos(lat * Math.PI / 180)), la = [], lo = [];
          for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { la.push((lat + (2 - r) * dl).toFixed(5)); lo.push((lon + (c - 2) * dn).toFixed(5)); }
          const j = await getJSON('https://api.open-meteo.com/v1/elevation?latitude=' + la.join(',') + '&longitude=' + lo.join(','), 9000);
          z = j.elevation; if (!Array.isArray(z) || z.length !== 25 || z.some(v => !isFinite(v))) return; cset('furrowz1:' + k, z);
        }
        if (id !== req) return; S.terrain = E.terrain(z, 250); suggest(); drawZones(); render();
      } catch (e) {}
    })();
    (async () => {
      try {
        let g = cget('furrows1:' + k);
        if (!g) {
          const url = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + lon + '&lat=' + lat + '&property=clay&property=sand&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean';
          let j; try { j = await getJSON(url, 25000); } catch (e) { j = await getJSON(url, 30000); }
          const val = name => { const L = j.properties.layers.find(x => x.name === name), f = (L.unit_measure && L.unit_measure.d_factor) || 10, v = L.depths.map(d => d.values.mean).filter(x => x !== null && isFinite(x)); return v.length ? E.mean(v) / f : NaN; };
          g = { sand: val('sand'), clay: val('clay') }; if (!(g.sand >= 0 && g.clay >= 0 && g.sand + g.clay <= 100.5) || g.sand + g.clay === 0) return; cset('furrows1:' + k, g);
        }
        if (id !== req) return; S.soilSug = Object.assign({ cls: E.textureClass(g.sand, g.clay) }, g); suggest();
      } catch (e) {}
    })();
  }
  function suggest() {
    const sp = S.terrain ? Math.round(S.terrain.typical * 2) / 2 : null;
    if (S.soilSug && !S.demo && !S.touched.soil) { S.soil = S.soilSug.cls; $('soil').value = S.soil; soilTxt(); }
    if (S.terrain && !S.demo && !S.touched.slope) setSlope(sp);
    $('sugsoil').innerHTML = S.soilSug ? '<div class="sug"><span>Soil map (SoilGrids): <b>' + E.SOILS[S.soilSug.cls].name + '</b>, ' + r0(S.soilSug.sand) + '% sand, ' + r0(S.soilSug.clay) + '% clay</span>' + (S.soil !== S.soilSug.cls ? '<button class="btn usebtn" data-use="soil">Use this</button>' : '<span class="inuse">In use</span>') + '</div>' : '';
    $('sugslope').innerHTML = S.terrain ? '<div class="sug"><span>Elevation data: typical slope <b>' + S.terrain.typical.toFixed(1) + '%</b>, steepest ' + S.terrain.steepest.toFixed(1) + '%</span>' + (Math.abs(S.slopePct - sp) > 0.01 ? '<button class="btn usebtn" data-use="slope">Use this</button>' : '<span class="inuse">In use</span>') + '</div>' : '';
    if ((S.soilSug || S.terrain) && !S.demo) recompute();
  }
  let req = 0;
  async function load() {
    const id = ++req; status('load');
    try { const raw = await fetchPower(S.lat, S.lon); if (id !== req) return; S.raw = raw; status(''); recompute(); extras(id); }
    catch (e) { if (id !== req) return; status('err', 'Couldn’t load the NASA data for this spot. ' + esc(e.message || '') + ' Check your internet and hit Load again.'); }
  }
  function status(kind, msg) {
    const el = $('status');
    if (!kind) { el.hidden = true; return; }
    el.hidden = false; el.className = 'banner' + (kind === 'err' ? ' err' : '');
    el.innerHTML = kind === 'load' ? '<span class="spin"></span>Grabbing 25 years of NASA weather data for ' + esc(S.name) + '…' : msg;
    if (kind === 'load') $('out').innerHTML = '';
  }

  function bareMonths(s, cl) {
    const cnt = new Array(12).fill(0);
    for (let t = 0; t < s.tl.T; t++) if (s.tl.st[t] === 0) { const d = t % 365; let m = 0; while (d >= E.CUM[m + 1]) m++; cnt[m]++; }
    const ms = cnt.map((v, m) => [v / s.tl.N / (E.CUM[m + 1] - E.CUM[m]), m]).filter(x => x[0] >= 0.5).map(x => x[1]);
    if (!ms.length) return 'short gaps between crops';
    if (ms.length === 12) return 'all year round';

    let start = ms.find(m => !ms.includes((m + 11) % 12)); if (start === undefined) start = ms[0];
    let end = start; while (ms.includes((end + 1) % 12) && (end + 1) % 12 !== start) end = (end + 1) % 12;
    return start === end ? 'in ' + cl.monthName(start) : 'from ' + cl.monthName(start) + ' to ' + cl.monthName(end);
  }
  function explain(s, A) {
    const cl = A.cl, cur = A.current, m = s.m, cm = cur.m, isCur = s.id === 'current';
    const hot = cl.yearTypes && cl.yearTypes.types.find(t => t.name.indexOf('Hot') === 0);
    const relHot = x => hot ? E.mean(hot.idx.map(i => x.m.relByYear[i])) : null;
    const ar = (a, b) => isCur ? '<b>' + a + '</b>' : a + ' to <b>' + b + '</b>';
    const ev = [];
    ev.push('Bare soil: ' + ar(r0(cm.bare), r0(m.bare)) + ' days a year');
    ev.push('Heavy rain landing on poorly covered soil: ' + ar(r0(cm.exposed), r0(m.exposed)) + ' mm a year, out of ' + r0(cl.erosTotal) + ' mm from days of 12.7 mm or more');
    ev.push('Crop water demand left unmet: ' + ar(pc(cm.relMean), pc(m.relMean)) + ' on average' + (hot ? '; in hot, dry years ' + ar(pc(relHot(cur)), pc(relHot(s))) : ''));
    ev.push('Living roots in the ground: ' + ar(r0(cm.living), r0(m.living)) + ' days a year');
    if (cm.nfix > 1 || m.nfix > 1) ev.push('Nitrogen from legumes: ' + ar(r0(cm.nfix), r0(m.nfix)) + ' kg N/ha a year');
    if (cm.heat >= 0.5 || m.heat >= 0.5) ev.push('Damaging heat in sensitive growth stages: ' + ar(cm.heat.toFixed(1), m.heat.toFixed(1)) + ' days a year');
    ev.push('Spread across the ' + cl.n + ' years: unmet demand ran from ' + pc(m.relLo) + ' to ' + pc(m.relHi) + ' in 8 years out of 10');
    let why = '', ben = [], gaps = [], rev = [];
    const bm = bareMonths(cur, cl), topE = cl.mEros.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).sort((a, b) => a[1] - b[1]).map(x => cl.monthName(x[1])).join(', ');
    switch (s.id) {
      case 'current':
        why = 'This is what you grow now. It is replayed through the weather your field had in each of the last ' + cl.n + ' years, and every other option is measured against it. Soil here is bare ' + bm + ', and ' + pc(cm.bareErosShare) + ' of the heavy rain falls on that bare ground. The months with most heavy rain are ' + topE + '.';
        ben = ['Known markets, equipment and routines', 'No transition cost or learning curve'];
        gaps = ['Your real yields: Furrow has no harvest records for this field', 'Soil test results such as organic matter, pH and compaction'];
        rev = ['Whether the bare periods shown match what you see on the ground'];
        break;
      case 'cover':
        why = 'Your soil is bare ' + r0(cm.bare) + ' days a year, ' + bm + ', and ' + pc(cm.bareErosShare) + ' of the heavy rain arrives while it is bare. A cover crop fills those windows with leaves and living roots without changing what you sell.';
        ben = ['Leaves and roots shield the soil when storms hit', 'Roots feed soil life and build organic matter over the years', 'Slower runoff, so more rain soaks in'];
        if (s.rot.some(r => r.cv === 'legmix')) ben.push('The legume mix supplies nitrogen to the next crop');
        gaps = ['Seed, seeding and termination costs on your farm', 'Herbicide carry-over that could stop a cover establishing'];
        rev = ['Termination date: in a dry spring, ending the cover earlier saves water for the cash crop', 'Cereal rye ahead of corn can tie up nitrogen early in the season'];
        break;
      case 'smallgrain': case 'diverse': {
        const g = C[s.grain], k = A.cal[s.grain];
        why = g.name + ' is harvested around ' + cl.fmtDay(k.harv) + ', before the hottest and driest weeks, which spreads your weather risk across two seasons. The long gap after harvest is warm enough to grow a legume cover mix' + (s.id === 'diverse' ? ', and cover crops follow the other cash crops too.' : '.');
        ben = ['A third crop family breaks pest, weed and disease cycles', 'Work and income are spread across the year', 'A long summer window for a nitrogen-fixing cover', 'Small-grain straw adds residue'];
        gaps = ['A local buyer and price for ' + g.short.toLowerCase(), 'Whether you have, or can hire, a drill and suitable harvest setup'];
        rev = ['Disease and weed pressure shifts when a new crop enters the rotation', 'One year in ' + s.rot.length + ' moves out of your main cash crops'];
        break;
      }
      case 'drought': {
        const f = cur.crops.find(c => c.id === s.from), to = C[s.to];
        why = C[s.from].short + ' came up shortest on water here: ' + pc(f.relMean) + ' of its demand went unmet on average, with ' + f.heat.toFixed(1) + ' days a year of damaging heat in its sensitive weeks. ' + to.name + ' needs less water and stands heat up to about ' + to.heatT + ' °C.';
        ben = ['Lower water demand in the hottest part of the season', 'Steadier output in hot, dry years', to.deep ? 'Deep roots reach water and loosen subsoil' : 'A different crop family in the rotation'];
        gaps = ['A local market, delivery point and price for ' + to.short.toLowerCase(), 'Whether your planter and combine are set up for it'];
        rev = ['Herbicide programme and bird or pest pressure for ' + to.short.toLowerCase()];
        break;
      }
      case 'nofallow':
        why = 'The fallow year leaves the field without a crop for more than a year at a stretch. Much of the rain that falls then evaporates or runs off before the next crop can use it. ' + C[s.to].name + ' turns that rain into a crop' + (C[s.to].fam === 'Legume' ? ' and fixes nitrogen.' : '.');
        ben = ['Something to sell from every year of the rotation', 'Far fewer bare-soil days', C[s.to].fam === 'Legume' ? 'Nitrogen credit for the following wheat' : 'More residue returned to the soil'];
        gaps = ['A local market for ' + C[s.to].short.toLowerCase(), 'Seed, inoculant and input costs'];
        rev = ['In the driest years, water stored during fallow is what carries the wheat. Compare the hot, dry year column in the table below before trying this'];
        break;
      case 'legume':
        why = 'There is no legume in your rotation, so every unit of nitrogen is bought in. ' + C[s.to].name + ' fixes its own nitrogen, leaves some for the next crop, and breaks the pest and disease cycles of your current crops.';
        ben = ['Lower fertiliser need for the following crop', 'A different crop family interrupts pests and diseases', 'A wider spread of sowing and harvest dates'];
        gaps = ['A local market for ' + C[s.to].short.toLowerCase(), 'Inoculant supply and root-disease history in your area'];
        rev = ['Legumes leave little residue, so the soil after harvest needs protection'];
        break;
      case 'forage':
        why = 'Two years of alfalfa keep the ground covered and rooted all year, fix nitrogen, and need no tillage. That rests the soil between runs of annual crops' + (S.livestock ? ' and gives you forage for your own livestock.' : '.');
        ben = ['Year-round cover in the alfalfa years', 'Deep roots open compacted layers and draw on deep water', 'A large nitrogen credit for the next crop'];
        gaps = ['A hay market, or livestock to use the forage', 'Establishment cost and access to hay equipment'];
        rev = ['Alfalfa dries the deep soil; the crop after it may start with less stored water', 'Alfalfa should not follow alfalfa directly'];
        break;
    }

    if (!why && window.Lab && (Lab.EXPERIMENTAL[s.id] || Lab.INFO[s.id])) { const I = Lab.EXPERIMENTAL[s.id] || Lab.INFO[s.id]; why = I.why + ' ' + I.ev; ben = I.ben ? [I.ben] : []; gaps = I.gap ? [I.gap] : ['How it performs on farms near you']; rev = [I.risk]; }
    if (!isCur && m.relMean > cm.relMean + 0.02) rev.unshift('Water trade-off: unmet crop water demand rises from ' + pc(cm.relMean) + ' to ' + pc(m.relMean) + ' because the extra plants draw on soil water. In a dry year that can cost the next crop yield');
    if (!isCur && s.sc.erosion < cur.sc.erosion - 2) rev.unshift('This option protects the soil less than your current rotation (storm-shield score ' + cur.sc.erosion + ' to ' + s.sc.erosion + ') because it leaves less residue. Pairing it with a cover crop would offset that');
    for (const n of s.tl.notes) {
      if (n.type === 'late') rev.push(C[n.crop].short + ' would be sown about ' + n.days + ' days later than ideal because ' + C[n.after].short.toLowerCase() + ' is still on the field');
      if (n.type === 'nocover') rev.push('Only ' + n.days + ' days separate ' + C[s.rot[n.i].c].short.toLowerCase() + ' harvest from the next sowing, too short for a cover crop, so none is counted there');
      if (n.type === 'thinfall') rev.push('The cover after ' + C[s.rot[n.i].c].short.toLowerCase() + ' gets little autumn warmth (about ' + n.gdd + ' growing degree days before winter), so stands may be thin. Seeding into the standing crop is one local workaround');
    }
    const seen = new Set();
    for (const c of s.crops) {
      if (c.fallow || seen.has(c.id) || c.reliab >= 0.9) continue; seen.add(c.id);
      rev.push(C[c.id].kind === 'summer' ? C[c.id].short + ' reached maturity before a killing frost in only ' + pc(c.reliab) + ' of years' : 'Winters were cold enough to threaten ' + C[c.id].short.toLowerCase() + ' in ' + pc(1 - c.reliab) + ' of years');
    }
    return { why, ev, ben, gaps, rev };
  }

  const KEY = 'furrowlab:choices1';
  const ANIMALS = { beef: ['Beef cattle', 4.5], dairy: ['Dairy cows', 6], sheep: ['Sheep or goats', 0.6], horse: ['Horses', 4] };
  const YIELD = { wheat: 4.5, corn: 7, soy: 2.5, sunflower: 2.3, sorghum: 4, oats: 3, pea: 2.5, canola: 2.8, alfalfa: 6 };
  function herd() {
    if (!S.stockOn) { S.livestock = false; return ''; }
    const need = (S.stockN || 0) * ANIMALS[S.stockType || 'beef'][1], share = 2 / (S.rot.length + 2), supply = (S.area || 0) * share * YIELD.alfalfa, use = supply ? Math.min(1, need / supply) : 0;
    S.livestock = use >= 0.5;
    return 'Your animals eat about <b>' + r0(need) + ' t</b> of hay a year. Two years of alfalfa in your rotation on ' + (S.area || 0) + ' ha would give about <b>' + r0(supply) + ' t</b> a year, so about <b>' + Math.round(use * 100) + '%</b> would be used' + (S.livestock ? '. Alfalfa counts as feed for your own animals.' : '. That is too little to count alfalfa as feed; it would need a hay buyer.');
  }
  function margin() { return Math.max(0, (S.mY || 0) * (S.mP || 0) - (S.mC || 0)); }
  function setSlope(p) { S.slopePct = Math.max(0, Math.min(20, +p || 0)); S.slope = 'custom'; E.SLOPES.custom = { name: S.slopePct + '%', f: Math.max(0.3, Math.min(3, S.slopePct / 4)) }; if ($('slopep')) { $('slopep').value = S.slopePct; $('slopev').textContent = S.slopePct + '%'; } }
  const choices = () => ({ lat: S.lat, lon: S.lon, demo: S.demo, rot: S.rot, soil: S.soil, slope: S.slope, till: S.till, irrigated: S.irrigated, livestock: S.livestock, exclude: Array.from(S.exclude), weights: S.weights, area: S.area, stockOn: S.stockOn, stockType: S.stockType, stockN: S.stockN, maxDrop: S.maxDrop, mY: S.mY, mP: S.mP, mC: S.mC, slopePct: S.slopePct, later: S.later, years: S.years, w2: S.w2, acc: S.acc, text: S.text, exp: S.exp });
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign(choices(), { done: !S.intro && S.wiz == null }))); } catch (e) {}
  }
  function shareLink() {
    return location.origin + location.pathname + '#r=' + btoa(unescape(encodeURIComponent(JSON.stringify(choices())))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromLink() {
    const m = /^#r=([A-Za-z0-9_-]+)$/.exec(location.hash); if (!m) return null;
    try { const v = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); v.done = true; history.replaceState(null, '', location.pathname + location.search); return v; } catch (e) { return null; }
  }
  function restore() {
    let v = fromLink(); if (!v) { try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
    if (!v || !v.done || !isFinite(v.lat) || !isFinite(v.lon) || Math.abs(v.lat) > 70 || Math.abs(v.lon) > 180 || !Array.isArray(v.rot) || !v.rot.length || v.rot.length > 6 || v.rot.some(r => !r || !C[r.c])) return null;
    S.rot = v.rot.map(r => ({ c: r.c, cv: CV[r.cv] ? r.cv : null }));
    if (E.SOILS[v.soil]) S.soil = v.soil; setSlope(isFinite(v.slopePct) ? v.slopePct : 3); ['later', 'years', 'text', 'exp', 'area', 'stockOn', 'stockType', 'stockN', 'maxDrop', 'mY', 'mP', 'mC'].forEach(k => { if (v[k] != null) S[k] = v[k]; }); if (v.w2) Object.assign(S.w2, v.w2); if (v.acc) S.acc = v.acc; if (E.TILLAGE[v.till]) S.till = v.till;
    S.irrigated = !!v.irrigated; S.livestock = !!v.livestock; S.exclude = new Set((Array.isArray(v.exclude) ? v.exclude : []).filter(k => C[k] || CV[k]));
    DIMS.forEach(d => { const w = v.weights && v.weights[d[0]]; if (w >= 0 && w <= 5) S.weights[d[0]] = Math.round(w); $('w_' + d[0]).value = S.weights[d[0]]; $('w_v' + d[0]).textContent = LEVEL[S.weights[d[0]]]; });
    $('soil').value = S.soil; $('till').value = S.till; $('irrig').checked = S.irrigated; if (window.syncExtra) window.syncExtra(); $('later').checked = !!S.later; $('laterbox').hidden = !S.later; $('years').value = S.years; $('yearsv').textContent = S.years + ' yrs'; $('free').value = S.text || ''; showUnd(); if (window.syncChips) window.syncChips(); DIMS.forEach(d => { $('w2_' + d[0]).value = S.w2[d[0]]; $('w2_v' + d[0]).textContent = LEVEL[S.w2[d[0]]]; });
    document.querySelectorAll('#excl .chip').forEach(b => b.setAttribute('aria-pressed', S.exclude.has(b.dataset.id) ? 'true' : 'false'));
    renderRot(); return v;
  }
  function sheet(A) {
    const cl = A.cl, all = [A.current].concat(A.alts), best = A.alts[0], list = all.concat(A.others).slice().sort((p, q) => q.match - p.match);
    const yes = b => b ? 'yes' : 'no', ex = Array.from(S.exclude).map(k => (C[k] || CV[k]).short).join(', ');
    let h = '<h1>Furrow: rotation summary</h1><p class="meta">' + esc(S.name) + ', ' + Math.abs(S.lat).toFixed(2) + '°' + (S.lat < 0 ? 'S' : 'N') + ' ' + Math.abs(S.lon).toFixed(2) + '°' + (S.lon < 0 ? 'W' : 'E') + '. Made on ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' at kuzakaa.github.io/furrow</p>';
    h += '<h2>What you told us</h2><table><tbody><tr><th>Rotation now</th><td>' + esc(E.rotLabel(S.rot)) + '</td></tr><tr><th>Soil</th><td>' + E.SOILS[S.soil].name + ', slope: ' + E.SLOPES[S.slope].name.toLowerCase() + ', ' + E.TILLAGE[S.till].name.toLowerCase() + '</td></tr><tr><th>Irrigation / livestock</th><td>' + yes(S.irrigated) + ' / ' + yes(S.livestock) + '</td></tr><tr><th>What matters (0 to 5)</th><td>' + DIMS.map(d => d[1] + ' ' + S.weights[d[0]]).join(', ') + '</td></tr>' + (ex ? '<tr><th>Ruled out</th><td>' + esc(ex) + '</td></tr>' : '') + '</tbody></table>';
    h += '<h2>How the rotations rank</h2><table><thead><tr><th>Option</th><th>Rotation</th><th>Match</th>' + DIMS.map(d => '<th>' + d[1] + '</th>').join('') + '<th>Beats yours in</th></tr></thead><tbody>' + list.map(s => '<tr><td>' + esc(s.name) + '</td><td>' + esc(E.rotLabel(s.rot)) + '</td><td><b>' + r0(s.match) + '</b></td>' + DIMS.map(d => '<td>' + s.sc[d[0]] + '</td>').join('') + '<td>' + (s.boot ? Math.round(s.boot.win * 100) + '% of reshuffles' : '') + '</td></tr>').join('') + '</tbody></table>';
    if (best) {
      const x = explain(best, A);
      h += '<h2>Best match: ' + esc(best.name) + '</h2><p>' + x.why + '</p><h3>What the data says (yours now vs this option)</h3><ul>' + x.ev.map(e => '<li>' + e + '</li>').join('') + '</ul><h3>Double-check this locally first</h3><ul>' + x.rev.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul><h3>What we can’t know from here</h3><ul>' + x.gaps.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    }
    h += '<h2>Weather here, ' + cl.years[0].label + ' to ' + cl.years[cl.n - 1].label + '</h2><table><thead><tr><th>Measure</th><th>Average</th><th>8 years out of 10</th><th>Trend per decade</th></tr></thead><tbody>' + cl.indicators.map(i => '<tr><td>' + i.name + '</td><td>' + i.mean.toFixed(i.digits) + ' ' + i.unit + '</td><td>' + i.lo.toFixed(i.digits) + ' to ' + i.hi.toFixed(i.digits) + '</td><td>' + (i.trend.perDecade > 0 ? '+' : '') + i.trend.perDecade.toFixed(i.digits ? 1 : 0) + ', ' + TREND[i.trend.label] + '</td></tr>').join('') + (cl.noFrost ? '' : '<tr><td>Typical frost dates</td><td colspan="3">last in spring ' + cl.fmtDay(cl.lastFrost) + ', first in autumn ' + cl.fmtDay(cl.firstFrost) + '</td></tr>') + '</tbody></table>';
    h += '<h2>Read this before acting</h2><p>Furrow replays each rotation through ' + cl.n + ' years of NASA POWER weather for this spot. That weather describes an area about 50 km wide, not one field. Soil health and easy-to-sell are rough scores, crop numbers are generic, and nobody has checked this model against field trials. Use it to start a conversation with an agronomist or adviser, and try any change on a strip first. NASA does not endorse this tool.</p>';
    $('sheet').innerHTML = h;
  }

  const TABS = [['result', 'Result'], ['options', 'Options'], ['climate', 'Weather'], ['calendar', 'Calendar'], ['years', 'Bad years'], ['method', 'How it works'], ['tools', 'More tools']];
  let LAST = null, RANK = '';
  function recompute() {
    if (!S.raw) return;
    setSlope(S.slopePct);
    const cons = window.Lab ? Lab.parseConstraints(S.text) : [], w = Object.assign({}, S.weights), acc = Object.assign({}, S.acc), ex = new Set(S.exclude); let stock = S.livestock;
    cons.forEach(c => { Object.assign(w, c.act.w || {}); for (const k in c.act.acc || {}) acc[k] = Math.min(acc[k] == null ? 5 : acc[k], c.act.acc[k]); (c.act.avoid || []).forEach(x => { if (!S.rot.some(r => r.c === x)) ex.add(x); }); if (c.act.livestock) stock = true; });
    if (Object.values(w).every(v => !v)) w.income = 1;
    herd(); if (S.livestock) stock = true;
    const inp = Object.assign({}, S, { weights: w, exclude: ex, livestock: stock });
    try { LAST = E.analyse(S.raw, inp); labAdjust(LAST, inp, acc, cons); } catch (e) { status('err', 'Something went wrong while analysing this field: ' + esc(e.message)); return; }
    S.sel = LAST.alts.length ? 1 : 0; render(); save(); if (S.wiz != null && WIZ[S.wiz][0] === 'acc') drawAcc();
  }
  function labAdjust(A, inp, acc, cons) {
    let all = A.alts.concat(A.others);
    if (S.exp && window.Lab) {
      const key = x => JSON.stringify(x.rot.map(r => [r.c, r.cv || null])) + x.till;
      const have = new Set(all.map(x => key(Object.assign({ till: inp.till }, x))).concat([key(Object.assign({ till: inp.till }, A.current))]));
      const exps = Lab.experimental(S.rot, A.cal, inp.till).filter(x => !have.has(key(x)) && !x.rot.some(r => inp.exclude.has(r.c) || (r.cv && inp.exclude.has(r.cv))));
      exps.forEach(x => { Object.assign(x, E.simulate(x.rot, A.cl, A.cal, Object.assign({}, inp, { till: x.till }))); x.match = E.match(x.sc, inp.weights); x.tag = 'New, less tested'; });
      if (exps.length) {
        let seed = 20261114; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, n = A.cl.n, B = 300;
        const d = exps.map(() => []);
        for (let b = 0; b < B; b++) { const idx = Array.from({ length: n }, () => Math.floor(rnd() * n)), mc = E.match(E.scoreSet(A.current, inp, idx), inp.weights); exps.forEach((x, j) => d[j].push(E.match(E.scoreSet(x, Object.assign({}, inp, { till: x.till }), idx), inp.weights) - mc)); }
        exps.forEach((x, j) => { const v = d[j].slice().sort((a, b) => a - b); x.boot = { win: v.filter(z => z > 0).length / B, lo: v[Math.floor(B * 0.1)], hi: v[Math.floor(B * 0.9)], runs: B }; });
        all = all.concat(exps);
      }
    }
    const mg = margin(), curC = new Set(S.rot.map(r => r.c));
    if (window.Lab) all.forEach(x => {
      x.need = Lab.needs(x, S.rot); x.adj = Lab.adjust(x, x.need, acc); x.rawMatch = x.match;
      const ci = A.current.sc.income || 1; x.incPct = (x.sc.income - ci) / ci * 100; x.incEur = x.incPct / 100 * mg * (S.area || 0);
      if (x.incPct < -S.maxDrop && x.id !== 'current') { x.adj.blocked.push('incomeDip'); x.need.incomeDip = 'about ' + Math.round(-x.incPct) + '% less income, more than the ' + S.maxDrop + '% you can accept'; }
      const big = x.rot.map(r => r.c).filter(c => !curC.has(c) && Lab.CROPINFO[c] && Lab.CROPINFO[c].niche >= 3).map(c => { const t = (S.area || 0) / x.rot.length * (YIELD[c] || 3); return t >= 300 ? C[c].short.toLowerCase() + ' (about ' + r0(t) + ' t a year)' : null; }).filter(Boolean);
      if (big.length) { x.need.market = big.join(', ') + ' is a lot for a thin local market'; x.adj.pen += 3; }
      x.adj.final = Math.round((x.rawMatch - x.adj.pen) * 10) / 10; x.match = x.adj.final;
    });
    all.sort((a, b) => (a.adj && a.adj.blocked.length ? 1 : 0) - (b.adj && b.adj.blocked.length ? 1 : 0) || b.match - a.match);
    const ok = all.filter(x => !(x.adj && x.adj.blocked.length));
    A.alts = (ok.length ? ok : all).slice(0, 3); A.others = all.filter(x => A.alts.indexOf(x) < 0); A.cons = cons; A.acc = acc;
    if (S.later && ok.length) { const by = ww => ok.slice().sort((a, b) => (E.match(b.sc, ww) - (b.adj ? b.adj.pen : 0)) - (E.match(a.sc, ww) - (a.adj ? a.adj.pen : 0)))[0]; A.plan = { first: by(inp.weights), then: by(S.w2), after: S.years }; } else A.plan = null;
  }
  function render() {
    const A = LAST; if (!A) return;
    const cl = A.cl, all = [A.current].concat(A.alts), best = A.alts[0], better = best && best.match > A.current.match + 1;
    const pane = (id, html) => '<div class="pane" data-pane="' + id + '">' + html + '</div>';

    let R = '';
    if (S.scen.rain || S.scen.temp) R += '<div class="banner warn"><b>Sensitivity test is on.</b> Everything here replays 2001 to 2025 with rainfall ' + (S.scen.rain > 0 ? '+' : '') + S.scen.rain + '% and temperature +' + S.scen.temp + ' °C.</div>';
    if (cl.noFrost) R += '<div class="banner warn"><b>Few or no frosts here.</b> Furrow times crops by frost dates, so sowing and harvest dates for this field are rough. Treat the results as a starting point only.</div>';
    R += '<div class="place">' + esc(S.name) + ', ' + Math.abs(S.lat).toFixed(2) + '°' + (S.lat < 0 ? 'S' : 'N') + ' ' + Math.abs(S.lon).toFixed(2) + '°' + (S.lon < 0 ? 'W' : 'E') + '. ' + E.SOILS[S.soil].name + ', ' + E.TILLAGE[S.till].name.toLowerCase() + '.</div>';
    R += '<h1>' + (!best ? 'We couldn’t build any other rotations from your choices' : better ? 'Best match for you: ' + esc(best.name.charAt(0).toLowerCase() + best.name.slice(1)) : 'Your rotation is already about as good as anything we tried') + '</h1>';
    if (best) {
      R += '<div class="vs"><div class="win"><span class="tag">Best match</span><span class="n">' + r0(best.match) + '</span><span class="l">' + esc(E.rotLabel(best.rot)) + '</span></div><div class="nowc"><span class="tag">What you grow now</span><span class="n">' + r0(A.current.match) + '</span><span class="l">' + esc(E.rotLabel(A.current.rot)) + '</span></div></div><p class="small muted">Scores out of 100, weighted by your priorities' + (A.acc && Object.keys(A.acc).length ? ' and adjusted for what you can take on' : '') + '.</p>';
      if (A.cons && A.cons.length) R += '<div class="note"><h4>Applied from your notes</h4><ul>' + A.cons.map(c => '<li><b>' + esc(c.tag) + '.</b> ' + esc(c.why) + '</li>').join('') + '</ul></div>';
      if (A.plan) R += '<div class="plan"><div><span class="tag">Years 1 to ' + A.plan.after + '</span><b>' + esc(A.plan.first.name) + '</b><small>' + esc(E.rotLabel(A.plan.first.rot)) + '</small></div><div><span class="tag">From year ' + (A.plan.after + 1) + '</span><b>' + esc(A.plan.then.name) + '</b><small>' + esc(E.rotLabel(A.plan.then.rot)) + '</small></div></div>' + (A.plan.first === A.plan.then ? '<p class="small muted">The same option fits both phases.</p>' : '');
      const cm = A.current.m, bm2 = best.m, hot = cl.yearTypes && cl.yearTypes.types.find(t => t.name.indexOf('Hot') === 0);
      const rh = q => hot ? E.mean(hot.idx.map(i => q.m.relByYear[i])) : q.m.relMean;
      const kp = (a, b, unit, main, sub, go) => '<div class="kp" data-go="' + go + '" title="Tap to see the chart"><div class="big ' + (b < a ? 'good' : b > a ? 'bad' : '') + '"><s>' + a + unit + ' to </s><em>' + b + unit + '</em></div><p>' + main + '<span>' + sub + '</span></p></div>';
      R += '<div class="key"><h3>The big changes</h3>' +
        kp(r0(cm.bare), r0(bm2.bare), '', 'days of bare soil a year', 'Right now it’s bare ' + bareMonths(A.current, cl), 'calendar') +
        kp(r0(cm.exposed), r0(bm2.exposed), '', 'mm of heavy rain a year hitting poorly covered soil', 'Out of ' + r0(cl.erosTotal) + ' mm that falls on really rainy days (12.7 mm or more)', 'calendar') +
        kp(Math.round(rh(A.current) * 100), Math.round(rh(best) * 100), '%', 'of the water crops wanted but didn’t get ' + (hot ? 'in hot, dry years' : 'on average'), hot ? hot.count + ' of the ' + cl.n + ' years were hot and dry' : 'Averaged over ' + cl.n + ' years', 'years') +
        '</div><h2 class="second">How the scores change (tap a row to see what it means)</h2>';
      R += dumbbell(A.current, best);
      const bt = best.boot, w = Math.round(bt.win * 100);
      R += '<div class="conf"><span class="cn">' + Math.round(bt.win * bt.runs) + '<small>of ' + bt.runs + '</small></span><span class="ct">' + (bt.win >= 0.9 ? 'Reliably better than what you grow now' : bt.win >= 0.7 ? 'Probably better than what you grow now' : 'About the same as what you grow now') + ' <button class="q" data-term="boot" aria-label="Explain">?</button></span><span class="cs">Wins in ' + Math.round(bt.win * bt.runs) + ' of ' + bt.runs + ' reshuffled versions of the ' + cl.n + ' years' + '</div>';
      R += '<p class="why">' + explain(best, A).why + '</p><button class="btn tolist" data-go="options">Open the full breakdown and all options</button>';
    } else R += '<p class="why">Un-cross a few crops under “Crops you can’t grow or sell” and we’ll have something to compare.</p>';
    R += '<div class="acts"><button class="btn ghost" data-act="print">Print or save as PDF</button><button class="btn ghost" data-act="share">Copy a link to this result</button><span id="shared" class="small muted"></span></div>';
    R += '<p class="fine">Scores run from 0 to 100 and come from replaying each rotation through ' + cl.n + ' years of NASA weather for this spot, weighted by your priorities. Differences of a few points are not meaningful. The weather grid is about 50 km wide (dashed box on the map), so it describes your area rather than the exact field. Soil health and profit are estimates, not measurements.</p>';
    let Cm = '<h2>The last ' + cl.n + ' years here</h2><p class="sub">Daily NASA POWER data, ' + cl.years[0].label + ' to ' + cl.years[cl.n - 1].label + '. One point per year, and the dashed line is the trend. A coloured dot means it’s changing. Tap a line to see any year.</p>';
    for (const i of cl.indicators) {
      const t = i.trend, cls = t.label === 'clear trend' ? ' clear' : t.label === 'possible trend' ? ' possible' : '';
      Cm += '<div class="irow' + (cls === ' clear' ? ' hot' : cls === ' possible' ? ' warm' : '') + '" title="' + esc(i.note) + '"><div><div class="k">' + i.name + '</div><div class="r">' + i.lo.toFixed(i.digits) + ' to ' + i.hi.toFixed(i.digits) + ' in 8 years out of 10</div><div class="mean">' + (t.label === 'no clear trend' ? 'No clear change since ' + cl.years[0].label + '.' : (MEANS[i.key] ? MEANS[i.key][t.perDecade > 0 ? 0 : 1] : '')) + '</div></div><div class="sp">' + spark(i, cl) + '</div><div><div class="v">' + i.mean.toFixed(i.digits) + ' <small>' + i.unit + '</small></div><div class="t' + cls + '">' + (t.perDecade > 0 ? '+' : '') + t.perDecade.toFixed(i.digits ? 1 : 0) + ' per decade, ' + TREND[t.label] + '</div></div></div>';
    }
    if (!cl.noFrost) Cm += '<div class="irow"><div><div class="k">Typical frost dates</div><div class="r">Median of ' + cl.n + ' years. Crop calendars are built from these.</div></div><div class="sp"></div><div><div class="v" style="font-size:16px">' + cl.fmtDay(cl.lastFrost) + ' <small>last</small></div><div class="v" style="font-size:16px">' + cl.fmtDay(cl.firstFrost) + ' <small>first</small></div></div></div>';
    Cm += '<p class="fine">Evaporative demand: ' + (cl.pmShare > 0.5 ? 'FAO Penman-Monteith, using satellite-derived sunlight (NASA CERES), wind and humidity from NASA POWER on ' + Math.round(cl.pmShare * 100) + '% of days' + (cl.pmShare < 0.995 ? ', Hargreaves on the rest.' : '.') : 'Hargreaves equation from daily temperatures. The fuller Penman-Monteith inputs were not available for this load.') + '</p>';
    if (S.terrain) Cm += terrainHTML(S.terrain);
    if (cl.hasGw && cl.gwAnom) {
      const dry = cl.gwAnom.map((r, i) => [E.mean(r), cl.years[i].label]).sort((a, b) => a[0] - b[0]);
      Cm += '<h2>Soil moisture: when it got dry</h2><p class="sub">Each square compares how wet the soil was with what’s normal for that month here. Amber means drier than usual, blue means wetter. Tap a square for the details. Driest years: <b>' + dry.slice(0, 3).map(d => d[1]).join(', ') + '</b>. Wettest: <b>' + dry.slice(-3).reverse().map(d => d[1]).join(', ') + '</b>. If you remember those years, see if it matches.</p><div class="fig">' + anomFigure(cl) + '</div><p class="fine">Source: NASA POWER root-zone soil wetness (GWETROOT), a model estimate for the grid cell.</p>';
    }

    const K = '<h2>When it rains vs. what’s on the field</h2><p class="sub">Top: rain in an average year next to how much water the air pulls out of the ground. Below: each rotation, year by year. Amber is bare soil, so amber under tall bright-blue bars means heavy rain is hitting bare ground. Tap any bar or strip for details.</p><div class="legend"><span><i style="background:' + COL.waterSoft + '"></i>Rain</span><span><i style="background:' + COL.water + '"></i>on heavy-rain days</span><span><i style="background:' + COL.et + ';border-radius:50%"></i>Water the air pulls out</span><span><i style="background:' + COL.crop + '"></i>Cash crop</span><span><i style="background:' + COL.cover + '"></i>Cover crop</span><span><i style="background:' + COL.peren + '"></i>Perennial</span><span><i style="background:' + COL.straw + '"></i>Residue</span><span><i style="background:' + COL.bare + '"></i>Bare soil</span></div><div class="fig">' + yearFigure(cl, all) + '</div>' + ndviNote(A);

    if (S.sel >= all.length) S.sel = 0;
    const allx = all.concat(A.others), rk = []; let O = '';
    allx.slice().sort((p, q) => q.match - p.match).forEach(s => { const i = allx.indexOf(s); rk.push('<button class="rk" data-sel="' + i + '" aria-pressed="' + (i === S.sel) + '"><span class="dot"></span><span class="nm"><b>' + esc(s.name) + '</b><small>' + esc(E.rotLabel(s.rot)) + (s.boot ? ' · beats yours in ' + Math.round(s.boot.win * 100) + '% of reshuffles' : '') + '</small></span><span class="sc">' + r0(s.match) + '</span><span class="br"><i style="width:' + r0(s.match) + '%"></i></span></button>'); });
    if (S.sel >= allx.length) S.sel = 0;
    const s = allx[S.sel], x = explain(s, A), isCur = s.id === 'current', cur = A.current;
    const tagt = isCur ? 'What you grow now' : s === A.alts[0] ? 'Your best match' : s.tag && s.tag.indexOf('New') === 0 ? 'New, less tested' : 'Option';
    const delta = r0(s.match) - r0(cur.match);
    O += '<div class="optd' + (S.animOpt ? ' in' : '') + '"><div class="ohead"><span class="tag">' + tagt + '</span>' + (s.adj && s.adj.blocked.length ? '<span class="tag no">Needs something you ruled out</span>' : '') + '</div>';
    O += '<h3 class="big">' + esc(E.rotLabel(s.rot)) + '</h3><div class="oscore"><b>' + r0(s.match) + '</b><span>/ 100 for your priorities' + (isCur ? '' : ', <em class="' + (delta >= 0 ? 'up' : 'dn') + '">' + (delta >= 0 ? '+' : '') + delta + '</em> vs now') + '</span></div>';
    O += '<p class="lead">' + x.why + '</p>';
    if (!isCur && s.incPct != null) O += '<div class="money ' + (s.incPct >= 0 ? 'up' : 'dn') + '">Estimated income: <b>' + (s.incPct >= 0 ? '+' : '') + Math.round(s.incPct) + '%</b>' + (margin() && S.area ? ', about <b>' + (s.incEur >= 0 ? '+' : '−') + '€' + Math.abs(Math.round(s.incEur / 100) * 100).toLocaleString('en') + '</b> a year on ' + S.area + ' ha' : '') + ' <button class="q" data-term="s_income" aria-label="Explain">?</button></div>';
    if (!isCur) {
      const kpi = (lab, a, b, unit, good, term) => { const better = good ? b > a : b < a, same = a === b; return '<div class="kpi"><span class="kl">' + lab + ' <button class="q" data-term="' + term + '" aria-label="Explain">?</button></span><span class="kv"><s>' + a + unit + '</s> ' + b + unit + '</span><span class="kd ' + (same ? '' : better ? 'up' : 'dn') + '">' + (same ? 'same' : better ? 'better' : 'worse') + '</span></div>'; };
      O += '<div class="kpis">' + kpi('Bare soil, days a year', r0(cur.m.bare), r0(s.m.bare), '', false, 'bare') + kpi('Heavy rain on open soil, mm', r0(cur.m.exposed), r0(s.m.exposed), '', false, 'heavy') + kpi('Water crops missed', Math.round(cur.m.relMean * 100), Math.round(s.m.relMean * 100), '%', false, 'water') + kpi('Living roots, days a year', r0(cur.m.living), r0(s.m.living), '', true, 'roots') + '</div>';
    }
    O += '<div class="bars">';
    for (const d of DIMS) { const v = s.sc[d[0]], dl = v - cur.sc[d[0]]; O += '<span>' + d[1] + ' <button class="q" data-term="s_' + d[0] + '" aria-label="Explain">?</button></span><span class="track"><b style="width:' + v + '%"></b></span><span class="num">' + v + '</span><span class="d ' + (isCur || !dl ? '' : dl > 0 ? 'up' : 'dn') + '">' + (isCur || !dl ? '' : (dl > 0 ? '+' : '') + dl) + '</span>'; }
    O += '</div>';
    const sec = (title, body, open, cls) => '<details class="osec' + (cls ? ' ' + cls : '') + '"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="ob">' + body + '</div></details>';
    const ul = a => '<ul>' + a.map(e => '<li>' + e + '</li>').join('') + '</ul>';
    if (s.need && Object.keys(s.need).length) O += sec('What it asks of you', ul(Object.keys(s.need).map(k => (s.adj.blocked.includes(k) ? '<span class="badtxt">' : '') + Lab.ACCEPT[k].q + ': ' + esc(s.need[k]) + (s.adj.blocked.includes(k) ? ' (you said this isn’t possible)</span>' : ''))), true);
    if (x.ben.length) O += sec('What you could gain', ul(x.ben.map(esc)), false);
    O += sec('Check locally before acting', ul(x.rev.map(esc)), false, 'warn');
    O += sec('What the data shows', ul(x.ev.map(e => '<span class="lnk" data-go="' + (/^(Bare soil|Heavy rain|Living roots)/.test(e) ? 'calendar' : /^Nitrogen/.test(e) ? 'method' : /^Damaging heat/.test(e) ? 'climate' : 'years') + '">' + e + '</span>')), false);
    if (s.boot) O += sec('How sure we are <button class="q" data-term="boot" aria-label="Explain">?</button>', '<p>Beats your current rotation in <b>' + Math.round(s.boot.win * s.boot.runs) + ' of ' + s.boot.runs + '</b> reshuffles of the ' + cl.n + ' years. Each reshuffle rebuilds the record from randomly drawn years, so a high number means the result does not hinge on a few unusual seasons.</p>', false);
    O += sec('What we can’t know from here', ul(x.gaps.map(esc)), false);
    O += '<div class="stickbar"><button class="btn bigbtn" id="showrank">See all ' + allx.length + ' options</button></div>'; RANK = rk.join('');
    if (false) {
      O += '<details class="more"><summary>Other ones we tried (' + A.others.length + ')</summary><div class="scroll"><table><thead><tr><th>Rotation</th><th>Match</th>' + DIMS.map(d => '<th>' + d[1].split(' ')[0] + '</th>').join('') + '</tr></thead><tbody>';
      for (const o of A.others) O += '<tr><td>' + esc(o.name) + '<div class="muted small">' + esc(E.rotLabel(o.rot)) + '</div></td><td class="num">' + r0(o.match) + '</td>' + DIMS.map(d => '<td class="num">' + o.sc[d[0]] + '</td>').join('') + '</tr>';
      O += '</tbody></table></div></details>';
    }
    O += '</div>'; S.animOpt = false;

    const yt = cl.yearTypes; let Yh = '';
    if (yt) {
      Yh = '<h2>How each rotation handles good and bad years</h2><p class="sub">The ' + cl.n + ' growing seasons are sorted into three kinds by warm-season rain, evaporative demand and hot days' + (yt.fallback ? '' : ', using a clustering model (k-means)') + '. The bars show how much of the water crops wanted they didn’t get. Shorter is better. Tap a bar for the worst year.</p>';
      for (const t of yt.types) {
        Yh += '<div class="ytype"><div class="hd"><h3>' + t.name + '</h3><span class="small muted">' + t.early + ' of ' + yt.half + ' early years, ' + t.late + ' of ' + (cl.n - yt.half) + ' recent</span></div><div class="yrs">' + r0(t.rain) + ' mm rain, ' + r0(t.et0) + ' mm demand, ' + r0(t.hot) + ' days over 32 °C. ' + t.labels.join(', ') + '</div>';
        for (const q of all) { const v = E.mean(t.idx.map(i => q.m.relByYear[i])), wi = t.idx.slice().sort((x, y) => q.m.relByYear[y] - q.m.relByYear[x])[0], bi = t.idx.slice().sort((x, y) => q.m.relByYear[x] - q.m.relByYear[y])[0]; Yh += '<div class="yb" data-tip="' + esc(q.name) + ' in ' + t.name.toLowerCase() + ': ' + pc(v) + ' of the water crops wanted was missing on average. Worst was ' + cl.years[wi].label + ' (' + pc(q.m.relByYear[wi]) + '), best was ' + cl.years[bi].label + ' (' + pc(q.m.relByYear[bi]) + ')."><span>' + esc(q.name) + '</span><span><i style="width:' + Math.min(100, Math.max(1, v * 200)) + '%"></i></span><span class="num">' + pc(v) + '</span></div>'; }
        Yh += '</div>';
      }
      Yh += '<p class="fine">“Early” is ' + yt.firstLabel + ' to ' + cl.years[yt.half - 1].label + '; “recent” is ' + yt.midLabel + ' to ' + yt.lastLabel + '. ' + (yt.fallback ? 'The clustering model split these years very unevenly (one group had fewer than three years), so the groups shown use a simpler rule: the driest, middle and wettest thirds by rain minus demand. The two methods agreed on ' + yt.agree + ' of the ' + cl.n + ' years.' : 'A simpler rule (the driest, middle and wettest thirds by rain minus demand) puts ' + yt.agree + ' of the ' + cl.n + ' years in the same group as the clustering model, so ' + (yt.agree >= cl.n * 0.75 ? 'the grouping is not an artefact of one method' : 'the two methods disagree on a fair number of years and the groups are fuzzy') + '.') + ' With only ' + cl.n + ' seasons each group is small. So take it as a pattern to talk over with someone local, not a forecast.</p>';
    } else Yh = '<p class="sub">Not enough seasons to group.</p>';
    if (!S.keepAnim) $('scroll').classList.remove('anim'); S.keepAnim = false;
    sheet(A);
    $('out').innerHTML = pane('result', R) + pane('climate', Cm) + pane('calendar', K) + pane('options', O) + pane('years', Yh);
    story();
  }

  function ndviNote(A) {
    if (!S.ndvi) return ''; const cl = A.cl, tl = A.current.tl, rot = A.current.rot, parts = [];
    S.ndvi.yrs.forEach(yr => {
      let bestR = 0, bestOk = -1, n = 0;
      for (let r = 0; r < tl.N; r++) { let ok = 0; n = 0; S.ndvi.by[yr].forEach((v, i) => { if (v === null) return; const d = ((i * 16 + 8 - cl.off) % 365 + 365) % 365; n++; if ((v >= 0.45) === (tl.cov[r * 365 + d] >= 0.6)) ok++; }); if (ok > bestOk) { bestOk = ok; bestR = r; } }
      parts.push('In ' + yr + ' the field looked most like your <b style="color:#fff">' + C[rot[bestR].c].short.toLowerCase() + '</b> year: ' + bestOk + ' of ' + n + ' sixteen-day windows match on whether the ground was green.');
    });
    return '<p class="fine"><b style="color:#fff">Satellite check.</b> The top strips are greenness measured by NASA\'s MODIS instrument on a 250 m square at your point. ' + parts.join(' ') + ' A poor match can mean our dates are off for your area, that something else was grown that year, or that the square covers several fields.</p>';
  }
  function dumbbell(cur, best) {
    const W = 560, L = 190, R = 44, pw = W - L - R, X = v => L + v / 100 * pw; let g = '', y = 26;
    [0, 25, 50, 75, 100].forEach(v => { g += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="16" y2="' + (26 + DIMS.length * 44 - 12) + '" stroke="' + COL.line + '"/><text x="' + X(v) + '" y="10" text-anchor="middle" font-size="13.7" fill="' + COL.muted + '">' + v + '</text>'; });
    for (const d of DIMS) {
      const a = cur.sc[d[0]], b = best.sc[d[0]], dl = b - a, c = dl > 2 ? '#8FD694' : dl < -2 ? '#F2907E' : '#A8A89C';
      g += '<text x="0" y="' + (y + 4) + '" font-size="16.9" fill="' + COL.ink + '">' + d[1] + '</text><text x="0" y="' + (y + 20) + '" font-size="13.7" fill="' + COL.muted + '">importance ' + S.weights[d[0]] + '</text>';
      g += '<line x1="' + X(a) + '" x2="' + X(b) + '" y1="' + y + '" y2="' + y + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round" opacity=".55"/><circle cx="' + X(a) + '" cy="' + y + '" r="5.5" fill="' + COL.panel + '" stroke="#A8A89C" stroke-width="2"><title>Now: ' + a + '</title></circle><circle cx="' + X(b) + '" cy="' + y + '" r="7" fill="' + c + '"><title>Alternative: ' + b + '</title></circle>';
      g += '<text x="' + (W - 2) + '" y="' + (y + 4.5) + '" text-anchor="end" font-size="16.9" font-weight="700" fill="' + c + '">' + (dl > 0 ? '+' : '') + dl + '</text><rect x="0" y="' + (y - 18) + '" width="' + W + '" height="40" fill="transparent" data-tip="' + esc(d[1] + ': ' + DIMTIP[d[0]] + ' Yours now: ' + a + '. The other option: ' + b + '.') + '"/>';
      y += 44;
    }
    return '<div class="legend" style="margin-bottom:2px"><span><i style="background:none;box-shadow:inset 0 0 0 2px #A8A89C;border-radius:50%"></i>your rotation now</span><span><i style="background:#8FD694;border-radius:50%"></i>the alternative</span></div><svg class="dumb" viewBox="0 0 ' + W + ' ' + (26 + DIMS.length * 44 - 6) + '" role="img" aria-label="Scores for each priority, current rotation against the alternative">' + g + '</svg>';
  }
  function terrainHTML(T) {
    const c = 46, col = v => v > 6 ? '#F2907E' : v >= 2 ? '#F2A541' : '#3E8E5A'; let g = '';
    T.slopes.forEach((v, i) => { const x = (i % T.n) * c, y = Math.floor(i / T.n) * c; g += '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (c - 2) + '" height="' + (c - 2) + '" rx="3" fill="' + col(v) + '"' + (T.low[i] ? ' stroke="#7CC6E8" stroke-width="3"' : '') + '><title>' + r0(T.z[i]) + ' m, slope ' + v.toFixed(1) + '%' + (T.low[i] ? ', low spot' : '') + '</title></rect><text x="' + (x + c / 2) + '" y="' + (y + c / 2 + 4) + '" text-anchor="middle" font-size="11" fill="#10231A">' + r0(T.z[i]) + '</text>'; });
    return '<h2>The ground around your point</h2><div class="terr"><svg viewBox="0 0 ' + c * T.n + ' ' + c * T.n + '" role="img" aria-label="Elevation and slope on a 5 by 5 grid around the field">' + g + '</svg><div><p>Across a ' + (T.step * T.n / 1000).toFixed(2).replace(/0$/, '') + ' km square the ground runs from <b>' + r0(T.min) + ' m</b> to <b>' + r0(T.max) + ' m</b>. Typical slope is <b>' + T.typical.toFixed(1) + '%</b>, the steepest part <b>' + T.steepest.toFixed(1) + '%</b>.</p><p>' + (T.steepCells ? '<b>' + T.steepCells + ' of ' + T.slopes.length + '</b> squares slope more than 6%. Heavy rain on bare soil does the most damage there, so those are the places where cover matters most.' : 'No square slopes more than 6%, so runoff speed is not the main erosion driver here.') + '</p><p>' + (T.lowCells ? '<b>' + T.lowCells + '</b> low ' + (T.lowCells === 1 ? 'spot is' : 'spots are') + ' outlined in blue. Cold air settles in hollows, so frost can come later in spring and earlier in autumn there than the district dates suggest.' : 'No marked hollows where cold air would pool.') + '</p><div class="legend"><span><i style="background:#3E8E5A"></i>under 2%</span><span><i style="background:#F2A541"></i>2 to 6%</span><span><i style="background:#F2907E"></i>over 6%</span><span><i style="background:none;box-shadow:inset 0 0 0 2px #7CC6E8"></i>low spot</span></div></div></div><p class="fine">Numbers are metres above sea level. Source: Copernicus 90 m elevation model (ESA), read through Open-Meteo. Too coarse for a field survey; use it to know where to look.</p>';
  }
  function spark(i, cl) {
    const v = i.series, n = v.length, W = 200, H = 44, lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), sp = (hi - lo) || 1;
    const X = k => 3 + k / (n - 1) * (W - 6), Y = y => H - 5 - (y - lo) / sp * (H - 10);
    const sl = i.trend.perDecade / 10, b = E.median(v.map((y, k) => y - sl * k));
    const c2 = i.trend.label === 'clear trend' ? '#F2907E' : i.trend.label === 'possible trend' ? '#F2A541' : '#86867A';
    const pts = v.map((y, k) => X(k).toFixed(1) + ',' + Y(y).toFixed(1)).join(' '), id = 'sg' + i.key;
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(i.name) + ', each year from ' + cl.years[0].label + ' to ' + cl.years[n - 1].label + ', with trend line"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8A89C" stop-opacity=".28"/><stop offset="1" stop-color="#A8A89C" stop-opacity="0"/></linearGradient></defs><rect x="3" y="' + Y(Math.min(hi, i.hi)).toFixed(1) + '" width="' + (W - 6) + '" height="' + Math.max(1, Y(Math.max(lo, i.lo)) - Y(Math.min(hi, i.hi))).toFixed(1) + '" fill="rgba(255,255,255,.045)"/><polygon points="3,' + H + ' ' + pts + ' ' + (W - 3) + ',' + H + '" fill="url(#' + id + ')"/><polyline points="' + pts + '" fill="none" stroke="#C9C7BA" stroke-width="1.4" stroke-linejoin="round"/><line x1="' + X(0) + '" y1="' + Y(Math.min(hi, Math.max(lo, b))).toFixed(1) + '" x2="' + X(n - 1) + '" y2="' + Y(Math.min(hi, Math.max(lo, b + sl * (n - 1)))).toFixed(1) + '" stroke="' + c2 + '" stroke-width="2" stroke-dasharray="5 3"/><circle cx="' + X(n - 1) + '" cy="' + Y(v[n - 1]).toFixed(1) + '" r="3" fill="#EEF2E6"/>' + v.map((y, k) => '<rect x="' + (X(k) - (W - 6) / (n - 1) / 2).toFixed(1) + '" y="0" width="' + ((W - 6) / (n - 1)).toFixed(1) + '" height="' + H + '" fill="transparent" data-tip="' + cl.years[k].label + ': ' + y.toFixed(i.digits) + ' ' + i.unit + '"/>').join('') + '</svg><div class="sparkax"><span>' + cl.years[0].label + '</span><span>' + cl.years[n - 1].label + '</span></div>';
  }
  function yearFigure(cl, list) {
    const W = 720, L = 118, PW = 596, X = d => L + d / 365 * PW;
    const top = 34, CH = 170, mx = Math.max.apply(null, cl.mRain.concat(cl.mEt0));
    const step = mx > 200 ? 50 : mx > 80 ? 25 : 10, ymax = Math.ceil(mx / step) * step, Yv = v => top + CH - v / ymax * CH;
    let s = '<defs><linearGradient id="gRain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B7186"/><stop offset="1" stop-color="#234652"/></linearGradient><linearGradient id="gHeavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AD8F2"/><stop offset="1" stop-color="#5AAED3"/></linearGradient><linearGradient id="gEt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2907E" stop-opacity=".22"/><stop offset="1" stop-color="#F2907E" stop-opacity="0"/></linearGradient></defs>', y = top;
    for (let v = 0; v <= ymax; v += step) s += '<line x1="' + L + '" x2="' + (L + PW) + '" y1="' + Yv(v) + '" y2="' + Yv(v) + '" stroke="' + COL.line + '" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Yv(v) + 4) + '" text-anchor="end" font-size="14.3" fill="' + COL.muted + '">' + v + '</text>';
    s += '<text x="' + (L - 8) + '" y="' + (top - 16) + '" text-anchor="end" font-size="14.3" fill="' + COL.muted + '">mm a month</text>';
    const pt = [];
    for (let m = 0; m < 12; m++) {
      const x0 = X(E.CUM[m]) + 6, w = X(E.CUM[m + 1]) - X(E.CUM[m]) - 12, cx = x0 + w / 2;
      s += '<rect x="' + x0 + '" y="' + Yv(cl.mRain[m]) + '" width="' + w + '" height="' + (top + CH - Yv(cl.mRain[m])) + '" fill="url(#gRain)" rx="4"><title>' + cl.monthName(m) + ': ' + r0(cl.mRain[m]) + ' mm rain</title></rect>';
      s += '<rect x="' + (x0 + w * 0.18) + '" y="' + Yv(cl.mEros[m]) + '" width="' + w * 0.64 + '" height="' + (top + CH - Yv(cl.mEros[m])) + '" fill="url(#gHeavy)" rx="3"><title>' + cl.monthName(m) + ': ' + r0(cl.mEros[m]) + ' mm on days of 12.7 mm or more</title></rect>';
      pt.push([cx, Yv(cl.mEt0[m])]);
      s += '<text x="' + cx + '" y="' + (top + CH + 20) + '" text-anchor="middle" font-size="15.6" fill="' + COL.ink + '">' + cl.monthName(m) + '</text>';
    }
    const line = pt.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    s += '<polygon points="' + pt[0][0] + ',' + (top + CH) + ' ' + line + ' ' + pt[11][0] + ',' + (top + CH) + '" fill="url(#gEt)"/><polyline points="' + line + '" fill="none" stroke="' + COL.et + '" stroke-width="2.2" stroke-linejoin="round"/>';
    pt.forEach((p, m) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.6" fill="' + COL.et + '" stroke="' + COL.panel + '" stroke-width="1.5"><title>' + cl.monthName(m) + ': ' + r0(cl.mEt0[m]) + ' mm evaporative demand</title></circle>'; });
    y = top + CH + 40;
    const y0 = y;
    if (S.ndvi) {
      const mixc = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')', nc = v => v < 0.3 ? mixc([120, 92, 60], [196, 168, 110], Math.max(0, v) / 0.3) : mixc([196, 168, 110], [62, 160, 84], Math.min(1, (v - 0.3) / 0.5));
      s += '<text x="0" y="' + (y + 16) + '" font-size="16.9" font-weight="600" fill="' + COL.ink + '">What the satellite saw</text>'; y += 27;
      S.ndvi.yrs.forEach(yr => {
        s += '<text x="' + (L - 8) + '" y="' + (y + 16) + '" text-anchor="end" font-size="14.3" fill="' + COL.muted + '">MODIS ' + yr + '</text><clipPath id="cN' + yr + '"><rect x="' + L + '" y="' + y + '" width="' + PW + '" height="22" rx="4"/></clipPath><g clip-path="url(#cN' + yr + ')">';
        S.ndvi.by[yr].forEach((v, i) => { if (v === null) return; const d0 = ((i * 16 - cl.off) % 365 + 365) % 365, x0 = X(d0), w = X(Math.min(365, d0 + 16)) - x0; s += '<rect x="' + x0 + '" y="' + y + '" width="' + (w + 0.5) + '" height="22" fill="' + nc(v) + '"><title>' + yr + ', around ' + cl.fmtDay(d0 + 8) + ': greenness (NDVI) ' + v.toFixed(2) + '</title></rect>'; if (d0 + 16 > 365) s += '<rect x="' + X(0) + '" y="' + y + '" width="' + (X(d0 + 16 - 365) - X(0)) + '" height="22" fill="' + nc(v) + '"/>'; });
        s += '</g>'; y += 27;
      });
      y += 7;
    }
    const fill = { 0: COL.bare, 1: COL.straw, 2: COL.crop, 3: COL.cover, 4: COL.peren };
    list.forEach((st, si) => {
      s += '<text x="0" y="' + (y + 16) + '" font-size="16.9" font-weight="600" fill="' + COL.ink + '">' + esc(st.name) + '</text>'; y += 27;
      const tl = st.tl;
      for (let i = 0; i < tl.N; i++) {
        s += '<text x="' + (L - 8) + '" y="' + (y + 16) + '" text-anchor="end" font-size="14.3" fill="' + COL.muted + '">Year ' + (i + 1) + '</text><clipPath id="c' + si + '_' + i + '"><rect x="' + L + '" y="' + y + '" width="' + PW + '" height="22" rx="4"/></clipPath><g clip-path="url(#c' + si + '_' + i + ')">';
        let a = 0;
        while (a < 365) {
          const t0 = i * 365 + a, k = tl.st[t0], who = tl.ci[t0]; let b = a;
          while (b < 365 && tl.st[i * 365 + b] === k && tl.ci[i * 365 + b] === who) b++;
          const x0 = X(a), w = X(b) - x0, lab = k === 0 ? 'Bare soil' : k === 1 ? 'Residue' : k === 3 ? 'Cover crop' : C[st.rot[who].c].short;
          s += '<rect x="' + x0 + '" y="' + y + '" width="' + Math.max(0.5, w - 1) + '" height="22" fill="' + fill[k] + '"><title>' + lab + ': ' + cl.fmtDay(a) + ' to ' + cl.fmtDay(b - 1) + '</title></rect>';
          if (w > lab.length * 8.4 + 10) s += '<text x="' + (x0 + w / 2) + '" y="' + (y + 16) + '" text-anchor="middle" font-size="13.7" font-weight="600" fill="' + (k === 4 ? '#fff' : '#10231A') + '" pointer-events="none">' + lab + '</text>';
          a = b;
        }
        s += '</g>'; y += 27;
      }
      y += 8;
    });
    let grid = ''; for (let m = 1; m < 12; m++) grid += '<line x1="' + X(E.CUM[m]) + '" x2="' + X(E.CUM[m]) + '" y1="' + (y0 - 6) + '" y2="' + (y - 8) + '" stroke="rgba(240,236,220,.09)" stroke-dasharray="2 4"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + y + '" role="img" aria-label="Monthly rain and evaporative demand above a calendar of ground cover for each rotation">' + grid + s + '</svg>';
  }
  function anomFigure(cl) {
    const L = 66, cw = 40, chh = 17, W = L + 12 * cw + 6, H = 22 + cl.n * chh + 34;
    const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
    const col = z => { const t = Math.min(1, Math.abs(z) / 2); return z < 0 ? mix([40, 40, 36], [242, 165, 65], t) : mix([40, 40, 36], [124, 198, 232], t); };
    let s = '';
    for (let m = 0; m < 12; m++) s += '<text x="' + (L + m * cw + cw / 2) + '" y="14" text-anchor="middle" font-size="14.3" fill="' + COL.muted + '">' + cl.monthName(m) + '</text>';
    cl.gwAnom.forEach((row, i) => {
      const y = 22 + i * chh;
      s += '<text x="' + (L - 6) + '" y="' + (y + 10) + '" text-anchor="end" font-size="13" fill="' + COL.muted + '">' + cl.years[i].label + '</text>';
      row.forEach((z, m) => { s += '<rect x="' + (L + m * cw) + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (chh - 2) + '" rx="2.5" fill="' + col(z) + '"><title>' + cl.monthName(m) + ' ' + cl.years[i].label + ': ' + (z > 0 ? '+' : '') + z.toFixed(1) + ' standard deviations</title></rect>'; });
    });
    const ly = 22 + cl.n * chh + 10;
    for (let j = 0; j <= 8; j++) s += '<rect x="' + (L + j * 22) + '" y="' + ly + '" width="22" height="9" fill="' + col(-2 + j * 0.5) + '"/>';
    s += '<text x="' + L + '" y="' + (ly + 21) + '" font-size="13" fill="' + COL.muted + '">much drier</text><text x="' + (L + 99) + '" y="' + (ly + 21) + '" text-anchor="middle" font-size="13" fill="' + COL.muted + '">normal</text><text x="' + (L + 198) + '" y="' + (ly + 21) + '" text-anchor="end" font-size="13" fill="' + COL.muted + '">much wetter</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="min-width:420px" role="img" aria-label="Soil wetness anomaly by month and year">' + s + '</svg>';
  }

  function renderRot() {
    const cropOpts = id => CORDER.map(k => '<option value="' + k + '"' + (k === id ? ' selected' : '') + '>' + C[k].name + '</option>').join('');
    $('rot').innerHTML = S.rot.map((r, i) => {
      const noCv = C[r.c].kind === 'fallow' || C[r.c].kind === 'perennial';
      return '<div class="rotrow"><span class="yr">Year ' + (i + 1) + '</span><select id="rc' + i + '" aria-label="Crop in year ' + (i + 1) + '">' + cropOpts(r.c) + '</select><select id="rv' + i + '" aria-label="Cover crop after year ' + (i + 1) + '"' + (noCv ? ' disabled' : '') + '><option value="">No cover crop</option>' + Object.keys(CV).map(k => '<option value="' + k + '"' + (k === r.cv ? ' selected' : '') + '>+ ' + CV[k].short + '</option>').join('') + '</select>' + (S.rot.length > 1 ? '<button id="rx' + i + '" aria-label="Remove year ' + (i + 1) + '" title="Remove this year">×</button>' : '<span></span>') + '</div>';
    }).join('');
    S.rot.forEach((r, i) => {
      $('rc' + i).onchange = e => { r.c = e.target.value; if (C[r.c].kind === 'fallow' || C[r.c].kind === 'perennial') r.cv = null; renderRot(); recompute(); };
      $('rv' + i).onchange = e => { r.cv = e.target.value || null; recompute(); };
      if ($('rx' + i)) $('rx' + i).onclick = () => { S.rot.splice(i, 1); renderRot(); recompute(); };
    });
    $('addyr').disabled = S.rot.length >= 6;
  }
  const EV = ['climate', 'calendar', 'years', 'method'];
  const ICON = { field: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.500 15.400 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.300"/>', result: '<path d="M12 21V11"/><path d="M12 13c0-4 2.500-6.500 7-7 0 4.500-2.500 7-7 7z"/><path d="M12 16c0-3-2-5-5.500-5.500C6.500 14 8.500 16 12 16z"/>', options: '<path d="M4 7h16M4 12h16M4 17h10"/>', evidence: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M7 15l4-4 3 2.500L19 8"/>' };
  function setTab(id) {
    if (id === 'evidence') id = S.ev || 'climate';
    if (id === 'field') document.body.dataset.view = 'field';
    else { document.body.dataset.view = 'results'; document.body.dataset.tab = id; $('scroll').scrollTop = 0; }
    const sc = $('scroll'); sc.classList.remove('anim'); void sc.offsetWidth; sc.classList.add('anim');
    if (window.innerWidth <= 900) { const lim = Math.round(window.innerHeight * 0.36) - 46; if (window.scrollY > lim) window.scrollTo(0, lim); }
    const ev = EV.indexOf(id) >= 0; if (ev) S.ev = id;
    document.body.dataset.group = id === 'field' ? 'field' : ev ? 'ev' : 'main';
    document.querySelectorAll('#tabs [data-tab-btn]').forEach(b => b.setAttribute('aria-selected', b.dataset.tabBtn === document.body.dataset.tab ? 'true' : 'false'));
    document.querySelectorAll('#dock [data-tab-btn]').forEach(b => b.setAttribute('aria-selected', b.dataset.tabBtn === id || (ev && b.dataset.tabBtn === 'evidence') ? 'true' : 'false'));
    moveInk();
  }
  function moveInk() {
    ['tabs', 'dock'].forEach(n => { const nav = $(n), ink = nav.querySelector('.ink'), b = nav.querySelector('[aria-selected=true]'); if (!ink) return; if (!b || !b.offsetWidth) { ink.style.opacity = 0; return; } ink.style.opacity = 1; ink.style.width = b.offsetWidth + 'px'; ink.style.transform = 'translateX(' + b.offsetLeft + 'px)'; });
  }
  const WIZ = [['field', 'Where is your field?', 'Enter coordinates, tap the map, or pick an example at the top.'], ['rot', 'What do you grow now?', 'One row per year, in rotation order. Add a cover crop if you already use one.'], ['soil', 'Soil and slope', 'Pick the closest texture class. Tap “What does this mean?” on any item for details.'], ['pri', 'What is your priority right now?', 'Set how important each goal is for the coming seasons. You can plan a change of priorities later.'], ['excl', 'Crops you can’t grow or sell', 'Tap a crop to exclude it. Skip if everything is available.'], ['acc', 'What you can take on', 'The best options for your priorities need the following. Rate how feasible each is: 0 = not possible at all, 5 = no problem.'], ['free', 'Anything else that limits you?', 'Tap what applies, or describe it in your own words in any language. We show exactly how each one changes the advice.']];
  function closeModal() { const m = $('modal'); if (!m.classList.contains('on')) return; m.classList.add('out'); setTimeout(() => { m.classList.remove('on', 'out', 'wide', 'term'); }, 220); }
  function openRank() {
    $('mbox').innerHTML = '<div class="mhead"><h2>All options for your field</h2><button class="btn ghost xbtn" data-close aria-label="Close">×</button></div><p class="muted">Sorted by how well they fit your priorities. Tap one to see it in full.</p><div class="rank">' + RANK + '</div>';
    $('modal').classList.add('on', 'wide');
  }
  const ANIM = {
    rain: '<svg viewBox="0 0 320 150" class="xanim"><g class="a-drops">' + [24, 60, 96, 132, 188, 224, 260, 296].map((x, i) => '<line x1="' + x + '" y1="0" x2="' + (x - 5) + '" y2="12" style="animation-delay:' + (i * 0.16) + 's"/>').join('') + '</g><rect x="8" y="90" width="146" height="34" rx="4" fill="#8a6a43"/><rect x="166" y="90" width="146" height="34" rx="4" fill="#8a6a43"/><rect x="166" y="86" width="146" height="5" rx="2" fill="#c9b27a"/>' + [180, 200, 220, 240, 260, 280, 300].map((x, i) => '<path class="a-sway" d="M' + x + ' 88 q5 -22 0 -38 q-5 16 0 38" fill="#9fd67a" style="animation-delay:' + (i * 0.2) + 's"/>').join('') + '<g class="a-wash"><circle cx="40" cy="92" r="3" fill="#c9a06a"/><circle cx="80" cy="93" r="2.5" fill="#c9a06a"/><circle cx="120" cy="92" r="3" fill="#c9a06a"/></g><text x="81" y="143" text-anchor="middle">bare: soil washes off</text><text x="239" y="143" text-anchor="middle">covered: water soaks in</text></svg>',
    bucket: '<svg viewBox="0 0 320 130" class="xanim"><defs><clipPath id="bk"><path d="M112 24 L128 120 H192 L208 24 Z"/></clipPath></defs><g clip-path="url(#bk)"><rect class="a-level" x="100" y="24" width="120" height="96" fill="#7cc6e8" opacity=".8"/></g><path d="M112 24 L128 120 H192 L208 24" fill="none" stroke="#e6f2e4" stroke-width="3" stroke-linejoin="round"/><g class="a-fall">' + [140, 160, 180].map((x, i) => '<line x1="' + x + '" y1="0" x2="' + (x - 3) + '" y2="10" style="animation-delay:' + (i * 0.35) + 's"/>').join('') + '</g><path class="a-leaf" d="M236 64 q30 -30 56 0 q-28 22 -56 0" fill="#9fd67a"/><path d="M208 70 Q222 66 236 64" stroke="#7cc6e8" stroke-width="3" fill="none" class="a-sip"/><text x="20" y="18">rain fills it</text><text x="240" y="100">crop drinks</text><text x="20" y="118">soil = bucket</text></svg>',
    shuffle: '<svg viewBox="0 0 320 130" class="xanim">' + Array.from({ length: 10 }, (_, i) => '<rect class="a-card a-c' + (i % 5) + '" x="' + (17 + i * 29) + '" y="40" width="24" height="34" rx="4" style="animation-delay:' + (i * 0.12) + 's"/>').join('') + '<text x="160" y="112" text-anchor="middle">25 real years, redrawn 300 times</text></svg>',
    roots: '<svg viewBox="0 0 320 150" class="xanim"><rect x="0" y="72" width="320" height="78" fill="#6b5233"/>' + [60, 160, 260].map((x, i) => '<path d="M' + x + ' 72 q5 -26 0 -40 q-5 14 0 40" fill="#9fd67a"/><path class="a-root" d="M' + x + ' 72 q-10 26 -4 70 M' + x + ' 72 q12 22 6 62" stroke="#ead9b2" stroke-width="2" fill="none" style="animation-delay:' + (i * 0.3) + 's"/>').join('') + '<text x="160" y="18" text-anchor="middle">roots hold soil and feed soil life</text></svg>',
    score: '<svg viewBox="0 0 320 130" class="xanim">' + [0, 1, 2, 3, 4].map(i => '<rect x="20" y="' + (10 + i * 23) + '" width="280" height="11" rx="5.5" fill="rgba(220,245,225,.12)"/><rect class="a-bar" x="20" y="' + (10 + i * 23) + '" width="' + [180, 240, 150, 210, 120][i] + '" height="11" rx="5.5" fill="#9fd67a" style="animation-delay:' + (i * 0.15) + 's"/>').join('') + '</svg>'
  };
  const TERMS = {
    bare: ['Bare soil days', 'rain', ['Days in a year when nothing is growing on the field and little straw covers it.', 'Bare soil loses water to evaporation and is washed or blown away in storms. One heavy storm on bare ground can remove topsoil that took decades to form.', 'Cover crops, keeping straw on the surface and less ploughing all cut these days.']],
    heavy: ['Heavy rain on open soil', 'rain', ['Rain on days with 12.7 mm or more, counted only when the soil was poorly covered.', 'These are the storms that move soil. On covered ground the leaves and straw take the hit and the water soaks in; on bare ground it runs off and takes soil with it.', 'Lower is better.']],
    water: ['Water crops missed', 'bucket', ['How much of the water the crop needed it could not get from rain and the soil.', 'We track the soil like a bucket every day for 25 years: rain fills it, the crop drinks from it, extra drains away. When the bucket runs low, the crop goes short.', '10% means that over the season the crop got 90% of what it wanted.']],
    roots: ['Living roots', 'roots', ['Days a year when something is growing in the field.', 'Living roots hold soil together, feed the microbes that build organic matter and take up nutrients that would otherwise wash out.', 'Higher is better.']],
    boot: ['How sure we are (reshuffles)', 'shuffle', ['25 years is a short record, and one or two strange years could decide the result by luck.', 'So we build 300 new versions of the record by picking years at random from the real ones: some years appear twice, some not at all. Both rotations are scored again on each version.', 'If an option still beats yours in, say, 290 of 300, the result does not depend on a few lucky years. Around 150 of 300 means it is a toss-up.']],
    s_income: ['Profit after costs', 'score', ['An estimate of what is left after growing costs, compared between options.', 'It uses how much each crop typically costs to grow and how many buyers it has, and drops when the crop runs short of water. It does not use your local prices.']],
    s_water: ['Saving water', 'bucket', ['How well the rotation copes with the rain your field gets, from 0 to 100.', '100 means the crops never ran short of water in 25 years.']],
    s_soil: ['Building soil health', 'roots', ['A score from 0 to 100 built from living-root days, nitrogen from legumes, straw left on the field, number of crop families, deep roots and few bare days.', 'Soil that scores high tends to gain organic matter, hold more water and need less fertiliser over time.']],
    s_erosion: ['Keeping soil in place', 'rain', ['How much of the heavy rain falls on covered ground rather than bare soil, adjusted for slope and tillage.', '100 means no heavy rain ever hits bare soil.']],
    s_resilience: ['Steady harvest in bad years', 'score', ['How the rotation does in the hottest, driest years of the 25, not just on average.', 'A high score means fewer failed seasons.']]
  };
  const KB = [
    [['bare', 'голая', 'гола', 'empty', 'fallow'], 'What does bare soil mean?', 'Bare soil is any day when no crop or cover crop is growing and little straw is left on top. Bare ground dries out faster and loses topsoil in storms. Cover crops, leaving straw on the surface and ploughing less all cut bare days.'],
    [['cover', 'покров', 'rye', 'рож', 'vetch', 'clover', 'mix', 'смес'], 'What is a cover crop and is it worth it?', 'A cover crop is sown between cash crops to protect and feed the soil, not to sell. Rye survives winter and holds soil; legume mixes (vetch, clover, peas) also add nitrogen for the next crop. Costs are seed and one extra pass to sow it. It pays back mainly through less erosion, more organic matter and lower nitrogen needs over several years, less so in the first season.'],
    [['no-till', 'notill', 'no till', 'плуг', 'вспаш', 'tillage', 'оранк', 'обработ'], 'What is no-till?', 'No-till means sowing directly into last year’s stubble without ploughing. Straw stays on top, so heavy rain does less damage and less water evaporates. It needs a no-till drill and usually more attention to weeds in the first years.'],
    [['legume', 'бобов', 'nitrogen', 'азот', 'pea', 'горох', 'soy', 'соя', 'alfalfa', 'люцерн'], 'Why add legumes?', 'Legumes such as peas, soybean and alfalfa host bacteria in their roots that take nitrogen from the air. Part of it stays in the soil for the next crop, so you can buy less fertiliser. They also break the disease and pest cycles of cereals and sunflower.'],
    [['reshuffl', 'bootstrap', 'sure', 'уверен', 'надежн', '300', 'luck', 'случайн'], 'How sure are these results?', 'We rebuild the 25-year weather record 300 times by drawing years at random and score every option again each time. If an option beats yours in nearly all 300, the advice does not depend on a few unusual years. Around half means the two are effectively tied.'],
    [['score', 'балл', 'оценк', '100', 'points', 'очк'], 'What do the scores mean?', 'Each score runs from 0 to 100 and compares options on the same field and weather. Your overall score averages the five, weighted by the priorities you set. A difference of a few points is not meaningful; 10 points or more is a real difference.'],
    [['profit', 'прибыл', 'income', 'доход', 'money', 'деньг', 'price', 'цен', 'sell', 'прода'], 'Does it know prices?', 'No. Profit is estimated from how much each crop typically costs to grow and how many buyers it has, reduced when the crop runs short of water. It ranks options against each other; it does not predict income. Check local prices before deciding.'],
    [['water', 'вод', 'drought', 'засух', 'missed', 'дефицит', 'rain', 'дожд', 'осадк'], 'How is water shortage worked out?', 'Every day for 25 years we track the soil like a bucket: rain fills it, the crop drinks from it, extra drains away. When the bucket runs low the crop goes short. The percentage is how much of the water the crop wanted that it did not get.'],
    [['heavy', 'ливн', 'storm', 'erosion', 'эрози', 'washed', 'смыв'], 'Why does heavy rain matter?', 'Days with 12.7 mm of rain or more are the ones that move soil. If they land on covered ground, leaves and straw absorb the impact and water soaks in. On bare ground water runs off and carries topsoil with it.'],
    [['root', 'корн', 'living', 'живы'], 'Why do living roots matter?', 'Roots hold soil together, feed the microbes that build organic matter and take up nutrients that would otherwise wash out. More days with living roots usually means healthier soil.'],
    [['nasa', 'power', 'weather', 'погод', 'data', 'данн', 'satellite', 'спутник'], 'Where does the data come from?', 'Weather is NASA POWER daily data for 2001 to 2025, built from satellites and weather models on a grid about 50 km wide. Field greenness is from NASA’s MODIS satellite at 250 m. Soil texture is from SoilGrids and slope from elevation data.'],
    [['ndvi', 'green', 'зелен'], 'What is NDVI?', 'NDVI is a greenness index satellites measure from red and near-infrared light. Dense healthy crops score high, bare soil scores low. We use it to check whether our crop calendar matches what the field actually looked like.'],
    [['slope', 'уклон', 'hill', 'склон'], 'How does slope change things?', 'Water runs off slopes faster and carries soil with it. The model increases erosion risk with slope; above about 6% keeping the soil covered matters much more.'],
    [['soil', 'почв', 'clay', 'глин', 'sand', 'песо', 'loam', 'суглин'], 'Why does soil type matter?', 'Texture sets how much water the root zone can store. Sandy soil drains fast and dries out early in a drought; clay holds a lot but waterlogs and compacts. If unsure, use the SoilGrids suggestion in the settings.'],
    [['experiment', 'new', 'нов', 'тест', 'double', 'два урож', 'relay'], 'Should I try the newer strategies?', 'Newer practices like two crops a year or sowing a legume into standing wheat can work, but there is less evidence and few farms nearby may have tried them. Test on one field or strip first and ask a local adviser.'],
    [['climate', 'климат', 'future', 'будущ', 'warm', 'тепл'], 'What about future climate?', 'We do not forecast weather. We replay the past 25 years warmer and drier, including the change seven climate models expect for 2036 to 2050, and check whether the same option still wins. See More tools, Future climate.'],
    [['bad year', 'плох', 'hot', 'жар', 'k-means', 'cluster'], 'What are bad years?', 'We group the 25 seasons into kinds of year by warm-season rain, evaporation and hot days, then show how each option did in each group. The hot, dry group shows which rotation fails least when it matters.'],
    [['trust', 'довер', 'accurate', 'точн', 'agronom', 'агроном', 'check', 'провер'], 'Can I trust this?', 'Treat it as a well-informed second opinion. Formulas follow FAO standards and crop dates match USDA records, but no agronomist has reviewed it and local prices, pests and varieties are not included. Discuss any change with a local adviser and try it on part of a field first.'],
    [['what should', 'что делать', 'next', 'дальше', 'start', 'начать'], 'What should I do next?', 'Open the best option in Options, read “Check locally before acting”, and talk it through with an adviser or neighbour who has tried it. If it still looks good, try it on one field for a season and compare.']
  ];
  function answer(q) {
    const t = q.toLowerCase(); let best = null, bs = 0;
    KB.forEach(e => { const sc = e[0].reduce((s, k) => s + (t.indexOf(k) >= 0 ? k.length : 0), 0); if (sc > bs) { bs = sc; best = e; } });
    return best ? best : null;
  }
  const SUGG = { bare: [1, 0, 2], heavy: [8, 1, 12], water: [7, 13, 0], roots: [9, 1, 3], boot: [4, 5, 17], s_income: [6, 5, 17], s_water: [7, 13, 15], s_soil: [3, 1, 2], s_erosion: [8, 12, 2], s_resilience: [16, 15, 4] };
  function askBox(k) {
    const sg = (SUGG[k] || [5, 17, 18]).map(i => KB[i]);
    return '<div class="ask"><h3>Ask a question</h3><div class="sugg">' + sg.map(e => '<button type="button" data-ask="' + esc(e[1]) + '">' + esc(e[1]) + '</button>').join('') + '</div><form id="askf"><input id="askq" placeholder="Type your question, any language" autocomplete="off"><button class="btn">Ask</button></form><div id="asko"></div></div>';
  }
  function showAnswer(q) {
    const e = answer(q), o = $('asko'); if (!o) return;
    o.innerHTML = '<div class="ans"><div class="q2">' + esc(q) + '</div>' + (e ? esc(e[2]) : 'There is no answer to that in Furrow’s guide yet. The How it works tab explains every number, and a local agronomist or extension adviser can answer questions about your farm.') + '<span class="src">Answer from Furrow’s built-in guide</span></div>'; o.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function explainTerm(k) {
    const t = TERMS[k]; if (!t) return;
    $('mbox').innerHTML = '<div class="mhead"><h2>' + t[0] + '</h2><button class="btn ghost xbtn" data-close aria-label="Close">×</button></div><div class="tgrid"><div><div class="animbox">' + ANIM[t[1]] + '</div>' + t[2].map((p, i) => '<p class="step" style="animation-delay:' + (0.25 + i * 0.35) + 's">' + p + '</p>').join('') + '</div><div>' + askBox(k) + '<button class="btn bigbtn" data-close>Got it</button></div></div>';
    $('modal').classList.add('on', 'term');
    $('askf').onsubmit = ev => { ev.preventDefault(); const q = $('askq').value.trim(); if (q) showAnswer(q); };
    $('mbox').querySelectorAll('[data-ask]').forEach(b => b.onclick = () => showAnswer(b.dataset.ask));
  }
  function soilTxt() { if ($('soiltxt')) $('soiltxt').textContent = SOILTXT[S.soil] || ''; }
  function showUnd() {
    const r = window.Lab ? Lab.parseConstraints(S.text) : [];
    $('und').innerHTML = r.length ? '<b>Applied:</b><ul>' + r.map(x => '<li><b>' + esc(x.tag) + '.</b> ' + esc(x.why) + '</li>').join('') + '</ul>' : (S.text.trim() ? '<span class="muted">Nothing recognised yet. The text is kept with your choices.</span>' : '');
  }
  function drawAcc() {
    if (!LAST || !window.Lab) { $('acc').innerHTML = '<p class="muted">Loading options…</p>'; return; }
    const top = LAST.alts.concat(LAST.others).slice(0, 6), keys = Object.keys(Lab.ACCEPT).filter(k => top.some(t => t.need && k in t.need));
    if ($('acc').dataset.keys === keys.join()) return;
    $('acc').dataset.keys = keys.join();
    $('acc').innerHTML = keys.length ? keys.map(k => { const A = Lab.ACCEPT[k], v = S.acc[k] == null ? 3 : S.acc[k], who = top.filter(t => t.need && k in t.need).map(t => t.name).slice(0, 1).join(''); return '<div class="wrow"><div class="wh"><label for="a_' + k + '">' + A.q + '</label><span class="lvl" id="av_' + k + '">' + v + ' of 5</span></div><input id="a_' + k + '" type="range" min="0" max="5" step="1" value="' + v + '"><div class="ends"><span>0 ' + A.lo.toLowerCase() + '</span><span>5 ' + A.hi.toLowerCase() + '</span></div><div class="ends"><span class="clip" title="' + esc(who) + '">For: ' + esc(who) + '</span></div></div>'; }).join('') : '<p class="muted">The best options don’t need anything new from you.</p>';
    keys.forEach(k => { $('a_' + k).oninput = e => { S.acc[k] = +e.target.value; $('av_' + k).textContent = e.target.value + ' of 5'; clearTimeout(drawAcc.t); drawAcc.t = setTimeout(recompute, 300); }; });
  }
  function askExp(done) {
    $('mbox').innerHTML = '<h2>Include experimental strategies?</h2><p>Some practices are still in trials, disputed in the literature, or untested in your region, for example two crops in one year or a legume sown into standing wheat. Evidence is weaker; they are marked separately.</p><div class="mrow"><button class="btn bigbtn" id="expy">Include them</button><button class="btn ghost bigbtn" id="expn">Established only</button></div>';
    $('modal').classList.add('on');
    $('expy').onclick = () => { S.exp = true; $('modal').classList.remove('on'); recompute(); done(); };
    $('expn').onclick = () => { S.exp = false; $('modal').classList.remove('on'); recompute(); done(); };
    $('expy').focus();
  }
  function wizard(i) {
    if (WIZ[i][0] === 'acc') { $('acc').dataset.keys = ''; drawAcc(); }
    S.wiz = i; document.body.classList.add('wiz'); document.body.classList.remove('noset'); document.body.classList.toggle('wacc', WIZ[i][0] === 'acc'); document.body.classList.toggle('wpri', WIZ[i][0] === 'pri'); document.body.classList.toggle('wfree', WIZ[i][0] === 'free');
    document.querySelectorAll('[data-wiz]').forEach(b => { const on = b.dataset.wiz === WIZ[i][0]; b.classList.toggle('cur', on); if (on) b.open = true; });
    $('wizn').textContent = 'Step ' + (i + 1) + ' of ' + WIZ.length; $('wizplace').textContent = S.name;
    $('wizt').textContent = WIZ[i][1]; $('wizd').textContent = WIZ[i][2]; $('wizbar').style.width = (i + 1) / WIZ.length * 100 + '%';
    $('wizback').style.visibility = i ? 'visible' : 'hidden'; $('wiznext').textContent = i === WIZ.length - 1 ? 'Show me the results' : 'Next';
    $('setup').scrollTop = 0;
  }
  function wizEnd() {
    S.wiz = null; document.body.classList.remove('wiz'); document.body.classList.add('noset'); save();
    document.querySelectorAll('[data-wiz]').forEach(b => { b.classList.remove('cur'); b.open = b.dataset.wiz === 'rot'; }); document.querySelectorAll('.setup details.box:not([data-wiz])').forEach(b => b.open = false); document.body.classList.remove('wacc', 'wpri', 'wfree');
    setTab('result'); if (map) goStep(0, true); moveInk();
  }
  let introPick = null;
  function intro() {
    const el = $('intro'), off = () => { document.body.classList.remove('intro'); S.intro = false; introPick = null; };
    if (!el) { off(); return; }
    const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    S.intro = true; let phase = 1, tick, y = 2001, pins = [];
    const fmt = c => Math.abs(c.lat).toFixed(2) + '°' + (c.lat < 0 ? 'S' : 'N') + ' ' + Math.abs(c.lng).toFixed(2) + '°' + (c.lng < 0 ? 'W' : 'E');
    if (map) {
      map.setView([DEMOS[0].lat, DEMOS[0].lon], calm ? 9.5 : 5.5, { animate: false });
      const ll = $('introll'), upd = () => { ll.textContent = fmt(map.getCenter()); }; upd(); map.on('move', upd);
    }
    const bar = $('introbar'), yr = $('introyr'), big = $('introbig');
    if (!calm) setTimeout(() => {
      bar.style.transition = 'transform 2.6s linear'; bar.style.transform = 'scaleX(1)';
      tick = setInterval(() => { yr.textContent = y; big.textContent = y; if (++y > 2025) clearInterval(tick); }, 104);
      if (map && phase === 1) map.flyTo([DEMOS[0].lat, DEMOS[0].lon], 9.5, { duration: 3.4, easeLinearity: 0.1 });
    }, 600);
    $('introchips').innerHTML = DEMOS.map(d => '<button class="chip" data-demo="' + d.id + '">' + d.short + '</button>').join('');
    const end = () => {
      el.classList.add('dark');
      setTimeout(() => {
        off(); wizard(0);
        if (map) { map.stop(); pins.forEach(m => map.removeLayer(m)); goStep(0, true); }
        moveInk(); el.classList.add('out'); setTimeout(() => el.remove(), 900);
      }, 540);
    };
    const pick = (lat, lon, demo) => {
      if (phase === 3) return; phase = 3; clearInterval(tick); el.classList.add('choose', 'go');
      setPlace(lat, lon, demo);
      const far = map && map.distance(map.getCenter(), [S.lat, S.lon]) > 60000;
      if (map) { map.stop(); if (calm) map.setView([S.lat, S.lon], 12, { animate: false }); else map.flyTo([S.lat, S.lon], 12, { duration: far ? 3 : 1.5, easeLinearity: 0.15 }); }
      setTimeout(end, map && !calm ? (far ? 2750 : 1300) : 150);
    };
    const choose = () => {
      if (phase !== 1) return; phase = 2; el.classList.add('choose'); introPick = pick;
      if (map) DEMOS.forEach(d => { const m = window.L.marker([d.lat, d.lon], { icon: window.L.divIcon({ className: 'cpin', html: '<i></i><span class="' + d.lab + '">' + d.short + '</span>', iconSize: [0, 0] }) }).addTo(map); m.on('click', () => pick(d.lat, d.lon, d)); pins.push(m); });
    };
    $('introchips').addEventListener('click', e => { const b = e.target.closest('[data-demo]'); if (b) { e.stopPropagation(); const d = DEMOS.find(x => x.id === b.dataset.demo); pick(d.lat, d.lon, d); } });
    $('introgo').onclick = e => { e.stopPropagation(); if (map) { const c = map.getCenter(); const d = DEMOS.find(x => Math.abs(x.lat - c.lat) < 0.02 && Math.abs(x.lon - c.lng) < 0.02); pick(c.lat, c.lng, d || null); } else pick(DEMOS[0].lat, DEMOS[0].lon, DEMOS[0]); };
    if (calm) choose(); else setTimeout(choose, 4200);
    el.addEventListener('click', e => { if (phase === 1) choose(); });
  }
  let map, marker, cell, overlay, co = [], step = 0, playing = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const GIBS = { ndvi: ['MODIS_Terra_NDVI_8Day', 'GoogleMapsCompatible_Level9', 'png', 9], smap: ['SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', 'GoogleMapsCompatible_Level6', 'png', 6], imerg: ['IMERG_Precipitation_Rate', 'GoogleMapsCompatible_Level6', 'png', 6] };
  const STEPS = ['', 'ndvi', 'smap', 'imerg'];
  function setLayer() {
    if (!map) return; const old = overlay; overlay = null;
    if (old) { old.setOpacity(0); setTimeout(() => map.removeLayer(old), 950); }
    const g = GIBS[$('layer').value]; if (!g) return;
    const lyr = window.L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + g[0] + '/default/' + $('ldate').value + '/' + g[1] + '/{z}/{y}/{x}.' + g[2], { maxNativeZoom: g[3], maxZoom: 17, opacity: 0, className: 'ovl', attribution: 'NASA GIBS' }).addTo(map);
    overlay = lyr; setTimeout(() => { if (overlay === lyr) lyr.setOpacity(0.72); }, 60);
  }
  function cellBounds() { const cy = Math.round(S.lat / 0.5) * 0.5, cx = Math.round(S.lon / 0.625) * 0.625; return [[cy - 0.25, cx - 0.3125], [cy + 0.25, cx + 0.3125]]; }
  function callout(html) { co.push(window.L.marker([S.lat, S.lon], { interactive: false, keyboard: false, icon: window.L.divIcon({ className: 'co', html: '<i></i><div>' + html + '</div>', iconSize: [0, 0] }) }).addTo(map)); }

  function story() {
    if (!map || S.intro) return; co.forEach(m => map.removeLayer(m)); co = [];
    const A = LAST; if (!A) return; const cl = A.cl, k = $('layer').value, d = $('ldate').value, cur = A.current;
    const ind = key => cl.indicators.find(i => i.key === key).mean;
    if (k === '') callout('<b>' + esc(S.name) + '</b>' + esc(E.rotLabel(cur.rot)) + '<br>Soil sits bare ' + r0(cur.m.bare) + ' days a year, ' + bareMonths(cur, cl));
    else if (k === 'ndvi') callout('<b>Crop greenness, ' + d + '</b>Greener means denser plants.<br>Living roots here ' + r0(cur.m.living) + ' days a year' + (A.alts[0] ? ', ' + r0(A.alts[0].m.living) + ' with the top alternative' : ''));
    else if (k === 'smap') { const dry = cl.gwAnom ? cl.gwAnom.map((r, i) => [E.mean(r), cl.years[i].label]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => x[1]).join(', ') : ''; callout('<b>Soil moisture, ' + d + '</b>Crops here ran short of ' + pc(cur.m.relMean) + ' of the water they wanted' + (dry ? '<br>Driest years: ' + dry : '')); }
    else callout('<b>Rainfall, ' + d + '</b>' + r0(ind('rain')) + ' mm a year here, ' + ind('heavy').toFixed(1) + ' heavy-rain days<br>' + pc(cur.m.bareErosShare) + ' of the heavy rain lands on bare soil');
  }

  function goStep(i, quick) {
    if (!map || S.intro) return; step = (i + STEPS.length) % STEPS.length; const k = STEPS[step];
    if ($('layer').value !== k) { $('layer').value = k; setLayer(); }
    map.invalidateSize();
    const cb = cellBounds(), b = k === '' ? [[S.lat - 0.035, S.lon - 0.05], [S.lat + 0.035, S.lon + 0.05]] : k === 'ndvi' ? cb : [[cb[0][0] - 1.5, cb[0][1] - 2], [cb[1][0] + 1.5, cb[1][1] + 2]];
    const wide = window.innerWidth > 900, wz = S.wiz != null, o = wz ? { paddingTopLeft: [16, 40], paddingBottomRight: [wide ? Math.round(window.innerWidth * 0.07) + 490 : 16, wide ? 40 : Math.round(window.innerHeight * 0.62)], maxZoom: 13 } : { paddingTopLeft: [wide ? 376 : 16, wide ? 190 : 118], paddingBottomRight: [wide ? document.querySelector('.res').offsetWidth + 36 : 16, wide ? 110 : 60], maxZoom: 13 };
    if (quick) map.fitBounds(b, o); else map.flyToBounds(b, Object.assign({ duration: 1.8 }, o));
    story();
  }
  let zones = [];
  function drawZones() {
    if (!map) return; zones.forEach(z => map.removeLayer(z)); zones = []; const T = S.terrain; if (!T) return;
    const dl = T.step / 111320, dn = T.step / (111320 * Math.cos(S.lat * Math.PI / 180));
    T.slopes.forEach((v, i) => { const r = Math.floor(i / T.n), c = i % T.n, la = S.lat + (2 - r) * dl, lo = S.lon + (c - 2) * dn; const z = window.L.rectangle([[la - dl / 2, lo - dn / 2], [la + dl / 2, lo + dn / 2]], { stroke: true, color: T.low[i] ? '#7CC6E8' : 'rgba(255,255,255,.85)', weight: T.low[i] ? 3 : 1.2, fillColor: v > 6 ? '#F2907E' : v >= 2 ? '#F2A541' : '#5FBF73', fillOpacity: 0.42, interactive: true }).addTo(map); z.bindTooltip(v.toFixed(1) + '% slope' + (T.low[i] ? ', low spot' : ''), { direction: 'top' }); zones.push(z); });
  }
  function setPlaying(on) { playing = on; $('play').textContent = on ? 'Pause tour' : 'Play tour'; $('play').setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function setPlace(lat, lon, demo, keep) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180; lat = Math.max(-60, Math.min(70, lat));
    S.lat = Math.round(lat * 100) / 100; S.lon = Math.round(lon * 100) / 100; S.demo = demo ? demo.id : null;
    S.name = demo ? demo.name : 'Your field';
    if (demo && !keep) { S.rot = demo.rot.map(r => ({ c: r.c, cv: r.cv || null })); S.soil = demo.soil; setSlope(demo.slope); S.till = demo.till; $('soil').value = S.soil; $('till').value = S.till; renderRot(); }
    $('lat').value = S.lat; $('lon').value = S.lon; $('demo').value = S.demo || '';
    S.terrain = null; S.soilSug = null; S.ndvi = null; S.touched = {}; $('sugsoil').innerHTML = ''; $('sugslope').innerHTML = ''; drawZones();
    if (map) { marker.setLatLng([S.lat, S.lon]); cell.setBounds(cellBounds()); goStep(0, true); }
    load();
  }
  function init() {
    const fill = (id, obj) => { $(id).innerHTML = Object.keys(obj).map(k => '<option value="' + k + '">' + obj[k].name + '</option>').join(''); };
    fill('soil', E.SOILS); fill('till', E.TILLAGE); setSlope(S.slopePct);
    $('demo').innerHTML = DEMOS.map(d => '<option value="' + d.id + '">' + d.name + '</option>').join('') + '<option value="">Your own point</option>';
    $('demo').onchange = e => { const d = DEMOS.find(x => x.id === e.target.value); if (d) setPlace(d.lat, d.lon, d); };
    $('tabs').innerHTML = TABS.map(t => '<button data-tab-btn="' + t[0] + '">' + t[1] + '</button>').join('') + '<span class="ink"></span>';
    $('tabs').querySelectorAll('button').forEach(b => { if (EV.indexOf(b.dataset.tabBtn) >= 0) b.className = 'ev'; });
    $('dock').innerHTML = [['field', 'Field'], ['result', 'Result'], ['options', 'Options'], ['evidence', 'Evidence']].map(t => '<button data-tab-btn="' + t[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[t[0]] + '</svg>' + t[1] + '</button>').join('') + '<span class="ink"></span>';
    document.querySelectorAll('[data-tab-btn]').forEach(b => b.onclick = () => b.dataset.tabBtn === 'tools' ? window.goTools() : setTab(b.dataset.tabBtn));
    const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);
    document.addEventListener('click', e => {
      let el = e.target.closest ? e.target.closest('[data-tip]') : null, text = el ? el.getAttribute('data-tip') : '';
      if (!text && e.target.namespaceURI === 'http://www.w3.org/2000/svg') { const t = e.target.querySelector && e.target.querySelector(':scope > title'); if (t) text = t.textContent; }
      if (!text) { tip.classList.remove('on'); return; }
      tip.textContent = text; tip.classList.add('on');
      const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - w / 2)) + 'px'; tip.style.top = (e.clientY - h - 14 < 8 ? e.clientY + 18 : e.clientY - h - 14) + 'px';
    });
    window.addEventListener('scroll', () => tip.classList.remove('on'), true);
    $('out').addEventListener('click', e => {
      const o = e.target.closest('[data-sel]'); if (o) { S.sel = +o.dataset.sel; S.animOpt = true; S.keepAnim = $('scroll').classList.contains('anim'); render(); return; }
      const g = e.target.closest('[data-go]'); if (g) { setTab(g.dataset.go); return; }
      const act = e.target.closest('[data-act]'); if (!act) return;
      if (act.dataset.act === 'print') { window.print(); return; }
      const link = shareLink(), box = $('shared'), done = () => { box.textContent = 'Link copied. Anyone who opens it sees this exact result.'; }, manual = () => { box.innerHTML = 'Copy this: <input readonly value="' + esc(link) + '" style="width:220px">'; const i = box.querySelector('input'); i.focus(); i.select(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, manual); else manual();
    });
    const wrow = (pre, d, v) => '<div class="wrow"><div class="wh"><label for="' + pre + d[0] + '">' + d[1] + '</label><span class="lvl" id="' + pre + 'v' + d[0] + '">' + LEVEL[v] + '</span></div><input id="' + pre + d[0] + '" type="range" min="0" max="5" step="1" value="' + v + '"><button class="why" data-x="' + pre + d[0] + '">What does this mean?</button><div class="explain" id="x_' + pre + d[0] + '"><p>' + DIMTIP[d[0]] + '</p></div></div>';
    $('weights').innerHTML = DIMS.map(d => wrow('w_', d, S.weights[d[0]])).join('');
    $('weights2').innerHTML = DIMS.map(d => wrow('w2_', d, S.w2[d[0]])).join('');
    DIMS.forEach(d => {
      $('w_' + d[0]).oninput = e => { S.weights[d[0]] = +e.target.value; $('w_v' + d[0]).textContent = LEVEL[+e.target.value]; recompute(); };
      $('w2_' + d[0]).oninput = e => { S.w2[d[0]] = +e.target.value; $('w2_v' + d[0]).textContent = LEVEL[+e.target.value]; recompute(); };
    });
    $('later').onchange = e => { S.later = e.target.checked; $('laterbox').hidden = !S.later; recompute(); };
    $('years').oninput = e => { S.years = +e.target.value; $('yearsv').textContent = S.years + ' yrs'; recompute(); };
    const LIM = ['Diesel is short or expensive', 'No money for new machinery', 'No no-till drill', 'Not enough workers or time', 'Little grain storage', 'No buyer nearby for new crops', 'Export prices or tariffs are unstable', 'Someone has a pollen allergy', 'The land is rented', 'We keep livestock', 'No irrigation, water is the worry', 'We farm organically'];
    $('limchips').innerHTML = LIM.map(l => '<button class="chip" aria-pressed="false">' + l + '</button>').join('');
    const syncChips = () => document.querySelectorAll('#limchips .chip').forEach(b => b.setAttribute('aria-pressed', String(S.text.toLowerCase().indexOf(b.textContent.toLowerCase()) >= 0)));
    document.querySelectorAll('#limchips .chip').forEach(b => b.onclick = () => {
      const l = b.textContent, on = S.text.toLowerCase().indexOf(l.toLowerCase()) >= 0;
      S.text = on ? S.text.split(/\n|; /).filter(x => x.trim() && x.trim().toLowerCase() !== l.toLowerCase()).join('; ') : (S.text.trim() ? S.text.trim() + '; ' : '') + l;
      $('free').value = S.text; syncChips(); showUnd(); clearTimeout(ft); ft = setTimeout(recompute, 400);
    });
    window.syncChips = syncChips;
    let ft = null;
    $('free').oninput = e => { S.text = e.target.value; syncChips(); showUnd(); clearTimeout(ft); ft = setTimeout(recompute, 600); };
    document.addEventListener('click', e => { const b = e.target.closest('.why'); if (b) { const x = $('x_' + b.dataset.x); if (x) x.classList.toggle('on'); } });
    document.querySelectorAll('.setup details.box').forEach(d => d.addEventListener('toggle', () => { if (d.open && S.wiz == null) document.querySelectorAll('.setup details.box').forEach(o => { if (o !== d) o.open = false; }); }));
    $('handle').onclick = () => { const off = document.body.classList.toggle('noset'); $('handle').setAttribute('aria-expanded', String(!off)); $('handle').setAttribute('aria-label', off ? 'Show settings' : 'Hide settings'); if (map) setTimeout(() => map.invalidateSize(), 350); };
    window.goTools = () => {
      const t = { field: S.demo || 'custom', lat: S.lat, lon: S.lon, rot: S.rot.map(r => r.c), soil: S.soil, till: S.till, slope: S.slopePct, w: S.weights, later: S.later, w2: S.w2, years: S.years, acc: S.acc, text: S.text, exp: S.exp };
      try { localStorage.setItem('furrowlab:setup', JSON.stringify(t)); } catch (e) {}
      location.href = 'tools/';
    };
    const ex = Object.keys(C).filter(k => k !== 'fallow').map(k => [k, C[k].short]).concat(Object.keys(CV).map(k => [k, CV[k].short]));
    $('excl').innerHTML = ex.map(x => '<button class="chip" data-id="' + x[0] + '" aria-pressed="false">' + x[1] + '</button>').join('');
    document.querySelectorAll('#excl .chip').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) S.exclude.add(b.dataset.id); else S.exclude.delete(b.dataset.id); recompute(); });
    $('slopep').oninput = e => { setSlope(e.target.value); S.touched.slope = true; recompute(); suggest(); };
    ['soil', 'till'].forEach(id => { $(id).onchange = e => { S[id] = e.target.value; S.touched[id] = true; suggest(); recompute(); }; });
    $('setup').addEventListener('click', e => { if (!e.target.closest('#sugsoil, #sugslope')) return; const b = e.target.closest('[data-use]'); if (!b) return; if (b.dataset.use === 'soil') { S.soil = S.soilSug.cls; $('soil').value = S.soil; } else { setSlope(Math.round(S.terrain.typical * 2) / 2); } S.touched[b.dataset.use] = true; suggest(); recompute(); });
    $('croptab').innerHTML = '<table><thead><tr><th>Crop</th><th>Family</th><th>Peak water use (Kc)</th><th>Heat limit</th><th>Warmth to mature</th><th>Nitrogen credit</th><th>Residue</th><th>Drought tolerance</th></tr></thead><tbody>' + Object.keys(C).filter(k => k !== 'fallow').map(k => { const c = C[k]; return '<tr><td>' + c.name + '</td><td>' + c.fam + '</td><td class="num">' + c.kc[1] + '</td><td class="num">' + (c.heatT ? c.heatT + ' °C' : '') + '</td><td class="num">' + (c.gdd ? c.gdd + ' °C days' + (c.base !== undefined ? ' above ' + c.base + ' °C' : ' above 0 °C from 1 Jan') : '') + '</td><td class="num">' + c.nfix + ' kg N/ha</td><td class="num">' + c.res + ' of 5</td><td class="num">' + c.dt + ' of 5</td></tr>'; }).join('') + '</tbody></table>';
    const stockUI = () => { $('stockbox').hidden = !S.stockOn; $('stockmsg').innerHTML = herd(); };
    const mUI = () => { const m = margin(); $('mout').innerHTML = 'Margin about <b>€' + r0(m).toLocaleString('en') + ' per ha</b>' + (S.area ? ', <b>€' + r0(m * S.area).toLocaleString('en') + '</b> a year on ' + S.area + ' ha. A ' + S.maxDrop + '% drop is about €' + r0(m * S.area * S.maxDrop / 100).toLocaleString('en') + ' a year.' : '.') + ' Rough defaults are for wheat; enter your own.'; $('maxdropv').textContent = S.maxDrop + '% a year' + (m && S.area ? ' (≈ €' + r0(m * S.area * S.maxDrop / 100).toLocaleString('en') + ')' : ''); };
    window.syncExtra = () => { $('area').value = S.area; $('stock').checked = S.stockOn; $('stype').value = S.stockType; $('sn').value = S.stockN; $('maxdrop').value = S.maxDrop; $('my').value = S.mY; $('mp').value = S.mP; $('mc').value = S.mC; stockUI(); mUI(); };
    let xt = null; const later = () => { clearTimeout(xt); xt = setTimeout(recompute, 400); };
    $('area').oninput = e => { S.area = Math.max(0, +e.target.value || 0); stockUI(); mUI(); later(); };
    $('stype').onchange = e => { S.stockType = e.target.value; stockUI(); later(); };
    $('sn').oninput = e => { S.stockN = Math.max(0, +e.target.value || 0); stockUI(); later(); };
    $('maxdrop').oninput = e => { S.maxDrop = +e.target.value; mUI(); later(); };
    ['my', 'mp', 'mc'].forEach(id => $(id).oninput = e => { S[{ my: 'mY', mp: 'mP', mc: 'mC' }[id]] = +e.target.value || 0; mUI(); later(); });
    window.syncExtra();
    $('irrig').onchange = e => { S.irrigated = e.target.checked; recompute(); };
    $('stock').onchange = e => { S.stockOn = e.target.checked; stockUI(); recompute(); };
    $('srain').oninput = e => { S.scen.rain = +e.target.value; $('srainv').textContent = (S.scen.rain > 0 ? '+' : '') + S.scen.rain + '%'; recompute(); };
    $('stemp').oninput = e => { S.scen.temp = +e.target.value; $('stempv').textContent = '+' + S.scen.temp + '°'; recompute(); };
    $('addyr').onclick = () => { if (S.rot.length < 6) { S.rot.push({ c: 'soy', cv: null }); renderRot(); recompute(); } };
    $('load').onclick = () => { const la = parseFloat($('lat').value), lo = parseFloat($('lon').value); if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 70 && Math.abs(lo) <= 180) { setPlace(la, lo, null); setTab('result'); } else status('err', 'Enter a latitude between -60 and 70 and a longitude between -180 and 180.'); };
    $('out').addEventListener('click', e => { if (e.target.id === 'showrank') openRank(); });
    document.addEventListener('click', e => { const q = e.target.closest('[data-term]'); if (q) { e.stopPropagation(); explainTerm(q.dataset.term); } }, true);
    $('modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); const o = e.target.closest('#mbox [data-sel]'); if (o) { S.sel = +o.dataset.sel; S.animOpt = true; closeModal(); render(); $('scroll').scrollTop = 0; } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    $('soil').addEventListener('change', () => { soilTxt(); suggest(); }); soilTxt();
    $('wizback').onclick = () => { if (S.wiz > 0) wizard(S.wiz - 1); };
    $('wiznext').onclick = () => { if (WIZ[S.wiz][0] === 'field') { const la = parseFloat($('lat').value), lo = parseFloat($('lon').value); if (!(isFinite(la) && isFinite(lo) && Math.abs(la) <= 70 && Math.abs(lo) <= 180)) { $('lat').focus(); $('lat').classList.add('bad'); return; } $('lat').classList.remove('bad'); if (Math.abs(la - S.lat) > 1e-4 || Math.abs(lo - S.lon) > 1e-4) setPlace(la, lo, null, true); }
     if (S.wiz < WIZ.length - 1) wizard(S.wiz + 1); else if (S.exp == null) askExp(wizEnd); else wizEnd(); };
    $('ldate').max = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    $('layer').onchange = () => { setPlaying(false); setLayer(); goStep(STEPS.indexOf($('layer').value)); };
    $('ldate').onchange = () => { setLayer(); story(); };
    $('play').onclick = () => { setPlaying(!playing); if (playing) goStep(step + 1); };
    setInterval(() => { if (playing && map && LAST && !S.intro && S.wiz == null && !document.hidden) goStep(step + 1); }, 9000);
    if (window.L) {
      map = window.L.map('map', { attributionControl: false, zoomSnap: 0.25, minZoom: 3, worldCopyJump: true, maxBounds: [[-85, -1000], [85, 1000]], maxBoundsViscosity: 1 }).setView([DEMOS[0].lat, DEMOS[0].lon], 7);
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(map);
      window.L.control.attribution({ prefix: false }).addTo(map);
      cell = window.L.rectangle([[0, 0], [1, 1]], { color: '#EEF2E6', weight: 1.5, fillOpacity: 0.03, dashArray: '6 5', interactive: false }).addTo(map);
      cell.bindTooltip('NASA POWER grid cell, about 50 km', { permanent: true, direction: 'bottom', className: 'cell' });
      marker = window.L.marker([DEMOS[0].lat, DEMOS[0].lon], { interactive: false, keyboard: false, icon: window.L.divIcon({ className: 'pin', iconSize: [0, 0] }) }).addTo(map);
      map.on('dragstart', () => setPlaying(false));
      map.on('click', e => { if (S.intro) { if (introPick) introPick(e.latlng.lat, e.latlng.lng, null); return; } setPlace(e.latlng.lat, e.latlng.lng, null); });
      window.addEventListener('resize', () => map.invalidateSize());
    } else { $('play').hidden = true;
    }
    $('reset').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} window.location.reload(); };
    const saved = restore();
    if (saved) { const el = $('intro'); if (el) el.remove(); document.body.classList.remove('intro'); S.intro = false; } else intro();
    setTab('result');
    window.addEventListener('resize', moveInk); setTimeout(moveInk, 400); if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
    if (saved) setPlace(saved.lat, saved.lon, DEMOS.find(d => d.id === saved.demo) || null, true); else setPlace(DEMOS[0].lat, DEMOS[0].lon, DEMOS[0]);
  }
  init();
})();
