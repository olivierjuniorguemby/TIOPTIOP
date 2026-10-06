'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const trackingPath = path.join(root, 'views', 'client', 'orders', 'tracking.ejs');
let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`[PASS] ${label}`);
  } else {
    fail++;
    console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('========================================================');
console.log('TIOPTIOP — AUDIT 19.4.2.A.1 MAP');
console.log('========================================================\n');

check('tracking.ejs présent', fs.existsSync(trackingPath), trackingPath);

if (fs.existsSync(trackingPath)) {
  const src = fs.readFileSync(trackingPath, 'utf8');
  check('Leaflet initialisé', /L\s*\.map\s*\(\s*["']trackingMap["']\s*\)/m.test(src));
  check('Ancien serveur OSM Standard retiré', !src.includes('tile.openstreetmap.org'));
  check('Fond CARTO configuré', src.includes('basemaps.cartocdn.com/light_all'));
  check('Attribution OpenStreetMap conservée', src.includes('openstreetmap.org/copyright'));
  check('Attribution CARTO présente', src.includes('carto.com/attributions'));
  check('Room de commande préservée', src.includes('order:join'));
  check('Listener driver:location préservé', src.includes('driver:location'));
  check('Mise à jour marqueur livreur préservée', src.includes('updateDriverPosition'));
}

console.log('\n--------------------------------------------------------');
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(`AUDIT 19.4.2.A.1 : ${fail === 0 ? 'OK' : 'ECHEC'}`);
console.log('--------------------------------------------------------');

process.exitCode = fail === 0 ? 0 : 1;
