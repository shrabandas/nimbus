const http = require('http');

// node:sqlite requires Node 22.5+. Fail with a clear message instead of a cryptic crash.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error('==========================================================');
  console.error(`ERROR: This project requires Node.js 22.5.0 or newer.`);
  console.error(`You are running Node.js ${process.versions.node}.`);
  console.error('Install a newer version from https://nodejs.org and try again.');
  console.error('==========================================================');
  process.exit(1);
}

const { Router } = require('./lib/router');

require('./db/init'); // ensures db + admin seed exist

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const withdrawRoutes = require('./routes/withdraw');
const referralRoutes = require('./routes/referral');
const plansRoutes = require('./routes/plans');
const adminRoutes = require('./routes/admin');

const router = new Router();
authRoutes.register(router);
walletRoutes.register(router);
withdrawRoutes.register(router);
referralRoutes.register(router);
plansRoutes.register(router);
adminRoutes.register(router);

router.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(async (req, res) => {
  // CORS - open for local demo purposes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Frontend-Host');

  res.json = (obj, statusCode = 200) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    await new Promise((resolve) => req.on('end', resolve));
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
  } else {
    req.body = {};
  }

  try {
    await router.handle(req, res);
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) res.json({ error: 'Internal server error' }, 500);
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('DEMO PROJECT: all balances and deposits are simulated, no real funds involved.');
  console.log('Admin login -> email: admin@demo.local  password: Admin123!');
});
