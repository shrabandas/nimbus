const { db } = require('../db/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getPrices } = require('../utils/prices');
const { validateTxId } = require('../utils/txValidator');

const VALID_ASSETS = ['USDT'];

function normalizeDepositAsset(rawAsset) {
  if (rawAsset === undefined || rawAsset === null || typeof rawAsset !== 'string') return null;

  const trimmed = rawAsset.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (VALID_ASSETS.includes(upper)) return upper;

  if (['USDT (BEP20)', 'USDT(BEP20)', 'BEP20'].includes(upper.replace(/\s+/g, ' '))) {
    return 'USDT';
  }

  return null;
}

// Only APPROVED deposits count toward portfolio value. Pending/rejected deposits
// don't contribute until an admin reviews them - mirrors the withdrawal flow.
function buildTransactionLog({ approvedDeposits = [], withdrawals = [], prices = {} }) {
  const depositRows = approvedDeposits.map((d) => ({
    id: d.id,
    type: 'deposit',
    asset: d.asset,
    amount: Number(d.amount),
    entry_price: Number(d.entry_price || prices[d.asset] || 1),
    current_price: Number(prices[d.asset] || d.entry_price || 1),
    current_value: Number(d.amount || 0),
    pnl_percent: 0,
    tx_id: d.tx_id,
    tx_status: d.tx_status,
    address: null,
    status: d.status,
    created_at: d.created_at,
  }));

  const withdrawalRows = withdrawals.map((w) => ({
    id: w.id,
    type: 'withdrawal',
    asset: 'USDT',
    amount: Number(w.amount),
    entry_price: 1,
    current_price: 1,
    current_value: Number(w.amount || 0),
    pnl_percent: 0,
    tx_id: null,
    tx_status: w.status,
    address: w.address,
    status: w.status,
    created_at: w.created_at,
  }));

  return [...depositRows, ...withdrawalRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function addUserEarning({ userId, amount, bonusName, adminId }) {
  const numAmount = Number(amount);
  const name = String(bonusName || '').trim();

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid bonus amount');
  }
  if (!name) {
    throw new Error('Enter a bonus name');
  }

  const targetUser = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(Number(userId));
  if (!targetUser) {
    throw new Error('User not found');
  }
  if (targetUser.is_admin) {
    throw new Error('Admin accounts cannot receive user earnings');
  }

  const info = db.prepare(`
    INSERT INTO user_earnings (user_id, amount, bonus_name, created_by_admin_id)
    VALUES (?, ?, ?, ?)
  `).run(Number(userId), numAmount, name, Number(adminId));

  return db.prepare('SELECT * FROM user_earnings WHERE id = ?').get(info.lastInsertRowid);
}

function deductUserEarning({ userId, amount, reason, adminId }) {
  const numAmount = Number(amount);
  const note = String(reason || '').trim();

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid deduction amount');
  }
  if (!note) {
    throw new Error('Enter a deduction reason');
  }

  const targetUser = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(Number(userId));
  if (!targetUser) {
    throw new Error('User not found');
  }
  if (targetUser.is_admin) {
    throw new Error('Admin accounts cannot have user earnings deducted');
  }

  const info = db.prepare(`
    INSERT INTO user_earnings (user_id, amount, bonus_name, created_by_admin_id)
    VALUES (?, ?, ?, ?)
  `).run(Number(userId), -Math.abs(numAmount), note, Number(adminId));

  return db.prepare('SELECT * FROM user_earnings WHERE id = ?').get(info.lastInsertRowid);
}

async function computePortfolio(userId) {
  const approvedDeposits = db.prepare(
    "SELECT * FROM deposits WHERE user_id = ? AND status = 'approved'"
  ).all(userId);
  const prices = await getPrices();

  let currentValue = 0;
  let principal = 0;
  const breakdown = approvedDeposits.map((d) => {
    const currentPrice = prices[d.asset] || d.entry_price;
    const units = d.amount / d.entry_price;
    const value = units * currentPrice;
    currentValue += value;
    principal += d.amount;
    return {
      id: d.id,
      asset: d.asset,
      amount_deposited: d.amount,
      entry_price: d.entry_price,
      current_price: currentPrice,
      current_value: Math.round(value * 100) / 100,
      pnl_percent: Math.round(((currentPrice - d.entry_price) / d.entry_price) * 10000) / 100,
      tx_id: d.tx_id,
      tx_status: d.tx_status,
      created_at: d.created_at,
    };
  });

  const withdrawals = db.prepare(
    "SELECT * FROM withdrawals WHERE user_id = ? AND status IN ('approved','pending')"
  ).all(userId);
  const reservedWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const planPurchases = db.prepare(
    'SELECT COALESCE(SUM(price_usdt),0) AS s FROM plan_purchases WHERE user_id = ?'
  ).get(userId).s;

  const earningsHistory = db.prepare(
    'SELECT * FROM user_earnings WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
  const totalEarnings = earningsHistory.reduce((sum, e) => sum + Number(e.amount), 0);

  const availableBalance = Math.max(0, currentValue + totalEarnings - reservedWithdrawals - planPurchases);

  const pendingDeposits = db.prepare(
    "SELECT * FROM deposits WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC"
  ).all(userId);

  return {
    principal: Math.round(principal * 100) / 100,
    current_value: Math.round(currentValue * 100) / 100,
    reserved_for_withdrawals: Math.round(reservedWithdrawals * 100) / 100,
    spent_on_plans: Math.round(planPurchases * 100) / 100,
    total_earnings: Math.round(totalEarnings * 100) / 100,
    earnings_history: earningsHistory,
    available_balance: Math.round(availableBalance * 100) / 100,
    breakdown,
    pending_deposits: pendingDeposits,
    all_transactions: buildTransactionLog({ approvedDeposits, withdrawals, prices }),
    prices,
  };
}

function register(router) {
  // GET /api/wallet/overview
  router.get('/api/wallet/overview', requireAuth, async (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const portfolio = await computePortfolio(user.id);
      res.json({
        demo_deposit_address: user.demo_deposit_address,
        network: ' USDT BEP20 (BNB Smart Chain) - Deposit carefully',
        ...portfolio,
      });
    } catch (err) {
      console.error(err);
      res.json({ error: 'Failed to load overview' }, 500);
    }
  });

  // POST /api/wallet/deposit  { amount, asset, tx_id }
  // Submits a deposit for admin review. It does NOT credit the balance immediately -
  // an admin must approve it first, same as withdrawals.
  router.post('/api/wallet/deposit', requireAuth, async (req, res) => {
    try {
      const { amount, asset, tx_id } = req.body;
      const numAmount = Number(amount);
      const normalizedAsset = normalizeDepositAsset(asset);

      if (!numAmount || numAmount <= 0) {
        return res.json({ error: 'Enter deposit amount' }, 400);
      }
      if (!normalizedAsset) {
        return res.json({ error: 'Choose USDT (BEP20)' }, 400);
      }
      if (!tx_id || !tx_id.trim()) {
        return res.json({ error: 'Paste your BEP20 transaction ID for reviewing the deposit' }, 400);
      }

      const txCheck = validateTxId(tx_id);

      const prices = await getPrices();
      const entryPrice = prices.USDT ?? 1;

      const info = db.prepare(`
        INSERT INTO deposits (user_id, amount, asset, entry_price, tx_id, tx_status, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(req.user.id, numAmount, normalizedAsset, entryPrice, tx_id.trim(), txCheck.status);

      const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(info.lastInsertRowid);
      res.json({
        message: 'Deposit submitted for admin review. It will appear in your portfolio once approved.',
        tx_check: txCheck,
        deposit,
      }, 201);
    } catch (err) {
      console.error(err);
      res.json({ error: 'Failed to submit deposit' }, 500);
    }
  });

  // POST /api/wallet/verify-tx  { tx_id } - check format only, no on-chain lookup
  router.post('/api/wallet/verify-tx', requireAuth, (req, res) => {
    const { tx_id } = req.body;
    const result = validateTxId(tx_id);
    res.json(result);
  });

  // GET /api/wallet/prices
  router.get('/api/wallet/prices', async (req, res) => {
    const prices = await getPrices();
    res.json({ prices });
  });

  // ---------- Admin ----------

  // GET /api/wallet/admin/deposits - every deposit request, with user info
  router.get('/api/wallet/admin/deposits', requireAuth, requireAdmin, (req, res) => {
    const rows = db.prepare(`
      SELECT d.*, u.name AS user_name, u.email AS user_email
      FROM deposits d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.created_at DESC
    `).all();
    res.json({ deposits: rows });
  });

  // POST /api/wallet/admin/deposits/:id/decide  { decision: 'approved' | 'rejected' }
  router.post('/api/wallet/admin/deposits/:id/decide', requireAuth, requireAdmin, (req, res) => {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.json({ error: "Decision must be 'approved' or 'rejected'" }, 400);
    }
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id);
    if (!deposit) return res.json({ error: 'Deposit not found' }, 404);
    if (deposit.status !== 'pending') {
      return res.json({ error: 'This deposit has already been decided' }, 400);
    }

    db.prepare(`
      UPDATE deposits SET status = ?, decided_at = datetime('now') WHERE id = ?
    `).run(decision, req.params.id);

    const updated = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id);
    res.json({ message: `Deposit ${decision}`, deposit: updated });
  });
}

module.exports = { register, computePortfolio, normalizeDepositAsset, buildTransactionLog, addUserEarning, deductUserEarning };
