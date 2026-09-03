const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const envPath=path.resolve(process.cwd(),'.env');
let text=fs.existsSync(envPath)?fs.readFileSync(envPath,'utf8'):'';
const match=text.match(/^LOYALTY_CARD_SECRET\s*=\s*(.+)$/m);
if(match&&match[1].trim()){
  console.log('✅ LOYALTY_CARD_SECRET existe déjà. Aucune modification.');
  console.log('Redémarrez Node puis régénérez/rafraîchissez le QR de la carte.');
  process.exit(0);
}
const value=crypto.randomBytes(48).toString('base64url');
if(text && !text.endsWith('\n')) text+='\n';
text+=`\n# Tiop+ — signature permanente des QR cartes physiques\nLOYALTY_CARD_SECRET=${value}\n`;
fs.writeFileSync(envPath,text,'utf8');
console.log('✅ LOYALTY_CARD_SECRET créée dans .env.');
console.log('⚠️ Gardez cette clé stable et secrète : la changer invalide les QR déjà générés.');
console.log('➡️ Redémarrez Node, ouvrez /admin/tiopplus/carte puis visualisez/téléchargez de nouveau la carte pour obtenir son QR signé avec cette clé.');
