const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'views', 'partials', 'client', 'header.ejs');
const src = fs.readFileSync(file, 'utf8');
const checks = [
  ['logo client présent', /src="\/media\/logo\.png"/.test(src)],
  ['largeur intrinsèque', /width="76"/.test(src)],
  ['hauteur intrinsèque', /height="76"/.test(src)],
  ['dimensions critiques inline', /style="[^"]*width:76px;[^"]*height:76px/.test(src)],
  ['chargement prioritaire', /fetchpriority="high"/.test(src)],
];
let pass=0, fail=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} - ${name}`); ok?pass++:fail++; }
console.log(`\nRÉSULTAT 19.1.1 : PASS=${pass} | FAIL=${fail}`);
process.exitCode = fail ? 1 : 0;
