const fs = require('fs');
const path = require('path');

const root = process.cwd();
let pass = 0;
let fail = 0;

function check(label, ok) {
  if (ok) { pass++; console.log(`[PASS] ${label}`); }
  else { fail++; console.log(`[FAIL] ${label}`); }
}
function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

console.log('========================================================');
console.log('TIOPTIOP — AUDIT 19.4.2.A.2.1 GPS LIVE DIAGNOSTIC');
console.log('========================================================\n');

const driverView = read('views/driver/delivery-detail.ejs');
const controller = read('controllers/driver/driver.controller.js');
const routes = read('routes/driver/index.routes.js');
const tracking = read('views/client/orders/tracking.ejs');
const app = read('app.js');

check('delivery-detail.ejs présent', !!driverView);
check('watchPosition GPS livreur préservé', driverView.includes('.watchPosition('));
check('POST /position préservé', driverView.includes('"/position"'));
check('Diagnostic data.filtered ajouté', driverView.includes('data.filtered'));
check('Diagnostic BAD_ACCURACY ajouté', driverView.includes('BAD_ACCURACY'));
check('Le livreur distingue inserted=true', driverView.includes('data.inserted'));
check('Le livreur distingue rateLimited', driverView.includes('data.rateLimited'));
check('Trace console réponse serveur ajoutée', driverView.includes('[TiopTiop GPS] Réponse serveur'));
check('Route GPS backend présente', routes.includes('/livraisons/:reference/position'));
check('Filtre précision backend présent', controller.includes('MAX_ACCURACY_METERS: 50'));
check('Émission driver:location backend préservée', controller.includes('"driver:location"'));
check('Room order:<reference> backend préservée', controller.includes('`order:${reference}`'));
check('Client écoute driver:location', tracking.includes('"driver:location"'));
check('Client rejoint order:join', tracking.includes('"order:join"'));
check('Isolation Socket.IO order:* présente', app.includes('room.startsWith(') && app.includes('"order:"'));

console.log('\n--------------------------------------------------------');
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(fail ? 'AUDIT 19.4.2.A.2.1 : ECHEC' : 'AUDIT 19.4.2.A.2.1 : OK');
console.log('--------------------------------------------------------');
process.exitCode = fail ? 1 : 0;
