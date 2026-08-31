const { createClient } = require('@libsql/client');
const { hashPassword } = require('../lib/password');

// ---------- Turso connection ----------
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN must be set as environment variables
// (e.g. in Render's Environment tab). Never hardcode these in source.
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('==========================================================');
  console.error('ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.');
  console.error('Set them as environment variables (see backend/.env.example).');
  console.error('==========================================================');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function rowToObject(columns, row) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

// Thin wrapper so route files can keep using the familiar
// db.prepare(sql).get(...args) / .all(...args) / .run(...args) shape,
// just with `await` in front now since Turso is a remote, async database.
function prepare(sql) {
  return {
    async get(...args) {
      const rs = await client.execute({ sql, args });
      if (rs.rows.length === 0) return undefined;
      return rowToObject(rs.columns, rs.rows[0]);
    },
    async all(...args) {
      const rs = await client.execute({ sql, args });
      return rs.rows.map((row) => rowToObject(rs.columns, row));
    },
    async run(...args) {
      const rs = await client.execute({ sql, args });
      return {
        lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : undefined,
        changes: rs.rowsAffected,
      };
    },
  };
}

const db = { prepare, client };

function genDemoAddress() {
  const chars = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

// ---------- Schema ----------
const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by INTEGER,
    demo_deposit_address TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (referred_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    asset TEXT NOT NULL DEFAULT 'BTC',
    entry_price REAL NOT NULL,
    tx_id TEXT,
    tx_status TEXT NOT NULL DEFAULT 'unverified',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS referral_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    bonus_points REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    bonus_name TEXT NOT NULL,
    created_by_admin_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS bonus_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    usdt_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS plan_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id TEXT NOT NULL,
    price_usdt REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('user', 'admin')),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
];

async function initSchema() {
  for (const stmt of schemaStatements) {
    await client.execute(stmt);
  }
}

// ---------- Admin account ----------
// Credentials come from environment variables, never hardcoded/logged.
// Set ADMIN_EMAIL and ADMIN_PASSWORD in Render's dashboard (Environment tab).
async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin seed. Set them in your environment.');
    return;
  }

  const existingAdmin = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = hashPassword(adminPassword);
    await db.prepare(`
      INSERT INTO users (name, email, password_hash, referral_code, demo_deposit_address, is_admin)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('Admin', adminEmail, hash, 'ADMIN0001', genDemoAddress());
    console.log('Admin account seeded.'); // no email/password printed
  }
}

// server.js awaits this before it starts accepting requests.
const ready = (async () => {
  await initSchema();
  await seedAdmin();
})();

module.exports = { db, genDemoAddress, ready };
