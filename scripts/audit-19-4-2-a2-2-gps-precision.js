'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const controller = path.join(root, 'controllers', 'driver', 'driver.controller.js');
let pass=0, fail=0;
function check(label, ok){ if(ok){pass++; console.log(`[PASS] ${label}`);} else {fail++; console.log(`[FAIL] ${label}`);} }
console.log('========================================================');
console.log('TIOPTIOP — AUDIT 19.4.2.A.2.2 GPS PRECISION');
console.log('========================================================\n');
check('driver.controller.js présent', fs.existsSync(controller));
if(fs.existsSync(controller)){
 const s=fs.readFileSync(controller,'utf8');
 check('Seuil GPS compatible PC / Wi-Fi / intérieur = 150 m', /MAX_ACCURACY_METERS\s*:\s*150\b/.test(s));
 check('Ancien seuil bloquant de 50 m retiré', !/MAX_ACCURACY_METERS\s*:\s*50\b/.test(s));
 check('Filtre BAD_ACCURACY conservé', s.includes('BAD_ACCURACY'));
 check('Validation des coordonnées conservée', s.includes('coordinatesAreValid'));
 check('Protection vitesse impossible conservée', s.includes('IMPOSSIBLE_SPEED'));
 check('Protection dérive immobile conservée', s.includes('STATIONARY_NOISE'));
 check('Confirmation de mouvement conservée', s.includes('MOVEMENT_CONFIRMATION'));
 check('Cohérence des candidats conservée', s.includes('candidateIsCoherent'));
 check('Limite vitesse 120 km/h conservée', /MAX_SPEED_KMH\s*:\s*120\b/.test(s));
 check('Écriture tracking BDD conservée', s.includes('recordTrackingPoint'));
 check('Émission driver:location conservée', s.includes('"driver:location"'));
 check('Room order:<reference> conservée', s.includes('`order:${reference}`'));
 check('Émission uniquement après insertion BDD conservée', /if\s*\(\s*result\.inserted\s*\)/s.test(s));
 check('Réponse expose toujours accuracyMeters', s.includes('accuracyMeters'));
}
console.log('\n--------------------------------------------------------');
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(fail ? 'AUDIT 19.4.2.A.2.2 : ECHEC' : 'AUDIT 19.4.2.A.2.2 : OK');
console.log('--------------------------------------------------------');
process.exitCode = fail ? 1 : 0;
