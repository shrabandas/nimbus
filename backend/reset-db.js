const dbInit = require('./db/init');
const { db } = dbInit;

const tables = [
  'user_earnings',
  'bonus_redemptions',
  'referral_bonuses',
  'plan_purchases',
  'withdrawals',
  'deposits',
  'users',
];

async function main() {
  await dbInit.ready;

  for (const table of tables) {
    try {
      await db.prepare(`DELETE FROM ${table}`).run();
    } catch (error) {
      console.log(`skip ${table}: ${error.message}`);
    }
  }

  try {
    await db.prepare(`
      DELETE FROM sqlite_sequence
      WHERE name IN ('users', 'deposits', 'withdrawals', 'bonus_redemptions', 'referral_bonuses', 'user_earnings', 'plan_purchases')
    `).run();
  } catch (error) {
    console.log(`sqlite_sequence skip: ${error.message}`);
  }

  const adminCount = (await db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get()).c;
  const userCount = (await db.prepare('SELECT COUNT(*) AS c FROM users').get()).c;
  const earningCount = (await db.prepare('SELECT COUNT(*) AS c FROM user_earnings').get()).c;
  const depositCount = (await db.prepare('SELECT COUNT(*) AS c FROM deposits').get()).c;
  const withdrawalCount = (await db.prepare('SELECT COUNT(*) AS c FROM withdrawals').get()).c;

  console.log(JSON.stringify({
    adminCount,
    userCount,
    earningCount,
    depositCount,
    withdrawalCount,
    message: 'database reset complete, no admin account remains'
  }, null, 2));
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
