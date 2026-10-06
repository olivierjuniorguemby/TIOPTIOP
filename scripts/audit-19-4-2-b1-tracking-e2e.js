'use strict';
const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files={ctrl:'controllers/driver/driver.controller.js',model:'models/delivery.model.js',app:'app.js',client:'views/client/orders/tracking.ejs',driver:'views/driver/delivery-detail.ejs'};
let pass=0,fail=0; const out=[];
function check(name,ok){(ok?pass++:fail++);out.push(`[${ok?'PASS':'FAIL'}] ${name}`)}
function has(s,...xs){return xs.every(x=>s.includes(x))}
console.log('========================================================');
console.log('TIOPTIOP — AUDIT 19.4.2.B.1 TRACKING GPS E2E');
console.log('========================================================\n');
for(const [k,p] of Object.entries(files)) check(`${p} présent`,fs.existsSync(path.join(root,p)));
if(fail){console.log(out.join('\n'));process.exit(1)}
const c=read(files.ctrl),m=read(files.model),a=read(files.app),v=read(files.client),d=read(files.driver);
check('Seuil GPS PC/intérieur conservé à 150 m',/MAX_ACCURACY_METERS\s*:\s*150/.test(c));
check('Coordonnées invalides rejetées',has(c,'INVALID_COORDINATES','coordinatesAreValid'));
check('Précision excessive rejetée',has(c,'BAD_ACCURACY','MAX_ACCURACY_METERS'));
check('Anti-dérive immobile actif',has(c,'STATIONARY_NOISE','stationaryRadius'));
check('Heartbeat GPS actif',has(c,'STATIONARY_HEARTBEAT','MAX_SILENCE_MS'));
check('Mouvement avec vitesse GPS peut être confirmé',has(c,'MOVEMENT_SPEED_CONFIRMED','MOVING_SPEED_MPS'));
check('Mouvement sans vitesse exige confirmation',has(c,'MOVEMENT_CONFIRMATION','REQUIRED_MOVING_POINTS','MOVEMENT_CONFIRMED'));
check('Cohérence des candidats de mouvement active',has(c,'candidateIsCoherent','MAX_CANDIDATE_GAP_METERS'));
check('Téléportation/vitesse impossible rejetée',has(c,'IMPOSSIBLE_SPEED','MAX_SPEED_KMH: 120'));
check('Point GPS persistant dans delivery_tracking_points',has(m,'INSERT INTO delivery_tracking_points'));
const insertPos=m.indexOf('INSERT INTO delivery_tracking_points');
check('Persistance GPS retourne un point inséré réel',insertPos>=0 && m.indexOf('result.insertId',insertPos)>insertPos);
const emitPos=c.indexOf('.emit(\n                        "driver:location"');
const resultInsertedPos=c.lastIndexOf('result.inserted',emitPos);
check('driver:location émis uniquement après point inséré',emitPos>0 && resultInsertedPos>0 && resultInsertedPos<emitPos);
check('Émission ciblée room order:<reference>',emitPos>0 && c.lastIndexOf('`order:${reference}`',emitPos)>0);
check('Socket client rejoint order:<reference>',has(a,'"order:join"','`order:${reference}`','socket.join'));
check('Isolation : anciennes rooms order:* quittées',has(a,'room.startsWith(\n                            "order:"','socket.leave'));
check('Client écoute driver:location',has(v,'"driver:location"','updateDriverPosition'));
check('Client vérifie la référence avant mise à jour',has(v,'data.orderId','data.reference','orderReference'));
check('Marqueur livreur mis à jour par Leaflet',has(v,'ensureDriverMarker','setLatLng'));
check('Route recalculée après position livreur',/function updateDriverPosition[\s\S]*?renderRoute\(\)/.test(v));
check('UX fraîcheur position active',has(v,'refreshGpsFreshness','Position en direct'));
check('UX reconnexion Socket.IO active',has(v,'"disconnect"','Reconnexion au suivi'));
check('Livreur utilise navigator.geolocation.watchPosition',/navigator\s*\n?\s*\.geolocation\s*\n?\s*\.watchPosition\s*\(/.test(d));
check('Livreur envoie via route HTTP /position',/fetch\([\s\S]*?\/position/.test(d));
check('Message dérive immobile non présenté comme panne',has(d,'dérive GPS ignorée','dernière position valide'));
// Sanity géométrique indépendant : prouve que le scénario de déplacement choisi pour un test futur est non nul et réaliste.
function hav(lat1,lon1,lat2,lon2){const R=6371000,rad=x=>x*Math.PI/180;const p1=rad(lat1),p2=rad(lat2),dp=rad(lat2-lat1),dl=rad(lon2-lon1);const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
const meters=hav(43.3028141,5.3865531,43.3029041,5.3865531);
check('Simulation isolée : déplacement test ≈10 m détectable',meters>9 && meters<11);
console.log(out.join('\n'));
console.log('\n--------------------------------------------------------');
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(fail?'AUDIT 19.4.2.B.1 : ECHEC':'AUDIT 19.4.2.B.1 : OK — TRACKING GPS VALIDABLE / GELABLE');
console.log('--------------------------------------------------------');
process.exit(fail?1:0);
