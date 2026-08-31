const crypto = require('crypto');
const { db, genDemoAddress } = require('../db/init');
const jwt = require('../lib/jwt');
const { hashPassword, verifyPassword } = require('../lib/password');
const { requireAuth } = require('../middleware/auth');

function makeReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin });
}

function publicUser(u) {
  const latestPlanId = u.latest_plan_id || (
    u.id ? db.prepare(
      'SELECT plan_id FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(u.id)?.plan_id : null
  );

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    referral_code: u.referral_code,
    demo_deposit_address: u.demo_deposit_address,
    is_admin: !!u.is_admin,
    created_at: u.created_at,
    latest_plan_id: latestPlanId || null,
  };
}

function register(router) {
  // POST /api/auth/signup
  router.post('/api/auth/signup', (req, res) => {
    const { name, email, password, referral_code } = req.body;
    if (!name || !email || !password) {
      return res.json({ error: 'Name, email and password are required' }, 400);
    }
    if (password.length < 6) {
      return res.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.json({ error: 'An account with this email already exists' }, 409);
    }

    let referrer = null;
    if (referral_code) {
      referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(referral_code.toUpperCase());
      if (!referrer) {
        return res.json({ error: 'Invalid referral code' }, 400);
      }
    }

    const hash = hashPassword(password);
    let code = makeReferralCode();
    while (db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code)) {
      code = makeReferralCode();
    }
    const address = genDemoAddress();

    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, referral_code, referred_by, demo_deposit_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email.toLowerCase(), hash, code, referrer ? referrer.id : null, address);

    const newUserId = info.lastInsertRowid;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
    const token = signToken(user);
    res.json({ token, user: publicUser(user) }, 201);
  });

  // POST /api/auth/login
  router.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ error: 'Email and password are required' }, 400);
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.json({ error: 'Invalid email or password' }, 401);
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.json({ error: 'User not found' }, 404);
    res.json({ user: publicUser(user) });
  });
}

module.exports = { register, publicUser };
