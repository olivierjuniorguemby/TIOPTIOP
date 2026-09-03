let posSelectedLoyaltyRedemption=null;
let posSelectedPhysicalLoyaltyCard=null;
let posSelectedPhysicalRewardId=null;
let posLoyaltyScannerStream=null;
let posLoyaltyScannerTimer=null;
let posLastServerCart=null;
let posReviewIdempotencyKey=null;
let posOrderCreationInProgress=false;

function createPosIdempotencyKey(){
    if(window.crypto && typeof window.crypto.randomUUID==="function"){
        return window.crypto.randomUUID();
    }
    return `pos-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function posSelectLabel(id){const e=document.getElementById(id);return e?.options?.[e.selectedIndex]?.text||e?.value||"—";}
function posReviewLine(k,v){return `<div class="pos-review-line"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v||"—"))}</strong></div>`;}
function closePosReview(){const m=document.getElementById("posReviewModal");if(m)m.hidden=true;}
async function openPosReview(){
 if(!posCart.length){alert("Ajoutez au moins un produit ou une formule au panier.");return;}
 const ce=validatePosCustomerContext();if(ce){alert(ce);return;}const fe=validatePosFulfillment();if(fe){alert(fe);return;}
 if(getPosOrderType()==="DELIVERY" && !selectedPosDeliveryZoneId()){alert("Sélectionnez une zone de livraison.");return;}
 const m=document.getElementById("posReviewModal"),err=document.getElementById("posReviewError");if(!m)return;m.hidden=false;if(err){err.hidden=true;err.textContent="";}
 try{
  const r=await fetch("/admin/pos/calcul",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:posCart.map(i=>({key:i.key,type:i.type,id:i.id,quantity:i.quantity,optionValueIds:i.optionValueIds||[],instructions:i.instructions||""})),orderType:getPosOrderType(),restaurantId:selectedPosRestaurantId(),deliveryZoneId:getPosOrderType()==="DELIVERY"?selectedPosDeliveryZoneId():null,loyaltyCardPublicId:posSelectedPhysicalLoyaltyCard?.publicId||null,loyaltyCardRewardId:posSelectedPhysicalRewardId||null})});
  const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.message||"Vérification serveur impossible.");const c=d.cart;posLastServerCart=c;posReviewIdempotencyKey=createPosIdempotencyKey();
  const mode=document.getElementById("posClientMode")?.value||"GUEST";let title="Client invité",name=[document.getElementById("posGuestFirstName")?.value,document.getElementById("posGuestLastName")?.value].filter(Boolean).join(" "),phone=document.getElementById("posGuestPhone")?.value||"";
  if(mode==="ACCOUNT"){title="Client avec compte";name=posSelectedCustomer?.displayName||"";phone=posSelectedCustomer?.phone||"";}if(mode==="ANONYMOUS"){title="Comptoir / anonyme";name="Aucune identité associée";phone="";}
  document.getElementById("posReviewCustomer").innerHTML=posReviewLine("Type",title)+posReviewLine("Nom",name)+(phone?posReviewLine("Téléphone",phone):"")+posReviewLine("Canal",posSelectLabel("posChannel"));
  let f=posReviewLine("Mode",getPosOrderType()==="DELIVERY"?"Livraison":getPosOrderType()==="PICKUP"?"Retrait":"Sur place")+posReviewLine("Restaurant",c.restaurant?.name);
  if(getPosOrderType()==="DELIVERY"){const a=[document.getElementById("posDeliveryAddress1")?.value,document.getElementById("posDeliveryAddress2")?.value,document.getElementById("posDeliveryDistrict")?.value,document.getElementById("posDeliveryCity")?.value].filter(Boolean).join(", ");f+=posReviewLine("Zone",c.deliveryZone?.name)+posReviewLine("Adresse",a);}
  document.getElementById("posReviewFulfillment").innerHTML=f;
  document.getElementById("posReviewItems").innerHTML=c.items.map(i=>{
      const options=(i.selectedOptions||[]).map(o=>`${escapeHtml(o.groupName)} : ${escapeHtml(o.name)}${Number(o.priceDelta)>0?` (+${escapeHtml(formatPosMoney(o.priceDelta,c.currency))})`:""}`).join(" · ");
      const instructions=i.instructions?`<span class="pos-review-options">Cuisine : ${escapeHtml(i.instructions)}</span>`:"";
      return `<div class="pos-review-item"><div><strong>${escapeHtml(i.name)}</strong><small>${i.quantity} × ${escapeHtml(formatPosMoney(i.unitPrice,c.currency))}</small>${options?`<span class="pos-review-options">${options}</span>`:""}${instructions}</div><strong>${escapeHtml(formatPosMoney(i.lineTotal,c.currency))}</strong></div>`;
    }).join("");
  {
    let loyaltyHtml="";
    if(c.loyaltyReward){
      const lr=c.loyaltyReward;
      loyaltyHtml=posReviewLine("Avantage Tiop+",lr.name||"Récompense Tiop+")
        +posReviewLine("Coût fidélité",`${Number(lr.pointsCost||0)} points`)
        +(posSelectedPhysicalLoyaltyCard?posReviewLine("Carte",`${posSelectedPhysicalLoyaltyCard.displayName||"Carte Tiop+"} — ${posSelectedPhysicalLoyaltyCard.cardNumber||""}`):"")
        +(lr.rewardType==="PRODUCT"&&lr.rewardProductName?posReviewLine("Produit offert",lr.rewardProductName):"");
    }
    document.getElementById("posReviewTotals").innerHTML=loyaltyHtml+posReviewLine("Sous-total",formatPosMoney(c.subtotal,c.currency))+posReviewLine("Réduction",formatPosMoney(c.discountAmount,c.currency))+posReviewLine("Livraison",formatPosMoney(c.deliveryFee,c.currency))+posReviewLine("Taxes",formatPosMoney(c.taxAmount,c.currency))+posReviewLine("TOTAL",formatPosMoney(c.total,c.currency));
  }
  document.getElementById("posReviewPayment").innerHTML=posReviewLine("Moyen prévu",posSelectLabel("posPayment"))+posReviewLine("Statut","À traiter après création");
 }catch(e){posLastServerCart=null;if(err){err.hidden=false;err.textContent=e.message;}}
}
let posDeliveryZones=[];

function selectedPosRestaurantId(){return Number(document.getElementById("posRestaurant")?.value||0);}
function selectedPosDeliveryZoneId(){return Number(document.getElementById("posDeliveryZone")?.value||0);}

function renderPosDeliveryZoneHelp(){
    const help=document.getElementById("posDeliveryZoneHelp");
    const zone=posDeliveryZones.find(z=>z.id===selectedPosDeliveryZoneId());
    if(!help)return;
    if(!zone){help.textContent=getPosOrderType()==="DELIVERY"?"Sélectionnez une zone.":"";return;}
    const free=zone.freeDeliveryFrom!=null?` · gratuit dès ${formatPosMoney(zone.freeDeliveryFrom,"XAF")}`:"";
    help.textContent=`Minimum ${formatPosMoney(zone.minOrder,"XAF")} · livraison ${formatPosMoney(zone.deliveryFee,"XAF")}${free} · ${zone.estimatedMinMinutes}-${zone.estimatedMaxMinutes} min`;
}
async function loadPosDeliveryZones(){
    const restaurantId=selectedPosRestaurantId(),select=document.getElementById("posDeliveryZone");
    posDeliveryZones=[];
    if(!select||!restaurantId){if(select)select.innerHTML='<option value="">Aucune zone</option>';return;}
    select.innerHTML='<option value="">Chargement...</option>';
    try{
        const response=await fetch(`/admin/pos/restaurants/${restaurantId}/zones`);
        const data=await response.json().catch(()=>null);
        if(!response.ok||!data?.ok)throw new Error(data?.message||"Zones indisponibles.");
        posDeliveryZones=data.zones||[];
        select.innerHTML='<option value="">Choisir une zone...</option>'+posDeliveryZones.map(z=>`<option value="${z.id}">${escapeHtml(z.name)} — ${formatPosMoney(z.deliveryFee,"XAF")}</option>`).join("");
        if(posDeliveryZones.length===1)select.value=String(posDeliveryZones[0].id);
        renderPosDeliveryZoneHelp();
        if(posCart.length)calculatePosCart();
    }catch(error){select.innerHTML='<option value="">Zones indisponibles</option>';const h=document.getElementById("posDeliveryZoneHelp");if(h)h.textContent=error.message;}
}

const POS_FULFILLMENT_STORAGE_KEY="tioptiop_admin_pos_fulfillment_v1";
let posSavedAddresses=[];

function getPosOrderType(){return document.querySelector('input[name="posOrderType"]:checked')?.value||"DELIVERY";}
function savePosFulfillment(){
    try{
        localStorage.setItem(POS_FULFILLMENT_STORAGE_KEY,JSON.stringify({
            orderType:getPosOrderType(),
            savedAddressId:document.getElementById("posSavedAddress")?.value||"",
            recipient:document.getElementById("posDeliveryRecipient")?.value||"",
            phone:document.getElementById("posDeliveryPhone")?.value||"",
            address1:document.getElementById("posDeliveryAddress1")?.value||"",
            address2:document.getElementById("posDeliveryAddress2")?.value||"",
            district:document.getElementById("posDeliveryDistrict")?.value||"",
            city:document.getElementById("posDeliveryCity")?.value||"Brazzaville",
            instructions:document.getElementById("posDeliveryInstructions")?.value||""
        }));
    }catch(_){}
}
function loadPosFulfillment(){try{return JSON.parse(localStorage.getItem(POS_FULFILLMENT_STORAGE_KEY)||"null");}catch(_){return null;}}
function renderPosFulfillment(){
    const type=getPosOrderType();
    const delivery=document.getElementById("posDeliveryDetails"),pickup=document.getElementById("posPickupInformation"),dine=document.getElementById("posDineInInformation");
    if(delivery)delivery.style.display=type==="DELIVERY"?"":"none";
    if(pickup)pickup.style.display=type==="PICKUP"?"":"none";
    if(dine)dine.style.display=type==="DINE_IN"?"":"none";
    const zoneBlock=document.getElementById("posDeliveryZoneBlock");if(zoneBlock)zoneBlock.style.display=type==="DELIVERY"?"":"none";
    renderPosAddressMode();renderPosDeliveryZoneHelp();
    if(posCart.length && (type!=="DELIVERY" || selectedPosDeliveryZoneId())) calculatePosCart();
    savePosFulfillment();
}
function renderPosAddressMode(){
    const mode=document.getElementById("posClientMode")?.value||"GUEST";
    const account=document.getElementById("posAccountAddressBlock"),manual=document.getElementById("posManualAddressBlock");
    const isDelivery=getPosOrderType()==="DELIVERY";
    if(account)account.style.display=isDelivery&&mode==="ACCOUNT"&&posSelectedCustomer?"":"none";
    if(manual)manual.style.display=isDelivery&&(mode!=="ACCOUNT"||!posSelectedCustomer||!document.getElementById("posSavedAddress")?.value)?"":"none";
}
function formatPosAddress(a){return [a.addressLine1,a.addressLine2,a.district,a.city].filter(Boolean).join(", ");}
async function loadPosCustomerAddresses(){
    posSavedAddresses=[];
    const select=document.getElementById("posSavedAddress"),preview=document.getElementById("posSavedAddressPreview");
    if(select)select.innerHTML='<option value="">Saisie manuelle...</option>';
    if(preview)preview.textContent="";
    if(!posSelectedCustomer)return renderPosAddressMode();
    try{
        const response=await fetch(`/admin/pos/clients/${posSelectedCustomer.id}/adresses`);
        const data=await response.json().catch(()=>null);
        if(!response.ok||!data?.ok)throw new Error(data?.message||"Adresses indisponibles.");
        posSavedAddresses=data.addresses||[];
        if(select){
            select.innerHTML='<option value="">Saisie manuelle...</option>'+posSavedAddresses.map(a=>`<option value="${a.id}" ${a.isDefault?"data-default=\"1\"":""}>${escapeHtml(a.label)} — ${escapeHtml(formatPosAddress(a))}</option>`).join("");
            const defaultAddress=posSavedAddresses.find(a=>a.isDefault);
            if(defaultAddress)select.value=String(defaultAddress.id);
        }
        applySelectedSavedAddress();
    }catch(error){if(preview)preview.textContent=error.message;}
    renderPosAddressMode();
}
function applySelectedSavedAddress(){
    const select=document.getElementById("posSavedAddress"),preview=document.getElementById("posSavedAddressPreview");
    const selected=posSavedAddresses.find(a=>String(a.id)===String(select?.value||""));
    if(preview)preview.textContent=selected?formatPosAddress(selected):"";
    if(selected){
        const values={posDeliveryRecipient:selected.recipientName||posSelectedCustomer?.displayName||"",posDeliveryPhone:selected.phone||posSelectedCustomer?.phone||"",posDeliveryAddress1:selected.addressLine1,posDeliveryAddress2:selected.addressLine2,posDeliveryDistrict:selected.district,posDeliveryCity:selected.city||"Brazzaville",posDeliveryInstructions:selected.instructions};
        Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value||"";});
    }
    renderPosAddressMode();savePosFulfillment();
}
function validatePosFulfillment(){
    if(!selectedPosRestaurantId())return "Sélectionnez un restaurant.";
    if(getPosOrderType()!=="DELIVERY")return null;
    if(!selectedPosDeliveryZoneId())return "Sélectionnez une zone de livraison.";
    const phone=(document.getElementById("posDeliveryPhone")?.value||"").trim();
    const address=(document.getElementById("posDeliveryAddress1")?.value||"").trim();
    const city=(document.getElementById("posDeliveryCity")?.value||"").trim();
    if(!phone)return "Le téléphone de livraison est obligatoire.";
    if(!address)return "L'adresse de livraison est obligatoire.";
    if(!city)return "La ville de livraison est obligatoire.";
    return null;
}

const POS_CUSTOMER_STORAGE_KEY="tioptiop_admin_pos_customer_v1";
let posSelectedCustomer=null;
let posCustomerSearchTimer=null;
function savePosCustomerContext(){try{const mode=document.getElementById("posClientMode")?.value||"GUEST";localStorage.setItem(POS_CUSTOMER_STORAGE_KEY,JSON.stringify({mode,selectedCustomer:mode==="ACCOUNT"?posSelectedCustomer:null,guest:mode==="GUEST"?{firstName:document.getElementById("posGuestFirstName")?.value||"",lastName:document.getElementById("posGuestLastName")?.value||"",phone:document.getElementById("posGuestPhone")?.value||"",email:document.getElementById("posGuestEmail")?.value||""}:null}));}catch(_){}}
function loadPosCustomerContext(){try{return JSON.parse(localStorage.getItem(POS_CUSTOMER_STORAGE_KEY)||"null");}catch(_){return null;}}
function renderSelectedPosCustomer(){const box=document.getElementById("posSelectedCustomer");if(!box)return;if(!posSelectedCustomer){box.style.display="none";box.innerHTML="";return;}box.style.display="block";box.innerHTML=`<div class="pos-selected-customer-head"><div><strong>✓ ${escapeHtml(posSelectedCustomer.displayName)}</strong><small>${escapeHtml(posSelectedCustomer.phone||"Sans téléphone")} · ${escapeHtml(posSelectedCustomer.email||"Sans email")}</small></div><button type="button" id="posRemoveSelectedCustomer">Changer</button></div>`;document.getElementById("posRemoveSelectedCustomer")?.addEventListener("click",()=>{posSelectedCustomer=null;renderSelectedPosCustomer();savePosCustomerContext();loadPosCustomerLoyalty();});}
function setPosClientMode(mode){const map={GUEST:"posGuestCustomer",ACCOUNT:"posAccountCustomer",ANONYMOUS:"posAnonymousCustomer"};Object.entries(map).forEach(([key,id])=>{const el=document.getElementById(id);if(el)el.style.display=key===mode?"":"none";});savePosCustomerContext();}
async function searchPosCustomers(){const input=document.getElementById("posCustomerSearch"),state=document.getElementById("posCustomerSearchState"),results=document.getElementById("posCustomerResults");const q=(input?.value||"").trim();if(!state||!results)return;if(q.length<2){results.innerHTML="";state.textContent="Saisissez au moins 2 caractères.";return;}state.textContent="Recherche…";results.innerHTML="";try{const response=await fetch(`/admin/pos/clients/recherche?q=${encodeURIComponent(q)}`);const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok)throw new Error(data?.message||"Recherche impossible.");if(!data.customers.length){state.textContent="Aucun client trouvé.";return;}state.textContent=`${data.customers.length} client(s) trouvé(s).`;results.innerHTML=data.customers.map(c=>`<button type="button" class="pos-customer-result" data-customer-id="${c.id}"><span><strong>${escapeHtml(c.displayName)}</strong><small>${escapeHtml(c.phone||"Sans téléphone")} · ${escapeHtml(c.email||"Sans email")}</small></span><small>${escapeHtml(c.status)}</small></button>`).join("");results.querySelectorAll("[data-customer-id]").forEach(button=>button.addEventListener("click",()=>{posSelectedCustomer=data.customers.find(c=>c.id===Number(button.dataset.customerId))||null;results.innerHTML="";state.textContent="Client sélectionné.";renderSelectedPosCustomer();savePosCustomerContext();loadPosCustomerAddresses();loadPosCustomerLoyalty();}));}catch(error){state.innerHTML=`<span class="pos-customer-error">${escapeHtml(error.message)}</span>`;}}
async function loadPosCustomerLoyalty(){const box=document.getElementById("posAccountLoyalty"),sel=document.getElementById("posLoyaltyRedemption"),bal=document.getElementById("posLoyaltyBalance"),help=document.getElementById("posLoyaltyHelp");posSelectedLoyaltyRedemption=null;if(!box||!sel)return;if(!posSelectedCustomer){box.style.display="none";sel.innerHTML='<option value="">Aucun avantage</option>';return;}box.style.display="block";help.textContent="Chargement Tiop+…";try{const r=await fetch(`/admin/pos/clients/${posSelectedCustomer.id}/tiopplus`);const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.message||"Chargement impossible.");if(!d.subscribed){bal.textContent="Non abonné";sel.innerHTML='<option value="">Aucun avantage</option>';help.textContent="Ce client n’est pas abonné à Tiop+.";return;}bal.textContent=`${Number(d.account?.pointsBalance||0)} points`;sel.innerHTML='<option value="">Aucun avantage</option>'+d.redemptions.map(x=>`<option value="${escapeHtml(x.publicId)}">${escapeHtml(x.name)} — ${escapeHtml(x.type)}</option>`).join("");help.textContent=d.redemptions.length?`${d.redemptions.length} avantage(s) disponible(s).`:"Aucun avantage débloqué disponible.";}catch(e){help.textContent=e.message;}}
function validatePosCustomerContext(){const mode=document.getElementById("posClientMode")?.value||"GUEST",channel=document.getElementById("posChannel")?.value||"POS";if(mode==="ACCOUNT"&&!posSelectedCustomer)return "Sélectionnez un client existant.";if(mode==="GUEST"){const phone=(document.getElementById("posGuestPhone")?.value||"").trim(),email=(document.getElementById("posGuestEmail")?.value||"").trim();if(["PHONE","WHATSAPP"].includes(channel)&&!phone)return "Le téléphone du client invité est obligatoire pour ce canal.";if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return "L'adresse email du client invité n'est pas valide.";}return null;}

const POS_STORAGE_KEY = "tioptiop_admin_pos_cart_v2";
let posCalculationSequence = 0;
let posCart = [];
let activePosCategory = "all";

function itemKey(item) { return item.key || `${item.type}:${item.id}`; }
function createPosLineKey(type,id){return `POSLINE-${Date.now()}-${Math.random().toString(36).slice(2,9)}-${type}-${id}`;}

function formatPosMoney(value, currency = "XAF") {
    const amount = Number(value || 0);
    try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: currency === "XAF" ? 0 : 2 }).format(amount); }
    catch (_) { return `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency}`; }
}

function savePosCart(){ try{ localStorage.setItem(POS_STORAGE_KEY,JSON.stringify(posCart)); }catch(_){} }
function loadPosCart(){ try{ const v=JSON.parse(localStorage.getItem(POS_STORAGE_KEY)||"[]"); posCart=Array.isArray(v)?v.filter(i=>Number(i.id)>0&&Number(i.quantity)>0).map(i=>({...i,key:i.key||createPosLineKey(i.type,Number(i.id)),id:Number(i.id),quantity:Math.min(99,Number(i.quantity)||1)})):[]; }catch(_){posCart=[];} }
function setPosCalculationState(message,isError=false){const e=document.getElementById("posCalculationState");if(e){e.textContent=message||"";e.classList.toggle("error",isError);}}
function updateContinueButton(enabled){const b=document.getElementById("createPosOrderButton");if(b)b.disabled=!enabled;}
function addPosItem(item) {
    const key = item.key || createPosLineKey(item.type,item.id);
    posCart.push({ ...item, key, quantity: Math.min(99,Math.max(1,Number(item.quantity)||1)) });
    savePosCart();
    renderPosCart();
}

function changePosQuantity(key, change) {
    const item = posCart.find(row => row.key === key);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) posCart = posCart.filter(row => row.key !== key);
    savePosCart();
    renderPosCart();
}

function removePosProduct(key) { posCart=posCart.filter(row=>row.key!==key); savePosCart(); renderPosCart(); }
function clearPosCart(){if(posCart.length&&confirm("Vider entièrement le panier POS ?")){posCart=[];savePosCart();renderPosCart();}}

function renderPosCart() {
    const container = document.getElementById("posCartItems");
    const empty = document.getElementById("posCartEmpty");
    const summary = document.getElementById("posCartSummary");
    if (!container || !empty || !summary) return;

    if (!posCart.length) {
        container.innerHTML=""; empty.style.display="block"; summary.style.display="none"; setPosCalculationState(""); updateContinueButton(false); return;
    }
    empty.style.display = "none"; summary.style.display = "block";
    container.innerHTML = posCart.map(item => `
      <div class="pos-cart-item">
        <div class="pos-cart-product"><div><strong>${escapeHtml(item.name)}</strong><small>${item.type === "FORMULA" ? "Formule" : "Produit"} · ${formatPosMoney(item.price,item.currency)}</small>${(item.serverOptions||item.optionLabels||[]).length?`<div class="pos-cart-customization">${(item.serverOptions||item.optionLabels||[]).map(o=>escapeHtml(o.groupName?`${o.groupName}: ${o.name}`:String(o))).join(" · ")}</div>`:""}${item.type==="FORMULA"&&Array.isArray(item.composition)&&item.composition.length?`<div class="pos-cart-customization">Composition : ${item.composition.map(c=>`${escapeHtml(c.name)} ×${c.quantity}`).join(" · ")}</div>`:""}${item.instructions?`<span class="pos-cart-instructions">Cuisine : ${escapeHtml(item.instructions)}</span>`:""}</div></div>
        <div class="pos-quantity"><button type="button" data-action="minus" data-key="${item.key}">−</button><strong>${item.quantity}</strong><button type="button" data-action="plus" data-key="${item.key}">+</button></div>
        <div><strong>${formatPosMoney(item.price*item.quantity,item.currency)}</strong><button type="button" class="pos-remove" data-action="remove" data-key="${item.key}">Supprimer</button></div>
      </div>`).join("");
    calculatePosCart();
}

function updatePosTotals() {}
async function calculatePosCart(){
    const seq=++posCalculationSequence; updateContinueButton(false); setPosCalculationState("Vérification des prix en base…");
    try{
        const response=await fetch("/admin/pos/calcul",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
            items:posCart.map(i=>({key:i.key,type:i.type,id:i.id,quantity:i.quantity,optionValueIds:i.optionValueIds||[],instructions:i.instructions||""})),
            orderType:getPosOrderType(),
            restaurantId:selectedPosRestaurantId(),
            deliveryZoneId:getPosOrderType()==="DELIVERY"?selectedPosDeliveryZoneId():null,
            loyaltyCardPublicId:posSelectedPhysicalLoyaltyCard?.publicId||null,
            loyaltyCardRewardId:posSelectedPhysicalRewardId||null
        })});
        const data=await response.json().catch(()=>null); if(seq!==posCalculationSequence)return;
        if(!response.ok||!data?.ok)throw new Error(data?.message||"Impossible de vérifier le panier.");
        const byKey=new Map(data.cart.items.map(i=>[i.key,i]));
        posCart=posCart.map(i=>{const priced=byKey.get(i.key);return priced?{...i,name:priced.name,price:Number(priced.unitPrice),basePrice:Number(priced.basePrice),currency:priced.currency,quantity:Number(priced.quantity),serverOptions:priced.selectedOptions||[],instructions:priced.instructions||i.instructions||""}:i;}); savePosCart();
        const cur=data.cart.currency||"XAF", set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=formatPosMoney(v,cur);};
        set("posSubtotal",data.cart.subtotal);set("posDiscount",data.cart.discountAmount);set("posDeliveryFee",data.cart.deliveryFee);set("posTaxAmount",data.cart.taxAmount);set("posTotal",data.cart.total);
        const count=document.getElementById("posCartCount");if(count)count.textContent=`${data.cart.itemCount} article${data.cart.itemCount>1?"s":""}`;
        setPosCalculationState("✓ Prix et total vérifiés depuis MySQL."); updateContinueButton(posCart.length>0);
    }catch(error){console.error("Calcul POS :",error);setPosCalculationState(error.message||"Erreur de calcul du panier.",true);updateContinueButton(false);}
}

function filterPosProducts() {
    const search=(document.getElementById("posProductSearch")?.value||"").trim().toLowerCase();
    document.querySelectorAll(".pos-product").forEach(card=>{
        const name=(card.dataset.name||"").toLowerCase();
        const category=card.dataset.category||"";
        const categoryOk=activePosCategory==="all" || category===activePosCategory;
        card.style.display=categoryOk && name.includes(search) ? "" : "none";
    });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}


let posItemDraft=null;
let posItemQuantity=1;

function closePosItemModal(){
    const modal=document.getElementById("posItemModal");
    if(modal)modal.hidden=true;
    posItemDraft=null;
}
function setPosItemError(message=""){
    const box=document.getElementById("posItemModalError");
    if(!box)return;
    box.textContent=message;
    box.hidden=!message;
}
function selectedPosDraftOptions(){
    if(!posItemDraft || posItemDraft.type!=="PRODUCT")return [];
    return Array.from(document.querySelectorAll('#posItemOptions input:checked'))
      .map(input=>Number(input.value))
      .filter(id=>Number.isInteger(id)&&id>0);
}
function selectedPosDraftOptionObjects(){
    const ids=new Set(selectedPosDraftOptions());
    return (posItemDraft?.groups||[]).flatMap(group=>(group.options||[])
      .filter(option=>ids.has(Number(option.id)))
      .map(option=>({id:Number(option.id),groupId:Number(group.id),groupName:group.name,name:option.name,priceDelta:Number(option.priceDelta||0)})));
}
function validatePosDraftOptions(){
    if(!posItemDraft || posItemDraft.type!=="PRODUCT")return null;
    const selected=new Set(selectedPosDraftOptions());
    for(const group of posItemDraft.groups||[]){
        const count=(group.options||[]).filter(option=>selected.has(Number(option.id))).length;
        const min=Math.max(Number(group.isRequired)?1:0,Number(group.minChoices||0));
        const max=Number(group.maxChoices||0);
        if(count<min)return `Sélectionnez ${min>1?`au moins ${min} choix`:"un choix"} pour « ${group.name} ».`;
        if(String(group.selectionType).toLowerCase()==="single"&&count>1)return `Un seul choix est autorisé pour « ${group.name} ».`;
        if(max>0&&count>max)return `Maximum ${max} choix pour « ${group.name} ».`;
    }
    return null;
}
function updatePosItemDraftPrice(){
    if(!posItemDraft)return;
    const extras=selectedPosDraftOptionObjects().reduce((sum,o)=>sum+Number(o.priceDelta||0),0);
    const unit=Number(posItemDraft.price||0)+extras;
    const el=document.getElementById("posItemCalculatedPrice");
    if(el)el.textContent=formatPosMoney(unit,posItemDraft.currency||"XAF");
    const qty=document.getElementById("posItemQtyValue");
    if(qty)qty.textContent=String(posItemQuantity);
}
function renderPosProductConfiguration(product){
    posItemDraft={type:"PRODUCT",...product};
    document.getElementById("posItemKind").textContent="Produit personnalisable";
    document.getElementById("posItemModalTitle").textContent=product.name;
    document.getElementById("posItemDescription").textContent=product.description||"";
    document.getElementById("posItemBasePrice").textContent=formatPosMoney(product.price,product.currency);
    const image=document.getElementById("posItemImage");
    if(product.image){image.src=product.image;image.hidden=false;}else image.hidden=true;
    const options=document.getElementById("posItemOptions");
    options.innerHTML=(product.groups||[]).map(group=>{
        const single=String(group.selectionType).toLowerCase()==="single";
        const required=group.isRequired?'<small>obligatoire</small>':(Number(group.minChoices)>0?`<small>minimum ${group.minChoices}</small>`:"");
        return `<div class="pos-option-group" data-group-id="${group.id}">
          <div class="pos-option-group-head"><strong>${escapeHtml(group.name)}</strong>${required}</div>
          ${(group.options||[]).map(option=>`<div class="pos-option-row"><label><input type="${single?"radio":"checkbox"}" name="pos_option_${group.id}${single?"":"[]"}" value="${option.id}" ${option.isDefault?"checked":""}> ${escapeHtml(option.name)}</label><strong>${Number(option.priceDelta)===0?"Inclus":`+${escapeHtml(formatPosMoney(option.priceDelta,product.currency))}`}</strong></div>`).join("")}
        </div>`;
    }).join("") || '<div class="pos-customer-help">Aucune option configurée pour ce produit.</div>';
    document.getElementById("posFormulaComposition").innerHTML="";
    options.querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{setPosItemError("");updatePosItemDraftPrice();}));
}
function renderPosFormulaConfiguration(formula){
    posItemDraft={type:"FORMULA",...formula};
    document.getElementById("posItemKind").textContent="Formule";
    document.getElementById("posItemModalTitle").textContent=formula.name;
    document.getElementById("posItemDescription").textContent=formula.description||"";
    document.getElementById("posItemBasePrice").textContent=formatPosMoney(formula.price,formula.currency);
    const image=document.getElementById("posItemImage");
    if(formula.image){image.src=formula.image;image.hidden=false;}else image.hidden=true;
    document.getElementById("posItemOptions").innerHTML="";
    document.getElementById("posFormulaComposition").innerHTML=`<div class="pos-formula-composition"><h3>🍽️ Composition de la formule</h3>${(formula.composition||[]).map(component=>`<div class="pos-formula-component"><div class="pos-formula-component-info">${component.image?`<img src="${escapeHtml(component.image)}" alt="">`:""}<div><strong>${escapeHtml(component.name)}</strong>${component.description?`<small>${escapeHtml(component.description)}</small>`:""}</div></div><strong>×${component.quantity}</strong></div>`).join("") || '<small>Composition non renseignée.</small>'}</div>`;
}
async function openPosItemModal(item){
    const modal=document.getElementById("posItemModal"),loading=document.getElementById("posItemModalLoading"),body=document.getElementById("posItemModalBody");
    if(!modal)return;
    modal.hidden=false;loading.hidden=false;body.hidden=true;setPosItemError("");posItemQuantity=1;
    document.getElementById("posItemInstructions").value="";
    try{
        const url=item.type==="PRODUCT"?`/admin/pos/produits/${item.id}/configuration`:`/admin/pos/formules/${item.id}/configuration`;
        const response=await fetch(url);
        const data=await response.json().catch(()=>null);
        if(!response.ok||!data?.ok)throw new Error(data?.message||"Impossible de charger les détails.");
        if(item.type==="PRODUCT")renderPosProductConfiguration(data.product);else renderPosFormulaConfiguration(data.formula);
        loading.hidden=true;body.hidden=false;updatePosItemDraftPrice();
    }catch(error){loading.hidden=true;body.hidden=true;setPosItemError(error.message);}
}
function addPosDraftToCart(){
    if(!posItemDraft)return;
    const validation=validatePosDraftOptions();
    if(validation){setPosItemError(validation);return;}
    const selectedOptions=selectedPosDraftOptionObjects();
    const extras=selectedOptions.reduce((sum,o)=>sum+Number(o.priceDelta||0),0);
    const instructions=(document.getElementById("posItemInstructions")?.value||"").trim().slice(0,2000);
    addPosItem({
        id:Number(posItemDraft.id),
        type:posItemDraft.type,
        name:posItemDraft.name,
        categoryId:posItemDraft.categoryId||null,
        categoryName:posItemDraft.categoryName||"",
        price:Number(posItemDraft.price||0)+extras,
        basePrice:Number(posItemDraft.price||0),
        currency:posItemDraft.currency||"XAF",
        image:posItemDraft.image||null,
        quantity:posItemQuantity,
        optionValueIds:selectedOptions.map(o=>o.id),
        optionLabels:selectedOptions,
        instructions,
        composition:posItemDraft.type==="FORMULA"?(posItemDraft.composition||[]):[],
        key:createPosLineKey(posItemDraft.type,posItemDraft.id)
    });
    closePosItemModal();
}


function buildPosOrderPayload(){
    const mode=document.getElementById("posClientMode")?.value||"GUEST";
    const orderType=getPosOrderType();

    return {
        idempotencyKey:posReviewIdempotencyKey,
        channel:document.getElementById("posChannel")?.value||"POS",
        paymentMethod:document.getElementById("posPayment")?.value||"CASH",
        customer:{
            mode,
            userId:mode==="ACCOUNT" ? (posSelectedCustomer?.id||null) : null,
            firstName:mode==="GUEST" ? (document.getElementById("posGuestFirstName")?.value||"") : "",
            lastName:mode==="GUEST" ? (document.getElementById("posGuestLastName")?.value||"") : "",
            phone:mode==="GUEST" ? (document.getElementById("posGuestPhone")?.value||"") : "",
            email:mode==="GUEST" ? (document.getElementById("posGuestEmail")?.value||"") : ""
        },
        restaurantId:selectedPosRestaurantId(),
        deliveryZoneId:orderType==="DELIVERY" ? selectedPosDeliveryZoneId() : null,
        orderType,
        delivery:{
            savedAddressId:mode==="ACCOUNT" ? (document.getElementById("posSavedAddress")?.value||null) : null,
            recipientName:document.getElementById("posDeliveryRecipient")?.value||"",
            phone:document.getElementById("posDeliveryPhone")?.value||"",
            addressLine1:document.getElementById("posDeliveryAddress1")?.value||"",
            addressLine2:document.getElementById("posDeliveryAddress2")?.value||"",
            district:document.getElementById("posDeliveryDistrict")?.value||"",
            city:document.getElementById("posDeliveryCity")?.value||"",
            instructions:document.getElementById("posDeliveryInstructions")?.value||""
        },
        loyaltyRedemptionPublicId:mode==="ACCOUNT" ? (document.getElementById("posLoyaltyRedemption")?.value||null) : null,
        loyaltyCardPublicId:posSelectedPhysicalLoyaltyCard?.publicId||null,
        loyaltyCardRewardId:posSelectedPhysicalRewardId||null,
        items:posCart.map(item=>({
            key:item.key,
            type:item.type,
            id:item.id,
            quantity:item.quantity,
            optionValueIds:item.optionValueIds||[],
            instructions:item.instructions||""
        }))
    };
}

async function createVerifiedPosOrder(){
    if(posOrderCreationInProgress)return;

    if(!posReviewIdempotencyKey){
        setPosReviewCreationError(
            "Le récapitulatif doit être recalculé avant la création."
        );
        return;
    }

    const button=document.getElementById("posReviewConfirmButton");
    const originalText=button?.textContent||"Créer la commande";

    posOrderCreationInProgress=true;
    if(button){
        button.disabled=true;
        button.textContent="Création en cours…";
    }

    setPosReviewCreationError("");

    try{
        const response=await fetch(
            "/admin/pos/commandes",
            {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify(buildPosOrderPayload())
            }
        );

        const data=await response.json().catch(()=>null);

        if(!response.ok||!data?.ok){
            throw new Error(
                data?.message||
                "Impossible de créer la commande POS."
            );
        }

        /*
         * La commande est maintenant réellement enregistrée.
         * On ne permet pas à l'ancien panier local de recréer une autre commande.
         */
        posCart=[];
        savePosCart();
        localStorage.removeItem(POS_STORAGE_KEY);

        posReviewIdempotencyKey=null;

        const duplicate=data.duplicate
            ? "Commande déjà créée : le rejeu a été détecté et aucune duplication n'a eu lieu."
            : "Commande créée avec succès.";

        alert(
            `${duplicate}\n\n`+
            `Référence : ${data.order.reference}\n`+
            `Total : ${formatPosMoney(data.order.totalAmount,data.order.currency)}\n`+
            `Paiement : ${data.payment.method} — ${data.payment.status}` +
            (data.cardPaymentError ? `\n\nAttention Stripe : ${data.cardPaymentError.message}` : "")
        );

        window.location.href=data.nextUrl||`/admin/commandes/${encodeURIComponent(data.order.reference)}`;
    }
    catch(error){
        setPosReviewCreationError(
            error.message||
            "Erreur lors de la création de la commande."
        );

        if(button){
            button.disabled=false;
            button.textContent=originalText;
        }

        posOrderCreationInProgress=false;
    }
}

function setPosReviewCreationError(message=""){
    const box=document.getElementById("posReviewError");
    if(!box)return;
    box.textContent=message;
    box.hidden=!message;
}





// 16.10.4.9 — POS caisse : scanner USB HID + import QR/SVG + recherche manuelle (webcam retirée)
let posUsbScannerBuffer='';
let posUsbScannerLastKeyAt=0;
let posUsbScannerTimer=null;

function looksLikeTiopQrValue(value){
 const v=String(value||'').trim();
 return v.startsWith('TIOPTIOP-TIOPPLUS:') || /^TT-[A-Z0-9-]{5,}$/i.test(v);
}

function installUsb2DScannerListener(){
 // Les lecteurs 2D USB en mode HID « clavier » envoient généralement les caractères très vite puis Entrée.
 document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  const now=performance.now();
  const active=document.activeElement;
  const tag=(active?.tagName||'').toLowerCase();
  const isTyping=tag==='input'||tag==='textarea'||tag==='select'||active?.isContentEditable;

  if(event.key==='Enter'){
   const value=posUsbScannerBuffer.trim();
   const fastEnough=now-posUsbScannerLastKeyAt<180;
   if(value.length>=8&&fastEnough){
    posUsbScannerBuffer='';
    clearTimeout(posUsbScannerTimer);posUsbScannerTimer=null;
    event.preventDefault();
    const state=document.getElementById('posLoyaltyCardState');
    if(state)state.textContent='🔎 Lecture scanner USB — vérification Tiop+…';
    verifyPhysicalLoyaltyCard(value).catch(e=>{if(state)state.textContent=e?.message||'Code scanné non reconnu.';});
    return;
   }
   posUsbScannerBuffer='';
   return;
  }

  if(event.key.length===1){
   const gap=now-posUsbScannerLastKeyAt;
   // Si l'utilisateur écrit normalement dans un champ, ne détourne pas sa saisie.
   if(isTyping&&gap>45){posUsbScannerBuffer='';return;}
   if(gap>180)posUsbScannerBuffer='';
   posUsbScannerBuffer+=event.key;
   posUsbScannerLastKeyAt=now;
   clearTimeout(posUsbScannerTimer);
   posUsbScannerTimer=setTimeout(()=>{posUsbScannerBuffer='';},350);
  }
 },true);
}

async function loadPhysicalLoyaltyRewards(){
 const box=document.getElementById('posPhysicalRewardBox'),sel=document.getElementById('posPhysicalLoyaltyReward'),help=document.getElementById('posPhysicalRewardHelp');
 posSelectedPhysicalRewardId=null;
 if(!box||!sel)return;
 sel.innerHTML='<option value="">Ne pas utiliser de récompense</option>';
 if(!posSelectedPhysicalLoyaltyCard){box.style.display='none';return;}
 box.style.display='block'; if(help)help.textContent='Chargement des récompenses…';
 try{
  const r=await fetch(`/admin/pos/tiopplus/carte/recompenses?publicId=${encodeURIComponent(posSelectedPhysicalLoyaltyCard.publicId)}`);
  const d=await r.json(); if(!r.ok||!d?.ok)throw new Error(d?.message||'Chargement impossible.');
  for(const x of d.rewards||[]){
   const o=document.createElement('option');o.value=String(x.id);
   o.disabled=!x.eligible;
   const extra=x.rewardType==='DISCOUNT'?` -${Number(x.rewardValue||0)}%`:x.rewardType==='COUPON'?` -${Number(x.rewardValue||0).toLocaleString('fr-FR')} XAF`:x.rewardType==='FREE_DELIVERY'?' livraison offerte':x.rewardProductName?` ${x.rewardProductName}`:'';
   o.textContent=`${x.name} — ${x.pointsCost} pts${extra}${x.eligible?'':' (solde insuffisant)'}`;
   sel.appendChild(o);
  }
  if(help)help.textContent=(d.rewards||[]).length?'Une seule récompense peut être utilisée par commande. Les points sont réservés à la création puis consommés après paiement.':'Aucune récompense active.';
 }catch(e){if(help)help.textContent=e.message;}
}
function renderSelectedPhysicalLoyaltyCard(){
 const box=document.getElementById('posSelectedLoyaltyCard'),state=document.getElementById('posLoyaltyCardState'); if(!box)return;
 if(!posSelectedPhysicalLoyaltyCard){box.style.display='none';box.innerHTML='';if(state)state.textContent='Aucune carte présentée.';return;}
 const c=posSelectedPhysicalLoyaltyCard;box.style.display='block';if(state)state.textContent='✓ Carte vérifiée par le serveur.';
 const exp=c.expiresAt?new Date(c.expiresAt).toLocaleDateString('fr-FR'):'Sans expiration';
 box.innerHTML=`<div class="pos-card-selected-head"><div><strong>⭐ ${escapeHtml(c.displayName)}</strong><div class="pos-card-selected-meta"><span class="pos-card-badge">${escapeHtml(c.cardNumber)}</span><span class="pos-card-badge">${escapeHtml(c.cardType)}</span><span class="pos-card-badge">${Number(c.pointsBalance||0)} points</span><span class="pos-card-badge">Valide : ${escapeHtml(exp)}</span></div></div><button type="button" class="pos-card-remove" id="posRemoveLoyaltyCard">Retirer</button></div>`;
 document.getElementById('posRemoveLoyaltyCard')?.addEventListener('click',()=>{posSelectedPhysicalLoyaltyCard=null;posSelectedPhysicalRewardId=null;renderSelectedPhysicalLoyaltyCard();loadPhysicalLoyaltyRewards();});
}
async function verifyPhysicalLoyaltyCard(value){
 const state=document.getElementById('posLoyaltyCardState');if(state)state.textContent='Vérification Tiop+…';
 const r=await fetch('/admin/pos/tiopplus/carte/verifier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})});
 const contentType=String(r.headers.get('content-type')||'');
 const d=contentType.includes('application/json')?await r.json().catch(()=>null):null;
 if(!r.ok||!d?.ok){
  posSelectedPhysicalLoyaltyCard=null;renderSelectedPhysicalLoyaltyCard();
  let message=d?.message||'';
  if(d?.code)message=`[${d.code}] ${message}`;
  if(!message){
   message=r.status===404
    ?'Endpoint Tiop+ POS introuvable (HTTP 404). Vérifiez les routes /admin/pos/tiopplus/… puis redémarrez Node.js.'
    :`Réponse serveur Tiop+ invalide (HTTP ${r.status}).`;
  }
  if(state)state.textContent=message;throw new Error(message);
 }
 posSelectedPhysicalLoyaltyCard=d.card;renderSelectedPhysicalLoyaltyCard();await loadPhysicalLoyaltyRewards();return d.card;
}
async function searchPhysicalLoyaltyCards(){
 const input=document.getElementById('posLoyaltyCardSearch'),results=document.getElementById('posLoyaltyCardResults'),state=document.getElementById('posLoyaltyCardState');const q=(input?.value||'').trim();if(!results||!state)return;
 if(q.length<2){state.textContent='Saisissez au moins 2 caractères.';results.innerHTML='';return;}
 state.textContent='Recherche…';results.innerHTML='';try{const r=await fetch(`/admin/pos/tiopplus/cartes/recherche?q=${encodeURIComponent(q)}`);const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.message||'Recherche impossible.');if(!d.cards.length){state.textContent='Aucune carte trouvée.';return;}state.textContent=`${d.cards.length} carte(s) trouvée(s).`;results.innerHTML=d.cards.map(c=>`<button type="button" class="pos-customer-result" data-pos-loyalty-card="${escapeHtml(c.cardNumber)}"><span><strong>${escapeHtml(c.displayName)}</strong><small>${escapeHtml(c.cardNumber)} · ${escapeHtml(c.cardType)} · ${Number(c.pointsBalance||0)} pts</small></span><small>${escapeHtml(c.status)}</small></button>`).join('');results.querySelectorAll('[data-pos-loyalty-card]').forEach(b=>b.addEventListener('click',async()=>{try{await verifyPhysicalLoyaltyCard(b.dataset.posLoyaltyCard);results.innerHTML='';}catch(_){}}));}catch(e){state.textContent=e.message;}
}
function getHtml5QrScanner(){
 if(window.posHtml5QrScanner)return window.posHtml5QrScanner;
 if(typeof window.Html5Qrcode!=="function")return null;
 try{
  window.posHtml5QrScanner=new Html5Qrcode("posHtml5QrcodeReader",{formatsToSupport:html5QrFormats(),verbose:false});
  return window.posHtml5QrScanner;
 }catch(_){return null;}
}

function html5QrFormats(){
 const F=window.Html5QrcodeSupportedFormats;
 if(!F)return undefined;
 return [F.QR_CODE,F.CODE_128,F.CODE_39,F.CODE_93,F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.DATA_MATRIX].filter(v=>v!==undefined);
}

async function decodeQrImageFile(file){
 if(!file)throw new Error("Aucun fichier sélectionné.");
 if(typeof window.Html5Qrcode!=="function")throw new Error("html5-qrcode n’est pas chargé.");
 const scanner=getHtml5QrScanner();
 if(!scanner)throw new Error("Impossible d’initialiser le lecteur d’image.");
 try{
  return await scanner.scanFile(file,true);
 }finally{
  try{await scanner.clear();}catch(_){}
  window.posHtml5QrScanner=null;
 }
}

document.addEventListener("DOMContentLoaded",()=>{
    installUsb2DScannerListener();
    loadPosCart();
    const savedCustomerContext=loadPosCustomerContext();
    if(savedCustomerContext?.mode&&["GUEST","ACCOUNT","ANONYMOUS"].includes(savedCustomerContext.mode)){
        const mode=document.getElementById("posClientMode");if(mode)mode.value=savedCustomerContext.mode;
        posSelectedCustomer=savedCustomerContext.selectedCustomer||null;
        if(savedCustomerContext.guest){
            const values={posGuestFirstName:savedCustomerContext.guest.firstName,posGuestLastName:savedCustomerContext.guest.lastName,posGuestPhone:savedCustomerContext.guest.phone,posGuestEmail:savedCustomerContext.guest.email};
            Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value||"";});
        }
    }
    setPosClientMode(document.getElementById("posClientMode")?.value||"GUEST");
    renderSelectedPosCustomer();
    document.getElementById("posClientMode")?.addEventListener("change",e=>{setPosClientMode(e.target.value);renderPosAddressMode();if(e.target.value==="ACCOUNT"&&posSelectedCustomer)loadPosCustomerAddresses();});
    ["posGuestFirstName","posGuestLastName","posGuestPhone","posGuestEmail"].forEach(id=>document.getElementById(id)?.addEventListener("input",savePosCustomerContext));
    document.getElementById("posPhysicalLoyaltyReward")?.addEventListener("change",e=>{posSelectedPhysicalRewardId=Number(e.target.value)||null;invalidatePosReview?.();if(posCart.length)calculatePosCart();});
        document.getElementById("posLoyaltyCardSearchButton")?.addEventListener("click",searchPhysicalLoyaltyCards);
    document.getElementById("posLoyaltyCardSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchPhysicalLoyaltyCards();}});
    document.getElementById("posScannerImageInput")?.addEventListener("change",async e=>{
        const file=e.target.files?.[0];if(!file)return;
        const state=document.getElementById('posLoyaltyCardState');
        try{
          if(state)state.textContent='🖼 Lecture du QR / SVG importé…';
          const raw=await decodeQrImageFile(file);
          await verifyPhysicalLoyaltyCard(raw);
          if(state)state.textContent='✓ Carte Tiop+ reconnue depuis le fichier importé.';
        }catch(error){
          if(state)state.textContent=`Import refusé : ${error?.message||'Impossible de lire cette image.'}`;
        }finally{e.target.value='';}
    });
    document.getElementById("posCustomerSearchButton")?.addEventListener("click",searchPosCustomers);
    document.getElementById("posCustomerSearch")?.addEventListener("input",()=>{clearTimeout(posCustomerSearchTimer);posCustomerSearchTimer=setTimeout(searchPosCustomers,350);});
    const savedFulfillment=loadPosFulfillment();
    if(savedFulfillment){
        const radio=document.querySelector(`input[name="posOrderType"][value="${savedFulfillment.orderType||"DELIVERY"}"]`);if(radio)radio.checked=true;
        const values={posDeliveryRecipient:savedFulfillment.recipient,posDeliveryPhone:savedFulfillment.phone,posDeliveryAddress1:savedFulfillment.address1,posDeliveryAddress2:savedFulfillment.address2,posDeliveryDistrict:savedFulfillment.district,posDeliveryCity:savedFulfillment.city,posDeliveryInstructions:savedFulfillment.instructions};
        Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&value!=null)el.value=value;});
    }
    document.querySelectorAll('input[name="posOrderType"]').forEach(radio=>radio.addEventListener("change",renderPosFulfillment));
    document.getElementById("posRestaurant")?.addEventListener("change",loadPosDeliveryZones);
    document.getElementById("posDeliveryZone")?.addEventListener("change",()=>{renderPosDeliveryZoneHelp();savePosFulfillment();if(posCart.length)calculatePosCart();});
    ["posDeliveryRecipient","posDeliveryPhone","posDeliveryAddress1","posDeliveryAddress2","posDeliveryDistrict","posDeliveryCity","posDeliveryInstructions"].forEach(id=>document.getElementById(id)?.addEventListener("input",savePosFulfillment));
    document.getElementById("posSavedAddress")?.addEventListener("change",applySelectedSavedAddress);
    renderPosFulfillment();
    loadPosDeliveryZones();
    if(posSelectedCustomer)loadPosCustomerAddresses();

    document.querySelectorAll("[data-pos-review-close]").forEach(b=>b.addEventListener("click",closePosReview));
    document.getElementById("posReviewConfirmButton")?.addEventListener("click",createVerifiedPosOrder);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closePosReview();});
    document.querySelectorAll("[data-pos-item]").forEach(button=>button.addEventListener("click",()=>{
        try { openPosItemModal(JSON.parse(button.dataset.posItem)); } catch(error) { console.error("POS item invalide",error); }
    }));
    document.querySelectorAll("[data-pos-item-close]").forEach(button=>button.addEventListener("click",closePosItemModal));
    document.getElementById("posItemQtyMinus")?.addEventListener("click",()=>{posItemQuantity=Math.max(1,posItemQuantity-1);updatePosItemDraftPrice();});
    document.getElementById("posItemQtyPlus")?.addEventListener("click",()=>{posItemQuantity=Math.min(99,posItemQuantity+1);updatePosItemDraftPrice();});
    document.getElementById("posItemAddButton")?.addEventListener("click",addPosDraftToCart);
    document.getElementById("posProductSearch")?.addEventListener("input",filterPosProducts);
    document.getElementById("posCategoryFilters")?.addEventListener("click",event=>{
        const button=event.target.closest("button[data-category]"); if(!button)return;
        activePosCategory=button.dataset.category;
        document.querySelectorAll("#posCategoryFilters button").forEach(b=>b.classList.toggle("active",b===button));
        filterPosProducts();
    });
    document.getElementById("posCartItems")?.addEventListener("click",event=>{
        const button=event.target.closest("button[data-action]"); if(!button)return;
        const {action,key}=button.dataset;
        if(action==="plus")changePosQuantity(key,1); if(action==="minus")changePosQuantity(key,-1); if(action==="remove")removePosProduct(key);
    });
    document.getElementById("clearPosCartButton")?.addEventListener("click",clearPosCart);
    document.getElementById("posPayment")?.addEventListener("change",event=>{
        const info=document.getElementById("posPaymentInformation"); if(!info)return;
        const messages={CASH:"Espèces : encaissement à confirmer dans l'étape paiement.",CARD:"Carte bancaire : après création, Stripe TEST s’ouvrira pour encaisser la commande.",MOBILE_MONEY:"Mobile Money : après création, la page MTN MoMo TEST s’ouvrira pour envoyer et vérifier la demande de paiement."};
        info.textContent=messages[event.target.value]||"";
    });
    document.getElementById("createPosOrderButton")?.addEventListener("click",openPosReview);
    renderPosCart();
});
