const http = require('http');

const { Router } = require('./lib/router');

const dbInit = require('./db/init'); // exposes a `ready` promise (schema + admin seed)

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

dbInit.ready
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
      console.log('Deposit crypto and earn fund online.');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
