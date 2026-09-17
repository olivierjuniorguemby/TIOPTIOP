const fs=require('fs');
let pass=0,fail=0;function t(n,c){console.log((c?'PASS':'FAIL')+' - '+n);c?pass++:fail++}
const a=fs.readFileSync('views/admin/content/support.ejs','utf8'),c=fs.readFileSync('views/client/account/support.ejs','utf8');
for(const [n,s] of [['admin',a],['client',c]]){
 t(n+' data-sender statique',/data-sender="<%= m\.sender_type %>"/.test(s));
 t(n+' désélection visuelle',/support-bulk-select'\)\?\.classList\.toggle\('active',on\)/.test(s));
 t(n+' suppression auteur seulement',/allMine=.*dataset\.sender===ROLE/.test(s)&&/deleteChoice\(selected\.size,allMine\)/.test(s));
 t(n+' modal upload automatique',/support-compose-preview/.test(s)&&/addEventListener\('change'/.test(s));
 t(n+' ajout fichiers dans modal',/scp-add/.test(s)&&/merged=\[\.\.\.files\(\),\.\.\.extra\.files\]/.test(s));
 t(n+' retrait fichier avant envoi',/Retirer ce fichier/.test(s)&&/a\.splice\(i,1\)/.test(s));
}
console.log(`\nRÉSULTAT 18.7.2.4.3 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
