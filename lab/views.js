(function () {
  window.MainViews = function (S) {
  const E = window.Engine, C = E.CROPS, CV = E.COVERS, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r0 = x => Math.round(x), pc = x => Math.round(x * 100) + '%';
  const DIMS = [['water', 'Save water'], ['soil', 'Soil health'], ['erosion', 'Soil kept in place'], ['income', 'Profit'], ['resilience', 'Bad years']];
  const DIMTIP = { water: 'How much of the water your crops wanted they actually got from rain and the soil. 100 means they never ran short.', soil: 'A rough guess at soil health: days with living roots, nitrogen from legumes, leftover residue, how many crop families you grow, deep roots, and few bare days.', erosion: 'How much of the heavy rain lands on covered ground instead of bare soil. 100 means none of it hits bare soil.', income: 'A rough 1 to 5 rating of how well each crop usually sells and pays, knocked down when the crop runs short of water. Not real prices.', resilience: 'How rarely crops get stressed by drought or heat, whether they ripen before frost, and how spread out your crops are across families and seasons.' };
  const TREND = { 'clear trend': 'trend, p < 0.05', 'possible trend': 'weak signal, p < 0.2', 'no clear trend': 'no clear trend' };
  const COL = { bare: '#F2A541', et: '#F2907E', straw: '#B7A98A', crop: '#8FD694', cover: '#D6EBAE', peren: '#3E8E5A', water: '#7CC6E8', waterSoft: '#2F5D6B', ink: '#EEF2E6', muted: '#cfe0cf', line: 'rgba(240,248,236,.16)', panel: '#163024' };
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
  function views(A) {
    const cl = A.cl, all = [A.current].concat(A.alts), best = A.alts[0], better = best && best.match > A.current.match + 1;
    const pane = (id, html) => '<div class="pane" data-pane="' + id + '">' + html + '</div>';

    let R = '';
    if (S.scen.rain || S.scen.temp) R += '<div class="banner warn"><b>Sensitivity test is on.</b> Everything here replays 2001 to 2025 with rainfall ' + (S.scen.rain > 0 ? '+' : '') + S.scen.rain + '% and temperature +' + S.scen.temp + ' °C.</div>';
    if (cl.noFrost) R += '<div class="banner warn"><b>Few or no frosts here.</b> Furrow times crops by frost dates, so sowing and harvest dates for this field are rough. Treat the results as a starting point only.</div>';
    R += '<div class="place">' + esc(S.name) + ', ' + Math.abs(S.lat).toFixed(2) + '°' + (S.lat < 0 ? 'S' : 'N') + ' ' + Math.abs(S.lon).toFixed(2) + '°' + (S.lon < 0 ? 'W' : 'E') + '. ' + E.SOILS[S.soil].name + ', ' + E.TILLAGE[S.till].name.toLowerCase() + '.</div>';
    R += '<h1>' + (!best ? 'We couldn’t build any other rotations from your choices' : better ? 'Best match for you: ' + esc(best.name.charAt(0).toLowerCase() + best.name.slice(1)) : 'Your rotation is already about as good as anything we tried') + '</h1>';
    if (best) {
      R += '<div class="vs"><div class="win"><span class="n">' + r0(best.match) + '</span><span class="l">' + esc(E.rotLabel(best.rot)) + '</span></div><div><span class="n">' + r0(A.current.match) + '</span><span class="l">' + esc(E.rotLabel(A.current.rot)) + ', what you grow now</span></div></div>';
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
      R += '<p class="conf"><b>' + w + ' out of 100.</b> We reshuffled the ' + cl.n + ' years ' + bt.runs + ' times, and this rotation still beat yours in ' + w + '% of them' + (bt.win >= 0.9 ? ', so it’s not just down to a couple of weird years.' : bt.win >= 0.7 ? '. So it’s probably better, but not for sure.' : '. So honestly the two are about the same.') + ' The gap goes from ' + (bt.lo > 0 ? '+' : '') + bt.lo.toFixed(1) + ' to ' + (bt.hi > 0 ? '+' : '') + bt.hi.toFixed(1) + ' points in 8 out of 10 runs.</p>';
      R += '<p class="why">' + explain(best, A).why + '</p><button class="link" data-go="options">See all the rotations side by side</button>';
    } else R += '<p class="why">Un-cross a few crops under “Crops you can’t grow or sell” and we’ll have something to compare.</p>';
    R += '<div class="acts"><button class="btn ghost" data-act="print">Print or save as PDF</button><button class="btn ghost" data-act="share">Copy a link to this result</button><span id="shared" class="small muted"></span></div>';
    R += '<p class="fine">How to read this: every score goes from 0 to 100 and comes from replaying the rotation through ' + cl.n + ' years of NASA weather for this spot. The match score is the average, weighted by what you said matters. A few points’ difference doesn’t mean much. NASA’s weather grid is about 50 km wide (the dashed box on the map), so this is your area’s weather, not exactly your field’s. Soil health and profit are estimates, not measurements.</p>';
    let Cm = '<h2>The last ' + cl.n + ' years here</h2><p class="sub">Daily NASA POWER data, ' + cl.years[0].label + ' to ' + cl.years[cl.n - 1].label + '. One point per year, and the dashed line is the trend. A coloured dot means it’s changing. Tap a line to see any year.</p>';
    for (const i of cl.indicators) {
      const t = i.trend, cls = t.label === 'clear trend' ? ' clear' : t.label === 'possible trend' ? ' possible' : '';
      Cm += '<div class="irow' + (cls === ' clear' ? ' hot' : cls === ' possible' ? ' warm' : '') + '" title="' + esc(i.note) + '"><div><div class="k">' + i.name + '</div><div class="r">' + i.lo.toFixed(i.digits) + ' to ' + i.hi.toFixed(i.digits) + ' in 8 years out of 10</div></div><div class="sp">' + spark(i, cl) + '</div><div><div class="v">' + i.mean.toFixed(i.digits) + ' <small>' + i.unit + '</small></div><div class="t' + cls + '">' + (t.perDecade > 0 ? '+' : '') + t.perDecade.toFixed(i.digits ? 1 : 0) + ' per decade, ' + TREND[t.label] + '</div></div></div>';
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
    let O = '<h2>Your rotation and ' + A.alts.length + ' other options</h2><p class="sub">Sorted by how well they fit what matters to you. Tap one to see why.</p><div class="rank">';
    all.slice().sort((p, q) => q.match - p.match).forEach(s => { const i = all.indexOf(s); O += '<button class="rk" data-sel="' + i + '" aria-pressed="' + (i === S.sel) + '"><span class="dot"></span><span class="nm"><b>' + esc(s.name) + '</b><small>' + esc(E.rotLabel(s.rot)) + (s.boot ? ' · beats yours in ' + Math.round(s.boot.win * 100) + '% of reshuffles' : '') + '</small></span><span class="sc">' + r0(s.match) + '</span><span class="br"><i style="width:' + r0(s.match) + '%"></i></span></button>'; });
    O += '</div>';
    const s = all[S.sel], x = explain(s, A), isCur = s.id === 'current';
    O += '<div class="optd' + (S.animOpt ? ' in' : '') + '"><h3>' + esc(s.name) + '</h3><div class="bars">';
    for (const d of DIMS) { const v = s.sc[d[0]], dl = v - A.current.sc[d[0]]; O += '<span>' + d[1] + '</span><span class="track"><b style="width:' + v + '%"></b></span><span class="num">' + v + '</span><span class="d ' + (isCur || !dl ? '' : dl > 0 ? 'up' : 'dn') + '">' + (isCur || !dl ? '' : (dl > 0 ? '+' : '') + dl) + '</span>'; }
    O += '</div><h4>' + (isCur ? 'What this is' : 'Why we suggest it') + '</h4><p>' + x.why + '</p><h4>What the data says (' + cl.n + ' years, tap a line to see the chart)</h4><ul>' + x.ev.map(e => '<li class="lnk" data-go="' + (/^(Bare soil|Heavy rain|Living roots)/.test(e) ? 'calendar' : /^Nitrogen/.test(e) ? 'method' : /^Damaging heat/.test(e) ? 'climate' : 'years') + '">' + e + '</li>').join('') + '</ul>';
    O += '<div class="note warn"><h4>Double-check this locally first</h4><ul>' + x.rev.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>';
    O += '<div class="note"><h4>What we can’t know from here</h4><ul>' + x.gaps.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>';
    O += '<details class="more"><summary>What you could gain</summary><ul>' + x.ben.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></details>';
    if (A.others.length) {
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
    sheet(A);
    return { result: R, climate: Cm, calendar: K, options: O, years: Yh };
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
    const W = 560, L = 168, R = 44, pw = W - L - R, X = v => L + v / 100 * pw; let g = '', y = 26;
    [0, 25, 50, 75, 100].forEach(v => { g += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="16" y2="' + (26 + DIMS.length * 34 - 12) + '" stroke="' + COL.line + '"/><text x="' + X(v) + '" y="10" text-anchor="middle" font-size="10.5" fill="' + COL.muted + '">' + v + '</text>'; });
    for (const d of DIMS) {
      const a = cur.sc[d[0]], b = best.sc[d[0]], dl = b - a, c = dl > 2 ? '#8FD694' : dl < -2 ? '#F2907E' : '#A8A89C';
      g += '<text x="0" y="' + (y + 4) + '" font-size="13" fill="' + COL.ink + '">' + d[1] + '</text><text x="0" y="' + (y + 17) + '" font-size="10.5" fill="' + COL.muted + '">importance ' + S.weights[d[0]] + '</text>';
      g += '<line x1="' + X(a) + '" x2="' + X(b) + '" y1="' + y + '" y2="' + y + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round" opacity=".55"/><circle cx="' + X(a) + '" cy="' + y + '" r="5.5" fill="' + COL.panel + '" stroke="#A8A89C" stroke-width="2"><title>Now: ' + a + '</title></circle><circle cx="' + X(b) + '" cy="' + y + '" r="7" fill="' + c + '"><title>Alternative: ' + b + '</title></circle>';
      g += '<text x="' + (W - 2) + '" y="' + (y + 4.5) + '" text-anchor="end" font-size="13" font-weight="700" fill="' + c + '">' + (dl > 0 ? '+' : '') + dl + '</text><rect x="0" y="' + (y - 15) + '" width="' + W + '" height="32" fill="transparent" data-tip="' + esc(d[1] + ': ' + DIMTIP[d[0]] + ' Yours now: ' + a + '. The other option: ' + b + '.') + '"/>';
      y += 34;
    }
    return '<div class="legend" style="margin-bottom:2px"><span><i style="background:none;box-shadow:inset 0 0 0 2px #A8A89C;border-radius:50%"></i>your rotation now</span><span><i style="background:#8FD694;border-radius:50%"></i>the alternative</span></div><svg class="dumb" viewBox="0 0 ' + W + ' ' + (26 + DIMS.length * 34 - 6) + '" role="img" aria-label="Scores for each priority, current rotation against the alternative">' + g + '</svg>';
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
    const W = 960, L = 150, PW = 790, X = d => L + d / 365 * PW;
    const top = 30, CH = 160, mx = Math.max.apply(null, cl.mRain.concat(cl.mEt0));
    const step = mx > 200 ? 50 : mx > 80 ? 25 : 10, ymax = Math.ceil(mx / step) * step, Yv = v => top + CH - v / ymax * CH;
    let s = '<defs><linearGradient id="gRain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B7186"/><stop offset="1" stop-color="#234652"/></linearGradient><linearGradient id="gHeavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AD8F2"/><stop offset="1" stop-color="#5AAED3"/></linearGradient><linearGradient id="gEt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2907E" stop-opacity=".22"/><stop offset="1" stop-color="#F2907E" stop-opacity="0"/></linearGradient></defs>', y = top;
    for (let v = 0; v <= ymax; v += step) s += '<line x1="' + L + '" x2="' + (L + PW) + '" y1="' + Yv(v) + '" y2="' + Yv(v) + '" stroke="' + COL.line + '" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Yv(v) + 4) + '" text-anchor="end" font-size="11" fill="' + COL.muted + '">' + v + '</text>';
    s += '<text x="' + (L - 8) + '" y="' + (top - 16) + '" text-anchor="end" font-size="11" fill="' + COL.muted + '">mm a month</text>';
    const pt = [];
    for (let m = 0; m < 12; m++) {
      const x0 = X(E.CUM[m]) + 6, w = X(E.CUM[m + 1]) - X(E.CUM[m]) - 12, cx = x0 + w / 2;
      s += '<rect x="' + x0 + '" y="' + Yv(cl.mRain[m]) + '" width="' + w + '" height="' + (top + CH - Yv(cl.mRain[m])) + '" fill="url(#gRain)" rx="4"><title>' + cl.monthName(m) + ': ' + r0(cl.mRain[m]) + ' mm rain</title></rect>';
      s += '<rect x="' + (x0 + w * 0.18) + '" y="' + Yv(cl.mEros[m]) + '" width="' + w * 0.64 + '" height="' + (top + CH - Yv(cl.mEros[m])) + '" fill="url(#gHeavy)" rx="3"><title>' + cl.monthName(m) + ': ' + r0(cl.mEros[m]) + ' mm on days of 12.7 mm or more</title></rect>';
      pt.push([cx, Yv(cl.mEt0[m])]);
      s += '<text x="' + cx + '" y="' + (top + CH + 17) + '" text-anchor="middle" font-size="12" fill="' + COL.ink + '">' + cl.monthName(m) + '</text>';
    }
    const line = pt.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    s += '<polygon points="' + pt[0][0] + ',' + (top + CH) + ' ' + line + ' ' + pt[11][0] + ',' + (top + CH) + '" fill="url(#gEt)"/><polyline points="' + line + '" fill="none" stroke="' + COL.et + '" stroke-width="2.2" stroke-linejoin="round"/>';
    pt.forEach((p, m) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.6" fill="' + COL.et + '" stroke="' + COL.panel + '" stroke-width="1.5"><title>' + cl.monthName(m) + ': ' + r0(cl.mEt0[m]) + ' mm evaporative demand</title></circle>'; });
    y = top + CH + 34;
    const y0 = y;
    if (S.ndvi) {
      const mixc = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')', nc = v => v < 0.3 ? mixc([120, 92, 60], [196, 168, 110], Math.max(0, v) / 0.3) : mixc([196, 168, 110], [62, 160, 84], Math.min(1, (v - 0.3) / 0.5));
      s += '<text x="0" y="' + (y + 12) + '" font-size="13" font-weight="600" fill="' + COL.ink + '">What the satellite saw</text>'; y += 20;
      S.ndvi.yrs.forEach(yr => {
        s += '<text x="' + (L - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="11" fill="' + COL.muted + '">MODIS ' + yr + '</text><clipPath id="cN' + yr + '"><rect x="' + L + '" y="' + y + '" width="' + PW + '" height="16" rx="4"/></clipPath><g clip-path="url(#cN' + yr + ')">';
        S.ndvi.by[yr].forEach((v, i) => { if (v === null) return; const d0 = ((i * 16 - cl.off) % 365 + 365) % 365, x0 = X(d0), w = X(Math.min(365, d0 + 16)) - x0; s += '<rect x="' + x0 + '" y="' + y + '" width="' + (w + 0.5) + '" height="16" fill="' + nc(v) + '"><title>' + yr + ', around ' + cl.fmtDay(d0 + 8) + ': greenness (NDVI) ' + v.toFixed(2) + '</title></rect>'; if (d0 + 16 > 365) s += '<rect x="' + X(0) + '" y="' + y + '" width="' + (X(d0 + 16 - 365) - X(0)) + '" height="16" fill="' + nc(v) + '"/>'; });
        s += '</g>'; y += 20;
      });
      y += 7;
    }
    const fill = { 0: COL.bare, 1: COL.straw, 2: COL.crop, 3: COL.cover, 4: COL.peren };
    list.forEach((st, si) => {
      s += '<text x="0" y="' + (y + 12) + '" font-size="13" font-weight="600" fill="' + COL.ink + '">' + esc(st.name) + '</text>'; y += 20;
      const tl = st.tl;
      for (let i = 0; i < tl.N; i++) {
        s += '<text x="' + (L - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="11" fill="' + COL.muted + '">Year ' + (i + 1) + '</text><clipPath id="c' + si + '_' + i + '"><rect x="' + L + '" y="' + y + '" width="' + PW + '" height="16" rx="4"/></clipPath><g clip-path="url(#c' + si + '_' + i + ')">';
        let a = 0;
        while (a < 365) {
          const t0 = i * 365 + a, k = tl.st[t0], who = tl.ci[t0]; let b = a;
          while (b < 365 && tl.st[i * 365 + b] === k && tl.ci[i * 365 + b] === who) b++;
          const x0 = X(a), w = X(b) - x0, lab = k === 0 ? 'Bare soil' : k === 1 ? 'Residue' : k === 3 ? 'Cover crop' : C[st.rot[who].c].short;
          s += '<rect x="' + x0 + '" y="' + y + '" width="' + Math.max(0.5, w - 1) + '" height="16" fill="' + fill[k] + '"><title>' + lab + ': ' + cl.fmtDay(a) + ' to ' + cl.fmtDay(b - 1) + '</title></rect>';
          if (w > lab.length * 6.5 + 8) s += '<text x="' + (x0 + w / 2) + '" y="' + (y + 12) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="' + (k === 4 ? '#fff' : '#10231A') + '" pointer-events="none">' + lab + '</text>';
          a = b;
        }
        s += '</g>'; y += 20;
      }
      y += 8;
    });
    let grid = ''; for (let m = 1; m < 12; m++) grid += '<line x1="' + X(E.CUM[m]) + '" x2="' + X(E.CUM[m]) + '" y1="' + (y0 - 6) + '" y2="' + (y - 8) + '" stroke="rgba(240,236,220,.09)" stroke-dasharray="2 4"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + y + '" role="img" aria-label="Monthly rain and evaporative demand above a calendar of ground cover for each rotation">' + grid + s + '</svg>';
  }
  function anomFigure(cl) {
    const L = 58, cw = 34, chh = 13, W = L + 12 * cw + 6, H = 22 + cl.n * chh + 34;
    const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
    const col = z => { const t = Math.min(1, Math.abs(z) / 2); return z < 0 ? mix([40, 40, 36], [242, 165, 65], t) : mix([40, 40, 36], [124, 198, 232], t); };
    let s = '';
    for (let m = 0; m < 12; m++) s += '<text x="' + (L + m * cw + cw / 2) + '" y="14" text-anchor="middle" font-size="11" fill="' + COL.muted + '">' + cl.monthName(m) + '</text>';
    cl.gwAnom.forEach((row, i) => {
      const y = 22 + i * chh;
      s += '<text x="' + (L - 6) + '" y="' + (y + 10) + '" text-anchor="end" font-size="10" fill="' + COL.muted + '">' + cl.years[i].label + '</text>';
      row.forEach((z, m) => { s += '<rect x="' + (L + m * cw) + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (chh - 2) + '" rx="2.5" fill="' + col(z) + '"><title>' + cl.monthName(m) + ' ' + cl.years[i].label + ': ' + (z > 0 ? '+' : '') + z.toFixed(1) + ' standard deviations</title></rect>'; });
    });
    const ly = 22 + cl.n * chh + 10;
    for (let j = 0; j <= 8; j++) s += '<rect x="' + (L + j * 22) + '" y="' + ly + '" width="22" height="9" fill="' + col(-2 + j * 0.5) + '"/>';
    s += '<text x="' + L + '" y="' + (ly + 21) + '" font-size="10" fill="' + COL.muted + '">much drier</text><text x="' + (L + 99) + '" y="' + (ly + 21) + '" text-anchor="middle" font-size="10" fill="' + COL.muted + '">normal</text><text x="' + (L + 198) + '" y="' + (ly + 21) + '" text-anchor="end" font-size="10" fill="' + COL.muted + '">much wetter</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="min-width:420px" role="img" aria-label="Soil wetness anomaly by month and year">' + s + '</svg>';
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
    h += '<h2>Read this before acting</h2><p>Furrow replays each rotation through ' + cl.n + ' years of NASA POWER weather for this spot. That weather describes an area about 50 km wide, not one field. Soil health and profit are estimates, crop numbers are generic, and nobody has checked this model against field trials. Use it to start a conversation with an agronomist or adviser, and try any change on a strip first. NASA does not endorse this tool.</p>';
    $('sheet').innerHTML = h;
  }
  return { views, explain, sheet, DIMS };
  };
})();
