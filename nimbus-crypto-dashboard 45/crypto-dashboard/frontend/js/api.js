const API_BASE = 'http://localhost:4000/api';

const Api = {
  token: null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('nimbus_token', token);
    else localStorage.removeItem('nimbus_token');
  },

  loadToken() {
    this.token = localStorage.getItem('nimbus_token');
    return this.token;
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    let resp;
    try {
      resp = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error('Could not reach the server. Is the backend running on port 4000?');
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      data = {};
    }

    if (!resp.ok) {
      throw new Error(data.error || `Request failed (${resp.status})`);
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },

  // ---- Auth ----
  signup(payload) { return this.post('/auth/signup', payload); },
  login(payload) { return this.post('/auth/login', payload); },
  me() { return this.get('/auth/me'); },

  // ---- Wallet ----
  walletOverview() { return this.get('/wallet/overview'); },
  walletDeposit(payload) { return this.post('/wallet/deposit', payload); },
  verifyTx(tx_id) { return this.post('/wallet/verify-tx', { tx_id }); },
  adminAllDeposits() { return this.get('/wallet/admin/deposits'); },
  adminDecideDeposit(id, decision) { return this.post(`/wallet/admin/deposits/${id}/decide`, { decision }); },

  // ---- Withdraw ----
  requestWithdraw(payload) { return this.post('/withdraw', payload); },
  myWithdrawals() { return this.get('/withdraw/mine'); },
  adminAllWithdrawals() { return this.get('/withdraw/admin/all'); },
  adminDecideWithdrawal(id, decision) { return this.post(`/withdraw/admin/${id}/decide`, { decision }); },

  // ---- Referral ----
  referralOverview() { return this.get('/referral/overview'); },

  // ---- Plans ----
  plans() { return this.get('/plans'); },
  buyPlan(plan_id) { return this.post('/plans/buy', { plan_id }); },
  myPlans() { return this.get('/plans/mine'); },

  // ---- Admin ----
  adminUsers() { return this.get('/admin/users'); },
  adminPlanPurchases() { return this.get('/admin/plan-purchases'); },
  adminAllEarnings() { return this.get('/admin/earnings'); },
  adminAddEarning(payload) { return this.post('/admin/earnings', payload); },
  adminDeductEarning(payload) { return this.post('/admin/earnings/deduct', payload); },
  adminStats() { return this.get('/admin/stats'); },
};
