const { db } = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const { computePortfolio, addUserEarning } = require('./wallet');
const { calculateReferralBonusPoints } = require('./referral');

// Feature/access tiers - NOT a promise of guaranteed profit or return.
const PLANS = [
  {
    id: 'silver',
    name: 'Silver',
    price_usdt: 50,
    features: [
      'every week 12.5 usdt',
      'refferal bonus',
      'Standard withdrawal review time',
    ],
  },
  {
    id: 'gold',
    name: 'Gold',
    price_usdt: 100,
    features: [
      'every week 25 usdt',
      'Priority withdrawal review',
      'Referral bonus',
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price_usdt: 200,
    features: [
      'All Gold features',
      'Early access to new plan',
      'Referral bonus',
    ],
  },
];

function register(router) {
  // GET /api/plans
  router.get('/api/plans', (req, res) => {
    res.json({ plans: PLANS });
  });

  // POST /api/plans/buy  { plan_id }
  // Requires enough approved wallet balance. Deposits must be made and admin-approved first.
  router.post('/api/plans/buy', requireAuth, async (req, res) => {
    try {
      const { plan_id } = req.body;
      const plan = PLANS.find((p) => p.id === plan_id);
      if (!plan) return res.json({ error: 'Unknown plan' }, 400);

      const portfolio = await computePortfolio(req.user.id);

      if (portfolio.available_balance < plan.price_usdt) {
        const shortfall = Math.round((plan.price_usdt - portfolio.available_balance) * 100) / 100;
        return res.json({
          error: `Not enough balance to buy the ${plan.name} plan. You have $${portfolio.available_balance} available — deposit at least $${shortfall} more (and wait for admin approval) before buying.`,
          available_balance: portfolio.available_balance,
          required: plan.price_usdt,
          shortfall,
        }, 400);
      }

      db.prepare(`
        INSERT INTO plan_purchases (user_id, plan_id, price_usdt) VALUES (?, ?, ?)
      `).run(req.user.id, plan.id, plan.price_usdt);

      const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (buyer && buyer.referred_by) {
        const referrer = db.prepare('SELECT * FROM users WHERE id = ?').get(buyer.referred_by);
        const hasPurchasedPlan = db.prepare(
          'SELECT COUNT(*) AS c FROM plan_purchases WHERE user_id = ?'
        ).get(referrer ? referrer.id : 0).c > 0;

        if (referrer && !referrer.is_admin && hasPurchasedPlan) {
          const bonusPoints = calculateReferralBonusPoints(plan.price_usdt);
          db.prepare(`
            INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_points, reason)
            VALUES (?, ?, ?, ?)
          `).run(referrer.id, req.user.id, bonusPoints, `Referred user bought ${plan.name} plan`);

          addUserEarning({
            userId: referrer.id,
            amount: bonusPoints,
            bonusName: `Referral bonus: ${plan.name} plan`,
            adminId: req.user.id,
          });
        }
      }

      const updatedPortfolio = await computePortfolio(req.user.id);

      res.json({
        message: `${plan.name} plan purchased for $${plan.price_usdt} from your wallet balance.`,
        plan,
        available_balance: updatedPortfolio.available_balance,
      }, 201);
    } catch (err) {
      console.error(err);
      res.json({ error: 'Failed to purchase plan' }, 500);
    }
  });

  // GET /api/plans/mine
  router.get('/api/plans/mine', requireAuth, (req, res) => {
    const purchases = db.prepare(
      'SELECT * FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json({ purchases });
  });
}

module.exports = { register };
