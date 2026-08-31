const { db } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

function calculateReferralBonusPoints(planAmount) {
  const amount = Number(planAmount) || 0;
  return Math.round((amount * 20) / 100 * 100) / 100;
}

function getAvailableBonusPoints({ earned = 0, redeemed = 0 }) {
  return Math.max(0, Number(earned || 0) - Number(redeemed || 0));
}

async function addSupportMessage({ userId, senderType, senderName, message }) {
  const trimmedMessage = String(message || '').trim();
  const normalizedType = String(senderType || '').toLowerCase();

  if (!Number.isFinite(Number(userId))) {
    throw new Error('User not found');
  }
  if (!['user', 'admin'].includes(normalizedType)) {
    throw new Error('Invalid sender type');
  }
  if (!trimmedMessage) {
    throw new Error('Message is required');
  }

  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(Number(userId));
  if (!user) {
    throw new Error('User not found');
  }

  const result = await db.prepare(`
    INSERT INTO support_messages (user_id, sender_type, sender_name, message)
    VALUES (?, ?, ?, ?)
  `).run(Number(userId), normalizedType, String(senderName || (normalizedType === 'user' ? 'User' : 'Admin')).trim() || (normalizedType === 'user' ? 'User' : 'Admin'), trimmedMessage);

  return db.prepare('SELECT * FROM support_messages WHERE id = ?').get(result.lastInsertRowid);
}

async function getSupportThreadForUser(userId) {
  return db.prepare(`
    SELECT *
    FROM support_messages
    WHERE user_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(Number(userId));
}

async function getSupportThreadsForAdmin() {
  const rows = await db.prepare(`
    SELECT sm.*, u.name AS user_name, u.email AS user_email
    FROM support_messages sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.id IN (
      SELECT MAX(id) FROM support_messages GROUP BY user_id
    )
    ORDER BY sm.created_at DESC
  `).all();

  const threads = [];
  for (const row of rows) {
    const messages = await getSupportThreadForUser(row.user_id);
    threads.push({
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      latest_message: row.message,
      latest_sender_type: row.sender_type,
      latest_created_at: row.created_at,
      messages,
    });
  }
  return threads;
}

function register(router) {
  // GET /api/referral/overview
  router.get('/api/referral/overview', requireAuth, async (req, res) => {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const referred = await db.prepare(`
      SELECT u.id, u.name, u.email, u.created_at, r.referral_code, r.name AS referrer_name,
        (SELECT pp.plan_id FROM plan_purchases pp WHERE pp.user_id = u.id ORDER BY pp.created_at DESC LIMIT 1) AS latest_plan_id
      FROM users u
      LEFT JOIN users r ON r.id = u.referred_by
      WHERE u.referred_by = ? ORDER BY u.created_at DESC
    `).all(user.id);

    const bonuses = await db.prepare(`
      SELECT rb.*, u.name AS referred_name, u.email AS referred_email
      FROM referral_bonuses rb
      JOIN users u ON u.id = rb.referred_id
      WHERE rb.referrer_id = ?
      ORDER BY rb.created_at DESC
    `).all(user.id);

    const totalPoints = bonuses.reduce((sum, b) => sum + Number(b.bonus_points || 0), 0);
    const redeemedPointsRow = await db.prepare(
      'SELECT COALESCE(SUM(points),0) AS s FROM bonus_redemptions WHERE user_id = ? AND status = ?'
    ).get(req.user.id, 'approved');
    const redeemedPoints = redeemedPointsRow.s;
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

  router.get('/api/referral/support', requireAuth, async (req, res) => {
    const messages = await getSupportThreadForUser(req.user.id);
    res.json({ messages });
  });

  router.post('/api/referral/support', requireAuth, async (req, res) => {
    try {
      const support = await addSupportMessage({
        userId: req.user.id,
        senderType: 'user',
        senderName: req.user.email,
        message: req.body.message,
      });
      res.json({ message: 'Support message sent', support }, 201);
    } catch (err) {
      res.json({ error: err.message || 'Failed to send support message' }, 400);
    }
  });

  router.get('/api/admin/support', requireAuth, requireAdmin, async (req, res) => {
    const threads = await getSupportThreadsForAdmin();
    res.json({ threads });
  });

  router.post('/api/admin/support/:userId/reply', requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const support = await addSupportMessage({
        userId,
        senderType: 'admin',
        senderName: req.user.email,
        message: req.body.message,
      });
      res.json({ message: 'Reply sent', support }, 201);
    } catch (err) {
      res.json({ error: err.message || 'Failed to send reply' }, 400);
    }
  });
}

module.exports = { register, calculateReferralBonusPoints, getAvailableBonusPoints, addSupportMessage, getSupportThreadForUser, getSupportThreadsForAdmin };
