const { db } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

function calculateReferralBonusPoints(planAmount) {
  const amount = Number(planAmount) || 0;
  return Math.round((amount * 20) / 100 * 100) / 100;
}

function getAvailableBonusPoints({ earned = 0, redeemed = 0 }) {
  return Math.max(0, Number(earned || 0) - Number(redeemed || 0));
}

function register(router) {
  // GET /api/referral/overview
  router.get('/api/referral/overview', requireAuth, async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const referred = db.prepare(`
      SELECT u.id, u.name, u.email, u.created_at, r.referral_code, r.name AS referrer_name,
        (SELECT pp.plan_id FROM plan_purchases pp WHERE pp.user_id = u.id ORDER BY pp.created_at DESC LIMIT 1) AS latest_plan_id
      FROM users u
      LEFT JOIN users r ON r.id = u.referred_by
      WHERE u.referred_by = ? ORDER BY u.created_at DESC
    `).all(user.id);

    const bonuses = db.prepare(`
      SELECT rb.*, u.name AS referred_name, u.email AS referred_email
      FROM referral_bonuses rb
      JOIN users u ON u.id = rb.referred_id
      WHERE rb.referrer_id = ?
      ORDER BY rb.created_at DESC
    `).all(user.id);

    const totalPoints = bonuses.reduce((sum, b) => sum + Number(b.bonus_points || 0), 0);
    const redeemedPoints = db.prepare(
      'SELECT COALESCE(SUM(points),0) AS s FROM bonus_redemptions WHERE user_id = ? AND status = ?'
    ).get(req.user.id, 'approved').s;
    const availablePoints = getAvailableBonusPoints({ earned: totalPoints, redeemed: redeemedPoints });

    const host = (req.headers['x-frontend-host']) || req.headers.host || 'localhost:5173';
    const webHost = host.replace(/:\d+$/, ':5173');

    res.json({
      referral_code: user.referral_code,
      referral_link: `http://${webHost}/signup?ref=${user.referral_code}`,
      total_referred: referred.length,
      total_bonus_points: totalPoints,
      overall_earned_commission: totalPoints,
      available_bonus_points: availablePoints,
      referred_users: referred,
      bonus_history: bonuses,
    });
  });
}

module.exports = { register, calculateReferralBonusPoints, getAvailableBonusPoints };
