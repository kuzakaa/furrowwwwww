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

  function run(raw, inp) {
    const res = {};
    SCEN.forEach(sc => {
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
    list.forEach(s => { const v = SCEN.map(sc => s.byScen[sc.id]); s.worst = Math.min.apply(null, v); s.spread = Math.max.apply(null, v) - s.worst; });
    const winners = {}; SCEN.forEach(sc => { winners[sc.id] = list.slice().sort((a, b) => b.byScen[sc.id] - a.byScen[sc.id])[0].id; });
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

  const API = { SCEN, INFO, strategies, run, extra, parseFarm, compareFarm, doyOf, credits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.Lab = API;
})(typeof window !== 'undefined' ? window : globalThis);
