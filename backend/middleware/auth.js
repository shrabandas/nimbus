const jwt = require('../lib/jwt');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.json({ error: 'No token provided' }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token);
    req.user = payload; // { id, email, is_admin }
    next();
  } catch (err) {
    return res.json({ error: 'Invalid or expired token' }, 401);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.json({ error: 'Admin access required' }, 403);
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
