const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TRACKING = path.join(ROOT, "views", "client", "orders", "tracking.ejs");
let pass = 0;
let fail = 0;

function check(label, condition) {
    if (condition) { console.log(`[PASS] ${label}`); pass++; }
    else { console.log(`[FAIL] ${label}`); fail++; }
}

console.log("========================================================");
console.log("TIOPTIOP — AUDIT 19.4.2.A.2 MAP + GPS LIVE");
console.log("========================================================\n");

check("tracking.ejs présent", fs.existsSync(TRACKING));
if (!fs.existsSync(TRACKING)) process.exit(1);
const s = fs.readFileSync(TRACKING, "utf8");

check("Leaflet 1.9.4 préservé", s.includes("leaflet@1.9.4"));
check("MapLibre GL chargé avec version épinglée", s.includes("maplibre-gl@4.7.1/dist/maplibre-gl.js"));
check("Adaptateur Leaflet/MapLibre chargé", s.includes("@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js"));
check("OpenFreeMap Liberty configuré", s.includes("https://tiles.openfreemap.org/styles/liberty"));
check("Ancien fond CARTO retiré", !s.includes("basemaps.cartocdn.com"));
check("Ancien serveur OSM Standard retiré", !s.includes("tile.openstreetmap.org/{z}/{x}/{y}.png"));
check("Aucune clé API cartographique codée en dur", !/api[_ -]?key\s*[:=]\s*[\"'][^\"']+/i.test(s));
check("Attribution OpenFreeMap présente", s.includes("OpenFreeMap"));
check("Attribution OpenMapTiles présente", s.includes("OpenMapTiles"));
check("Attribution OpenStreetMap présente", s.includes("OpenStreetMap"));
check("Room de commande préservée", s.includes('socket.emit(\n                    "order:join"') || s.includes('"order:join"'));
check("Listener driver:location préservé", s.includes('"driver:location"'));
check("Filtrage de la référence de commande préservé", s.includes("orderReference"));
check("Mise à jour marqueur livreur préservée", s.includes("updateDriverPosition") && s.includes("ensureDriverMarker"));
check("Pan automatique du livreur préservé", s.includes("map.panTo"));
check("Affichage heure GPS préservé", s.includes("Position GPS reçue"));

console.log("\n--------------------------------------------------------");
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(fail === 0 ? "AUDIT 19.4.2.A.2 : OK" : "AUDIT 19.4.2.A.2 : ECHEC");
console.log("--------------------------------------------------------");
console.log("\nNOTE : cet audit vérifie le câblage statique. Le test final GPS");
console.log("doit être fait avec la page livreur + la page client ouvertes :");
console.log("le marqueur livreur doit bouger sans F5 après un point GPS accepté.");
process.exitCode = fail === 0 ? 0 : 1;
