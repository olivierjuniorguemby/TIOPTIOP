const db = require('../config/database');

function where(filters = {}, publicOnly = false) {
  const clauses = [], params = [];
  if (publicOnly) {
    clauses.push('p.is_active = 1');
    // 17.5 — une promotion SELECTED ne doit être visible que par les clients choisis.
    if (filters.userId) {
      clauses.push("(p.audience <> 'SELECTED' OR EXISTS (SELECT 1 FROM promotion_selected_users psu WHERE psu.promotion_id=p.id AND psu.user_id=?))");
      params.push(Number(filters.userId));
    } else {
      clauses.push("p.audience <> 'SELECTED'");
    }
  }
  if (filters.q) { clauses.push('(p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)'); const q=`%${filters.q}%`; params.push(q,q,q); }
  if (filters.type) { clauses.push('p.discount_type = ?'); params.push(filters.type); }
  if (filters.audience) { clauses.push('p.audience = ?'); params.push(filters.audience); }
  if (filters.category) { clauses.push('EXISTS (SELECT 1 FROM promotion_categories pcf WHERE pcf.promotion_id=p.id AND pcf.category_id=?)'); params.push(Number(filters.category)); }
  if (filters.status === 'ACTIVE') clauses.push('p.is_active=1 AND (p.starts_at IS NULL OR p.starts_at<=NOW()) AND (p.ends_at IS NULL OR p.ends_at>=NOW())');
  if (filters.status === 'UPCOMING') clauses.push('p.is_active=1 AND p.starts_at>NOW()');
  if (filters.status === 'EXPIRED') clauses.push('(p.is_active=0 OR (p.ends_at IS NOT NULL AND p.ends_at<NOW()))');
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

exports.list = async (filters={}) => {
  const w=where(filters,false);
  return db.query(`SELECT p.*, (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM promotion_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.promotion_id=p.id) category_names, CASE WHEN p.is_active=0 THEN 'INACTIVE' WHEN p.ends_at IS NOT NULL AND p.ends_at<NOW() THEN 'EXPIRED' WHEN p.starts_at IS NOT NULL AND p.starts_at>NOW() THEN 'UPCOMING' ELSE 'ACTIVE' END AS computed_status FROM promotions p ${w.sql} ORDER BY COALESCE(p.starts_at,p.created_at) DESC,p.id DESC`,w.params);
};
exports.listPublic = async (filters={}) => {
  const w=where(filters,true);
  return db.query(`SELECT p.*, (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM promotion_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.promotion_id=p.id) category_names, CASE WHEN p.ends_at IS NOT NULL AND p.ends_at<NOW() THEN 'EXPIRED' WHEN p.starts_at IS NOT NULL AND p.starts_at>NOW() THEN 'UPCOMING' ELSE 'ACTIVE' END AS computed_status FROM promotions p ${w.sql} ORDER BY CASE WHEN p.starts_at>NOW() THEN 1 ELSE 0 END,COALESCE(p.starts_at,p.created_at) DESC`,w.params);
};
exports.findById = async id => (await db.query('SELECT * FROM promotions WHERE id=? LIMIT 1',[id]))[0]||null;
exports.stats = async () => (await db.query(`SELECT COUNT(*) total, SUM(is_active=1 AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW())) active, SUM(is_active=1 AND starts_at>NOW()) upcoming, SUM(is_active=0 OR (ends_at IS NOT NULL AND ends_at<NOW())) expired FROM promotions`))[0];
exports.categories = async () => db.query('SELECT id,name FROM categories WHERE is_active=1 ORDER BY name');
exports.categoryIds = async id => (await db.query('SELECT category_id FROM promotion_categories WHERE promotion_id=?',[id])).map(x=>Number(x.category_id));

// 17.5 — clients ciblés par une promotion SELECTED
exports.selectedUserIds = async id => (await db.query('SELECT user_id FROM promotion_selected_users WHERE promotion_id=? ORDER BY user_id',[id])).map(x=>Number(x.user_id));
exports.saveSelectedUsers = async (id, ids=[]) => {
  await db.query('DELETE FROM promotion_selected_users WHERE promotion_id=?',[id]);
  for (const uid of [...new Set(ids.map(Number).filter(Number.isInteger))]) {
    await db.query('INSERT IGNORE INTO promotion_selected_users(promotion_id,user_id) VALUES(?,?)',[id,uid]);
  }
};
exports.customers = async () => db.query(`
  SELECT u.id,u.email,u.phone,COALESCE(NULLIF(up.display_name,''),NULLIF(CONCAT_WS(' ',up.first_name,up.last_name),''),u.email,u.phone,CONCAT('Client #',u.id)) AS name
  FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id
  WHERE u.account_type='CUSTOMER' AND u.status<>'DELETED'
  ORDER BY name,u.id
`);
exports.saveCategories = async (id, ids=[]) => { await db.query('DELETE FROM promotion_categories WHERE promotion_id=?',[id]); for(const cid of ids) await db.query('INSERT IGNORE INTO promotion_categories(promotion_id,category_id) VALUES(?,?)',[id,cid]); };
exports.create = async d => { const r=await db.query(`INSERT INTO promotions(name,code,description,image_url,discount_type,discount_value,minimum_order,audience,usage_limit,usage_limit_per_user,starts_at,ends_at,is_active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[d.name,d.code,d.description,d.image_url,d.discount_type,d.discount_value,d.minimum_order,d.audience,d.usage_limit,d.usage_limit_per_user,d.starts_at,d.ends_at,d.is_active]); return r.insertId; };
exports.update = async (id,d) => db.query(`UPDATE promotions SET name=?,code=?,description=?,image_url=?,discount_type=?,discount_value=?,minimum_order=?,audience=?,usage_limit=?,usage_limit_per_user=?,starts_at=?,ends_at=?,is_active=? WHERE id=?`,[d.name,d.code,d.description,d.image_url,d.discount_type,d.discount_value,d.minimum_order,d.audience,d.usage_limit,d.usage_limit_per_user,d.starts_at,d.ends_at,d.is_active,id]);
exports.remove = async id => db.query('DELETE FROM promotions WHERE id=?',[id]);


/* =========================================================
   17.2 — VALIDATION / APPLICATION CODE PROMO AU PANIER
========================================================= */
function promoNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function validateCode({ code, userId = null, cart, connection = null, lock = false }) {
  const normalizedCode = String(code || '').trim().toUpperCase().slice(0, 80);
  if (!normalizedCode) return { valid:false, message:'Saisissez un code promo.' };
  if (!cart || !Array.isArray(cart.items) || !cart.items.length) return { valid:false, message:'Votre panier est vide.' };

  const executor = connection || db.pool;
  const suffix = lock && connection ? ' FOR UPDATE' : '';
  const [rows] = await executor.execute(`
    SELECT * FROM promotions
    WHERE code=? LIMIT 1${suffix}
  `,[normalizedCode]);
  const promo = rows[0] || null;
  if (!promo) return { valid:false, message:'Code promo introuvable.' };
  if (Number(promo.is_active) !== 1) return { valid:false, message:'Ce code promo est désactivé.' };

  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return { valid:false, message:'Cette promotion n’a pas encore commencé.' };
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return { valid:false, message:'Ce code promo a expiré.' };

  const subtotal = promoNumber(cart.subtotal);
  const minimum = promoNumber(promo.minimum_order);
  if (minimum > 0 && subtotal < minimum) {
    return { valid:false, message:`Montant minimum requis : ${minimum.toLocaleString('fr-FR')} XAF.` };
  }

  if (promo.audience !== 'ALL') {
    if (!userId) return { valid:false, message:'Connectez-vous pour utiliser ce code promo.' };
    if (promo.audience === 'TIOP_PLUS') {
      const [a] = await executor.execute('SELECT user_id FROM loyalty_accounts WHERE user_id=? AND subscribed_at IS NOT NULL LIMIT 1',[userId]);
      if (!a.length) return { valid:false, message:'Ce code est réservé aux membres Tiop+.' };
    } else if (promo.audience === 'NEW_CUSTOMERS') {
      const [o] = await executor.execute("SELECT COUNT(*) total FROM orders WHERE user_id=? AND status<>'CANCELLED'",[userId]);
      if (Number(o[0]?.total || 0) > 0) return { valid:false, message:'Ce code est réservé aux nouveaux clients.' };
    } else if (promo.audience === 'SELECTED') {
      const [selected] = await executor.execute('SELECT 1 FROM promotion_selected_users WHERE promotion_id=? AND user_id=? LIMIT 1',[promo.id,userId]);
      if (!selected.length) return { valid:false, message:'Ce code promo est réservé à certains clients.' };
    }
  }

  if (promo.usage_limit != null) {
    const [u] = await executor.execute('SELECT COUNT(*) total FROM promotion_usages WHERE promotion_id=?',[promo.id]);
    if (Number(u[0]?.total || 0) >= Number(promo.usage_limit)) return { valid:false, message:'La limite d’utilisation de ce code a été atteinte.' };
  }
  if (promo.usage_limit_per_user != null && userId) {
    const [u] = await executor.execute('SELECT COUNT(*) total FROM promotion_usages WHERE promotion_id=? AND user_id=?',[promo.id,userId]);
    if (Number(u[0]?.total || 0) >= Number(promo.usage_limit_per_user)) return { valid:false, message:'Vous avez déjà utilisé ce code le nombre maximum de fois.' };
  }

  let eligibleSubtotal = subtotal;
  const [cats] = await executor.execute('SELECT category_id FROM promotion_categories WHERE promotion_id=?',[promo.id]);
  if (cats.length) {
    const allowed = new Set(cats.map(x=>Number(x.category_id)));
    const productIds = [...new Set(cart.items.filter(i=>i.item_type==='PRODUCT' && i.product_id).map(i=>Number(i.product_id)))];
    const categoryByProduct = new Map();
    if (productIds.length) {
      const placeholders = productIds.map(()=>'?').join(',');
      const [products] = await executor.execute(`SELECT id,category_id FROM products WHERE id IN (${placeholders})`,productIds);
      products.forEach(x=>categoryByProduct.set(Number(x.id),Number(x.category_id)));
    }
    eligibleSubtotal = cart.items.reduce((sum,item)=>{
      if (item.item_type !== 'PRODUCT') return sum;
      return allowed.has(categoryByProduct.get(Number(item.product_id))) ? sum + promoNumber(item.line_total) : sum;
    },0);
    if (eligibleSubtotal <= 0) return { valid:false, message:'Ce code ne s’applique à aucun article de votre panier.' };
  }

  const type = String(promo.discount_type || '').toUpperCase();
  const value = Math.max(0,promoNumber(promo.discount_value));
  let discountAmount = 0;
  let freeDelivery = false;
  if (type === 'PERCENT') {
    if (value <= 0 || value > 100) return { valid:false, message:'Ce code promo est mal configuré.' };
    discountAmount = Math.min(eligibleSubtotal, Math.round(eligibleSubtotal * value / 100));
  } else if (type === 'FIXED') {
    if (value <= 0) return { valid:false, message:'Ce code promo est mal configuré.' };
    discountAmount = Math.min(eligibleSubtotal, value);
  } else if (type === 'FREE_DELIVERY') {
    freeDelivery = true;
  } else if (type === 'POINTS_MULTIPLIER') {
    if (value <= 1) return { valid:false, message:'Le multiplicateur de points doit être supérieur à 1.' };
    // 17.4 — ce type ne réduit pas le panier : il multiplie les points gagnés après paiement.
    // La promotion reste enregistrée sur la commande afin que le crédit fidélité soit serveur-authoritative.
  } else {
    return { valid:false, message:'Type de promotion non supporté.' };
  }

  return {
    valid:true,
    promotion:promo,
    code:normalizedCode,
    discountAmount,
    freeDelivery,
    pointsMultiplier: type === 'POINTS_MULTIPLIER' ? value : 1,
    eligibleSubtotal,
    label:promo.name || normalizedCode
  };
}

exports.validateCode = validateCode;
