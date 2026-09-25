const fs=require('fs');
const checks=[];
for (const [file,role] of [['views/client/account/support.ejs','CUSTOMER'],['views/admin/content/support.ejs','ADMIN']]) {
  const s=fs.readFileSync(file,'utf8');
  checks.push([`${file}: cache auteur sélection`,s.includes('selectedSender=new Map()')]);
  checks.push([`${file}: auteur mémorisé au clic`,s.includes("selectedSender.set(id,String(m.dataset.sender||''))")]);
  checks.push([`${file}: recalage après rerender`,s.includes('if(on&&m.dataset.sender)selectedSender.set(mid,String(m.dataset.sender))')]);
  checks.push([`${file}: calcul ownership stable`,s.includes('const senderFor=id=>') && s.includes("const allMine=[...selected].every(id=>senderFor(id)===ROLE)")]);
  checks.push([`${file}: rôle ${role}`,s.includes(`const ROLE='${role}'`)]);
}
let pass=0,fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} - ${n}`);ok?pass++:fail++;}
console.log(`\nRÉSULTAT 18.7.2.5.1 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
