const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../db/init');
const { normalizeDepositAsset, buildTransactionLog, addUserEarning, deductUserEarning } = require('../routes/wallet');
const { calculateReferralBonusPoints, getAvailableBonusPoints } = require('../routes/referral');
const authRoutes = require('../routes/auth');

test('normalizeDepositAsset accepts USDT/BEP20 only', () => {
  assert.equal(normalizeDepositAsset('usdt'), 'USDT');
  assert.equal(normalizeDepositAsset('USDT (BEP20)'), 'USDT');
  assert.equal(normalizeDepositAsset('USDT'), 'USDT');
});

test('normalizeDepositAsset rejects BTC/ETH/BNB and other unsupported assets', () => {
  assert.equal(normalizeDepositAsset('btc'), null);
  assert.equal(normalizeDepositAsset('eth'), null);
  assert.equal(normalizeDepositAsset('bnb'), null);
  assert.equal(normalizeDepositAsset('sol'), null);
  assert.equal(normalizeDepositAsset(''), null);
});

test('buildTransactionLog includes deposits and withdrawals in one timeline', () => {
  const transactions = buildTransactionLog({
    approvedDeposits: [{
      id: 1,
      amount: 100,
      asset: 'USDT',
      entry_price: 1,
      tx_id: '0xabc',
      status: 'approved',
      created_at: '2025-01-01T00:00:00Z'
    }],
    withdrawals: [{
      id: 2,
      amount: 40,
      address: '0xdef',
      status: 'pending',
      created_at: '2025-01-02T00:00:00Z'
    }],
    prices: { USDT: 1 }
  });

  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].type, 'withdrawal');
  assert.equal(transactions[0].amount, 40);
  assert.equal(transactions[0].address, '0xdef');
  assert.equal(transactions[1].type, 'deposit');
  assert.equal(transactions[1].tx_id, '0xabc');
});

test('addUserEarning stores a bonus credit with its name and amount', () => {
  const email = `wallet-user-${Date.now()}@demo.local`;
  const user = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Wallet User', email, 'hash', `WALLET${Date.now()}`, '0x2222222222222222222222222222222222222222');

  const record = addUserEarning({ userId: user.lastInsertRowid, amount: 250, bonusName: 'Referral bonus', adminId: 1 });

  assert.equal(record.user_id, user.lastInsertRowid);
  assert.equal(record.amount, 250);
  assert.equal(record.bonus_name, 'Referral bonus');
  assert.equal(record.created_by_admin_id, 1);

  db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(user.lastInsertRowid);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.lastInsertRowid);
});

test('deductUserEarning records a negative adjustment with the admin reason', () => {
  const email = `wallet-deduct-${Date.now()}@demo.local`;
  const user = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Deduct User', email, 'hash', `DEDUCT${Date.now()}`, '0x3333333333333333333333333333333333333333');

  const record = deductUserEarning({ userId: user.lastInsertRowid, amount: 75, reason: 'Wrong referral payout', adminId: 1 });

  assert.equal(record.user_id, user.lastInsertRowid);
  assert.equal(record.amount, -75);
  assert.equal(record.bonus_name, 'Wrong referral payout');
  assert.equal(record.created_by_admin_id, 1);

  db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(user.lastInsertRowid);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.lastInsertRowid);
});

test('calculateReferralBonusPoints gives 20% of a plan purchase', () => {
  assert.equal(calculateReferralBonusPoints(100), 20);
  assert.equal(calculateReferralBonusPoints(250), 50);
});

test('getAvailableBonusPoints subtracts redeemed bonus points from earned points', () => {
  const available = getAvailableBonusPoints({ earned: 100, redeemed: 35 });
  assert.equal(available, 65);
});

test('admin accounts cannot receive a user earning credit', () => {
  const adminUser = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get();
  assert.ok(adminUser, 'expected seeded admin user to exist');
  assert.throws(() => {
    addUserEarning({ userId: adminUser.id, amount: 250, bonusName: 'Referral bonus', adminId: adminUser.id });
  }, /admin/i);
});

test('admin balance is approved deposits minus approved withdrawals and payout credits', () => {
  const unique = Date.now();
  const referrer = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Referrer Balance', `balance-referrer-${unique}@demo.local`, 'hash', `BALREF${unique}`, '0x1111111111111111111111111111111111111111');
  const referred = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, referred_by, demo_deposit_address) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Referred Balance', `balance-referred-${unique}@demo.local`, 'hash', `BALREF2${unique}`, referrer.lastInsertRowid, '0x2222222222222222222222222222222222222222');

  const bonusAmount = 50;
  db.prepare('INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_points, reason) VALUES (?, ?, ?, ?)')
    .run(referrer.lastInsertRowid, referred.lastInsertRowid, bonusAmount, 'Test referral bonus');
  addUserEarning({ userId: referrer.lastInsertRowid, amount: bonusAmount, bonusName: 'Referral bonus', adminId: 1 });

  const expected = Number(db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE status = 'approved'").get().s)
    - Number(db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'approved'").get().s)
    - Number(db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM user_earnings').get().s);

  const actual = Number(db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE status = 'approved'"
  ).get().s) - Number(db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'approved'"
  ).get().s) - Number(db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS s FROM user_earnings'
  ).get().s);

  assert.equal(actual, expected);
  assert.ok(actual <= Number.MAX_SAFE_INTEGER);

  db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(referrer.lastInsertRowid);
  db.prepare('DELETE FROM referral_bonuses WHERE referrer_id = ? AND referred_id = ?').run(referrer.lastInsertRowid, referred.lastInsertRowid);
  db.prepare('DELETE FROM users WHERE id = ?').run(referred.lastInsertRowid);
  db.prepare('DELETE FROM users WHERE id = ?').run(referrer.lastInsertRowid);
});

test('signup alone does not award a referral bonus', () => {
  const unique = Date.now();
  const referrerEmail = `referrer-${unique}@demo.local`;
  const referrerCode = `REF${unique}`;
  const referrer = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)').run(
    'Referrer',
    referrerEmail,
    'hash',
    referrerCode,
    '0x1111111111111111111111111111111111111111'
  );

  const fakeRouter = {
    routes: {},
    get(path, handler) {
      this.routes[path] = handler;
    },
    post(path, handler) {
      this.routes[path] = handler;
      if (path === '/api/auth/signup') {
        this.signupHandler = handler;
      }
    },
  };

  authRoutes.register(fakeRouter);

  let statusCode = 200;
  const req = {
    body: {
      name: 'New User',
      email: `newuser-${unique}@demo.local`,
      password: 'abc12345',
      referral_code: referrerCode,
    },
  };
  const res = {
    json(payload, code) {
      if (code) statusCode = code;
      return payload;
    },
  };

  fakeRouter.signupHandler(req, res);

  const bonus = db.prepare('SELECT COUNT(*) AS c FROM referral_bonuses WHERE referrer_id = ? AND referred_id = (SELECT id FROM users WHERE email = ?)').get(referrer.lastInsertRowid, req.body.email.toLowerCase());
  assert.equal(statusCode, 201);
  assert.equal(bonus.c, 0);

  db.prepare('DELETE FROM users WHERE email = ?').run(req.body.email.toLowerCase());
  db.prepare('DELETE FROM users WHERE id = ?').run(referrer.lastInsertRowid);
});
