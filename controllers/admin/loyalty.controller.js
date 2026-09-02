const Loyalty = require('../../models/loyalty.model');
const db = require('../../config/database');

function imageUrl(file, fallback = null) {
  return file ? `/uploads/rewards/${file.filename}` : (fallback || null);
}
function normalize(body = {}) {
  const type = ['PRODUCT','DISCOUNT','FREE_DELIVERY','COUPON'].includes(body.reward_type) ? body.reward_type : 'PRODUCT';
  return {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim() || null,
    points_cost: Math.max(1, Number(body.points_cost || body.points || 0)),
    reward_type: type,
    reward_value: body.reward_value === '' || body.reward_value == null ? null : Number(body.reward_value),
    reward_product_id: type === 'PRODUCT' && Number(body.reward_product_id) > 0 ? Number(body.reward_product_id) : null,
    is_active: body.is_active === '0' ? 0 : 1
  };
}

exports.index = async (req,res,next) => {
  try {
    const [rewards, products] = await Promise.all([Loyalty.listRewards({ includeInactive: true }), db.query(`SELECT id,name,price FROM products WHERE is_active=1 ORDER BY name`)]);
    res.render('admin/catalog/loyalty', { title:'Tiop+', layout:'layouts/admin', rewards, products, saved:req.query.saved, deleted:req.query.deleted });
  } catch(e){ next(e); }
};

exports.create = async (req,res,next) => {
  try {
    const data = normalize(req.body);
    if (!data.name || !data.points_cost) return res.status(400).send('Nom et coût en points obligatoires.');
    data.image_url = imageUrl(req.file);
    await Loyalty.createReward(data);
    res.redirect('/admin/tiopplus?saved=1');
  } catch(e){ next(e); }
};

exports.update = async (req,res,next) => {
  try {
    const current = await Loyalty.findReward(Number(req.params.id));
    if (!current) return res.status(404).send('Récompense introuvable.');
    const data = normalize(req.body);
    if (!data.name || !data.points_cost) return res.status(400).send('Nom et coût en points obligatoires.');
    data.image_url = imageUrl(req.file, current.image_url);
    await Loyalty.updateReward(Number(req.params.id), data);
    res.redirect('/admin/tiopplus?saved=1');
  } catch(e){ next(e); }
};

exports.remove = async (req,res,next) => {
  try {
    await Loyalty.deleteReward(Number(req.params.id));
    res.redirect('/admin/tiopplus?deleted=1');
  } catch(e){ next(e); }
};
