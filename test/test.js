const E = require('../src/engine.js');

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function synth(lat, tMean, tAmp, rainMm, summerShare, years = 25) {

  const P = { T2M_MAX: {}, T2M_MIN: {}, PRECTOTCORR: {}, GWETROOT: {} };
  const south = lat < 0;
  for (let y = 2001; y < 2001 + years; y++) {
    const yrAnom = (rnd() - 0.5) * 2, wet = 0.6 + rnd() * 0.8;
    for (let m = 1; m <= 12; m++) {
      const dim = [31, (y % 4 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
      for (let d = 1; d <= dim; d++) {
        const doy = E.CUM[m - 1] + d, ph = Math.cos(2 * Math.PI * (doy - 200 + (south ? 182 : 0)) / 365);
        const tm = tMean + tAmp * ph + yrAnom + (rnd() - 0.5) * 8 + (y - 2001) * 0.04;
        const k = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
        P.T2M_MAX[k] = +(tm + 6).toFixed(2); P.T2M_MIN[k] = +(tm - 6).toFixed(2);
        const pw = (1 + summerShare * ph) * rainMm / 365 * wet;
        P.PRECTOTCORR[k] = rnd() < 0.28 ? +(-Math.log(1 - rnd()) * pw / 0.28).toFixed(2) : 0;
        P.GWETROOT[k] = +(0.6 - 0.15 * ph + (rnd() - 0.5) * 0.1).toFixed(2);
      }
    }
  }
  P.T2M_MAX['20030615'] = -999;
  return { properties: { parameter: P } };
}

const ra = E.raMm(-20, 246);
if (Math.abs(ra - 13.1) > 0.15) throw new Error('Ra reference case failed: ' + ra);
console.log('Ra reference (FAO-56 Example 8): ' + ra.toFixed(2) + ' mm/day, expected 13.1');
const pm = E.et0PM(21.5, 12.3, 22.07, 2.078, 1.409, 41.09, 100);
if (Math.abs(pm - 3.88) > 0.12) throw new Error('Penman-Monteith reference case failed: ' + pm);
console.log('ET0 reference (FAO-56 Example 18): ' + pm.toFixed(2) + ' mm/day, expected 3.88');
const tr = E.terrain(Array.from({ length: 25 }, (_, i) => 100 + (i % 5) * 12.5), 250);
if (Math.abs(tr.typical - 5) > 0.01 || tr.cls !== 'gentle') throw new Error('terrain reference failed: ' + tr.typical);
if (E.textureClass(20, 50) !== 'clay' || E.textureClass(90, 4) !== 'sand' || E.textureClass(20, 15) !== 'silt_loam' || E.textureClass(40, 20) !== 'loam' || E.textureClass(65, 10) !== 'sandy_loam') throw new Error('texture classes failed');
console.log('terrain and texture reference cases pass');
const W = { water: 3, soil: 3, erosion: 3, income: 3, resilience: 3 };
const cases = [
  ['Iowa-like corn-soy', 42, 9.5, 14, 900, 0.6, [{ c: 'corn' }, { c: 'soy' }], 'loam'],
  ['Kansas-like wheat-fallow', 38.9, 12.5, 13.5, 580, 0.6, [{ c: 'wheat' }, { c: 'fallow' }], 'silt_loam'],
  ['Ukraine-like wheat-sunflower', 47, 10.5, 12.5, 450, 0.3, [{ c: 'wheat' }, { c: 'sunflower' }], 'clay_loam'],
  ['Pampas-like soy-corn (south)', -33.9, 16.5, 7, 1000, 0.3, [{ c: 'soy' }, { c: 'corn' }], 'silt_loam'],
  ['Tropical no frost', 5, 27, 1, 1500, 0.2, [{ c: 'corn' }], 'clay']
];
for (const [name, lat, tm, amp, rain, ss, rot, soil] of cases) {
  const raw = E.parsePower(synth(lat, tm, amp, rain, ss));
  const t0 = Date.now();
  const A = E.analyse(raw, { lat, rot, soil, slope: 'gentle', till: 'reduced', irrigated: false, livestock: false, exclude: new Set(), weights: W, scen: { rain: 0, temp: 0 } });
  const cl = A.cl;
  if (!(cl.yearTypes.agree >= 0 && cl.yearTypes.agree <= cl.n)) throw new Error('agreement missing');
  console.log('\n===', name, `(${Date.now() - t0} ms, ${cl.n} yrs)`);
  console.log(' frost: last', cl.fmtDay(cl.lastFrost), 'first', cl.fmtDay(cl.firstFrost), 'noFrost', cl.noFrost);
  console.log(' ', cl.indicators.map(i => `${i.key}=${i.mean.toFixed(1)}(${i.trend.perDecade.toFixed(1)}/dec ${i.trend.label})`).join(' '));
  console.log(' calendars:', Object.entries(A.cal).map(([k, v]) => `${k}:${cl.fmtDay(v.plant)}-${cl.fmtDay(v.harv)} r${v.reliab.toFixed(2)}`).join(' | '));
  if (cl.yearTypes) console.log(' types:', cl.yearTypes.types.map(t => `${t.name} n=${t.count} (${t.early}/${t.late}) rain${t.rain.toFixed(0)} et${t.et0.toFixed(0)}`).join('; '));
  for (const s of [A.current, ...A.alts, ...A.others]) {
    const m = s.m;
    console.log(`  [${s.id}] ${E.rotLabel(s.rot)}  match=${s.match.toFixed(1)} sc=${JSON.stringify(s.sc)}`);
    console.log(`     bare=${m.bare.toFixed(0)} resid=${m.resid.toFixed(0)} living=${m.living.toFixed(0)} exposed=${(m.exposedShare * 100).toFixed(0)}% rel=${(m.relMean * 100).toFixed(1)}% stress=${(m.stress * 100).toFixed(0)}% heat=${m.heat.toFixed(1)} nfix=${m.nfix.toFixed(0)} eta=${m.eta.toFixed(0)} notes=${JSON.stringify(s.tl.notes)}`);
    for (const v of Object.values(s.sc)) if (!(v >= 0 && v <= 100)) throw new Error('score out of range');
    if (s.id !== 'current' && !(s.boot && s.boot.win >= 0 && s.boot.win <= 1)) throw new Error('bootstrap missing');
    if ([m.bare, m.living, m.relMean, m.eta, s.match].some(x => !isFinite(x))) throw new Error('non-finite metric');
    if (Math.abs(m.bare + m.resid + m.living - 365) > 0.01) throw new Error('days do not sum to 365');
  }
}
console.log('\nALL OK');
