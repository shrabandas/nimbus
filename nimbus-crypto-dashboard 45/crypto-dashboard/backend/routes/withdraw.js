const { db } = require('../db/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { computePortfolio } = require('./wallet');

function register(router) {
  // POST /api/withdraw  { amount, address }
  router.post('/api/withdraw', requireAuth, async (req, res) => {
    try {
      const { amount, address } = req.body;
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) {
        return res.json({ error: 'Enter a valid withdrawal amount' }, 400);
      }
      if (!address || address.trim().length < 10) {
        return res.json({ error: 'Enter a valid destination address' }, 400);
      }

      const portfolio = await computePortfolio(req.user.id);
      if (numAmount > portfolio.available_balance) {
        return res.json({
          error: `Insufficient available balance. Available: $${portfolio.available_balance}`,
        }, 400);
      }

      const info = db.prepare(`
        INSERT INTO withdrawals (user_id, amount, address, status)
        VALUES (?, ?, ?, 'pending')
      `).run(req.user.id, numAmount, address.trim());

      const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(info.lastInsertRowid);
      res.json({ message: 'Withdrawal request submitted for admin review', withdrawal }, 201);
    } catch (err) {
      console.error(err);
      res.json({ error: 'Failed to submit withdrawal request' }, 500);
    }
  });

  // GET /api/withdraw/mine
  router.get('/api/withdraw/mine', requireAuth, (req, res) => {
    const rows = db.prepare(
      'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json({ withdrawals: rows });
  });

  // ---------- Admin ----------

  // GET /api/withdraw/admin/all
  router.get('/api/withdraw/admin/all', requireAuth, requireAdmin, (req, res) => {
    const rows = db.prepare(`
      SELECT w.*, u.name AS user_name, u.email AS user_email
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ORDER BY w.created_at DESC
    `).all();
    res.json({ withdrawals: rows });
  });

  // POST /api/withdraw/admin/:id/decide  { decision }
  router.post('/api/withdraw/admin/:id/decide', requireAuth, requireAdmin, (req, res) => {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.json({ error: "Decision must be 'approved' or 'rejected'" }, 400);
    }
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id);
    if (!withdrawal) return res.json({ error: 'Withdrawal request not found' }, 404);
    if (withdrawal.status !== 'pending') {
      return res.json({ error: 'This request has already been decided' }, 400);
    }

    db.prepare(`
      UPDATE withdrawals SET status = ?, decided_at = datetime('now') WHERE id = ?
    `).run(decision, req.params.id);

    const updated = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id);
    res.json({ message: `Withdrawal ${decision}`, withdrawal: updated });
  });
}

module.exports = { register };
