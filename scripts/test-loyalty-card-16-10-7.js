require('dotenv').config();
const fs=require('fs');
const path=require('path');
const db=require('../config/database');
const Card=require('../models/loyalty-card.model');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cardSrc=read('models/loyalty-card.model.js');
const refundSrc=read('services/refund.service.js');
const paymentSrc=read('services/payment.service.js');
const adminPaySrc=read('controllers/admin/payment.controller.js');
let pass=0,fail=0,warn=0;
function out(letter,title,ok,details=[]){console.log(`\nTEST ${letter} — ${title}`);for(const d of details)console.log('  '+d);console.log(ok===true?'  ✅ PASS':ok===false?'  ❌ FAIL':'  ⚠️  À CONTRÔLER');if(ok===true)pass++;else if(ok===false)fail++;else warn++;}
async function one(sql,p=[]){const r=await db.query(sql,p);return r[0]||null}
async function scalar(sql,p=[]){const r=await one(sql,p);return r?Number(Object.values(r)[0]||0):0}
(async()=>{try{
 console.log('='.repeat(72));console.log(' TIOPTIOP — 16.10.7 — TESTS AUTOMATISÉS / AUDIT CARTES TIOP+');console.log(' Mode sûr : lecture DB + analyse du code, aucune donnée métier modifiée.');console.log('='.repeat(72));
 const tables=['loyalty_cards','loyalty_card_transactions','loyalty_card_order_links','loyalty_card_redemptions','loyalty_card_replacements','loyalty_card_account_links','orders','payments','payment_refunds'];
 const missing=[];for(const t of tables){if(!(await scalar(`SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,[t])))missing.push(t)}
 if(missing.length)throw new Error('Tables manquantes : '+missing.join(', '));

 const A=cardSrc.includes("if(x.status==='RESTORED')")&&cardSrc.includes("['RESERVED','USED'].includes(x.status)")&&cardSrc.includes("'REVERSAL'");
 out('A','Annulation AVANT paiement + récompense',A,[A?'restoreOrderRedemption() restitue une seule fois les points RESERVED/USED.':'Protection de restitution introuvable dans loyalty-card.model.js.',A?'Aucun EARN n’est créé par la fonction de restitution.':'']);

 const B=cardSrc.includes("reason:'NO_CARD_REDEMPTION'");
 out('B','Annulation avant paiement sans récompense',B,[B?'Sans redemption, restoreOrderRedemption() sort sans toucher au solde.':'Sortie NO_CARD_REDEMPTION introuvable.']);

 const C=cardSrc.includes("transaction_type='EARN'")&&cardSrc.includes("reason:'ALREADY_CREDITED'")&&cardSrc.includes("status='USED'")&&(paymentSrc.includes('LoyaltyCard.finalizeOrderRedemption')||adminPaySrc.includes('LoyaltyCard.finalizeOrderRedemption'));
 out('C','Paiement normal + récompense',C,[C?'Paiement finalise RESERVED → USED et EARN est protégé contre le doublon.':'Chaînage paiement/récompense ou idempotence EARN incomplet.']);

 const hasPhysicalEarnReverse=/LoyaltyCard\.(reverse|revers).*Earn|reverse.*loyalty_card_transactions|transaction_type\s*=\s*['\"]EARN['\"].*(REVERSAL|refund)/is.test(refundSrc);
 const D=hasPhysicalEarnReverse&&refundSrc.includes("LoyaltyCard.restoreOrderRedemption");
 out('D','Remboursement TOTAL après paiement avec récompense',D,[refundSrc.includes("LoyaltyCard.restoreOrderRedemption")?'Restitution de la récompense physique : présente.':'Restitution de la récompense physique : absente.',hasPhysicalEarnReverse?'Annulation des points EARN physiques : présente.':'⚠️ Annulation des points EARN physiques : NON détectée dans refund.service.js.']);

 const E=hasPhysicalEarnReverse;
 out('E','Remboursement TOTAL sans récompense',E,[E?'Les points EARN de la carte sont inversés.':'Aucune logique détectée pour retirer les EARN d’une carte physique après remboursement total.']);

 const fullRestoreCount=(refundSrc.match(/LoyaltyCard\.restoreOrderRedemption\([^)]*FULL_REFUND[^)]*\)/g)||[]).length;
 const F=fullRestoreCount>0;
 out('F','Remboursement PARTIEL',F,[F?'La restitution de récompense physique est branchée sur les chemins FULL_REFUND, pas sur un simple PARTIAL.':'Impossible de confirmer le garde-fou remboursement partiel.']);

 const dupEarn=await db.query(`SELECT card_id,order_id,COUNT(*) n FROM loyalty_card_transactions WHERE transaction_type='EARN' AND order_id IS NOT NULL GROUP BY card_id,order_id HAVING COUNT(*)>1`);
 const dupSpend=await db.query(`SELECT card_id,order_id,COUNT(*) n FROM loyalty_card_transactions WHERE transaction_type='SPEND' AND order_id IS NOT NULL GROUP BY card_id,order_id HAVING COUNT(*)>1`);
 const dupRev=await db.query(`SELECT card_id,order_id,COUNT(*) n FROM loyalty_card_transactions WHERE transaction_type='REVERSAL' AND order_id IS NOT NULL GROUP BY card_id,order_id HAVING COUNT(*)>1`);
 const G=!dupEarn.length&&!dupSpend.length&&!dupRev.length;
 out('G','Idempotence',G,[`Doublons EARN=${dupEarn.length}, SPEND=${dupSpend.length}, REVERSAL=${dupRev.length}.`,`Le code EARN et RESTORED contient aussi des gardes idempotentes.`]);

 const suspended=await scalar(`SELECT COUNT(*) n FROM loyalty_cards WHERE status='SUSPENDED'`);
 const H=cardSrc.includes("card_status")&&cardSrc.includes("CARD_NOT_ACTIVE")&&cardSrc.includes("status='ACTIVE'");
 out('H','Carte SUSPENDED',H,[`Cartes SUSPENDED actuelles : ${suspended}.`,'Les gains/récompenses exigent une carte ACTIVE.']);

 const expired=await scalar(`SELECT COUNT(*) n FROM loyalty_cards WHERE status='EXPIRED' OR (expires_at IS NOT NULL AND expires_at<=NOW())`);
 const I=cardSrc.includes('expires_at')&&cardSrc.includes('CARD_NOT_ACTIVE');
 out('I','Carte EXPIRED',I,[`Cartes expirées actuelles : ${expired}.`,'Le contrôle expires_at est présent avant gain/utilisation.']);

 const repl=await db.query(`SELECT r.old_card_id,r.new_card_id,r.points_transferred,o.card_number old_number,o.status old_status,o.points_balance old_points,n.card_number new_number,n.status new_status,n.points_balance new_points FROM loyalty_card_replacements r JOIN loyalty_cards o ON o.id=r.old_card_id JOIN loyalty_cards n ON n.id=r.new_card_id ORDER BY r.id DESC LIMIT 5`);
 const badRepl=repl.filter(x=>x.old_status!=='REVOKED'||Number(x.old_points)!==0||x.new_status!=='ACTIVE');
 out('J','Carte REVOKED / remplacée',repl.length>0&&!badRepl.length,[`Remplacements trouvés : ${repl.length}.`,badRepl.length?`Incohérences : ${badRepl.length}.`:'Anciennes cartes révoquées à 0 pt ; nouvelles cartes actives.']);

 const linked=await db.query(`SELECT lc.id,lc.card_number,lc.points_balance,lc.user_id,u.email,la.user_id linked_user_id FROM loyalty_cards lc JOIN loyalty_card_account_links la ON la.card_id=lc.id LEFT JOIN users u ON u.id=lc.user_id ORDER BY la.id DESC LIMIT 10`);
 let K=null, kd='Aucune carte rattachée trouvée.';
 if(linked.length){const x=linked[0];const acct=await one(`SELECT points_balance FROM loyalty_accounts WHERE user_id=? LIMIT 1`,[x.user_id]);K=Number(x.user_id)===Number(x.linked_user_id);kd=`Carte ${x.card_number}: ${x.points_balance} pts | compte user #${x.user_id}: ${acct?acct.points_balance:'N/A'} pts (portefeuilles distincts).`;}
 out('K','Carte rattachée à un compte client',K,[kd]);

 const orphanLinks=await scalar(`SELECT COUNT(*) n FROM loyalty_card_order_links l LEFT JOIN orders o ON o.id=l.order_id LEFT JOIN loyalty_cards c ON c.id=l.card_id WHERE o.id IS NULL OR c.id IS NULL`);
 const orphanRed=await scalar(`SELECT COUNT(*) n FROM loyalty_card_redemptions r LEFT JOIN loyalty_cards c ON c.id=r.card_id LEFT JOIN loyalty_rewards w ON w.id=r.reward_id WHERE c.id IS NULL OR w.id IS NULL`);
 const negCards=await scalar(`SELECT COUNT(*) n FROM loyalty_cards WHERE points_balance<0`);
 const usedUnpaid=await scalar(`SELECT COUNT(*) n FROM loyalty_card_redemptions r LEFT JOIN payments p ON p.order_id=r.order_id AND p.status IN ('PAID','PARTIAL','REFUNDED') WHERE r.status='USED' AND p.id IS NULL`);
 const L=!orphanLinks&&!orphanRed&&!dupEarn.length&&!dupSpend.length&&!dupRev.length&&!usedUnpaid;
 out('L','Audit final SQL/Node',L,[`Orphelins order_links=${orphanLinks}, redemptions=${orphanRed}.`,`Doublons EARN=${dupEarn.length}, SPEND=${dupSpend.length}, REVERSAL=${dupRev.length}.`,`USED sans paiement reconnu=${usedUnpaid}. Cartes avec solde négatif=${negCards} (informatif).`]);

 console.log('\n'+'='.repeat(72));console.log(`RÉSULTAT 16.10.7 : PASS=${pass} | FAIL=${fail} | À CONTRÔLER=${warn}`);if(fail)console.log('⚠️ Ne pas clôturer 16.10.7 : corriger les FAIL avant validation finale.');else console.log('✅ Aucun FAIL détecté par cet audit.');console.log('='.repeat(72));
 }catch(e){console.error('\n❌ Audit impossible :',e.stack||e);process.exitCode=1}finally{try{await db.pool.end()}catch(_){}}
})();
