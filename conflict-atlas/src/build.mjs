import fs from 'fs';
import * as topo from 'topojson-client';
import * as simp from 'topojson-simplify';
import { geoEqualEarth, geoPath, geoGraticule } from 'd3-geo';
import { conflicts, sources, ASOF } from './conflicts.mjs';

const W = 1000;
const t = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
let s = simp.presimplify(t);
s = simp.simplify(s, simp.quantile(s, 0.15));
const fc = topo.feature(s, s.objects.countries);

const wc = JSON.parse(fs.readFileSync('node_modules/world-countries/countries.json'));
const byNum = Object.fromEntries(wc.filter(c => c.ccn3).map(c => [c.ccn3, c]));
const manual = {
  'Somaliland': { id: 'somaliland', n: 'Somaliland', r: 'Africa', s: 'Eastern Africa', note: 'Self-declared republic, internationally regarded as part of Somalia' },
  'Kosovo': { id: 'kosovo', n: 'Kosovo', r: 'Europe', s: 'Southeast Europe' },
  'N. Cyprus': { id: 'ncyprus', n: 'Northern Cyprus', r: 'Europe', s: 'Southern Europe', note: 'Recognised only by Türkiye' },
  'Siachen Glacier': { id: 'siachen', n: 'Siachen Glacier', r: 'Asia', s: 'Southern Asia', note: 'Disputed between India and Pakistan', related: ['356', '586'] },
};
const nameFix = { '840': 'United States', '826': 'United Kingdom', '275': 'Palestine', '158': 'Taiwan', '180': 'DR Congo', '178': 'Republic of the Congo', '732': 'Western Sahara' };

fc.features = fc.features.filter(f => f.id !== '010' && f.properties.name !== 'Indian Ocean Ter.');
const proj = geoEqualEarth().fitWidth(W, fc);
const path = geoPath(proj).digits(1);
const [[, y0], [, y1]] = path.bounds(fc);
// shift so the map starts at y = 0
const H = Math.ceil(y1 - y0);
proj.translate([proj.translate()[0], proj.translate()[1] - y0]);

// bounds of the main landmass(es), so a far-flung island does not stretch the zoom box
function mainBounds(f) {
  const g = f.geometry;
  if (g.type !== 'MultiPolygon') return path.bounds(f).flat();
  const parts = g.coordinates.map(c => ({ type: 'Polygon', coordinates: c })).map(p => ({ p, a: path.area(p) }));
  const max = Math.max(...parts.map(x => x.a));
  let b = null;
  for (const x of parts) {
    if (x.a < max * 0.2) continue;
    const [[a0, b0], [a1, b1]] = path.bounds(x.p);
    b = b ? [Math.min(b[0], a0), Math.min(b[1], b0), Math.max(b[2], a1), Math.max(b[3], b1)] : [a0, b0, a1, b1];
  }
  return b;
}
const countries = [];
for (const f of fc.features) {
  const m = manual[f.properties.name];
  const wcRec = byNum[f.id];
  const rec = m ? { ...m } : {
    id: f.id,
    n: nameFix[f.id] || wcRec?.name?.common || f.properties.name,
    r: wcRec?.region || '',
    s: wcRec?.subregion || '',
  };
  rec.d = path(f);
  if (!rec.d) continue;
  rec.b = mainBounds(f).map(v => Math.round(v * 10) / 10);
  countries.push(rec);
}
// largest first, so small countries draw on top and stay tappable
countries.sort((a, b) => (b.b[2] - b.b[0]) * (b.b[3] - b.b[1]) - (a.b[2] - a.b[0]) * (a.b[3] - a.b[1]));

const ids = new Set(countries.map(c => c.id));
for (const c of conflicts) {
  for (const id of [...c.where, ...c.involved]) if (!ids.has(id)) console.warn('missing country', c.id, id);
  c.pt = proj(c.marker).map(v => Math.round(v * 10) / 10);
}

const sphere = path({ type: 'Sphere' });
const grat = path(geoGraticule().step([30, 30])());
const data = { asof: ASOF, w: W, h: H, sphere, grat, countries, conflicts, sources };
const json = JSON.stringify(data);
const tpl = fs.readFileSync('app.html', 'utf8');
if (!tpl.includes('/*__DATA__*/null')) throw new Error('app.html is missing the data placeholder');
const page = tpl.replace('/*__DATA__*/null', () => json);

// 1. The Claude artifact: page content only (the artifact host adds the document skeleton).
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', page);

// 2. GitHub Pages: a complete document. Head tags go in <head>; the safe-area padding
//    matches what the artifact host adds, so both versions lay out the same.
const split = page.indexOf('<div class="app">');
const head = page.slice(0, split), body = page.slice(split);
const full = `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
${head.trim()}
</head>
<body>
${body.trim()}
</body>
</html>
`;
fs.writeFileSync('../index.html', full);
console.log('countries', countries.length, 'conflicts', conflicts.length, 'as of', ASOF, '| index.html', full.length, 'bytes');
