(function (G) {
  const E = G.Engine || (typeof require !== 'undefined' ? require('../src/engine.js') : null);
  const C = E.CROPS;

  const SCEN = [
    { id: 'base', name: 'Same as 2001-2025', temp: 0, rain: 0 },
    { id: 'warm', name: '+1.5 °C', temp: 1.5, rain: 0 },
    { id: 'warmdry', name: '+1.5 °C, 10% less rain', temp: 1.5, rain: -10 },
    { id: 'hotdry', name: '+3 °C, 20% less rain', temp: 3, rain: -20 },
    { id: 'wet', name: '+1.5 °C, 10% more rain', temp: 1.5, rain: 10 }
  ];

  const INFO = {
    current: { why: 'What the farm does now. Every other option is measured against it.', ev: 'Your own choice of crops, replayed through 25 years of NASA POWER weather.', ben: 'Known to the farmer, machinery and buyers already fit.', gap: 'We do not know the farm history, yields or prices.', risk: 'None new, but the replay shows where it is weak.' },
    cover: { why: 'The soil sits bare for months between crops, and heavy rain falls on it.', ev: 'Bare days and heavy rain on bare soil come straight from the replay. Field trials in many countries show cover crops cut erosion and add organic matter.', ben: 'Fewer bare days, less soil washed away, more roots in the ground.', gap: 'Cover crop seed cost and how well it establishes after a late harvest.', risk: 'In dry years a cover crop can use water the next crop needs. Local advisers should say if there is enough autumn rain.' },
    legume: { why: 'No crop in the rotation fixes its own nitrogen.', ev: 'Legumes take nitrogen from the air; the model credits them with it. Rotations with a legume year usually need less fertiliser.', ben: 'Less nitrogen fertiliser, a new crop family that breaks pest and disease cycles.', gap: 'Local price and buyer for soy or peas.', risk: 'Legumes can be sensitive to heat at flowering and to some soil diseases.' },
    smallgrain: { why: 'Adds a cool-season grain so the field is covered at a different time of year.', ev: 'Small grains are harvested early, leaving time for a summer cover crop.', ben: 'Spreads work and risk over more seasons.', gap: 'Grain prices are usually lower than corn or sunflower.', risk: 'Needs a buyer for the extra grain and storage.' },
    drought: { why: 'One crop runs short of water in hot dry years.', ev: 'Crop water stress per year from the replay; sorghum and sunflower root deeper and need less water at key stages.', ben: 'Fewer failed years.', gap: 'Yield potential and market for the swapped crop.', risk: 'Different machinery or drying may be needed.' },
    notill: { why: 'Same crops, but the soil is not ploughed and residue stays on top.', ev: 'Residue cover in the model protects soil from heavy rain. No-till is widely studied and reduces erosion.', ben: 'Less erosion and fuel use, more water kept in the soil.', gap: 'Effect on yield varies a lot by soil and climate.', risk: 'Needs a no-till drill; weeds and slugs can be harder to control at first.' },
    notillcover: { why: 'Combines no-till with cover crops, the full conservation package.', ev: 'Both effects from the model added up.', ben: 'The strongest soil protection of all options here.', gap: 'Highest learning curve and some extra cost.', risk: 'Best tried on one field first with local advice.' },
    forage: { why: 'Two years of alfalfa give the soil a long rest with deep roots.', ev: 'Alfalfa is a perennial legume with deep roots; the model counts living cover and nitrogen.', ben: 'Big boost to soil structure and nitrogen, feed for livestock.', gap: 'Only pays if there are animals or a hay buyer nearby.', risk: 'Alfalfa uses a lot of water in dry climates.' },
    diverse: { why: 'A long four-crop rotation with covers, the most varied option.', ev: 'More crop families and seasons spread weather and pest risk.', ben: 'Highest diversity, nitrogen from the legume, cover in winter.', gap: 'Many crops means many markets to sell into.', risk: 'More complex to manage; check each crop suits the area.' },
    mono: { why: 'Not a recommendation. Shows what happens if only the main crop is grown every year.', ev: 'Same model, one crop on repeat.', ben: 'Simple to run.', gap: 'Ignores yield loss from pests and disease build-up, which is the main reason to rotate.', risk: 'Pest, disease and soil decline. Shown so the others have something to beat.' }
  };

  const cp = rot => rot.map(r => ({ c: r.c, cv: r.cv || null }));
  const coverAll = (rot, cal) => rot.map(r => {
    const c = C[r.c]; if (!c || (c.kind !== 'summer' && c.kind !== 'winter') || r.cv) return r;
    const early = c.kind === 'winter' || (cal[r.c] && cal[r.c].harv < 235);
    return { c: r.c, cv: early ? 'legmix' : 'rye' };
  });

  function strategies(cur, cal, till) {
    const out = [], key = s => JSON.stringify(s.rot) + s.till;
    const add = (id, name, rot, t) => { const s = { id, name, rot, till: t || till }; if (!out.some(o => key(o) === key(s))) out.push(s); };
    const has = id => cur.some(r => r.c === id), hasLeg = cur.some(r => C[r.c] && C[r.c].fam === 'Legume');
    add('current', 'Your current rotation', cp(cur));
    add('cover', 'Same crops, cover crops in the gaps', coverAll(cp(cur), cal));
    if (!hasLeg) { const leg = cal.soy && cal.soy.reliab >= 0.8 ? 'soy' : 'pea'; add('legume', 'Add a legume year (' + C[leg].short.toLowerCase() + ')', cp(cur).concat([{ c: leg, cv: null }])); }
    if (!has('wheat') && !has('oats')) { const g = cal.wheat && cal.wheat.reliab >= 0.7 ? 'wheat' : 'oats'; add('smallgrain', 'Add a small-grain year', coverAll(cp(cur).concat([{ c: g, cv: null }]), cal)); }
    const swap = { corn: 'sorghum', soy: 'sunflower', oats: 'sorghum', pea: 'sunflower', wheat: 'sorghum' };
    const sw = cur.findIndex(r => swap[r.c] && !has(swap[r.c]));
    if (sw >= 0) { const r = cp(cur); r[sw] = { c: swap[cur[sw].c], cv: null }; add('drought', 'Swap ' + C[cur[sw].c].short.toLowerCase() + ' for ' + C[swap[cur[sw].c]].short.toLowerCase(), r); }
    if (till !== 'notill') { add('notill', 'Same crops, no-till', cp(cur), 'notill'); add('notillcover', 'No-till plus cover crops', coverAll(cp(cur), cal), 'notill'); }
    if (!has('alfalfa') && cal.alfalfa && cal.alfalfa.reliab >= 0.7) add('forage', 'Add two years of alfalfa', cp(cur).filter(r => r.c !== 'fallow').concat([{ c: 'alfalfa', cv: null }, { c: 'alfalfa', cv: null }]));
    const warm = cal.soy && cal.soy.reliab >= 0.8, d4 = [{ c: cal.wheat && cal.wheat.reliab >= 0.7 ? 'wheat' : 'oats' }, { c: warm ? 'soy' : 'pea' }, { c: warm && cal.corn.reliab >= 0.8 ? 'corn' : 'sunflower' }, { c: 'oats' }];
    add('diverse', 'Four-crop rotation with covers', coverAll(d4.map(r => ({ c: r.c, cv: null })), cal));
    const main = cur.find(r => C[r.c] && C[r.c].kind !== 'fallow');
    if (main && cur.length > 1) add('mono', 'Only ' + C[main.c].short.toLowerCase() + ', every year', [{ c: main.c, cv: null }]);
    return out;
  }

  function extra(s) {
    const m = s.m, cov = s.rot.filter(r => r.cv).length / s.rot.length, nt = s.till === 'notill' ? 1 : s.till === 'reduced' ? 0.4 : 0;
    const perennial = s.rot.filter(r => C[r.c] && C[r.c].kind === 'perennial').length / s.rot.length;
    const carbon = 0.32 * cov + 0.15 * nt + 0.4 * perennial;
    return {
      bare: Math.round(m.bare), heavyBare: Math.round(m.exposedShare * 100), nfix: Math.round(m.nfix), fams: m.fams, famRun: m.famRun,
      waterGap: Math.round(m.relMean * 100), badYear: Math.round(m.relHi * 100), heat: Math.round(m.heat * 10) / 10,
      carbon: Math.round(carbon * 100) / 100, ops: Math.round((s.rot.length + s.rot.filter(r => r.cv).length) / s.rot.length * 10) / 10
    };
  }

  function withPatch(patch, fn) {
    const keep = {}; for (const id in patch || {}) { if (!C[id]) continue; keep[id] = Object.assign({}, C[id]); const q = Object.assign({}, patch[id]); delete q.n; Object.assign(C[id], q); }
    try { return fn(); } finally { for (const id in keep) { for (const k in C[id]) delete C[id][k]; Object.assign(C[id], keep[id]); } }
  }

  function run(raw, inp, more, patch) { return withPatch(patch, () => run0(raw, inp, more || [])); }
  function run0(raw, inp, more) {
    const res = {}, all = SCEN.concat(more); res.scen = all;
    all.forEach(sc => {
      const cl = E.buildClimate(raw, inp.lat, sc), cal = E.calendar(cl);
      if (sc.id === 'base') { res.cl = cl; res.cal = cal; res.list = strategies(inp.rot, cal, inp.till).concat(inp.exp ? experimental(inp.rot, cal, inp.till) : []).filter((s, i, a) => a.findIndex(o => JSON.stringify(o.rot) === JSON.stringify(s.rot) && o.till === s.till) === i).filter(s => !s.rot.some(r => (inp.avoid || []).includes(r.c)) || s.id === 'current'); }
      res.list.forEach(s => {
        const r = E.simulate(s.rot, cl, cal, Object.assign({}, inp, { till: s.till }));
        const score = E.match(r.sc, inp.weights);
        s.byScen = s.byScen || {}; s.byScen[sc.id] = score;
        if (sc.id === 'base') {
          Object.assign(s, r, { match: score }); s.x = extra(s);
          const half = Math.floor(cl.n / 2), idx = Array.from({ length: cl.n - half }, (_, i) => half + i);
          s.recent = E.match(E.scoreSet(r, Object.assign({}, inp, { till: s.till }), idx), inp.weights);
        }
      });
    });
    const list = res.list;
    list.forEach(s => { const v = all.map(sc => s.byScen[sc.id]); s.worst = Math.min.apply(null, v); s.spread = Math.max.apply(null, v) - s.worst; });
    const winners = {}; all.forEach(sc => { winners[sc.id] = list.slice().sort((a, b) => b.byScen[sc.id] - a.byScen[sc.id])[0].id; });
    winners.recent = list.slice().sort((a, b) => b.recent - a.recent)[0].id;
    res.winners = winners;
    res.stable = new Set(Object.values(winners)).size === 1;
    list.sort((a, b) => b.match - a.match);
    return res;
  }

  function doyOf(dateStr, south) {
    const d = new Date(dateStr + 'T00:00:00Z'); if (isNaN(d)) return null;
    const y0 = Date.UTC(d.getUTCFullYear(), 0, 1); let doy = Math.round((d - y0) / 864e5);
    if (doy > 364) doy = 364; if (south) doy = (doy + 183) % 365;
    return doy;
  }
  function parseFarm(text) {
    const rows = [];
    text.split(/\r?\n/).forEach(line => {
      const p = line.split(/[,;\t]/).map(x => x.trim()); if (p.length < 3 || !/^\d{4}$/.test(p[0])) return;
      const crop = Object.keys(C).find(k => k === p[1].toLowerCase() || C[k].short.toLowerCase() === p[1].toLowerCase());
      rows.push({ year: +p[0], crop: crop || null, raw: p[1], sow: p[2] || '', harv: p[3] || '', yield: p[4] ? +p[4] : null });
    });
    return rows;
  }
  function compareFarm(rows, cal, south) {
    return rows.map(r => {
      const c = r.crop && cal[r.crop]; if (!c) return Object.assign({ note: 'crop not in our list' }, r);
      const s = doyOf(r.sow, south), h = doyOf(r.harv, south);
      const diff = (a, b) => a == null || b == null ? null : ((a - b + 545) % 365) - 180;
      return Object.assign({}, r, { sowDiff: diff(s, c.plant), harvDiff: diff(h, c.harv) });
    });
  }

  function credits(s, base, area, price, years) {
    const dC = Math.max(0, s.x.carbon - base.x.carbon), co2 = dC * 44 / 12;
    return { tC: dC, tCO2: co2, total: co2 * area * years, money: co2 * area * years * price };
  }

  const MODELS = ['EC_Earth3P_HR', 'MRI_AGCM3_2_S', 'CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S'];
  function projections(j) {
    const t = j.daily.time, out = [], yr = t.map(d => +d.slice(0, 4));
    MODELS.forEach(m => {
      const T = j.daily['temperature_2m_mean_' + m], P = j.daily['precipitation_sum_' + m]; if (!T || !P) return;
      let a = 0, na = 0, b = 0, nb = 0, pa = 0, pb = 0;
      for (let i = 0; i < t.length; i++) { if (T[i] == null || P[i] == null) continue; if (yr[i] <= 2025) { a += T[i]; na++; pa += P[i]; } else if (yr[i] >= 2036) { b += T[i]; nb++; pb += P[i]; } }
      if (na < 3000 || nb < 3000) return;
      const dT = b / nb - a / na, dP = 100 * ((pb / nb) / (pa / na) - 1);
      out.push({ id: 'm_' + m, name: m.replace(/_/g, ' '), temp: Math.round(dT * 10) / 10, rain: Math.round(dP), model: true });
    });
    if (out.length) out.push({ id: 'm_mean', name: 'All models, average', temp: Math.round(out.reduce((s, o) => s + o.temp, 0) / out.length * 10) / 10, rain: Math.round(out.reduce((s, o) => s + o.rain, 0) / out.length), model: true });
    return out;
  }

  // IPCC 2019 Refinement, Vol. 4, Ch. 5, Table 5.5 (Updated), 20-year relative stock change factors, temperate.
  // Tillage F_MG differs for warm temperate (mean annual temp > 10 C) and cool temperate; input F_I does not.
  const IPCC = {
    till: {
      conv: { warm: { dry: 1, moist: 1 }, cool: { dry: 1, moist: 1 } },
      reduced: { warm: { dry: 0.99, moist: 1.05 }, cool: { dry: 0.98, moist: 1.04 } },
      notill: { warm: { dry: 1.04, moist: 1.10 }, cool: { dry: 1.03, moist: 1.09 } }
    },
    input: { low: { dry: 0.95, moist: 0.92 }, medium: { dry: 1, moist: 1 }, high: { dry: 1.04, moist: 1.11 } },
    source: 'https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch05_Cropland.pdf'
  };
  function inputLevel(rot) {
    const n = rot.length, cov = rot.filter(r => r.cv).length, per = rot.filter(r => C[r.c] && C[r.c].kind === 'perennial').length, fal = rot.filter(r => r.c === 'fallow').length;
    if (fal / n >= 0.5) return 'low';
    if ((cov + per) / n >= 0.5) return 'high';
    return 'medium';
  }
  function carbonIPCC(s, base, soc0, moist, warm) {
    const w = moist ? 'moist' : 'dry', z = warm === false ? 'cool' : 'warm';
    const fm = x => IPCC.till[x.till][z][w], fi = x => IPCC.input[inputLevel(x.rot)][w], f = x => fm(x) * fi(x);
    const ratio = f(s) / f(base), stock20 = soc0 * ratio;
    return { level: inputLevel(s.rot), baseLevel: inputLevel(base.rot), zone: z, moist: w, fmNew: fm(s), fmOld: fm(base), fiNew: fi(s), fiOld: fi(base), ratio, perYear: (stock20 - soc0) / 20, after20: stock20 };
  }

  function calibrate(rows, cal) {
    const by = {};
    rows.forEach(r => { if (!r.crop || r.sowDiff == null || !C[r.crop] || (C[r.crop].kind !== 'summer' && C[r.crop].kind !== 'winter')) return; (by[r.crop] = by[r.crop] || []).push(r); });
    const patch = {}, clip = (v, a, b) => Math.max(a, Math.min(b, v)), avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    for (const id in by) {
      const c = C[id], rs = by[id], sd = avg(rs.map(r => r.sowDiff)), hs = rs.filter(r => r.harvDiff != null), hd = hs.length ? avg(hs.map(r => r.harvDiff)) : null;
      if (c.kind === 'summer') { patch[id] = { off: Math.round(clip(c.off + sd, -40, 60)) }; if (hd != null) patch[id].dry = Math.round(clip(c.dry + hd - sd, 3, 60)); }
      else { patch[id] = { lead: Math.round(clip(c.lead - sd, 0, 90)) }; if (hd != null) patch[id].gdd = Math.round(clip(c.gdd + hd * 12, 900, 2600)); }
      patch[id].n = rs.length;
    }
    return patch;
  }
  function errors(rows) {
    const s = rows.filter(r => r.sowDiff != null).map(r => Math.abs(r.sowDiff)), h = rows.filter(r => r.harvDiff != null).map(r => Math.abs(r.harvDiff)), avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return { sow: avg(s), harv: avg(h), n: rows.length };
  }
  function calFor(raw, lat, patch) { return withPatch(patch, () => { const cl = E.buildClimate(raw, lat); return { cl, cal: E.calendar(cl) }; }); }

  function ndviYears(nd, cl) {
    const out = [];
    cl.years.forEach((Y, k) => {
      const y = +String(Y.label).slice(0, 4), v = nd.by[y]; if (!v) return;
      const ok = v.filter(x => x != null); if (ok.length < 15) return;
      const peak = Math.max.apply(null, ok), meanv = ok.reduce((a, b) => a + b, 0) / ok.length;
      out.push({ year: y, peak, mean: meanv, low: v.filter(x => x != null && x < 0.25).length * 16, bal: Y.wRain - Y.wEt0, hot: Y.hot32, heavy: Y.heavy, dry: Y.drySpell });
    });
    return out;
  }
  function corr(a, b) {
    const n = a.length; if (n < 4) return null;
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
  }
  function oracle(nd, year, south, maxBare) {
    const v = nd.by[year]; if (!v || v.filter(x => x != null).length < 15) return null;
    const win = south ? [10, 11, 12, 13, 14, 15] : [0, 1, 2, 3, 19, 20, 21, 22], w = win.map(i => v[i]).filter(x => x != null);
    const bare = v.filter(x => x != null && x < 0.25).length * 16, wn = w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0;
    return { year, bare, winter: Math.round(wn * 1000) / 1000, covered: bare <= maxBare };
  }

  function rainChange(cl) {
    const ys = cl.years, f = k => E.trend(ys.map(Y => Y[k]));
    const cv = ys.map(Y => { const m = Array.from({ length: 12 }, (_, i) => 0); for (let d = 0; d < 365; d++) m[Math.min(11, Math.floor(d / 30.42))] += Y.pr[d]; const a = m.reduce((x, y) => x + y, 0) / 12; return a ? Math.sqrt(m.reduce((x, y) => x + (y - a) ** 2, 0) / 12) / a : 0; });
    return { heavy: f('heavy'), dry: f('drySpell'), rain: f('rain'), hot: f('hot32'), cv: E.trend(cv), series: { heavy: ys.map(Y => Y.heavy), dry: ys.map(Y => Y.drySpell), cv, labels: ys.map(Y => Y.label) } };
  }

  function pack(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unpack(t) { return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))))); }
  function fromIssues(list) {
    const out = [];
    (list || []).forEach(it => { const m = /```json\s*([\s\S]*?)```/.exec(it.body || ''); if (!m) return; try { const j = JSON.parse(m[1]); if (j.app === 'furrow-lab') out.push(Object.assign(j, { by: it.user && it.user.login, url: it.html_url })); } catch (e) {} });
    return out;
  }
  function summarise(notes) {
    const votes = {}, recs = [];
    notes.forEach(n => {
      for (const f in n.feedback || {}) for (const s in n.feedback[f]) { const v = n.feedback[f][s].v; if (!v) continue; votes[s] = votes[s] || { works: 0, no: 0, tried: 0, fields: new Set() }; votes[s][v]++; votes[s].fields.add(f); }
      for (const f in n.records || {}) recs.push({ field: f, text: n.records[f] });
    });
    return { votes, recs };
  }


  const CROPINFO = {
    wheat: { cost: 3, machinery: 2, market: 5, stable: 4, niche: 1, nNeed: 4, water: 3, root: 3, roles: ['Covers soil over winter'], buyers: 'Mills, feed, export' },
    corn: { cost: 5, machinery: 4, market: 5, stable: 3, niche: 1, nNeed: 5, water: 5, root: 3, roles: ['Lots of residue'], buyers: 'Feed, ethanol, export' },
    soy: { cost: 3, machinery: 3, market: 4, stable: 3, niche: 2, nNeed: 1, water: 4, root: 3, roles: ['Fixes nitrogen'], buyers: 'Crushers, feed, export' },
    sunflower: { cost: 3, machinery: 3, market: 4, stable: 3, niche: 2, nNeed: 3, water: 2, root: 5, roles: ['Deep roots', 'Handles drought'], buyers: 'Oil crushers' },
    sorghum: { cost: 2, machinery: 3, market: 2, stable: 3, niche: 3, nNeed: 3, water: 1, root: 4, roles: ['Handles drought', 'Deep roots'], buyers: 'Feed, some food and biofuel' },
    oats: { cost: 2, machinery: 2, market: 3, stable: 3, niche: 3, nNeed: 2, water: 3, root: 2, roles: ['Breaks disease cycles of wheat'], buyers: 'Feed, food mills, horses' },
    pea: { cost: 2, machinery: 2, market: 3, stable: 3, niche: 3, nNeed: 1, water: 2, root: 2, roles: ['Fixes nitrogen', 'Harvested early'], buyers: 'Feed, protein makers, export' },
    canola: { cost: 4, machinery: 3, market: 4, stable: 3, niche: 2, nNeed: 4, water: 3, root: 4, roles: ['Deep tap root', 'Breaks grass disease cycles'], buyers: 'Oil crushers, biodiesel' },
    alfalfa: { cost: 3, machinery: 4, market: 2, stable: 4, niche: 4, nNeed: 1, water: 5, root: 5, roles: ['Fixes nitrogen', 'Very deep roots', 'Covers soil all year'], buyers: 'Livestock farms, hay buyers' },
    fallow: { cost: 1, machinery: 1, market: 0, stable: 0, niche: 0, nNeed: 0, water: 1, root: 0, roles: ['Stores some water'], buyers: 'Nothing to sell' }
  };

  const EXPERIMENTAL = {
    doublecrop: { name: 'Two crops in one year (wheat, then a summer legume)', why: 'Some farms now sow a short summer crop right after the wheat harvest instead of leaving the field empty.', ev: 'Common in the US Midwest and spreading in Ukraine as summers get longer. We model the second crop as a legume cover, so income from it is not counted.', risk: 'Only works if there is enough rain in July and August. Very new in most of Europe.', since: 'Tried for decades in warm regions, new further north' },
    multimix: { name: 'Mixed cover crops in every gap', why: 'Instead of one cover crop, a mix of several species (legume, grass, brassica) is sown.', ev: 'Researchers mostly agree mixes give more soil life, but they argue about whether it is worth the higher seed cost.', risk: 'Seed is expensive and mixes are harder to kill before the next crop.', since: 'Spreading fast in the last 10 years' },
    relay: { name: 'Legume sown into the standing wheat', why: 'Clover or pea is sown into the wheat in spring, so it is already growing when the wheat is cut.', ev: 'Trials in Europe and North America show it covers the soil faster than sowing after harvest.', risk: 'Needs a special drill or broadcasting and a wet spring. Few farms in the region have tried it.', since: 'Still in trials in most places' }
  };

  function experimental(cur, cal, till) {
    const out = [], has = id => cur.some(r => r.c === id), cp = rot => rot.map(r => ({ c: r.c, cv: r.cv || null }));
    if (has('wheat')) out.push({ id: 'doublecrop', name: EXPERIMENTAL.doublecrop.name, rot: cp(cur).map(r => r.c === 'wheat' ? { c: 'wheat', cv: 'legmix' } : r), till, exp: true });
    out.push({ id: 'multimix', name: EXPERIMENTAL.multimix.name, rot: cp(cur).map(r => C[r.c] && C[r.c].kind !== 'perennial' && r.c !== 'fallow' ? { c: r.c, cv: 'legmix' } : r), till, exp: true });
    if (has('wheat')) out.push({ id: 'relay', name: EXPERIMENTAL.relay.name, rot: cp(cur).map(r => r.c === 'wheat' ? { c: 'wheat', cv: 'legmix' } : r), till: till === 'conv' ? 'reduced' : till, exp: true });
    return out;
  }

  function needs(s, cur) {
    const curC = new Set(cur.map(r => r.c)), newC = s.rot.map(r => r.c).filter(c => !curC.has(c) && c !== 'fallow');
    const n = {};
    if (s.till === 'notill') n.equipment = 'a no-till drill';
    if (s.rot.some(r => r.c === 'alfalfa')) n.equipment = (n.equipment ? n.equipment + ' and ' : '') + 'hay machinery';
    if (newC.length) { n.newCrop = newC.map(c => C[c].short.toLowerCase()).join(', '); n.newBuyer = n.newCrop; }
    if (s.rot.some(r => r.cv)) n.seedCost = 'cover crop seed every year';
    if (s.rot.some(r => r.c === 'alfalfa') || s.rot.length > cur.length) n.incomeDip = 'a year or two with a lower-value crop';
    if (s.x && s.x.ops > 1.2) n.moreWork = 'about ' + s.x.ops + ' sowings a year instead of 1';
    if (s.exp) n.experimental = 'a method few farms near you have tried';
    return n;
  }
  const ACCEPT = {
    equipment: { q: 'Money you can spend on machinery (buying or renting)', lo: 'Nothing', hi: 'Over €80,000', steps: ['Nothing', 'Up to €2,000', 'Up to €10,000', 'Up to €30,000', 'Up to €80,000', 'Over €80,000'] },
    newCrop: { q: 'Learning to grow a crop you haven’t grown', lo: 'Rather not', hi: 'Happy to' },
    newBuyer: { q: 'Finding a new buyer for a new crop', lo: 'No buyer nearby', hi: 'Easy for me' },
    seedCost: { q: 'Paying for cover crop seed', lo: 'Can’t afford it', hi: 'Fine' },
    incomeDip: { q: 'Earning less for a year or two', lo: 'Can’t afford it', hi: 'Fine if it pays off later' },
    moreWork: { q: 'More field work', lo: 'Already stretched', hi: 'Have the time' },
    experimental: { q: 'Trying something new and less tested', lo: 'Only proven methods', hi: 'Happy to experiment' },
    market: { q: 'Selling a large amount of a niche crop', lo: 'No market for it', hi: 'Have a contract' }
  };
  function adjust(s, need, acc) {
    let pen = 0; const blocked = [];
    for (const k in need) { const a = acc[k] == null ? 5 : acc[k]; if (a === 0) blocked.push(k); pen += (5 - a) * 1.2; }
    return { pen: Math.round(pen * 10) / 10, blocked, final: Math.round((s.match - pen) * 10) / 10 };
  }

  const RULES = [
    { re: /fuel|diesel|petrol|gas(oline)?|бензин|топлив|дизел|пальн/i, tag: 'Short of fuel', act: { prefer: 'notill', ops: true }, why: 'Fewer passes over the field. No-till uses the least fuel.' },
    { re: /combine|harvester|комбайн/i, tag: 'No reliable combine', act: { prefer: 'forage', avoidNew: true }, why: 'Keep crops you can already harvest; hay crops need no combine.' },
    { re: /money|cash|credit|loan|budget|afford|денег|деньг|кредит|бюджет|грош/i, tag: 'Tight money', act: { acc: { equipment: 1, seedCost: 2, incomeDip: 0 } }, why: 'We push down options that need buying things or a dip in income.' },
    { re: /drill|seeder|сеялк|сівалк/i, tag: 'No no-till drill', act: { acc: { equipment: 0 } }, why: 'No-till options need one, so they go down.' },
    { re: /worker|labou?r|people|staff|time|рабоч|людей|времен|працівн/i, tag: 'Short of hands or time', act: { acc: { moreWork: 1 } }, why: 'Options with more field work go down.' },
    { re: /water|irrigat|drought|dry|worry|полив|засух|вод/i, tag: 'Water is the worry', act: { w: { water: 5, resilience: 4 } }, why: 'Saving water now counts most.' },
    { re: /allerg|аллерг|алерг/i, tag: 'Allergy concern', act: { avoid: ['canola', 'sunflower', 'alfalfa'] }, why: 'Crops with lots of pollen or dust are left out. Tell a doctor which plants cause it.' },
    { re: /buyer|market|sell|export|price|tariff|unstable|рынок|продат|покупат|экспорт|тариф|ціна|цен/i, tag: 'Selling is hard', act: { acc: { newBuyer: 1 }, w: { income: 5 } }, why: 'We keep to crops with many buyers.' },
    { re: /storage|silo|склад|хранен|зберіган/i, tag: 'Little storage', act: { acc: { newCrop: 2 } }, why: 'New crops may need their own storage, so they go down.' },
    { re: /animal|livestock|cattle|cow|скот|коров|худоб/i, tag: 'Has livestock', act: { livestock: true }, why: 'Hay crops like alfalfa become worth more.' },
    { re: /no animal|without livestock|нет скот|без скот/i, tag: 'No livestock', act: { avoid: ['alfalfa'] }, why: 'Without animals or a hay buyer alfalfa is hard to sell.' },
    { re: /rent|lease|аренд|оренд/i, tag: 'Rented land', act: { acc: { incomeDip: 1 } }, why: 'Long-term soil gains may not pay back on rented land.' },
    { re: /organic|органи/i, tag: 'Organic farm', act: { w: { soil: 5 } }, why: 'Legumes and covers matter more without bought fertiliser.' }
  ];
  function parseConstraints(text) {
    const out = []; if (!text) return out;
    RULES.forEach(r => { if (r.re.test(text)) out.push(r); });
    return out;
  }

  function plan(list, wNow, wLater, nYears) {
    const by = w => list.slice().sort((a, b) => E.match(b.sc, w) - E.match(a.sc, w))[0];
    const a = by(wNow), b = by(wLater);
    return { first: a, then: b, switchAfter: nYears, same: a.id === b.id };
  }

  function qc(rows) {
    const keep = [], drop = [];
    rows.forEach(r => {
      if (!r.crop) return drop.push(Object.assign({ why: 'unknown crop' }, r));
      if (r.sowDiff == null) return drop.push(Object.assign({ why: 'no sowing date' }, r));
      if (Math.abs(r.sowDiff) > 60 || (r.harvDiff != null && Math.abs(r.harvDiff) > 60)) return drop.push(Object.assign({ why: 'more than 2 months off, probably a typo' }, r));
      keep.push(r);
    });
    const by = {}; keep.forEach(r => (by[r.crop] = by[r.crop] || []).push(r));
    const final = [];
    for (const c in by) {
      const v = by[c].map(r => r.sowDiff).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)], mad = v.map(x => Math.abs(x - med)).sort((a, b) => a - b)[Math.floor(v.length / 2)] || 5;
      by[c].forEach(r => Math.abs(r.sowDiff - med) > 3 * Math.max(mad, 5) && by[c].length >= 3 ? drop.push(Object.assign({ why: 'far from the other records for this crop' }, r)) : final.push(r));
    }
    return { keep: final, drop };
  }

  function confidence(list, inp, n) {
    let seed = 20261114; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, B = 300, cur = list.find(s => s.id === 'current');
    const ip = s => Object.assign({}, inp, { till: s.till }), idxs = Array.from({ length: B }, () => Array.from({ length: n }, () => Math.floor(rnd() * n)));
    const curS = idxs.map(idx => E.match(E.scoreSet(cur, ip(cur), idx), inp.weights));
    list.forEach(s => {
      if (s === cur) { s.conf = null; return; }
      const d = idxs.map((idx, b) => E.match(E.scoreSet(s, ip(s), idx), inp.weights) - curS[b]);
      s.conf = { beats: d.filter(x => x > 0).length, runs: B };
    });
  }


  // Economics per crop: typical Austrian conditions, rough 2024-2025 values (to be replaced by IDB Deckungsbeiträge and exchange data)
  const ECON = {
    wheat: { y: 6.5, unit: 't', price: 210, cv: 0.18, costs: { nitrogen: 230, seed: 90, protection: 120, drying: 0, fuel: 200, other: 110 }, bench: 'Euronext milling wheat' },
    corn: { y: 10, unit: 't', price: 190, cv: 0.2, costs: { nitrogen: 220, seed: 230, protection: 90, drying: 230, fuel: 230, other: 120 }, bench: 'CBOT and Euronext corn' },
    soy: { y: 3, unit: 't', price: 430, cv: 0.2, costs: { nitrogen: 0, seed: 190, protection: 110, drying: 0, fuel: 180, other: 100 }, bench: 'CBOT soybeans plus a non-GMO premium' },
    sunflower: { y: 2.8, unit: 't', price: 420, cv: 0.22, costs: { nitrogen: 80, seed: 150, protection: 90, drying: 20, fuel: 180, other: 90 }, bench: 'Physical quotes (no futures)' },
    sorghum: { y: 7, unit: 't', price: 170, cv: 0.25, costs: { nitrogen: 140, seed: 90, protection: 60, drying: 120, fuel: 190, other: 90 }, bench: 'Corn price minus a discount' },
    oats: { y: 5, unit: 't', price: 190, cv: 0.2, costs: { nitrogen: 120, seed: 80, protection: 60, drying: 0, fuel: 170, other: 90 }, bench: 'Feed grain prices' },
    pea: { y: 3.2, unit: 't', price: 280, cv: 0.25, costs: { nitrogen: 0, seed: 150, protection: 100, drying: 0, fuel: 170, other: 90 }, bench: 'Local buyers (no exchange price)' },
    canola: { y: 3.3, unit: 't', price: 450, cv: 0.2, costs: { nitrogen: 200, seed: 90, protection: 170, drying: 0, fuel: 190, other: 100 }, bench: 'Euronext rapeseed' },
    alfalfa: { y: 9, unit: 't hay', price: 150, cv: 0.3, costs: { nitrogen: 0, seed: 60, protection: 30, drying: 0, fuel: 260, other: 120 }, bench: 'Local hay market' },
    fallow: { y: 0, unit: 't', price: 0, cv: 0, costs: { nitrogen: 0, seed: 0, protection: 0, drying: 0, fuel: 40, other: 20 }, bench: '-' }
  };
  const COVER_COST = { rye: 70, legmix: 110 }, LEGUME_N_CREDIT = 0.4;
  function econYear(c, prevLegume, wat, reliab, cv, livestock) {
    const e = ECON[c] || ECON.fallow, cost = Object.assign({}, e.costs); if (prevLegume) cost.nitrogen = Math.round(cost.nitrogen * (1 - LEGUME_N_CREDIT));
    const yf = wat * (0.6 + 0.4 * reliab), rev = e.y * yf * e.price * (livestock && c === 'alfalfa' ? 1.1 : 1), cov = cv ? COVER_COST[cv] || 0 : 0;
    const tot = Object.values(cost).reduce((a, b) => a + b, 0) + cov;
    return { rev, cost, cov, tot, margin: rev - tot, yf };
  }
  function planner(cl, cal, inp0) {
    const COV = E.COVERS, clip = E.clip, inpS = { soil: inp0.soil, slope: inp0.slope, till: inp0.till };
    const ids = Object.keys(C), ci = {}; ids.forEach((c, i) => { ci[c] = i; });
    const canCv = c => C[c].kind === 'summer' || C[c].kind === 'winter', Q = v => Math.round(v * 1000), sims = new Map();
    function slot(p, ph, c, ch, n) {
      ph = ph && canCv(p) ? 1 : 0; ch = ch && canCv(c) ? 1 : 0;
      const k = p + ph + '|' + c + ch + '|' + n; let s = sims.get(k); if (s) return s;
      const R = E.simulate([{ c: p, cv: ph ? 'rye' : null }, { c: c, cv: ch ? 'rye' : null }, { c: n, cv: null }], cl, cal, inpS), tl = R.tl;
      let bare = 0, living = 0, exp = 0;
      for (let t = 365; t < 730; t++) { const st = tl.st[t]; if (st === 0) bare++; else if (st !== 1) living++; exp += cl.eros[t - 365] * (1 - tl.cov[t]); }
      const c1 = tl.covers.find(x => x.i === 1), c0 = tl.covers.find(x => x.i === 0), cr = R.crops[1];
      s = { bare, living, exp: cl.erosTotal > 0 ? exp / cl.erosTotal : 0, g1: c1 ? c1.growth : -1, g0: c0 ? 1 : 0, fallow: !!cr.fallow, rel: cr.rel, hd: cr.hdY, def: cr.defY, reliab: cr.reliab };
      sims.set(k, s); return s;
    }
    const norm = r => ({ c: r.c, cv: r.cv && COV[r.cv] && canCv(r.c) ? r.cv : null });
    function year(pT, cT, nT, o, idx) {
      const p = pT.c, c = cT.c, n = nT.c, s = slot(p, pT.cv, c, cT.cv, n), cc = C[c], fams = new Set(), kinds = new Set();
      [p, c, n].forEach(x => { if (C[x].fam !== '-') fams.add(C[x].fam); if (C[x].kind !== 'fallow') kinds.add(C[x].kind); });
      const cvOn = !!cT.cv && s.g1 >= 0; if (cvOn) fams.add(COV[cT.cv].fam + ' cover'); if (pT.cv && s.g0) fams.add(COV[pT.cv].fam + ' cover');
      const nfix = cc.nfix + (cvOn ? COV[cT.cv].nfix * Math.min(1, s.g1 / 90) : 0), deep = C[p].deep || cc.deep || C[n].deep ? 1 : 0;
      const soil = 35 * s.living / 365 + 15 * clip(nfix / 60) + 15 * cc.res / 5 + 15 * clip((fams.size - 1) / 3) + 10 * deep + 10 * (1 - s.bare / 365);
      let rel = 0, hd = 0, def = 0, st = 0; const Yn = s.rel.length, m = idx ? idx.length : Yn;
      for (let j = 0; j < m; j++) { const k = idx ? idx[j] : j; rel += s.rel[k]; hd += s.hd[k]; def += s.def[k]; if (s.rel[k] > 0.25) st++; }
      rel /= m; hd /= m; def /= m; st /= m;
      const wat = o.irrigated ? 1 : 1 - 0.8 * clip(rel / 0.6);
      const prevLeg = C[p].nfix > 0 || (pT.cv === 'legmix' && s.g0), ey = econYear(s.fallow ? 'fallow' : c, prevLeg, wat, s.reliab, cvOn ? cT.cv : null, o.livestock);
      const inc = clip((ey.margin + 300) / 1400) * 4.2;
      return {
        soil, eros: 100 * (1 - s.exp), inc: inc / 4.2 * 100, mar: ey.margin, cash: s.fallow ? 0 : 1,
        water: s.fallow ? 0 : o.irrigated ? 100 * (1 - clip(def / 450)) : 100 * (1 - clip(rel / 0.45)),
        res: s.fallow ? 0 : 100 * (0.35 * (1 - clip(st)) + 0.2 * (1 - clip(hd / 10)) + 0.2 * s.reliab + 0.15 * clip((fams.size - 1) / 2) + 0.1 * clip(kinds.size / 2))
      };
    }
    const fin = (a, b, d, e, f, L, cash) => ({ water: cash ? Math.round(e / (cash * 1000)) : 0, soil: Math.round(a / (L * 1000)), erosion: Math.round(b / (L * 1000)), income: Math.round(Math.min(100, Math.max(0, d / (L * 1000)))), resilience: cash ? Math.round(f / (cash * 1000)) : 0 });
    function money(rot, o) {
      const T = rot.map(norm), L = T.length, out = [];
      for (let i = 0; i < L; i++) { const pT = T[(i - 1 + L) % L], cT = T[i], nT = T[(i + 1) % L], s = slot(pT.c, pT.cv, cT.c, cT.cv, nT.c), cvOn = !!cT.cv && s.g1 >= 0, prevLeg = C[pT.c].nfix > 0 || (pT.cv === 'legmix' && s.g0);
        const perYear = s.rel.map(r => econYear(s.fallow ? 'fallow' : cT.c, prevLeg, o.irrigated ? 1 : 1 - 0.8 * clip(r / 0.6), s.reliab, cvOn ? cT.cv : null, o.livestock).margin);
        const mean = econYear(s.fallow ? 'fallow' : cT.c, prevLeg, o.irrigated ? 1 : 1 - 0.8 * clip(s.rel.reduce((a, b) => a + b, 0) / s.rel.length / 0.6), s.reliab, cvOn ? cT.cv : null, o.livestock);
        out.push({ c: cT.c, cv: cvOn ? cT.cv : null, prevLeg, perYear, mean }); }
      return out;
    }
    function score(rot, o, idx) {
      const T = rot.map(norm), L = T.length; let a = 0, b = 0, d = 0, e = 0, f = 0, cash = 0; const years = [];
      for (let i = 0; i < L; i++) { const y = year(T[(i - 1 + L) % L], T[i], T[(i + 1) % L], o, idx); years.push(y); a += Q(y.soil); b += Q(y.eros); d += Q(y.inc); if (y.cash) { e += Q(y.water); f += Q(y.res); cash++; } }
      return { sc: fin(a, b, d, e, f, L, cash), years };
    }
    const mt = (wa, so, er, inc, re, w) => { const tw = w[5]; return tw ? (0 + wa * w[0] + so * w[1] + er * w[2] + inc * w[3] + re * w[4]) / tw : (wa + so + er + inc + re) / 5; };
    const wv = w => { const v = ['water', 'soil', 'erosion', 'income', 'resilience'].map(k => w[k] || 0); v.push(v[0] + v[1] + v[2] + v[3] + v[4]); return v; };
    function choose(T, BM, BR, lo) {
      const rotOf = q => { const L = BR[q * 8], r = []; for (let i = 0; i < L; i++) r.push({ c: T[BR[q * 8 + 1 + i]].c, cv: T[BR[q * 8 + 1 + i]].cv }); return r; };
      const pick = off => { let b = -1; for (let i = 0; i <= 100; i++) if (i >= lo && BM[off + i] > -1e8 && (b < 0 || BM[off + i] > BM[off + b])) b = i; return b < 0 ? null : { m: BM[off + b], rot: rotOf(off + b) }; };
      const top = []; for (let i = 0; i <= 100; i++) if (i >= lo && BM[202 + i] > -1e8) top.push({ m: BM[202 + i], rot: rotOf(202 + i) });
      top.sort((p, q) => q.m - p.m);
      return { first: pick(0), then: pick(101), top, minInc: lo };
    }
    function rank(res, sc) { if (!res || !res.F) return sc; const F = res.F, k = ['water', 'soil', 'erosion', 'income', 'resilience'], out = {}; k.forEach((n, i) => { out[n] = Math.round(F[i * 101 + Math.max(0, Math.min(100, Math.round(sc[n])))]); }); return out; }
    function rankRaw(res, sc) { if (!res || !res.F) return sc; const F = res.F, k = ['water', 'soil', 'erosion', 'income', 'resilience'], out = {}; k.forEach((n, i) => { out[n] = F[i * 101 + Math.max(0, Math.min(100, Math.round(sc[n])))]; }); return out; }
    function within(res, lo) { const r = choose(res.T, res.BM, res.BR, lo); r.count = res.count; r.maxInc = res.maxInc; r.F = res.F; return r; }
    function levels(w) { const v = ['water', 'soil', 'erosion', 'income', 'resilience'].map(k => w[k] || 0), ds = [...new Set(v.filter(x => x > 0))].sort((a, b) => b - a); return { of: v.map(x => x > 0 ? ds.indexOf(x) : -1), n: ds.length }; }
    function lexKey(Lv, f, pen) { const acc = new Float64Array(5); for (let i = 0; i < 5; i++) if (Lv.of[i] >= 0) acc[Lv.of[i]] += f[i]; let k = 0; for (let l = 0; l < Lv.n; l++) k = k * 1024 + Math.max(0, Math.min(1023, Math.round(acc[l] - pen + 50))); return k; }
    function job(cfg) {
      const T = cfg.types.map(norm), NT = T.length, n3 = NT * NT * NT, maxLen = cfg.maxLen || 6;
      const SO = new Int32Array(n3), ER = new Int32Array(n3), IN = new Int32Array(n3), WA = new Int32Array(n3), RE = new Int32Array(n3), CA = new Uint8Array(n3);
      const fl = T.map(t => (t.cv ? 1 : 0) | (t.c === 'alfalfa' ? 2 : 0)), cb = T.map(t => 1 << (3 * ci[t.c]));
      const w1 = wv(cfg.w1), w2 = wv(cfg.w2), fa = cfg.share, fb = 1 - fa, PEN = cfg.pen, BIG = (cfg.big || []).map(b => [3 * ci[b[0]], b[1]]);
      const BM = new Float64Array(303).fill(-1e9), BR = new Int8Array(303 * 8), y = new Int32Array(8);
      let ti = 0, y0 = 0, y1 = 0, maxInc = -1, count = 0, stage = 0, pass = 0;
      const H = new Float64Array(505), F = new Float64Array(505), Lv1 = levels(cfg.w1), Lv2 = levels(cfg.w2), fv = new Float64Array(5);
      const leaf = (L, a, b, d, e, f, cash, fg, mask) => {
        const wa = cash ? Math.round(e / (cash * 1000)) : 0, so = Math.round(a / (L * 1000)), er = Math.round(b / (L * 1000)), inc = Math.round(Math.min(100, Math.max(0, d / (L * 1000)))), re = cash ? Math.round(f / (cash * 1000)) : 0;
        if (pass === 0) { count++; H[wa]++; H[101 + so]++; H[202 + er]++; H[303 + inc]++; H[404 + re]++; return; }
        const P = PEN[fg]; if (P.blocked) return;
        let big = 0; for (let j = 0; j < BIG.length; j++) { const n = (mask >> BIG[j][0]) & 7; if (n && n * BIG[j][1] >= 300 * L) { big = 3; break; } } const pen = P.pen + big; if (inc > maxInc) maxInc = inc;
        const pw = F[wa], pso = F[101 + so], per = F[202 + er], pin = F[303 + inc], pre = F[404 + re];
        fv[0] = pw; fv[1] = pso; fv[2] = per; fv[3] = pin; fv[4] = pre;
        const m1 = lexKey(Lv1, fv, pen), m2 = lexKey(Lv2, fv, pen), mb = fa * (mt(pw, pso, per, pin, pre, w1) - pen) + fb * (mt(pw, pso, per, pin, pre, w2) - pen);
        if (m1 > BM[inc]) { BM[inc] = m1; const q = inc * 8; BR[q] = L; for (let i = 0; i < L; i++) BR[q + 1 + i] = y[i]; }
        if (m2 > BM[101 + inc]) { BM[101 + inc] = m2; const q = (101 + inc) * 8; BR[q] = L; for (let i = 0; i < L; i++) BR[q + 1 + i] = y[i]; }
        if (mb > BM[202 + inc]) { BM[202 + inc] = mb; const q = (202 + inc) * 8; BR[q] = L; for (let i = 0; i < L; i++) BR[q + 1 + i] = y[i]; }
      };
      const rec = (L, p, a, b, dd, e, f, cash, fg, mask) => {
        if (p === L) {
          const i0 = (y[L - 1] * NT + y[0]) * NT + y[1 % L], i1 = (y[L > 1 ? L - 2 : 0] * NT + y[L - 1]) * NT + y[0];
          if (L === 1) leaf(1, a + SO[i0], b + ER[i0], dd + IN[i0], e + WA[i0], f + RE[i0], cash + CA[i0], fg, mask);
          else leaf(L, a + SO[i0] + SO[i1], b + ER[i0] + ER[i1], dd + IN[i0] + IN[i1], e + WA[i0] + WA[i1], f + RE[i0] + RE[i1], cash + CA[i0] + CA[i1], fg, mask);
        }
        if (L === maxLen) return;
        for (let t = y[L - p]; t < NT; t++) {
          y[L] = t; const np = t === y[L - p] ? p : L + 1;
          if (L >= 2) { const q = (y[L - 2] * NT + y[L - 1]) * NT + t; rec(L + 1, np, a + SO[q], b + ER[q], dd + IN[q], e + WA[q], f + RE[q], cash + CA[q], fg | fl[t], mask + cb[t]); }
          else rec(L + 1, np, a, b, dd, e, f, cash, fg | fl[t], mask + cb[t]);
        }
      };
      const J = {
        total: n3, done: 0, finished: false, result: null,
        step(ms) {
          const t0 = Date.now();
          if (stage === 0) {
            while (ti < n3) {
              const n = ti % NT, c = ((ti - n) / NT) % NT, p = (ti - n - c * NT) / (NT * NT), v = year(T[p], T[c], T[n], cfg.o);
              SO[ti] = Q(v.soil); ER[ti] = Q(v.eros); IN[ti] = Q(v.inc); WA[ti] = v.cash ? Q(v.water) : 0; RE[ti] = v.cash ? Q(v.res) : 0; CA[ti] = v.cash; ti++;
              if ((ti & 15) === 0 && Date.now() - t0 > ms) break;
            }
            J.done = ti; if (ti >= n3) stage = 1; return false;
          }
          if (stage === 1) {
            while (y0 < NT) {
              y[0] = y0;
              if (y1 === y0) { const q = (y0 * NT + y0) * NT + y0; leaf(1, SO[q], ER[q], IN[q], WA[q], RE[q], CA[q], fl[y0], cb[y0]); if (maxLen > 1) { y[1] = y0; rec(2, 1, 0, 0, 0, 0, 0, 0, fl[y0], cb[y0] + cb[y0]); } }
              else if (maxLen > 1) { y[1] = y1; rec(2, 2, 0, 0, 0, 0, 0, 0, fl[y0] | fl[y1], cb[y0] + cb[y1]); }
              y1++; if (y1 >= NT) { y0++; y1 = y0; }
              if (Date.now() - t0 > ms) break;
            }
            J.bf = (pass + y0 / NT) / 2; if (y0 < NT) return false;
            if (pass === 0) { for (let k = 0; k < 5; k++) { let below = 0; for (let v = 0; v <= 100; v++) { const h = H[k * 101 + v]; F[k * 101 + v] = count ? (below + h / 2) / count * 100 : 0; below += h; } } pass = 1; y0 = 0; y1 = 0; return false; }
            stage = 2;
          }
          J.result = choose(T, BM, BR, -1); J.result.BM = BM; J.result.BR = BR; J.result.T = T; J.result.maxInc = maxInc; J.result.count = count; J.result.F = F; J.finished = true; return true;
        }
      };
      return J;
    }
    return { score, money, job, within, rank, rankRaw, levels, lexKey, year, ci, canCv, sims };
  }

  const API = { ECON, COVER_COST, CROPINFO, EXPERIMENTAL, experimental, needs, ACCEPT, adjust, planner, RULES, parseConstraints, plan, qc, confidence, MODELS, projections, IPCC, inputLevel, carbonIPCC, calibrate, errors, calFor, withPatch, ndviYears, corr, oracle, rainChange, pack, unpack, fromIssues, summarise, SCEN, INFO, strategies, run, extra, parseFarm, compareFarm, doyOf, credits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.Lab = API;
})(typeof window !== 'undefined' ? window : globalThis);
