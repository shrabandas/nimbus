const crypto = require('crypto');
const { db, genDemoAddress } = require('../db/init');
const jwt = require('../lib/jwt');
const { hashPassword, verifyPassword } = require('../lib/password');
const { requireAuth } = require('../middleware/auth');
const otp = require('../lib/otp');
const { sendOtpEmail } = require('../lib/mailer');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function makeReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin });
}

async function publicUser(u) {
  const latestPlanId = u.latest_plan_id || (
    u.id ? (await db.prepare(
      'SELECT plan_id FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(u.id))?.plan_id : null
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
  router.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, referral_code } = req.body;
    if (!name || !email || !password) {
      return res.json({ error: 'Name, email and password are required' }, 400);
    }
    if (password.length < 6) {
      return res.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.json({ error: 'An account with this email already exists' }, 409);
    }

    let referrer = null;
    if (referral_code) {
      referrer = await db.prepare('SELECT * FROM users WHERE referral_code = ?').get(referral_code.toUpperCase());
      if (!referrer) {
        return res.json({ error: 'Invalid referral code' }, 400);
      }
    }

    const hash = hashPassword(password);
    let code = makeReferralCode();
    while (await db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code)) {
      code = makeReferralCode();
    }
    const address = genDemoAddress();

    const info = await db.prepare(`
      INSERT INTO users (name, email, password_hash, referral_code, referred_by, demo_deposit_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email.toLowerCase(), hash, code, referrer ? referrer.id : null, address);

    const newUserId = info.lastInsertRowid;

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
    const token = signToken(user);
    res.json({ token, user: await publicUser(user) }, 201);
  });

  // POST /api/auth/login (step 1: password check + send OTP)
  router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ error: 'Email and password are required' }, 400);
    }
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.json({ error: 'Invalid email or password' }, 401);
    }

    if (user.is_admin) {
      const token = signToken(user);
      return res.json({ token, user: await publicUser(user) });
    }

    const code = otp.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await db.prepare(
      'INSERT INTO login_otps (user_id, code_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, otp.hashCode(code), expiresAt);

    await sendOtpEmail(user.email, code);

    res.json({ otp_required: true, user_id: user.id });
  });

  // POST /api/auth/verify-otp (step 2: code check + issue token)
  router.post('/api/auth/verify-otp', async (req, res) => {
    const { user_id, code } = req.body;
    if (!user_id || !code) {
      return res.json({ error: 'user_id and code are required' }, 400);
    }

    const row = await db.prepare(
      'SELECT * FROM login_otps WHERE user_id = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1'
    ).get(user_id);

    if (!row) return res.json({ error: 'No pending code. Please log in again.' }, 400);
    if (new Date(row.expires_at) < new Date()) {
      return res.json({ error: 'Code expired. Please log in again.' }, 400);
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return res.json({ error: 'Too many attempts. Please log in again.' }, 429);
    }

    if (!otp.verifyCode(code, row.code_hash)) {
      await db.prepare('UPDATE login_otps SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      return res.json({ error: 'Incorrect code' }, 401);
    }

    await db.prepare('UPDATE login_otps SET consumed = 1 WHERE id = ?').run(row.id);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    const token = signToken(user);
    res.json({ token, user: await publicUser(user) });
  });

  // POST /api/auth/resend-otp
  router.post('/api/auth/resend-otp', async (req, res) => {
    const { user_id } = req.body;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) return res.json({ error: 'Invalid request' }, 400);

    const code = otp.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await db.prepare(
      'INSERT INTO login_otps (user_id, code_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, otp.hashCode(code), expiresAt);
    await sendOtpEmail(user.email, code);

    res.json({ ok: true });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', requireAuth, async (req, res) => {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.json({ error: 'User not found' }, 404);
    res.json({ user: await publicUser(user) });
  });
}

module.exports = { register, publicUser };
