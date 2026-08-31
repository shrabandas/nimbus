const { db } = require('../db/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { addUserEarning, deductUserEarning } = require('./wallet');

function register(router) {
  // GET /api/admin/users
  router.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    const users = await db.prepare(`
      SELECT u.id, u.name, u.email, u.referral_code, u.referred_by, r.name AS referrer_name, r.referral_code AS referrer_code, u.demo_deposit_address, u.is_admin, u.created_at,
        (SELECT pp.plan_id FROM plan_purchases pp WHERE pp.user_id = u.id ORDER BY pp.created_at DESC LIMIT 1) AS latest_plan_id,
        (SELECT pp.price_usdt FROM plan_purchases pp WHERE pp.user_id = u.id ORDER BY pp.created_at DESC LIMIT 1) AS latest_plan_price,
        (SELECT pp.created_at FROM plan_purchases pp WHERE pp.user_id = u.id ORDER BY pp.created_at DESC LIMIT 1) AS latest_plan_purchased_at
      FROM users u
      LEFT JOIN users r ON r.id = u.referred_by
      ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  });

  // GET /api/admin/plan-purchases
  router.get('/api/admin/plan-purchases', requireAuth, requireAdmin, async (req, res) => {
    const purchases = await db.prepare(`
      SELECT pp.*, u.name AS user_name, u.email AS user_email
      FROM plan_purchases pp
      JOIN users u ON u.id = pp.user_id
      ORDER BY pp.created_at DESC
    `).all();
    res.json({ purchases });
  });

  // GET /api/admin/earnings
  router.get('/api/admin/earnings', requireAuth, requireAdmin, async (req, res) => {
    const rows = await db.prepare(`
      SELECT ue.*, u.name AS user_name, u.email AS user_email, a.name AS admin_name
      FROM user_earnings ue
      JOIN users u ON u.id = ue.user_id
      LEFT JOIN users a ON a.id = ue.created_by_admin_id
      ORDER BY ue.created_at DESC
    `).all();
    const referralBonuses = await db.prepare(`
      SELECT rb.*, referrer.name AS referrer_name, referrer.email AS referrer_email, referred.name AS referred_name, referred.email AS referred_email
      FROM referral_bonuses rb
      JOIN users referrer ON referrer.id = rb.referrer_id
      JOIN users referred ON referred.id = rb.referred_id
      ORDER BY rb.created_at DESC
    `).all();
    res.json({ earnings: rows, referralBonuses });
  });

  // POST /api/admin/earnings  { user_id, amount, bonus_name }
  router.post('/api/admin/earnings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { user_id, amount, bonus_name } = req.body;
      const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(Number(user_id));
      if (!user) return res.json({ error: 'User not found' }, 404);

      const record = await addUserEarning({
        userId: user.id,
        amount,
        bonusName: bonus_name,
        adminId: req.user.id,
      });

      res.json({ message: 'Earning credited to user wallet', earning: record }, 201);
    } catch (err) {
      res.json({ error: err.message || 'Failed to add earning' }, 400);
    }
  });

  // POST /api/admin/earnings/deduct  { user_id, amount, reason }
  router.post('/api/admin/earnings/deduct', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { user_id, amount, reason } = req.body;
      const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(Number(user_id));
      if (!user) return res.json({ error: 'User not found' }, 404);

      const record = await deductUserEarning({
        userId: user.id,
        amount,
        reason,
        adminId: req.user.id,
      });

      res.json({ message: 'Deduction applied to user wallet', earning: record }, 201);
    } catch (err) {
      res.json({ error: err.message || 'Failed to deduct earning' }, 400);
    }
  });

  // POST /api/admin/bonus-redemptions/:id/decide  { decision: 'approved' | 'rejected' }
  router.post('/api/admin/bonus-redemptions/:id/decide', requireAuth, requireAdmin, async (req, res) => {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.json({ error: "Decision must be 'approved' or 'rejected'" }, 400);
    }

    const redemption = await db.prepare('SELECT * FROM bonus_redemptions WHERE id = ?').get(req.params.id);
    if (!redemption) return res.json({ error: 'Redemption request not found' }, 404);
    if (redemption.status !== 'pending') {
      return res.json({ error: 'This redemption has already been decided' }, 400);
    }

    await db.prepare(`
      UPDATE bonus_redemptions SET status = ?, decided_at = datetime('now') WHERE id = ?
    `).run(decision, req.params.id);

    const updated = await db.prepare('SELECT * FROM bonus_redemptions WHERE id = ?').get(req.params.id);
    if (decision === 'approved') {
      await addUserEarning({
        userId: updated.user_id,
        amount: updated.usdt_amount,
        bonusName: `Redeemed bonus: ${updated.points} points`,
        adminId: req.user.id,
      });
    }

    res.json({ message: `Bonus redemption ${decision}`, redemption: updated });
  });

  // GET /api/admin/stats
  router.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    const totalUsersRow = await db.prepare('SELECT COUNT(*) AS c FROM users').get();
    const totalDepositedRow = await db.prepare(
      "SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE status = 'approved'"
    ).get();
    const pendingDepositsRow = await db.prepare(
      "SELECT COUNT(*) AS c FROM deposits WHERE status = 'pending'"
    ).get();
    const pendingWithdrawalsRow = await db.prepare(
      "SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'"
    ).get();
    const approvedWithdrawalsRow = await db.prepare(
      "SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'approved'"
    ).get();
    const totalUserEarningsRow = await db.prepare(
      'SELECT COALESCE(SUM(amount),0) AS s FROM user_earnings'
    ).get();

    const totalUsers = totalUsersRow.c;
    const totalDeposited = totalDepositedRow.s;
    const pendingDeposits = pendingDepositsRow.c;
    const pendingWithdrawals = pendingWithdrawalsRow.c;
    const approvedWithdrawals = approvedWithdrawalsRow.s;
    const totalUserEarnings = totalUserEarningsRow.s;
    const adminBalance = Number(totalDeposited) - Number(approvedWithdrawals) - Number(totalUserEarnings);

    res.json({
      totalUsers,
      totalDeposited,
      pendingDeposits,
      pendingWithdrawals,
      approvedWithdrawals,
      totalUserEarnings,
      adminBalance,
    });
  });
}

module.exports = { register };
