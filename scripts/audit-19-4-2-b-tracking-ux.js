const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const clientPath = path.join(root, "views/client/orders/tracking.ejs");
const driverPath = path.join(root, "views/driver/delivery-detail.ejs");

let pass = 0;
let fail = 0;

function check(label, ok) {
  if (ok) {
    pass++;
    console.log("[PASS] " + label);
  } else {
    fail++;
    console.log("[FAIL] " + label);
  }
}

console.log("========================================================");
console.log("TIOPTIOP — AUDIT 19.4.2.B TRACKING GPS UX");
console.log("========================================================");
console.log("");

check("tracking.ejs présent", fs.existsSync(clientPath));
check("delivery-detail.ejs présent", fs.existsSync(driverPath));

const client = fs.existsSync(clientPath) ? fs.readFileSync(clientPath, "utf8") : "";
const driver = fs.existsSync(driverPath) ? fs.readFileSync(driverPath, "utf8") : "";

check("Fond OpenFreeMap préservé", client.includes("tiles.openfreemap.org/styles/liberty"));
check("Room order:join préservée", client.includes('socket.emit(') && client.includes('"order:join"'));
check("Listener driver:location préservé", client.includes('"driver:location"'));
check("Mise à jour marqueur préservée", client.includes("updateDriverPosition"));
check("Indicateur fraîcheur GPS client présent", client.includes('id="gpsFreshness"'));
check("Fraîcheur GPS recalculée périodiquement", client.includes("refreshGpsFreshness") && client.includes("5000"));
check("États GPS direct / ancien présents", client.includes("Position en direct") && client.includes("Position ancienne"));
check("État Socket reconnecting présent", client.includes("reconnecting"));
check("Diagnostic GPS livreur préservé", driver.includes("DIAGNOSTIC GPS LIVE 19.4.2.A.2.1"));
check("Filtres GPS informatifs distingués des erreurs", driver.includes("informationalFilter") && driver.includes('"filtered"'));
check("Dérive immobile conservée", driver.includes("STATIONARY_NOISE"));
check("BAD_ACCURACY conservé", driver.includes("BAD_ACCURACY"));
check("Message dernière position valide présent", driver.includes("dernière position valide reste visible côté client"));

console.log("");
console.log("--------------------------------------------------------");
console.log(`Résultat : ${pass} PASS / ${fail} FAIL`);
console.log(fail === 0 ? "AUDIT 19.4.2.B : OK" : "AUDIT 19.4.2.B : ECHEC");
console.log("--------------------------------------------------------");

process.exit(fail === 0 ? 0 : 1);
