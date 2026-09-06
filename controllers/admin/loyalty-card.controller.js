const Card = require('../../models/loyalty-card.model');
const CardQr = require('../../services/loyalty-card-qr.service');

function adminId(req){ return Number(req.session?.admin?.id) || null; }
function clean(v){ return String(v ?? '').trim(); }
function points(v){ const n=Math.trunc(Number(v)); return Number.isFinite(n)?n:0; }
function form(body){
  return {
    firstName:clean(body.first_name), lastName:clean(body.last_name), displayName:clean(body.display_name),
    phone:clean(body.phone)||null, email:clean(body.email)||null, cardType:clean(body.card_type)||'VIP',
    expiresAt:clean(body.expires_at)||null, status:['ACTIVE','SUSPENDED','EXPIRED','REVOKED'].includes(body.status)?body.status:'ACTIVE'
  };
}
exports.index=async(req,res,next)=>{try{
  const q=clean(req.query.q).toLowerCase(), type=clean(req.query.type).toUpperCase(), status=clean(req.query.status).toUpperCase(), expiry=clean(req.query.expiry), minPoints=req.query.min_points===''?null:Number(req.query.min_points), maxPoints=req.query.max_points===''?null:Number(req.query.max_points);
  let cards=await Card.listAll(); const now=new Date(), soon=new Date(Date.now()+30*86400000);
  cards=cards.filter(c=>{ const hay=[c.card_number,c.display_name,c.first_name,c.last_name,c.phone,c.email].filter(Boolean).join(' ').toLowerCase(); const exp=c.expires_at?new Date(c.expires_at):null; return (!q||hay.includes(q))&&(!type||c.card_type===type)&&(!status||c.status===status)&&(!Number.isFinite(minPoints)||Number(c.points_balance)>=minPoints)&&(!Number.isFinite(maxPoints)||Number(c.points_balance)<=maxPoints)&&(!expiry||(expiry==='EXPIRED'&&exp&&exp<now)||(expiry==='SOON'&&exp&&exp>=now&&exp<=soon)||(expiry==='NONE'&&!exp)); });
  const cardsWithQr=await Promise.all(cards.map(async c=>({...c,qrDataUrl:await CardQr.dataUrl(c,320)})));
  const all=await Card.listAll(); const stats={total:all.length,active:all.filter(c=>c.status==='ACTIVE').length,suspended:all.filter(c=>c.status==='SUSPENDED').length,expired:all.filter(c=>c.status==='EXPIRED'||(c.expires_at&&new Date(c.expires_at)<now)).length};
  res.render('admin/catalog/loyalty-cards',{title:'Cartes Tiop+',layout:'layouts/admin',cards:cardsWithQr,stats,filters:{q:req.query.q||'',type,status,expiry,min_points:req.query.min_points||'',max_points:req.query.max_points||''},cardCreated:req.query.cardCreated,cardUpdated:req.query.cardUpdated,cardReplaced:req.query.cardReplaced,cardLinked:req.query.cardLinked,newCardId:req.query.newCardId});
}catch(e){next(e)}};
exports.create=async(req,res,next)=>{try{
  const data=form(req.body); const initial=Math.max(0,points(req.body.points));
  if(!data.displayName && !data.firstName && !data.lastName) return res.status(400).send('Nom de la personne obligatoire.');
  await Card.createGuestCard({...data,points:initial,adminUserId:adminId(req)});
  res.redirect('/admin/tiopplus/carte?cardCreated=1');
}catch(e){next(e)}};
exports.edit=(req,res)=>res.redirect('/admin/tiopplus/carte');
exports.update=async(req,res,next)=>{try{
  const id=Number(req.params.id); const current=await Card.findById(id); if(!current)return res.status(404).send('Carte introuvable.');
  const data=form(req.body); if(!data.displayName && !data.firstName && !data.lastName)return res.status(400).send('Nom obligatoire.');
  await Card.updateCard(id,data);
  const target=points(req.body.points_balance); const delta=target-Number(current.points_balance||0);
  if(delta) await Card.adjustPoints(id,delta,clean(req.body.adjustment_reason)||'Ajustement administratif.',adminId(req));
  res.redirect('/admin/tiopplus/carte?cardUpdated=1');
}catch(e){next(e)}};
exports.print=(req,res)=>res.redirect('/admin/tiopplus/carte');
exports.download=async(req,res,next)=>{try{
  const card=await Card.findById(req.params.id); if(!card)return res.status(404).send('Carte introuvable.');
  const qr=await CardQr.dataUrl(card,500);
  const name=(card.display_name || [card.first_name,card.last_name].filter(Boolean).join(' ') || 'MEMBRE TIOP+').replace(/[<>&]/g,'');
  const expiry=card.expires_at ? new Date(card.expires_at).toLocaleDateString('fr-FR') : 'Sans expiration';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1016" height="638" viewBox="0 0 1016 638">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#090909"/><stop offset=".58" stop-color="#17110d"/><stop offset="1" stop-color="#2a1609"/></linearGradient><linearGradient id="orange" x1="0" x2="1"><stop stop-color="#ff7900"/><stop offset="1" stop-color="#e96d00"/></linearGradient></defs>
  <rect width="1016" height="638" rx="54" fill="url(#bg)"/><circle cx="980" cy="160" r="190" fill="#ff7900" opacity=".08"/><circle cx="930" cy="80" r="110" fill="#ff7900" opacity=".08"/>
  <text x="58" y="82" fill="#fff" font-family="Arial" font-size="58" font-weight="900">Tiop<tspan fill="#ff7900">+</tspan></text><text x="60" y="112" fill="#ffc15f" font-family="Arial" font-size="18" font-weight="800">CARTE DE FIDÉLITÉ</text>
  <text x="60" y="196" fill="#d8d0c8" font-family="Arial" font-size="16" font-weight="700">N° MEMBRE</text><text x="60" y="238" fill="#ffb23c" font-family="Arial" font-size="36" font-weight="900">${card.card_number}</text>
  <text x="60" y="308" fill="#d8d0c8" font-family="Arial" font-size="16" font-weight="700">NOM DU MEMBRE</text><text x="60" y="348" fill="#fff" font-family="Arial" font-size="30" font-weight="900">${name}</text>
  <text x="790" y="75" text-anchor="middle" fill="#d9cec0" font-family="Arial" font-size="16">TYPE</text><text x="790" y="110" text-anchor="middle" fill="#ffba48" font-family="Arial" font-size="30" font-weight="900">${card.card_type}</text>
  <rect x="700" y="132" width="220" height="220" rx="28" fill="#fff" stroke="#ffb23c" stroke-width="8"/><image href="${qr}" x="720" y="152" width="180" height="180"/><text x="810" y="382" text-anchor="middle" fill="#f7eee5" font-family="Arial" font-size="15" font-weight="700">Scan en caisse</text>
  <rect y="430" width="1016" height="208" fill="url(#orange)"/><text x="60" y="490" fill="#fff" font-family="Arial" font-size="16" font-weight="800">SOLDE POINTS</text><text x="60" y="560" fill="#fff" font-family="Arial" font-size="62" font-weight="900">★ ${Number(card.points_balance||0).toLocaleString('fr-FR')} <tspan font-size="20">points</tspan></text>
  <line x1="540" y1="462" x2="540" y2="595" stroke="#fff" opacity=".25"/><text x="590" y="490" fill="#fff" font-family="Arial" font-size="16" font-weight="800">VALIDITÉ</text><text x="590" y="548" fill="#fff" font-family="Arial" font-size="34" font-weight="900">${expiry}</text><text x="590" y="582" fill="#fff" font-family="Arial" font-size="15">Statut : ${card.status}</text></svg>`;
  res.setHeader('Content-Type','image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="TiopPlus-${card.card_number}.svg"`);
  res.send(svg);
}catch(e){next(e)}};

exports.history=async(req,res,next)=>{try{
  const id=Number(req.params.id);
  const card=await Card.findById(id);
  if(!card)return res.status(404).json({ok:false,message:'Carte Tiop+ introuvable.'});
  const transactions=await Card.listTransactions(id);
  res.json({ok:true,card,transactions});
}catch(e){next(e)}};

exports.signToken=CardQr.sign;


// 16.10.6.1 — cycle de vie : suspension / réactivation / révocation
exports.changeStatus=async(req,res,next)=>{try{
 const id=Number(req.params.id),status=clean(req.body.status).toUpperCase(),reason=clean(req.body.reason);
 await Card.changeStatus(id,status,reason,adminId(req));
 res.redirect('/admin/tiopplus/carte?cardUpdated=1');
}catch(e){next(e)}};
exports.lifecycle=async(req,res,next)=>{try{
 const id=Number(req.params.id),card=await Card.findById(id);if(!card)return res.status(404).json({ok:false,message:'Carte Tiop+ introuvable.'});
 const events=await Card.listLifecycleEvents(id);res.json({ok:true,card,events});
}catch(e){next(e)}};


// 16.10.6.2 — remplacement d'une carte perdue / détériorée
exports.replace=async(req,res,next)=>{try{
 const id=Number(req.params.id),reason=clean(req.body.reason);
 if(!reason)return res.status(400).send('Le motif du remplacement est obligatoire.');
 const newCard=await Card.replaceCard(id,{reason,adminUserId:adminId(req)});
 res.redirect(`/admin/tiopplus/carte?cardReplaced=1&newCardId=${Number(newCard.id)}`);
}catch(e){next(e)}};


// 16.10.6.3 — rattachement carte physique -> compte client Tiop+
exports.searchCustomers=async(req,res,next)=>{try{
 const q=clean(req.query.q); const customers=await Card.searchCustomersForLink(q,12); res.json({ok:true,customers});
}catch(e){next(e)}};
exports.linkAccount=async(req,res,next)=>{try{
 const id=Number(req.params.id),userId=Number(req.body.user_id),reason=clean(req.body.reason);
 await Card.linkToCustomer(id,userId,{reason,adminUserId:adminId(req)});
 res.redirect('/admin/tiopplus/carte?cardLinked=1');
}catch(e){next(e)}};
exports.linkedAccount=async(req,res,next)=>{try{
 const card=await Card.findById(req.params.id);if(!card)return res.status(404).json({ok:false,message:'Carte Tiop+ introuvable.'});
 const customer=await Card.getLinkedCustomer(req.params.id);res.json({ok:true,card,customer});
}catch(e){next(e)}};
