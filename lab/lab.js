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
      if (sc.id === 'base') { res.cl = cl; res.cal = cal; res.list = strategies(inp.rot, cal, inp.till); }
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

  const IPCC = {
    till: { conv: { dry: 1, moist: 1 }, reduced: { dry: 1.02, moist: 1.08 }, notill: { dry: 1.1, moist: 1.15 } },
    input: { low: { dry: 0.95, moist: 0.92 }, medium: { dry: 1, moist: 1 }, high: { dry: 1.04, moist: 1.11 } }
  };
  function inputLevel(rot) {
    const n = rot.length, cov = rot.filter(r => r.cv).length, per = rot.filter(r => C[r.c] && C[r.c].kind === 'perennial').length, fal = rot.filter(r => r.c === 'fallow').length;
    if (fal / n >= 0.5) return 'low';
    if ((cov + per) / n >= 0.5) return 'high';
    return 'medium';
  }
  function carbonIPCC(s, base, soc0, moist) {
    const w = moist ? 'moist' : 'dry', f = x => IPCC.till[x.till][w] * IPCC.input[inputLevel(x.rot)][w];
    const ratio = f(s) / f(base), stock20 = soc0 * ratio;
    return { level: inputLevel(s.rot), ratio, perYear: (stock20 - soc0) / 20, after20: stock20 };
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

  const API = { MODELS, projections, IPCC, inputLevel, carbonIPCC, calibrate, errors, calFor, withPatch, ndviYears, corr, oracle, rainChange, pack, unpack, fromIssues, summarise, SCEN, INFO, strategies, run, extra, parseFarm, compareFarm, doyOf, credits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.Lab = API;
})(typeof window !== 'undefined' ? window : globalThis);
