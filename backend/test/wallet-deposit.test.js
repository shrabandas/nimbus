const test = require('node:test');
const assert = require('node:assert/strict');
const dbInit = require('../db/init');
const { db } = dbInit;
const { normalizeDepositAsset, buildTransactionLog, addUserEarning, deductUserEarning } = require('../routes/wallet');
const { calculateReferralBonusPoints, getAvailableBonusPoints } = require('../routes/referral');
const authRoutes = require('../routes/auth');

test.before(async () => {
  await dbInit.ready;
});

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

test('addUserEarning stores a bonus credit with its name and amount', async () => {
  const email = `wallet-user-${Date.now()}@demo.local`;
  const user = await db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Wallet User', email, 'hash', `WALLET${Date.now()}`, '0x2222222222222222222222222222222222222222');

  const record = await addUserEarning({ userId: user.lastInsertRowid, amount: 250, bonusName: 'Referral bonus', adminId: 1 });

  assert.equal(record.user_id, user.lastInsertRowid);
  assert.equal(record.amount, 250);
  assert.equal(record.bonus_name, 'Referral bonus');
  assert.equal(record.created_by_admin_id, 1);

  await db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(user.lastInsertRowid);
  await db.prepare('DELETE FROM users WHERE id = ?').run(user.lastInsertRowid);
});

test('deductUserEarning records a negative adjustment with the admin reason', async () => {
  const email = `wallet-deduct-${Date.now()}@demo.local`;
  const user = await db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Deduct User', email, 'hash', `DEDUCT${Date.now()}`, '0x3333333333333333333333333333333333333333');

  const record = await deductUserEarning({ userId: user.lastInsertRowid, amount: 75, reason: 'Wrong referral payout', adminId: 1 });

  assert.equal(record.user_id, user.lastInsertRowid);
  assert.equal(record.amount, -75);
  assert.equal(record.bonus_name, 'Wrong referral payout');
  assert.equal(record.created_by_admin_id, 1);

  await db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(user.lastInsertRowid);
  await db.prepare('DELETE FROM users WHERE id = ?').run(user.lastInsertRowid);
});

test('calculateReferralBonusPoints gives 20% of a plan purchase', () => {
  assert.equal(calculateReferralBonusPoints(100), 20);
  assert.equal(calculateReferralBonusPoints(250), 50);
});

test('getAvailableBonusPoints subtracts redeemed bonus points from earned points', () => {
  const available = getAvailableBonusPoints({ earned: 100, redeemed: 35 });
  assert.equal(available, 65);
});

test('admin accounts cannot receive a user earning credit', async () => {
  const adminUser = await db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get();
  assert.ok(adminUser, 'expected seeded admin user to exist');
  await assert.rejects(async () => {
    await addUserEarning({ userId: adminUser.id, amount: 250, bonusName: 'Referral bonus', adminId: adminUser.id });
  }, /admin/i);
});

test('admin balance is approved deposits minus approved withdrawals and payout credits', async () => {
  const unique = Date.now();
  const referrer = await db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)')
    .run('Referrer Balance', `balance-referrer-${unique}@demo.local`, 'hash', `BALREF${unique}`, '0x1111111111111111111111111111111111111111');
  const referred = await db.prepare('INSERT INTO users (name, email, password_hash, referral_code, referred_by, demo_deposit_address) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Referred Balance', `balance-referred-${unique}@demo.local`, 'hash', `BALREF2${unique}`, referrer.lastInsertRowid, '0x2222222222222222222222222222222222222222');

  const bonusAmount = 50;
  await db.prepare('INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_points, reason) VALUES (?, ?, ?, ?)')
    .run(referrer.lastInsertRowid, referred.lastInsertRowid, bonusAmount, 'Test referral bonus');
  await addUserEarning({ userId: referrer.lastInsertRowid, amount: bonusAmount, bonusName: 'Referral bonus', adminId: 1 });

  const expectedDeposits = await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE status = 'approved'").get();
  const expectedWithdrawals = await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'approved'").get();
  const expectedEarnings = await db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM user_earnings').get();
  const expected = Number(expectedDeposits.s) - Number(expectedWithdrawals.s) - Number(expectedEarnings.s);

  const actualDeposits = await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE status = 'approved'").get();
  const actualWithdrawals = await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'approved'").get();
  const actualEarnings = await db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM user_earnings').get();
  const actual = Number(actualDeposits.s) - Number(actualWithdrawals.s) - Number(actualEarnings.s);

  assert.equal(actual, expected);
  assert.ok(actual <= Number.MAX_SAFE_INTEGER);

  await db.prepare('DELETE FROM user_earnings WHERE user_id = ?').run(referrer.lastInsertRowid);
  await db.prepare('DELETE FROM referral_bonuses WHERE referrer_id = ? AND referred_id = ?').run(referrer.lastInsertRowid, referred.lastInsertRowid);
  await db.prepare('DELETE FROM users WHERE id = ?').run(referred.lastInsertRowid);
  await db.prepare('DELETE FROM users WHERE id = ?').run(referrer.lastInsertRowid);
});

test('signup alone does not award a referral bonus', async () => {
  const unique = Date.now();
  const referrerEmail = `referrer-${unique}@demo.local`;
  const referrerCode = `REF${unique}`;
  const referrer = await db.prepare('INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address) VALUES (?, ?, ?, ?, ?)').run(
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

  await fakeRouter.signupHandler(req, res);

  const bonus = await db.prepare('SELECT COUNT(*) AS c FROM referral_bonuses WHERE referrer_id = ? AND referred_id = (SELECT id FROM users WHERE email = ?)').get(referrer.lastInsertRowid, req.body.email.toLowerCase());
  assert.equal(statusCode, 201);
  assert.equal(bonus.c, 0);

  await db.prepare('DELETE FROM users WHERE email = ?').run(req.body.email.toLowerCase());
  await db.prepare('DELETE FROM users WHERE id = ?').run(referrer.lastInsertRowid);
});
