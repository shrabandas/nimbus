const { db } = require('./db/init');

const tables = [
  'user_earnings',
  'bonus_redemptions',
  'referral_bonuses',
  'plan_purchases',
  'withdrawals',
  'deposits',
  'users',
];

for (const table of tables) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (error) {
    console.log(`skip ${table}: ${error.message}`);
  }
}

try {
  db.prepare(`
    DELETE FROM sqlite_sequence
    WHERE name IN ('users', 'deposits', 'withdrawals', 'bonus_redemptions', 'referral_bonuses', 'user_earnings', 'plan_purchases')
  `).run();
} catch (error) {
  console.log(`sqlite_sequence skip: ${error.message}`);
}

const adminCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get().c;
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
const earningCount = db.prepare('SELECT COUNT(*) AS c FROM user_earnings').get().c;
const depositCount = db.prepare('SELECT COUNT(*) AS c FROM deposits').get().c;
const withdrawalCount = db.prepare('SELECT COUNT(*) AS c FROM withdrawals').get().c;

console.log(JSON.stringify({
  adminCount,
  userCount,
  earningCount,
  depositCount,
  withdrawalCount,
  message: 'database reset complete, no admin account remains'
}, null, 2));
