const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'demo-secret-change-me-in-production';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function hmac(data) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(payload, expiresInSec = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const headerEnc = base64url(JSON.stringify(header));
  const bodyEnc = base64url(JSON.stringify(body));
  const signature = hmac(`${headerEnc}.${bodyEnc}`);
  return `${headerEnc}.${bodyEnc}.${signature}`;
}

function verify(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerEnc, bodyEnc, signature] = parts;
  const expected = hmac(`${headerEnc}.${bodyEnc}`);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(base64urlDecode(bodyEnc));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}

module.exports = { sign, verify };
