const crypto = require('crypto');
const QRCode = require('qrcode');

const PREFIX = 'TIOPTIOP-TIOPPLUS:';
const VERSION = 'v1';

function getSecretInfo(){
  if (process.env.LOYALTY_CARD_SECRET) return { value:String(process.env.LOYALTY_CARD_SECRET), source:'LOYALTY_CARD_SECRET', dedicated:true };
  if (process.env.SESSION_SECRET) return { value:String(process.env.SESSION_SECRET), source:'SESSION_SECRET', dedicated:false };
  if (process.env.SESSION_SECRET_KEY) return { value:String(process.env.SESSION_SECRET_KEY), source:'SESSION_SECRET_KEY', dedicated:false };
  return { value:'tioptiop-change-me', source:'FALLBACK', dedicated:false };
}
function secret(){ return getSecretInfo().value; }

function verificationSecrets(){
  const candidates=[];
  const push=(value,source,legacy=false)=>{
    const v=String(value||'').trim();
    if(!v) return;
    if(candidates.some(x=>x.value===v)) return;
    candidates.push({value:v,source,legacy});
  };

  // Clé dédiée actuelle : utilisée pour tous les nouveaux QR.
  push(process.env.LOYALTY_CARD_SECRET,'LOYALTY_CARD_SECRET',false);

  // Compatibilité de migration : les cartes générées avant 16.10.4.2
  // pouvaient être signées avec la clé de session. On continue à les
  // accepter sans réutiliser ces clés pour générer de nouveaux QR.
  push(process.env.SESSION_SECRET,'SESSION_SECRET',true);
  push(process.env.SESSION_SECRET_KEY,'SESSION_SECRET_KEY',true);

  // Si aucune clé dédiée n'est configurée, garder le comportement historique
  // pour ne pas casser l'application, mais ne jamais ajouter le fallback public
  // comme clé legacy lorsqu'une vraie clé existe.
  if(!candidates.length){
    const info=getSecretInfo();
    push(info.value,info.source,false);
  }
  return candidates;
}

function b64url(v){ return Buffer.from(String(v),'utf8').toString('base64url'); }
function safeEqual(a,b){
  const aa=Buffer.from(String(a||''),'utf8'); const bb=Buffer.from(String(b||''),'utf8');
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function sign(publicId){
  const payload=`${VERSION}.${b64url(publicId)}`;
  const sig=crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function payload(card){ return `${PREFIX}${sign(card.public_id)}`; }
async function dataUrl(card,width=360){
  return QRCode.toDataURL(payload(card),{errorCorrectionLevel:'H',margin:2,width});
}
function verifyTokenDetailed(input){
  const original=String(input||'').trim();
  if(!original) return {ok:false,code:'QR_EMPTY',message:'QR vide.'};
  const raw=original.replace(/^TIOPTIOP-TIOPPLUS:/i,'').trim();
  const parts=raw.split('.');
  if(parts.length!==3) return {ok:false,code:'QR_FORMAT_INVALID',message:'QR détecté, mais son format n’est pas celui d’une carte Tiop+.'};
  if(parts[0]!==VERSION) return {ok:false,code:'QR_VERSION_UNSUPPORTED',message:`QR Tiop+ détecté, mais version ${parts[0]||'inconnue'} non supportée.`};
  let publicId='';
  try { publicId=Buffer.from(parts[1],'base64url').toString('utf8').trim(); } catch(_) {}
  if(!publicId) return {ok:false,code:'QR_PUBLIC_ID_INVALID',message:'QR Tiop+ détecté, mais identifiant de carte illisible.'};
  const signed=`${parts[0]}.${parts[1]}`;
  const matched=verificationSecrets().find(candidate=>{
    const expected=crypto.createHmac('sha256',candidate.value).update(signed).digest('base64url');
    return safeEqual(parts[2],expected);
  });
  if(!matched) return {ok:false,code:'QR_SIGNATURE_INVALID',publicId,message:'QR Tiop+ détecté, mais signature invalide. Ce QR ne correspond à aucune clé Tiop+ connue par ce serveur.'};
  return {
    ok:true,
    code:matched.legacy?'QR_VALID_LEGACY':'QR_VALID',
    publicId,
    legacySignature:matched.legacy,
    verificationKeySource:matched.source,
    message:matched.legacy
      ? 'Ancien QR Tiop+ accepté. Vous pourrez le régénérer plus tard avec la clé Tiop+ actuelle.'
      : 'QR Tiop+ valide.'
  };
}
function verifyToken(token){ const r=verifyTokenDetailed(token); return r.ok?r.publicId:null; }
function extractPublicId(value){
  const text=String(value||'').trim();
  if(!text) return null;
  if(/^TIOPTIOP-TIOPPLUS:/i.test(text)||/^v1\./i.test(text)) return verifyToken(text);
  return null;
}
function diagnostics(){
  const info=getSecretInfo();
  return {
    source:info.source,
    dedicated:info.dedicated,
    configured:info.source!=='FALLBACK',
    fingerprint:crypto.createHash('sha256').update(info.value).digest('hex').slice(0,12),
    acceptedVerificationSources:verificationSecrets().map(x=>({source:x.source,legacy:x.legacy}))
  };
}
module.exports={sign,payload,dataUrl,verifyToken,verifyTokenDetailed,extractPublicId,diagnostics};
