const crypto = require('crypto');
const Loyalty = require('../../models/loyalty.model');

function memberNumber(account) {
  if (!account) return null;
  const token = String(account.public_id || account.user_id).replace(/-/g, '').toUpperCase();
  return `TT+${token.slice(0, 8)}`;
}

function memberName(account) {
  if (!account) return '';
  if (account.display_name) return String(account.display_name).trim();
  return [account.first_name, account.last_name].filter(Boolean).join(' ').trim();
}

function levelFromAccount(account) {
  const raw = String(account?.tier || 'TIOP_PLUS').toUpperCase();
  if (raw.includes('PLATINUM')) return 'PLATINUM';
  if (raw.includes('GOLD')) return 'GOLD';
  return 'TIOP';
}

/**
 * La carte ne transporte AUCUNE donnée personnelle (nom, email, téléphone, solde...).
 * Le QR contient uniquement : version + public_id + signature HMAC.
 * Une future borne/app TiopTiop pourra vérifier la signature puis retrouver le compte côté serveur.
 */
function signedCardPayload(account) {
  if (!account?.public_id) return null;

  const secret =
    process.env.TIOPPLUS_CARD_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.APP_SECRET ||
    'tioptiop-dev-card-secret-change-me';

  const publicId = String(account.public_id);
  const body = `TIOPPLUS|1|${publicId}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');

  return `${body}|${signature}`;
}

exports.page = async (req, res, next) => {
  try {
    const userId = Number(req.session.user.id);
    const [account, config, rewards, availableRedemptions] = await Promise.all([
      Loyalty.findAccount(userId),
      Loyalty.getConfig(),
      Loyalty.listRewards(),
      Loyalty.listAvailableRedemptions(userId)
    ]);

    const points = Number(account?.points_balance || 0);
    const rate = Math.max(1, Number(config.pointsPer1000Xaf || 10));
    const amountEquivalent = Math.floor(points / rate) * 1000;

    res.render('client/content/tiopplus', {
      title: 'Tiop+',
      layout: 'layouts/client',
      account,
      isSubscribed: Boolean(account?.subscribed_at),
      points,
      amountEquivalent,
      pointsPer1000Xaf: rate,
      memberNumber: memberNumber(account),
      memberName: memberName(account),
      memberLevel: levelFromAccount(account),
      cardPayload: signedCardPayload(account),
      rewards,
      availableRedemptions,
      rewardRequestKeys: Object.fromEntries((rewards || []).map(r => [r.id, crypto.randomUUID()])),
      joined: req.query.joined === '1',
      redeemed: req.query.redeemed === '1',
      redeemError: String(req.query.redeem_error || '')
    });
  } catch (e) {
    next(e);
  }
};

exports.subscribe = async (req, res, next) => {
  try {
    const config = await Loyalty.getConfig();
    if (!config.enabled) {
      return res.status(503).send('Le programme Tiop+ est temporairement indisponible.');
    }

    await Loyalty.subscribe(Number(req.session.user.id));
    res.redirect('/tiopplus?joined=1');
  } catch (e) {
    next(e);
  }
};


exports.redeem = async (req, res, next) => {
  try {
    const userId = Number(req.session.user.id);
    const rewardId = Number(req.params.id);
    const requestKey = String(req.body.request_key || '').trim();
    const result = await Loyalty.redeemReward(userId, rewardId, requestKey);

    if (result.redeemed) {
      return res.redirect('/tiopplus?redeemed=1#recompenses');
    }

    const publicReasons = new Set([
      'NOT_SUBSCRIBED', 'REWARD_UNAVAILABLE', 'INSUFFICIENT_POINTS',
      'INVALID_REWARD', 'INVALID_REQUEST', 'INVALID_COST'
    ]);
    const reason = publicReasons.has(result.reason) ? result.reason : 'REDEEM_FAILED';
    return res.redirect(`/tiopplus?redeem_error=${encodeURIComponent(reason)}#recompenses`);
  } catch (e) {
    next(e);
  }
};
