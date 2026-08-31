# Nimbus — Demo Crypto Portfolio Dashboard

A full-stack demo web app for a college project: signup/login, a simulated USDT (BEP20)
deposit flow with transaction-ID validation, a live-market-linked portfolio, withdrawal
requests with admin approval, plan tiers, and a referral program.

**This is a simulation.** No real cryptocurrency ever changes hands. There is no
guaranteed or fixed "return" anywhere in this app — portfolio value simply tracks live
BTC/ETH/BNB market prices against a demo entry price, the same way a real portfolio
tracker would.

## Why it's built this way

An earlier version of this brief asked for guaranteed weekly returns and referral
commissions paid out of other users' deposits. That combination is the actual mechanism
of a Ponzi/HYIP scheme, so this build intentionally does not include it. Everything here
demonstrates the same technical skills (auth, wallet balances, admin workflows,
referrals) on a structure that isn't fraudulent by design:

- Deposits: submitted with a transaction ID and held **pending** until an admin
  approves them — same review workflow as withdrawals. No instant credit, no fake yield;
  once approved, value moves only with real market prices.
- Referrals: pay **bonus points** for signups, not a percentage of anyone's money.
- Plans: are feature/access tiers (support priority, referral multiplier), not investment products.
- Withdrawals: go into a pending queue reviewed by an admin, same as the original brief.

## Stack

- **Backend:** Node.js only, **zero external npm dependencies**. Uses `node:sqlite`
  (built into Node 22.5+), `crypto` (password hashing + JWT), and the built-in `http`
  module. No Express, no bcrypt, no jsonwebtoken package — all implemented from scratch
  in `backend/lib/`.
- **Frontend:** Vanilla JS single-page app with hash-based routing, no build step, no
  framework. Talks to the backend purely over `fetch`.

This was a deliberate choice: it means you can run the whole project with nothing but
Node installed — no `npm install`, no bundler, nothing that can go out of date.

## Requirements

- Node.js **22.5.0 or newer** (for the built-in `node:sqlite` module).
  Check your version with `node -v`.

## Running it

Open two terminals.

**Terminal 1 — backend (port 4000):**
```bash
cd backend
node server.js
```

**Terminal 2 — frontend (port 5173):**
```bash
cd frontend
node serve.js
```

Then open **http://localhost:5173** in your browser.

## Demo accounts

An admin account is seeded automatically the first time the backend runs:

- **Admin:** `admin@demo.local` / `Admin123!`
- Regular accounts: just sign up from the app.

## Pages

1. **Login / Signup** — JWT-based auth, referral code field on signup.
2. **Overview** — live portfolio value (approved deposits only), P/L, demo deposit address, pending deposits awaiting review, and asset breakdown with attached transaction IDs.
3. **Plans** — Silver ($50) / Gold ($100) / Platinum ($200) feature tiers with a demo deposit address shown after selecting one.
4. **Deposit** — submit a USDT (BEP20) deposit with a required transaction ID (format-validated); it stays pending until an admin approves it.
5. **Withdraw** — request a withdrawal to any address; shows status (pending/approved/rejected).
6. **Referrals** — your referral code/link, who you've referred, and bonus points earned.
7. **Admin panel** (admin account only) — platform stats, approve/decline both deposit and withdrawal requests, view all users.

## Notes on the transaction ID field

The "Validate" button on the Deposit page checks that a pasted ID matches the *format*
of a BEP20 transaction hash (`0x` + 64 hex characters). It does **not** query BscScan or
any real blockchain — doing that in a demo project would make the flow indistinguishable
from a real deposit-verification system. If you want to extend this into a real product,
that's the one spot where you'd wire up a real block-explorer API call, server-side.

## Project structure

```
backend/
  server.js            entry point
  lib/
    router.js           tiny HTTP router with param + middleware support
    jwt.js               HMAC-SHA256 JWT sign/verify (no dependency)
    password.js          scrypt-based password hashing
  db/
    init.js              schema + seed data (node:sqlite)
  middleware/auth.js     requireAuth / requireAdmin
  routes/                auth, wallet, withdraw, referral, plans, admin
  utils/
    prices.js            live price fetch (CoinGecko) with offline fallback
    txValidator.js       transaction ID format check

frontend/
  index.html
  serve.js               zero-dependency static file server
  css/styles.css
  js/
    api.js               fetch wrapper for the backend
    state.js             tiny global state
    components.js        layout, icons, formatting helpers
    router.js             hash-based router + auth guards
    app.js                bootstrap
    pages/                one file per page
```
