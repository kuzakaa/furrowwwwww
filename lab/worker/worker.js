const ALLOW = ['https://kuzakaa.github.io'];
const MM = 'https://api.meteomatics.com';
const PARAMS = 't_2m:C,precip_24h:mm,evapotranspiration_24h:mm,soil_moisture_index_-15cm:idx';
const AE = 'https://appeears.earthdatacloud.nasa.gov/api';
const AE_LAYERS = { smap: ['SPL4SMGP.008', 'Geophysical_Data_sm_rootzone'], et: ['MOD16A2GF.061', 'ET_500m'], esi: ['ECO_L4T_ESI.002', 'ESI'] };
const CDSE_TOKEN = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CDSE_STATS = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
const cors = o => ({ 'Access-Control-Allow-Origin': ALLOW.includes(o) ? o : ALLOW[0], 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' });
const json = (d, s, o, c) => new Response(JSON.stringify(d), { status: s, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': c || 'public, max-age=3600' }, cors(o)) });
const num = (v, lo, hi) => { const x = parseFloat(v); return isFinite(x) && x >= lo && x <= hi ? x : null; };
const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
const pick = (env, a, b) => env[a] || env[b];
async function runAI(env, x) { let last; for (const m of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.1-8b-instruct-fast']) { try { return await env.AI.run(m, x); } catch (e) { last = e; } } throw last; }
async function meteo(env, lat, lon, from, to) {
const u = pick(env, 'MM_USER', 'MM-USER'), p = pick(env, 'MM_PASS', 'MM-PASS');
const r = await fetch(MM + '/' + from + 'T00:00:00Z--' + to + 'T00:00:00Z:P1D/' + PARAMS + '/' + lat + ',' + lon + '/json', { headers: { Authorization: 'Basic ' + btoa(u + ':' + p) } });
if (!r.ok) throw new Error('Meteomatics ' + r.status);
const j = await r.json(), out = {};
for (const d of j.data || []) out[d.parameter] = d.coordinates[0].dates.map(x => [x.date.slice(0, 10), x.value]);
return out;
}
async function aeToken(env) {
const r = await fetch(AE + '/login', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(env.EARTHDATA_USER + ':' + env.EARTHDATA_PASS), 'Content-Length': '0' } });
if (!r.ok) throw new Error('Earthdata login ' + r.status);
return (await r.json()).token;
}
async function aeStart(env, kind, lat, lon, from, to) {
const L = AE_LAYERS[kind], t = await aeToken(env), f = d => d.slice(5, 7) + '-' + d.slice(8, 10) + '-' + d.slice(0, 4);
const body = { task_type: 'point', task_name: 'furrow-' + kind + '-' + Date.now(), params: { dates: [{ startDate: f(from), endDate: f(to) }], layers: [{ product: L[0], layer: L[1] }], coordinates: [{ id: 'field', latitude: lat, longitude: lon }] } };
const r = await fetch(AE + '/task', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
if (!r.ok) throw new Error('AppEEARS task ' + r.status + ' ' + (await r.text()).slice(0, 200));
return (await r.json()).task_id;
}
async function aeStatus(env, id) {
const t = await aeToken(env), r = await fetch(AE + '/task/' + id, { headers: { Authorization: 'Bearer ' + t } });
if (!r.ok) throw new Error('AppEEARS status ' + r.status);
return (await r.json()).status;
}
async function aeResult(env, id) {
const t = await aeToken(env), H = { Authorization: 'Bearer ' + t };
const b = await (await fetch(AE + '/bundle/' + id, { headers: H })).json();
const f = (b.files || []).find(x => /results\.csv$/i.test(x.file_name));
if (!f) throw new Error('not ready');
const csv = await (await fetch(AE + '/bundle/' + id + '/' + f.file_id, { headers: H, redirect: 'follow' })).text();
const L = csv.trim().split(/\r?\n/), h = L[0].split(','), di = h.indexOf('Date'), vi = h.findIndex(x => /_(sm_rootzone|ET_500m|ESI)$/.test(x));
const out = [];
for (let i = 1; i < L.length; i++) { const p = L[i].split(','), v = parseFloat(p[vi]); if (p[di] && isFinite(v) && v > -9000 && v < 32000) out.push([p[di].slice(0, 10), v]); }
return out;
}
async function cdseToken(env) {
const r = await fetch(CDSE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&client_id=' + encodeURIComponent(env.CDSE_ID) + '&client_secret=' + encodeURIComponent(env.CDSE_SECRET) });
if (!r.ok) throw new Error('Copernicus login ' + r.status);
return (await r.json()).access_token;
}
async function sentinel(env, lat, lon, from, to) {
const t = await cdseToken(env), dl = 125 / 111320, dn = 125 / (111320 * Math.cos(lat * Math.PI / 180));
const es = '//VERSION=3\nfunction setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]}}\nfunction evaluatePixel(s){var c=[3,8,9,10].indexOf(s.SCL)>=0;return{ndvi:[(s.B08-s.B04)/(s.B08+s.B04)],dataMask:[s.dataMask&&!c?1:0]}}';
const body = { input: { bounds: { bbox: [lon - dn, lat - dl, lon + dn, lat + dl], properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } }, data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 60 } }] }, aggregation: { timeRange: { from: from + 'T00:00:00Z', to: to + 'T23:59:59Z' }, aggregationInterval: { of: 'P10D' }, evalscript: es, resx: 0.0001, resy: 0.0001 } };
const r = await fetch(CDSE_STATS, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
if (!r.ok) throw new Error('Copernicus ' + r.status + ' ' + (await r.text()).slice(0, 200));
const j = await r.json();
return (j.data || []).map(d => { const s = d.outputs && d.outputs.ndvi && d.outputs.ndvi.bands.B0.stats; return s && s.sampleCount > s.noDataCount && isFinite(s.mean) ? [d.interval.from.slice(0, 10), Math.round(s.mean * 1000) / 1000] : null; }).filter(Boolean);
}
async function edlToken(env) {
const H = { Authorization: 'Basic ' + btoa(env.EARTHDATA_USER + ':' + env.EARTHDATA_PASS) };
let r = await fetch('https://urs.earthdata.nasa.gov/api/users/tokens', { headers: H });
if (r.ok) { const a = await r.json(); if (a.length) return a[0].access_token; }
r = await fetch('https://urs.earthdata.nasa.gov/api/users/token', { method: 'POST', headers: H });
if (!r.ok) throw new Error('Earthdata token ' + r.status);
return (await r.json()).access_token;
}
async function grace(env, lat, lon, raw) {
const c = await (await fetch('https://cmr.earthdata.nasa.gov/search/granules.json?short_name=GRACEDADM_CLSM025GL_7D&sort_key=-start_date&page_size=1')).json();
const e = c.feed.entry[0], links = (e.links || []).map(x => x.href);
const od = links.find(h => /opendap/i.test(h) && /\.nc4$/.test(h)) || links.find(h => /opendap/i.test(h));
const t = await edlToken(env), H = { Authorization: 'Bearer ' + t };
if (raw === '1') { const d = od ? await (await fetch(od + '.dds', { headers: H })).text() : ''; return { granule: e.producer_granule_id, od, links: links.slice(0, 6), dds: d.slice(0, 1500) }; }
if (!od) throw new Error('GRACE-DA OPeNDAP link missing');
const i = Math.round((lat + 59.875) / 0.25), j = Math.round((lon + 179.875) / 0.25);
const r = await fetch(od + '.ascii?' + encodeURIComponent('gws_inst[0:0][' + i + '][' + j + '],rtzsm_inst[0:0][' + i + '][' + j + '],sfsm_inst[0:0][' + i + '][' + j + ']'), { headers: H });
const txt = await r.text(); if (raw === '2') return { status: r.status, txt: txt.slice(0, 1500) };
if (!r.ok) throw new Error('GRACE-DA ' + r.status);
const val = k => { const m = txt.match(new RegExp(k + '\\[0\\]\\[0\\],\\s*([-\\d.eE]+)')) || txt.match(new RegExp(k + '[^\\n]*\\n[^,\\n]*,\\s*([-\\d.eE]+)')); return m ? +m[1] : null; };
return { date: e.time_start.slice(0, 10), groundwater: val('gws_inst'), rootzone: val('rtzsm_inst'), surface: val('sfsm_inst') };
}
export default { async fetch(req, env) {
const o = req.headers.get('Origin') || '';
if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });
const u = new URL(req.url), q = u.searchParams, p = u.pathname.split('/').filter(Boolean);
try {
if (p[0] === 'ask') {
const qq = (q.get('q') || '').slice(0, 600).trim(), ctx = (q.get('ctx') || '').slice(0, 1500);
if (!qq) return json({ error: 'q needed' }, 400, o);
if (!env.AI) return json({ error: 'AI binding missing' }, 503, o, 'no-store');
const sys = 'You are the helper inside Furrow, a free web tool that helps farmers choose crop rotations using 25 years of NASA weather data for their field. Answer the user\'s question in plain, friendly words a farmer with no science background understands. Answer ANY question, farming or not, briefly and honestly (at most 120 words, no markdown headings). Reply in the same language the user writes in. If you are not sure, say so. Context about what the user is looking at: ' + ctx + ' If the message is insulting, sexual, hateful, harassing, or asks for something harmful or illegal, reply with exactly the single word UPSET and nothing else.';
const r = await runAI(env, { messages: [{ role: 'system', content: sys }, { role: 'user', content: qq }], max_tokens: 300 });
const t = (r && r.response || '').trim();
return json({ answer: t, upset: /^UPSET\W*$/i.test(t) }, 200, o, 'no-store');
}
if (p[0] === 'health') return json({ ok: true, meteomatics: !!pick(env, 'MM_USER', 'MM-USER'), earthdata: !!env.EARTHDATA_USER, copernicus: !!env.CDSE_ID, ai: !!env.AI }, 200, o, 'no-store');
if (p[0] === 'ae' && p[1] === 'status' && /^[\w-]+$/.test(p[2] || '')) return json({ status: await aeStatus(env, p[2]) }, 200, o, 'no-store');
if (p[0] === 'ae' && p[1] === 'result' && /^[\w-]+$/.test(p[2] || '')) return json({ series: await aeResult(env, p[2]) }, 200, o);
const lat = num(q.get('lat'), -70, 70), lon = num(q.get('lon'), -180, 180), from = day(q.get('from')), to = day(q.get('to'));
if (lat == null || lon == null || !from || !to) return json({ error: 'lat, lon, from, to needed' }, 400, o);
if (p[0] === 'weather') return json({ series: await meteo(env, lat, lon, from, to) }, 200, o);
if (p[0] === 'grace') return json(await grace(env, lat, lon, q.get('raw')), 200, o, q.get('raw') ? 'no-store' : 'public, max-age=86400');
if (p[0] === 's2map') { const t = await cdseToken(env), dl = 2500 / 111320, dn = 2500 / (111320 * Math.cos(lat * Math.PI / 180)); const es = '//VERSION=3\nfunction setup(){return{input:["B04","B08","SCL","dataMask"],output:{bands:4}}}\nfunction evaluatePixel(s){var n=(s.B08-s.B04)/(s.B08+s.B04);if(!s.dataMask||[3,8,9,10].indexOf(s.SCL)>=0)return[0,0,0,0];var c=n<0.1?[0.55,0.42,0.3]:n<0.25?[0.78,0.66,0.36]:n<0.4?[0.75,0.82,0.36]:n<0.6?[0.4,0.72,0.3]:[0.13,0.5,0.2];return[c[0],c[1],c[2],1]}'; const body = { input: { bounds: { bbox: [lon - dn, lat - dl, lon + dn, lat + dl], properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } }, data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from: from + 'T00:00:00Z', to: to + 'T23:59:59Z' }, maxCloudCoverage: 40, mosaickingOrder: 'leastCC' } }] }, output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] }, evalscript: es }; const r = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'image/png' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error('Copernicus image ' + r.status + ' ' + (await r.text()).slice(0, 200)); return new Response(r.body, { headers: Object.assign({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'X-Bounds': [lat - dl, lon - dn, lat + dl, lon + dn].join(',') }, cors(o)) }); }
if (p[0] === 'sentinel') return json({ series: await sentinel(env, lat, lon, from, to) }, 200, o);
if (p[0] === 'ae' && p[1] === 'start' && AE_LAYERS[p[2]]) return json({ task: await aeStart(env, p[2], lat, lon, from, to) }, 200, o, 'no-store');
return json({ error: 'unknown route' }, 404, o);
} catch (e) { return json({ error: e.message }, 502, o, 'no-store'); }
} };
