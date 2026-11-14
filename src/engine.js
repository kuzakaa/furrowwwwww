
(function (G) {
  'use strict';
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clip = (x, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x));
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quant = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };

  const CROPS = {
    corn: { name: 'Corn (maize)', short: 'Corn', fam: 'Grass', kind: 'summer', base: 10, gdd: 1500, off: 15, dry: 28, kc: [0.3, 1.2, 0.5], heatT: 35, heatW: [0.45, 0.65], nfix: 0, res: 5, deep: 0, dt: 2, margin: 4, market: 5, forage: 0 },
    soy: { name: 'Soybean', short: 'Soybean', fam: 'Legume', kind: 'summer', base: 10, gdd: 1450, off: 26, dry: 18, kc: [0.4, 1.15, 0.5], heatT: 36, heatW: [0.5, 0.8], nfix: 45, res: 2, deep: 0, dt: 3, margin: 4, market: 5, forage: 0 },
    sorghum: { name: 'Grain sorghum', short: 'Sorghum', fam: 'Grass', kind: 'summer', base: 10, gdd: 1250, off: 30, dry: 20, kc: [0.3, 1.05, 0.55], heatT: 38, heatW: [0.45, 0.65], nfix: 0, res: 4, deep: 1, dt: 5, margin: 3, market: 3, forage: 1 },
    sunflower: { name: 'Sunflower', short: 'Sunflower', fam: 'Aster', kind: 'summer', base: 6.7, gdd: 1650, off: 15, dry: 20, kc: [0.35, 1.1, 0.35], heatT: 34, heatW: [0.45, 0.65], nfix: 0, res: 2, deep: 1, dt: 4, margin: 3, market: 3, forage: 0 },
    oats: { name: 'Spring oats', short: 'Oats', fam: 'Grass', kind: 'summer', base: 0, gdd: 1400, off: -25, dry: 7, kc: [0.3, 1.15, 0.25], heatT: 30, heatW: [0.6, 0.9], nfix: 0, res: 3, deep: 0, dt: 2, margin: 2, market: 3, forage: 1 },
    pea: { name: 'Field pea', short: 'Field pea', fam: 'Legume', kind: 'summer', base: 4.4, gdd: 1000, off: -20, dry: 7, kc: [0.4, 1.15, 0.3], heatT: 28, heatW: [0.5, 0.8], nfix: 60, res: 2, deep: 0, dt: 3, margin: 3, market: 3, forage: 0 },
    wheat: { name: 'Winter wheat', short: 'Winter wheat', fam: 'Grass', kind: 'winter', gdd: 1700, lead: 22, kc: [0.45, 1.15, 0.3], heatT: 32, nfix: 0, res: 4, deep: 0, dt: 4, margin: 3, market: 5, forage: 0, kill: -30 },
    canola: { name: 'Winter canola', short: 'Canola', fam: 'Brassica', kind: 'winter', gdd: 1450, lead: 40, kc: [0.45, 1.1, 0.35], heatT: 30, nfix: 0, res: 2, deep: 1, dt: 3, margin: 3, market: 3, forage: 0, kill: -20 },
    alfalfa: { name: 'Alfalfa', short: 'Alfalfa', fam: 'Legume', kind: 'perennial', kc: [0.4, 0.95, 0.9], nfix: 60, res: 3, deep: 1, dt: 4, margin: 3, market: 3, forage: 1, kill: -32 },
    fallow: { name: 'Fallow (no crop)', short: 'Fallow', fam: '-', kind: 'fallow', nfix: 0, res: 0, deep: 0, dt: 3, margin: 0, market: 5, forage: 0 }
  };
  const COVERS = {
    rye: { name: 'Cereal rye cover crop', short: 'rye cover', fam: 'Grass', nfix: 0, cost: 0.35 },
    legmix: { name: 'Vetch or clover with oats cover mix', short: 'legume cover mix', fam: 'Legume', nfix: 50, cost: 0.5 }
  };
  const SOILS = {
    sand: { name: 'Sand', awc: 70 }, sandy_loam: { name: 'Sandy loam', awc: 120 }, loam: { name: 'Loam', awc: 170 },
    silt_loam: { name: 'Silt loam', awc: 200 }, clay_loam: { name: 'Clay loam', awc: 160 }, clay: { name: 'Clay', awc: 140 }
  };
  const SLOPES = { flat: { name: 'Flat, under 2%', f: 0.5 }, gentle: { name: 'Gentle, 2 to 6%', f: 1 }, steep: { name: 'Steep, over 6%', f: 2 } };
  const TILLAGE = { conv: { name: 'Conventional tillage', res: 0.25 }, reduced: { name: 'Reduced tillage', res: 0.6 }, notill: { name: 'No-till', res: 1 } };

  function parsePower(json) {
    const p = json.properties.parameter;
    const keys = Object.keys(p.T2M_MAX).sort().filter(k => k.slice(4) !== '0229');
    const n = keys.length - (keys.length % 365);
    const out = { y0: +keys[0].slice(0, 4), n, tx: new Array(n), tn: new Array(n), pr: new Array(n), gw: new Array(n) };
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      out.tx[i] = p.T2M_MAX[k]; out.tn[i] = p.T2M_MIN[k]; out.pr[i] = p.PRECTOTCORR[k];
      out.gw[i] = p.GWETROOT ? p.GWETROOT[k] : -999;
    }
    return out;
  }

  function parseExtra(json) {
    const p = json.properties.parameter;
    const keys = Object.keys(p.ALLSKY_SFC_SW_DWN).sort().filter(k => k.slice(4) !== '0229');
    const n = keys.length - (keys.length % 365), g = json.geometry && json.geometry.coordinates, ks = keys.slice(0, n);
    return { n, elev: g && isFinite(g[2]) && g[2] > -500 ? g[2] : 0, rs: ks.map(k => p.ALLSKY_SFC_SW_DWN[k]), ws: ks.map(k => p.WS2M[k]), rh: ks.map(k => p.RH2M[k]) };
  }
  const e0 = t => 0.6108 * Math.exp(17.27 * t / (t + 237.3));
  function et0PM(tx, tn, rs, u2, ea, raMJ, z) {
    const tm = (tx + tn) / 2, es = (e0(tx) + e0(tn)) / 2, D = 4098 * e0(tm) / Math.pow(tm + 237.3, 2);
    const P = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26), g = 0.000665 * P, rso = (0.75 + 2e-5 * z) * raMJ, rr = rso > 0 ? clip(rs / rso, 0.3, 1) : 0.5;
    const rnl = 4.903e-9 * ((Math.pow(tx + 273.16, 4) + Math.pow(tn + 273.16, 4)) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * rr - 0.35), rn = 0.77 * rs - rnl;
    return Math.max(0, (0.408 * D * rn + g * 900 / (tm + 273) * u2 * Math.max(0, es - ea)) / (D + g * (1 + 0.34 * u2)));
  }
  function raMm(latDeg, doy) {
    const phi = latDeg * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
    const dl = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
    const ws = Math.acos(clip(-Math.tan(phi) * Math.tan(dl), -1, 1));
    const ra = (24 * 60 / Math.PI) * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dl) + Math.cos(phi) * Math.cos(dl) * Math.sin(ws));
    return Math.max(0, ra * 0.408);
  }

  function trend(v) {
    const n = v.length, sl = []; let s = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { sl.push((v[j] - v[i]) / (j - i)); s += Math.sign(v[j] - v[i]); }
    const varS = n * (n - 1) * (2 * n + 5) / 18;
    const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
    const az = Math.abs(z);
    return { perDecade: median(sl) * 10, z, label: az > 1.96 ? 'clear trend' : az > 1.28 ? 'possible trend' : 'no clear trend' };
  }

  function buildClimate(raw, lat, scen) {
    scen = scen || { rain: 0, temp: 0 };
    const south = lat < 0, off = south ? 182 : 0;
    const nY = Math.floor((raw.n - off) / 365), years = [];
    const dT = scen.temp || 0, pf = 1 + (scen.rain || 0) / 100;
    const bad = v => v === undefined || v === null || v < -900;
    for (let k = 0; k < nY; k++) {
      const Y = { label: south ? (raw.y0 + k) + '/' + String(raw.y0 + k + 1).slice(2) : String(raw.y0 + k), tx: new Float32Array(365), tn: new Float32Array(365), pr: new Float32Array(365), gw: new Float32Array(365), et0: new Float32Array(365) };
      for (let d = 0; d < 365; d++) {
        const i = k * 365 + off + d;
        Y.tx[d] = bad(raw.tx[i]) ? NaN : raw.tx[i] + dT; Y.tn[d] = bad(raw.tn[i]) ? NaN : raw.tn[i] + dT;
        Y.pr[d] = bad(raw.pr[i]) ? NaN : raw.pr[i] * pf; Y.gw[d] = bad(raw.gw[i]) ? NaN : raw.gw[i];
      }
      years.push(Y);
    }

    for (const key of ['tx', 'tn', 'pr', 'gw']) {
      for (let d = 0; d < 365; d++) {
        let s = 0, c = 0; for (const Y of years) if (!isNaN(Y[key][d])) { s += Y[key][d]; c++; }
        const m = c ? s / c : NaN; for (const Y of years) if (isNaN(Y[key][d])) Y[key][d] = m;
      }
    }
    const hasGw = !isNaN(years[0].gw[0]), ex = raw.ex && raw.ex.n >= raw.n ? raw.ex : null; let pmDays = 0, yk = -1;
    for (const Y of years) {
      yk++;
      for (let d = 0; d < 365; d++) {
        const tm = (Y.tx[d] + Y.tn[d]) / 2, doy = ((d + off) % 365) + 1, ra = raMm(lat, doy), i = yk * 365 + off + d;
        const rs = ex ? ex.rs[i] : -999, ws = ex ? ex.ws[i] : -999, rh = ex ? ex.rh[i] : -999;
        if (ex && rs > 0 && ws >= 0 && rh > 0 && rh <= 100) { Y.et0[d] = et0PM(Y.tx[d], Y.tn[d], rs, ws, rh / 100 * (e0(Y.tx[d]) + e0(Y.tn[d])) / 2, ra / 0.408, ex.elev); pmDays++; }
        else Y.et0[d] = Math.max(0, 0.0023 * (tm + 17.8) * Math.sqrt(Math.max(0, Y.tx[d] - Y.tn[d])) * ra);
      }
      let lf = -1, ff = -1, kf = -1, hot35 = 0, hot32 = 0, heavy = 0, rain = 0, et = 0, wr = 0, we = 0, dry = 0, run = 0, tmin = 99;
      Y.mRain = new Array(12).fill(0); Y.mEt0 = new Array(12).fill(0); Y.mEros = new Array(12).fill(0); Y.mGw = new Array(12).fill(0); Y.mHeavy = new Array(12).fill(0);
      for (let d = 0, m = 0; d < 365; d++) {
        while (d >= CUM[m + 1]) m++;
        const p = Y.pr[d];
        rain += p; et += Y.et0[d]; Y.mRain[m] += p; Y.mEt0[m] += Y.et0[d]; Y.mGw[m] += Y.gw[d] / (CUM[m + 1] - CUM[m]);
        if (p >= 12.7) Y.mEros[m] += p; if (p >= 25) { heavy++; Y.mHeavy[m]++; }
        if (Y.tx[d] >= 35) hot35++; if (Y.tx[d] >= 32) hot32++;
        if (Y.tn[d] < tmin) tmin = Y.tn[d];
        if (Y.tn[d] <= 0) { if (d < 181) lf = d; else if (ff < 0) ff = d; }
        if (Y.tn[d] <= -2 && d >= 181 && kf < 0) kf = d;
        if (d >= 90 && d <= 272) { wr += p; we += Y.et0[d]; if (p < 1) { run++; if (run > dry) dry = run; } else run = 0; }
      }
      Object.assign(Y, { rain, et: et, lastFrost: lf, firstFrost: ff, killFrost: kf < 0 ? 349 : kf, hot35, hot32, heavy, wRain: wr, wEt0: we, drySpell: dry, tmin, frostFree: (lf >= 0 && ff >= 0) ? ff - lf : 365 });
    }

    const cl = { lat, south, off, years, hasGw, n: years.length, pmShare: pmDays / (years.length * 365), elev: ex ? ex.elev : null };
    const avg = key => { const a = new Float32Array(365); for (const Y of years) for (let d = 0; d < 365; d++) a[d] += Y[key][d] / years.length; return a; };
    const smooth = (a, w) => { const o = new Float32Array(365); for (let d = 0; d < 365; d++) { let s = 0; for (let j = -w; j <= w; j++) s += a[(d + j + 365) % 365]; o[d] = s / (2 * w + 1); } return o; };
    cl.tx = smooth(avg('tx'), 7); cl.tn = smooth(avg('tn'), 7); cl.tm = new Float32Array(365);
    for (let d = 0; d < 365; d++) cl.tm[d] = (cl.tx[d] + cl.tn[d]) / 2;
    cl.pr = avg('pr'); cl.et0 = smooth(avg('et0'), 3);
    const er = new Float32Array(365); for (const Y of years) for (let d = 0; d < 365; d++) if (Y.pr[d] >= 12.7) er[d] += Y.pr[d] / years.length;
    cl.eros = smooth(er, 15); cl.erosTotal = cl.eros.reduce((s, v) => s + v, 0);
    for (const k of ['mRain', 'mEt0', 'mEros', 'mGw', 'mHeavy']) cl[k] = Array.from({ length: 12 }, (_, m) => mean(years.map(Y => Y[k][m])));
    const lfs = years.filter(Y => Y.lastFrost >= 0).map(Y => Y.lastFrost), ffs = years.filter(Y => Y.firstFrost >= 0).map(Y => Y.firstFrost);
    cl.frostFrac = Math.min(lfs.length, ffs.length) / years.length;
    cl.noFrost = cl.frostFrac < 0.5;
    cl.lastFrost = cl.noFrost ? 45 : Math.round(median(lfs));
    cl.firstFrost = cl.noFrost ? 349 : Math.round(median(ffs));
    cl.monthName = m => MON[(m + (south ? 6 : 0)) % 12];
    cl.fmtDay = d => { const a = ((Math.round(d) + off) % 365 + 365) % 365; let m = 0; while (a >= CUM[m + 1]) m++; return MON[m] + ' ' + (a - CUM[m] + 1); };

    if (hasGw) {
      cl.gwAnom = years.map(Y => Y.mGw.map((v, m) => { const col = years.map(X => X.mGw[m]); const mu = mean(col), sd = Math.sqrt(mean(col.map(x => (x - mu) ** 2))) || 1; return (v - mu) / sd; }));
    }
    const ind = (key, name, unit, digits, note) => ({ key, name, unit, digits, note, series: years.map(Y => Y[key]), mean: mean(years.map(Y => Y[key])), lo: quant(years.map(Y => Y[key]), 0.1), hi: quant(years.map(Y => Y[key]), 0.9), trend: trend(years.map(Y => Y[key])) });
    cl.indicators = [
      ind('rain', 'Rain and snow per year', 'mm', 0, 'Total precipitation.'),
      ind('et', 'Evaporative demand per year', 'mm', 0, 'Reference evapotranspiration (ET0): the water a well-watered grass surface would use.'),
      ind('hot35', 'Days at 35 °C or hotter', 'days', 1, 'Heat that damages most crops at flowering.'),
      ind('heavy', 'Heavy-rain days (25 mm or more)', 'days', 1, 'Days wet enough to drive runoff. A daily total, not a measured storm intensity.'),
      ind('drySpell', 'Longest dry spell, warm half of year', 'days', 0, 'Consecutive days with under 1 mm of rain.'),
      ind('frostFree', 'Frost-free season', 'days', 0, 'Days between the last spring frost and the first autumn frost.')
    ];
    cl.yearTypes = yearTypes(years);
    return cl;
  }

  function yearTypes(years) {
    const n = years.length; if (n < 9) return null;
    const F = years.map(Y => [Y.wRain, Y.wEt0, Y.hot32]);
    const mu = [0, 1, 2].map(j => mean(F.map(f => f[j]))), sd = [0, 1, 2].map(j => Math.sqrt(mean(F.map(f => (f[j] - mu[j]) ** 2))) || 1);
    const Z = F.map(f => f.map((v, j) => (v - mu[j]) / sd[j]));
    const order = years.map((Y, i) => i).sort((a, b) => (Z[a][0] - Z[a][1]) - (Z[b][0] - Z[b][1]));
    let cen = [1 / 6, 3 / 6, 5 / 6].map(q => Z[order[Math.floor(q * n)]].slice());
    let asg = new Array(n).fill(0);
    for (let it = 0; it < 30; it++) {
      asg = Z.map(z => { let b = 0, bd = 1e9; cen.forEach((c, k) => { const dd = c.reduce((s, v, j) => s + (v - z[j]) ** 2, 0); if (dd < bd) { bd = dd; b = k; } }); return b; });
      cen = cen.map((c, k) => { const mem = Z.filter((_, i) => asg[i] === k); return mem.length ? [0, 1, 2].map(j => mean(mem.map(m => m[j]))) : c; });
    }
    const rule = new Array(n); order.forEach((i, pos) => { rule[i] = pos < n / 3 ? 0 : pos < 2 * n / 3 ? 1 : 2; });
    const sizes = [0, 1, 2].map(k => asg.filter(v => v === k).length), fallback = Math.min.apply(null, sizes) < 3;
    let agree0 = null;
    if (fallback) {
      const rk = [0, 1, 2].sort((a, b) => (cen[a][0] - cen[a][1]) - (cen[b][0] - cen[b][1])), lab0 = asg.map(a => rk.indexOf(a));
      agree0 = lab0.filter((l, i) => l === rule[i]).length; asg = rule.slice();
      cen = [0, 1, 2].map(k => { const mem = Z.filter((_, i) => asg[i] === k); return [0, 1, 2].map(j => mean(mem.map(m => m[j]))); });
    }
    const rank = [0, 1, 2].sort((a, b) => (cen[a][0] - cen[a][1]) - (cen[b][0] - cen[b][1]));
    const names = ['Hot, dry years', 'Typical years', 'Cool, wet years'], half = Math.floor(n / 2);
    const types = rank.map((k, r) => {
      const idx = years.map((_, i) => i).filter(i => asg[i] === k);
      return { name: names[r], idx, count: idx.length, early: idx.filter(i => i < half).length, late: idx.filter(i => i >= half).length, rain: mean(idx.map(i => years[i].wRain)), et0: mean(idx.map(i => years[i].wEt0)), hot: mean(idx.map(i => years[i].hot32)), labels: idx.map(i => years[i].label) };
    }).filter(t => t.count > 0);
    const lab = new Array(n); rank.forEach((k, r) => asg.forEach((a, i) => { if (a === k) lab[i] = r; }));
    const agree = fallback ? agree0 : lab.filter((l, i) => l === rule[i]).length;
    return { types, half, agree, fallback, firstLabel: years[0].label, midLabel: years[half].label, lastLabel: years[n - 1].label };
  }

  function gddDay(tx, tn, base) { const hi = clip(tx, base, 30), lo = clip(tn, base, 30); return (hi + lo) / 2 - base; }
  function calendar(cl) {
    const cal = {};
    for (const id in CROPS) {
      const c = CROPS[id];
      if (c.kind === 'summer') {
        const p = clip(cl.lastFrost + c.off, 45, 170), lim = Math.min(349, cl.firstFrost + 14);
        let g = 0, h = -1; for (let d = p; d <= lim; d++) { g += gddDay(cl.tx[d], cl.tn[d], c.base); if (g >= c.gdd) { h = d; break; } }
        cal[id] = { plant: p, mat: h < 0 ? lim : h, harv: Math.min(349, (h < 0 ? lim : h) + c.dry) };

        let ok = 0; for (const Y of cl.years) { let gg = 0; for (let d = p; d <= Y.killFrost; d++) { gg += gddDay(Y.tx[d], Y.tn[d], c.base); if (gg >= c.gdd) { ok++; break; } } }
        cal[id].reliab = ok / cl.n;
      } else if (c.kind === 'winter') {
        const p = clip(cl.firstFrost - c.lead, 243, 318);
        let g = 0, h = 219; for (let d = 0; d < 220; d++) { g += Math.max(0, cl.tm[d]); if (g >= c.gdd) { h = d; break; } }
        let s0 = 0; while (s0 < 120 && cl.tm[s0] < 4) s0++;
        cal[id] = { plant: p, harv: h, spring: s0, reliab: 1 - cl.years.filter(Y => Y.tmin < c.kill).length / cl.n };
      } else if (c.kind === 'perennial') {
        cal[id] = { plant: clip(cl.lastFrost - 10, 45, 150), harv: 300, reliab: 1 - cl.years.filter(Y => Y.tmin < c.kill).length / cl.n };
      }
    }
    return cal;
  }

  function buildTimeline(rot, cl, cal, tillRes) {
    const N = rot.length, T = N * 365, U = t => ((t % T) + T) % T;
    const kc = new Float32Array(T).fill(-1), cov = new Float32Array(T), st = new Uint8Array(T), ci = new Int8Array(T).fill(-1), nxt = new Uint8Array(T), heat = new Float32Array(T), thr = new Float32Array(T).fill(0.55);
    const phases = [], notes = [], allAlf = rot.every(r => r.c === 'alfalfa');
    rot.forEach((r, i) => {
      const c = CROPS[r.c]; if (!c || c.kind === 'fallow') return; const k = cal[r.c]; let s, e;
      if (c.kind === 'summer') { s = i * 365 + k.plant; e = i * 365 + k.harv; }
      else if (c.kind === 'winter') { s = (i - 1) * 365 + k.plant; e = i * 365 + k.harv; }
      else { const pA = N > 1 && rot[(i - 1 + N) % N].c === 'alfalfa', nA = N > 1 && rot[(i + 1) % N].c === 'alfalfa'; s = i * 365 + ((pA || allAlf) ? 0 : k.plant); e = i * 365 + ((nA || allAlf) ? 364 : k.harv); }
      phases.push({ i, id: r.c, c, k, s, e, est: c.kind === 'perennial' && !(N > 1 && rot[(i - 1 + N) % N].c === 'alfalfa') && !allAlf });
    });

    phases.forEach((ph, j) => {
      if (phases.length < 2) return; const prev = phases[(j - 1 + phases.length) % phases.length];
      let pe = prev.e; if (j === 0) pe -= T;
      if (ph.s <= pe + 2) { const delay = pe + 3 - ph.s; ph.s = pe + 3; ph.delay = delay; if (delay > 10) notes.push({ i: ph.i, type: 'late', days: delay, crop: ph.id, after: prev.id }); }
    });
    for (const ph of phases) {
      const c = ph.c, k = ph.k, len = ph.e - ph.s + 1;
      for (let t = ph.s; t <= ph.e; t++) {
        const u = U(t), d = u % 365, f = (t - ph.s) / len; let K, C, H = 0;
        if (c.kind === 'summer') {
          K = f < 0.2 ? c.kc[0] : f < 0.45 ? c.kc[0] + (c.kc[1] - c.kc[0]) * (f - 0.2) / 0.25 : f < 0.8 ? c.kc[1] : c.kc[1] + (c.kc[2] - c.kc[1]) * (f - 0.8) / 0.2;
          C = f < 0.35 ? 0.1 + 0.85 * f / 0.35 : f > 0.9 ? 0.85 : 0.95;
          if (f >= c.heatW[0] && f <= c.heatW[1]) H = c.heatT;
        } else if (c.kind === 'winter') {
          if (t < ph.i * 365) { C = Math.min(0.5, 0.1 + 0.4 * (t - ph.s) / 40); K = cl.tm[d] > 4 ? c.kc[0] : 0.25; nxt[u] = 1; }
          else {
            const g = (d - k.spring) / Math.max(1, k.harv - k.spring);
            if (g < 0) { K = 0.25; C = 0.5; } else if (g < 0.35) { K = c.kc[0] + (c.kc[1] - c.kc[0]) * g / 0.35; C = 0.5 + 0.45 * g / 0.35; }
            else if (g < 0.8) { K = c.kc[1]; C = 0.95; } else { K = c.kc[1] + (c.kc[2] - c.kc[1]) * (g - 0.8) / 0.2; C = 0.9; }
            if (g >= 0.6 && g <= 0.95) H = c.heatT;
          }
        } else {
          const est = ph.est ? Math.min(1, (t - ph.s) / 60) : 1; C = 0.1 + 0.8 * est; K = cl.tm[d] > 5 ? 0.35 + 0.6 * est : 0.3;
        }
        kc[u] = K; cov[u] = C; st[u] = c.kind === 'perennial' ? 4 : 2; ci[u] = ph.i; heat[u] = H; thr[u] = 0.55 - 0.05 * (c.dt - 3);
      }
    }

    for (const ph of phases) {
      const r0 = tillRes * 0.13 * ph.c.res;
      for (let a = 1; a < T; a++) { const u = U(ph.e + a); if (st[u] >= 2) break; const C = r0 * (1 - 0.35 * Math.min(1, a / 200)); cov[u] = C; st[u] = C >= 0.3 ? 1 : 0; kc[u] = 0.25 - 0.1 * C; }
    }
    for (let u = 0; u < T; u++) if (kc[u] < 0) { kc[u] = 0.25; cov[u] = 0.03; st[u] = 0; }

    const covers = [];
    rot.forEach((r, i) => {
      if (!r.cv || !COVERS[r.cv]) return; const ph = phases.find(p => p.i === i); if (!ph) return;
      const start = ph.e + 7; let t = start; while (t - start < T && st[U(t)] < 2) t++;
      const term = t - 14;
      if (term - start < 40) { notes.push({ i, type: 'nocover', cover: r.cv, days: Math.max(0, term - start) }); return; }
      let growth = 0, fallG = 0, inFall = true;
      for (let q = start; q <= term; q++) {
        const u = U(q), d = u % 365, warm = cl.tm[d] > 3; if (warm) growth++;
        if (inFall) { if (cl.tm[d] < 0.5 || (q - start > 150)) inFall = false; else fallG += Math.max(0, cl.tm[d]); }
        cov[u] = Math.max(cov[u], Math.min(0.85, 0.85 * growth / 45)); kc[u] = warm ? 0.3 + 0.5 * Math.min(1, growth / 60) : 0.25; st[u] = 3; thr[u] = 0.5;
      }
      covers.push({ i, id: r.cv, start: U(start) % 365, term: U(term) % 365, days: term - start + 1, growth, fallG });
      if (fallG < 150) notes.push({ i, type: 'thinfall', cover: r.cv, gdd: Math.round(fallG) });
    });
    return { N, T, kc, cov, st, ci, nxt, heat, thr, phases, covers, notes };
  }

  function simulate(rot, cl, cal, inp) {
    const tl = buildTimeline(rot, cl, cal, TILLAGE[inp.till].res);
    const N = tl.N, Yn = cl.n, cap = SOILS[inp.soil].awc * 1.2, slopeF = Math.sqrt(SLOPES[inp.slope].f);
    const dem = Array.from({ length: N }, () => new Float64Array(Yn)), def = Array.from({ length: N }, () => new Float64Array(Yn)), hd = Array.from({ length: N }, () => new Float64Array(Yn));
    const etaY = new Float64Array(Yn), runY = new Float64Array(Yn), drainY = new Float64Array(Yn);
    for (let o = 0; o < N; o++) {
      let S = 0.6 * cap;
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < Yn; k++) {
          const Y = cl.years[k], r = (k + o) % N;
          for (let d = 0; d < 365; d++) {
            const t = r * 365 + d, p = Y.pr[d], c = tl.cov[t];
            const ro = p > 20 ? (p - 20) * 0.4 * (1 - 0.7 * c) * slopeF : 0;
            S += p - ro; const pot = tl.kc[t] * Y.et0[d], eta = pot * Math.min(1, S / (tl.thr[t] * cap)); S = Math.max(0, S - eta);
            let dr = 0; if (S > cap) { dr = S - cap; S = cap; }
            if (pass) {
              etaY[k] += eta / N; runY[k] += ro / N; drainY[k] += dr / N;
              const i = tl.ci[t];
              if (i >= 0) { const ka = Math.min(Yn - 1, k + tl.nxt[t]); dem[i][ka] += pot; def[i][ka] += pot - eta; if (tl.heat[t] > 0 && Y.tx[d] >= tl.heat[t]) hd[i][ka]++; }
            }
          }
        }
      }
    }

    const crops = [];
    rot.forEach((r, i) => {
      const c = CROPS[r.c]; if (!c || c.kind === 'fallow') { crops.push({ i, id: r.c, fallow: true, rel: new Array(Yn).fill(0), hdY: new Array(Yn).fill(0), defY: new Array(Yn).fill(0), relMean: 0, stress: 0, heat: 0, defMm: 0, demMm: 0, reliab: 1 }); return; }
      const rel = Array.from(dem[i], (v, k) => v > 0 ? def[i][k] / v : 0);
      crops.push({ i, id: r.c, rel, hdY: Array.from(hd[i]), defY: Array.from(def[i]), relMean: mean(rel), stress: rel.filter(v => v > 0.25).length / Yn, heat: mean(Array.from(hd[i])), defMm: mean(Array.from(def[i])), demMm: mean(Array.from(dem[i])), reliab: cal[r.c].reliab });
    });
    const cash = crops.filter(c => !c.fallow);
    let bare = 0, resid = 0, living = 0, coverDays = 0, exp = 0, bareEros = 0;
    for (let t = 0; t < tl.T; t++) { const s = tl.st[t], e = cl.eros[t % 365]; if (s === 0) { bare++; bareEros += e; } else if (s === 1) resid++; else { living++; if (s === 3) coverDays++; } exp += e * (1 - tl.cov[t]); }
    const fams = new Set(cash.map(c => CROPS[c.id].fam)); tl.covers.forEach(cv => fams.add(COVERS[cv.id].fam + ' cover'));
    const nfix = (cash.reduce((s, c) => s + CROPS[c.id].nfix, 0) + tl.covers.reduce((s, cv) => s + COVERS[cv.id].nfix * Math.min(1, cv.growth / 90), 0)) / N;
    let run = 1, best = 1; const seq = rot.map(r => CROPS[r.c] ? CROPS[r.c].fam : '-');
    if (N === 1) best = 9; else for (let j = 1; j < 2 * N; j++) { if (seq[j % N] === seq[(j - 1) % N] && seq[j % N] !== '-') { run++; best = Math.max(best, run); } else run = 1; }
    const relByYear = Array.from({ length: Yn }, (_, k) => cash.length ? mean(cash.map(c => c.rel[k])) : 0);
    const m = {
      bare: bare / N, resid: resid / N, living: living / N, coverDays: coverDays / N,
      exposed: exp / N, exposedShare: cl.erosTotal > 0 ? exp / N / cl.erosTotal : 0, bareErosShare: cl.erosTotal > 0 ? bareEros / N / cl.erosTotal : 0,
      nfix, fams: fams.size, famRun: best, deep: cash.some(c => CROPS[c.id].deep),
      resAvg: mean(rot.map(r => CROPS[r.c] ? CROPS[r.c].res : 0)),
      relMean: cash.length ? mean(cash.map(c => c.relMean)) : 0, stress: cash.length ? mean(cash.map(c => c.stress)) : 0,
      heat: cash.length ? mean(cash.map(c => c.heat)) : 0, reliab: cash.length ? mean(cash.map(c => c.reliab)) : 1,
      irrig: mean(crops.map(c => c.defMm)), eta: mean(Array.from(etaY)), runoff: mean(Array.from(runY)), drain: mean(Array.from(drainY)),
      relByYear, relLo: quant(relByYear, 0.1), relHi: quant(relByYear, 0.9),
      seasons: (cash.some(c => CROPS[c.id].kind === 'winter') ? 1 : 0) + (cash.some(c => CROPS[c.id].kind === 'summer') ? 1 : 0) + (cash.some(c => CROPS[c.id].kind === 'perennial') ? 1 : 0)
    };

    const sc = scoreSet({ rot, crops, m, tl }, inp);
    return { rot, tl, crops, m, sc };
  }
  function scoreSet(R, inp, idx) {
    const rot = R.rot, m = R.m, tl = R.tl, pick = a => idx ? idx.map(i => a[i]) : a;
    const cs = R.crops.map(c => { const rel = pick(c.rel); return { fallow: c.fallow, reliab: c.reliab, rel: mean(rel), stress: rel.filter(v => v > 0.25).length / rel.length, heat: mean(pick(c.hdY)), def: mean(pick(c.defY)) }; });
    const cash = cs.filter(c => !c.fallow), relMean = cash.length ? mean(cash.map(c => c.rel)) : 0, stress = cash.length ? mean(cash.map(c => c.stress)) : 0, heat = cash.length ? mean(cash.map(c => c.heat)) : 0, irrig = mean(cs.map(c => c.def));
    const sc = {};
    sc.water = inp.irrigated ? 100 * (1 - clip(irrig / 450)) : 100 * (1 - clip(relMean / 0.45));
    sc.soil = 35 * m.living / 365 + 15 * clip(m.nfix / 60) + 15 * m.resAvg / 5 + 15 * clip((m.fams - 1) / 3) + 10 * (m.deep ? 1 : 0) + 10 * (1 - m.bare / 365);
    sc.erosion = 100 * (1 - m.exposedShare);
    sc.resilience = 100 * (0.35 * (1 - clip(stress)) + 0.2 * (1 - clip(heat / 10)) + 0.2 * m.reliab + 0.15 * clip((m.fams - 1) / 2) + 0.1 * clip(m.seasons / 2));
    let inc = 0; rot.forEach((r, i) => {
      const c = CROPS[r.c], cr = cs[i]; if (!c) return;
      const water = inp.irrigated ? 1 : 1 - 0.8 * clip(cr.rel / 0.6);
      inc += c.margin * (c.market / 5) * water * (0.5 + 0.5 * cr.reliab) + (inp.livestock && c.forage ? 1 : 0);
      if (r.cv && tl.covers.some(cv => cv.i === i)) inc -= COVERS[r.cv].cost - (inp.livestock ? 0.3 : 0);
    });
    sc.income = clip(inc / rot.length / 4.2) * 100;
    for (const k in sc) sc[k] = Math.round(clip(sc[k], 0, 100));
    return sc;
  }
  function bootstrap(cur, list, inp, n) {
    let seed = 20261114; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, B = 300, diff = list.map(() => []);
    for (let b = 0; b < B; b++) {
      const idx = Array.from({ length: n }, () => Math.floor(rnd() * n)), mc = match(scoreSet(cur, inp, idx), inp.weights);
      list.forEach((s, j) => diff[j].push(match(scoreSet(s, inp, idx), inp.weights) - mc));
    }
    list.forEach((s, j) => { s.boot = { win: diff[j].filter(d => d > 0).length / B, lo: quant(diff[j], 0.1), hi: quant(diff[j], 0.9), runs: B }; });
  }
  function terrain(z, step) {
    const N = Math.round(Math.sqrt(z.length)), at = (r, c) => z[r * N + c], slopes = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const c0 = Math.max(0, c - 1), c1 = Math.min(N - 1, c + 1), r0 = Math.max(0, r - 1), r1 = Math.min(N - 1, r + 1);
      const dx = (at(r, c1) - at(r, c0)) / ((c1 - c0) * step), dy = (at(r1, c) - at(r0, c)) / ((r1 - r0) * step);
      slopes.push(100 * Math.sqrt(dx * dx + dy * dy));
    }
    const mu = mean(z), cut = quant(z, 0.15), low = z.map(v => v <= cut && v <= mu - 2), typ = median(slopes);
    return { n: N, step, z, slopes, low, min: Math.min.apply(null, z), max: Math.max.apply(null, z), typical: typ, steepest: Math.max.apply(null, slopes), steepCells: slopes.filter(v => v > 6).length, lowCells: low.filter(Boolean).length, cls: quant(slopes, 0.75) > 6 ? 'steep' : quant(slopes, 0.75) >= 2 ? 'gentle' : 'flat' };
  }
  function textureClass(sand, clay) {
    const silt = 100 - sand - clay;
    if (clay >= 40) return 'clay'; if (clay >= 27) return 'clay_loam'; if (sand >= 85) return 'sand';
    if (sand >= 52 && clay < 20) return 'sandy_loam'; if (silt >= 50) return 'silt_loam'; return 'loam';
  }
  function match(sc, w) { const ks = ['water', 'soil', 'erosion', 'income', 'resilience']; const tw = ks.reduce((s, k) => s + (w[k] || 0), 0); return tw ? ks.reduce((s, k) => s + sc[k] * (w[k] || 0), 0) / tw : mean(ks.map(k => sc[k])); }

  function rotLabel(rot) { return rot.map(r => CROPS[r.c].short + (r.cv ? ' + ' + COVERS[r.cv].short : '')).join(', then '); }
  function candidates(cur, curRes, cal, inp) {
    const ex = inp.exclude || new Set(), ok = id => !ex.has(id), has = id => cur.some(r => r.c === id), out = [];
    const cp = rot => rot.map(r => ({ c: r.c, cv: r.cv || null }));
    const pickCover = r => { const c = CROPS[r.c]; const early = c.kind === 'winter' || (cal[r.c] && cal[r.c].harv < 235); const want = early ? 'legmix' : 'rye'; return ok(want) ? want : ok('rye') ? 'rye' : ok('legmix') ? 'legmix' : null; };
    const withCover = rot => rot.map(r => (CROPS[r.c].kind === 'summer' || CROPS[r.c].kind === 'winter') && !r.cv ? { c: r.c, cv: pickCover(r) } : r);
    const push = (id, name, tag, rot, extra) => { if (JSON.stringify(rot) !== JSON.stringify(cp(cur))) out.push(Object.assign({ id, name, tag, rot }, extra || {})); };

    if (ok('rye') || ok('legmix')) push('cover', 'Keep the crops, cover the gaps', 'Same cash crops, with a cover crop wherever the soil sits empty', withCover(cp(cur)));

    const hasSmall = has('wheat') || has('oats');
    const grain = ok('wheat') && cal.wheat.reliab >= 0.7 ? 'wheat' : ok('oats') ? 'oats' : null;
    if (!hasSmall && grain) {
      const r = cp(cur); let at = r.findIndex(x => x.c === 'soy'); at = at < 0 ? r.length : at + 1;
      r.splice(at, 0, { c: grain, cv: ok('legmix') ? 'legmix' : null });
      push('smallgrain', 'Add a small-grain year', 'One more year in the rotation, with ' + CROPS[grain].short.toLowerCase() + ' and a summer-sown cover', r, { grain });
      push('diverse', 'Longer rotation with covers', 'A small-grain year plus cover crops after every cash crop', withCover(cp(r)), { grain });
    }

    const swap = { corn: 'sorghum', soy: 'sunflower', oats: 'sorghum', pea: 'sunflower' };
    const worst = curRes.crops.filter(c => swap[c.id] && ok(swap[c.id]) && !has(swap[c.id])).sort((a, b) => (b.relMean + b.heat / 30) - (a.relMean + a.heat / 30))[0];
    if (worst) { const r = cp(cur); r[worst.i] = { c: swap[worst.id], cv: r[worst.i].cv }; push('drought', 'Swap in a drought-hardy crop', CROPS[swap[worst.id]].short + ' takes the place of ' + CROPS[worst.id].short.toLowerCase(), r, { from: worst.id, to: swap[worst.id] }); }

    const leg = ok('soy') && cal.soy.reliab >= 0.8 ? 'soy' : ok('pea') ? 'pea' : null;
    const fi = cur.findIndex(r => r.c === 'fallow');
    if (fi >= 0) { const repl = ok('pea') ? 'pea' : ok('sorghum') ? 'sorghum' : null; if (repl) { const r = cp(cur); r[fi] = { c: repl, cv: null }; push('nofallow', 'Grow a crop instead of fallow', CROPS[repl].short + ' replaces the fallow year', r, { to: repl }); } }
    else if (leg && !cur.some(r => CROPS[r.c].fam === 'Legume')) { const r = cp(cur); r.push({ c: leg, cv: null }); push('legume', 'Add a legume year', CROPS[leg].short + ' joins the rotation to fix nitrogen and break pest cycles', r, { to: leg }); }

    if (ok('alfalfa') && !has('alfalfa') && cal.alfalfa.reliab >= 0.7) push('forage', 'Add a two-year forage phase', 'Two years of alfalfa after the cash crops', cp(cur).filter(r => r.c !== 'fallow').concat([{ c: 'alfalfa', cv: null }, { c: 'alfalfa', cv: null }]));
    return out;
  }

  function analyse(raw, inp) {
    const cl = buildClimate(raw, inp.lat, inp.scen), cal = calendar(cl);
    const cur = simulate(inp.rot, cl, cal, inp);
    const cands = candidates(inp.rot, cur, cal, inp).map(c => Object.assign(c, simulate(c.rot, cl, cal, inp)));
    cands.forEach(c => c.match = match(c.sc, inp.weights)); cands.sort((a, b) => b.match - a.match);
    bootstrap(cur, cands, inp, cl.n);
    const current = Object.assign({ id: 'current', name: 'Your current rotation', tag: 'The baseline every other option is compared with' }, cur); current.match = match(cur.sc, inp.weights);
    return { cl, cal, current, alts: cands.slice(0, 3), others: cands.slice(3) };
  }

  const API = { raMm, et0PM, parseExtra, terrain, textureClass, scoreSet, CROPS, COVERS, SOILS, SLOPES, TILLAGE, MON, CUM, parsePower, buildClimate, calendar, buildTimeline, simulate, candidates, analyse, match, rotLabel, mean, median, quant, clip, trend };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
