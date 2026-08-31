async function renderDashboard(container, navigate) {
  container.innerHTML = Layout('dashboard', `
    <div class="page-header">
      <h1 class="page-title">Overview</h1>
      <p class="page-sub">Your wallet balance and total earnings</p>
    </div>
    <div id="dashboard-content">
      <div class="loading-spin"></div>
    </div>
  `);
  wireLayoutEvents(container, navigate);

  const content = container.querySelector('#dashboard-content');

  try {
    const data = await Api.walletOverview();
    const totalEarnings = Number(data.total_earnings || 0);
    const earningsClass = totalEarnings >= 0 ? 'pnl-positive' : 'pnl-negative';
    const earningsSign = totalEarnings >= 0 ? '+' : '-';

    content.innerHTML = `
      <div class="hero-card">
        <div class="hero-label"><span class="pulse-dot"></span> Wallet balance </div>
        <div class="hero-value">$${formatUSD(data.available_balance)}</div>
        <div class="hero-meta">
          <div class="hero-meta-item">
            <div class="label">Principal deposited</div>
            <div class="value">$${formatUSD(data.principal)}</div>
          </div>
          <div class="hero-meta-item">
            <div class="label">Total earnings</div>
            <div class="value ${earningsClass}">${earningsSign}$${formatUSD(Math.abs(totalEarnings))}</div>
          </div>
          <div class="hero-meta-item">
            <div class="label">Available to withdraw</div>
            <div class="value">$${formatUSD(data.available_balance)}</div>
          </div>
        </div>
      </div>

      <div class="notice-box">
         check the deposit address twice before sending any funds otherwise fund will be lost.
      </div>

      <div class="section-title"> deposit address</div>
      <div class="address-box">
  <span class="addr mono">0x3B88353408f0d55C2c5678206a732b5B501C16e0</span>
  <button class="copy-btn" data-copy="0x3B88353408f0d55C2c5678206a732b5B501C16e0">${Icons.copy} Copy</button>
</div>
      <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${data.network}</p>

      ${data.pending_deposits.length > 0 ? `
        <div class="section-title">Pending deposits <span style="color:var(--amber); font-weight:500;">(awaiting admin approval)</span></div>
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>Amount</th><th>Asset</th><th>Tx ID</th><th>Submitted</th></tr></thead>
            <tbody>
              ${data.pending_deposits.map((d) => `
                <tr>
                  <td class="mono">$${formatUSD(d.amount)}</td>
                  <td><strong>${d.asset}</strong></td>
                  <td class="mono" style="font-size:12px;" title="${d.tx_id || ''}">${d.tx_id ? truncateAddr(d.tx_id, 6) : '—'}</td>
                  <td>${formatDate(d.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <div class="section-title">Earnings <span style="color:var(--text-dim); font-weight:500;">(bonus credits)</span></div>
      ${(!data.earnings_history || data.earnings_history.length === 0) ? `
        <div class="card empty-state">
          <div class="icon">◇</div>
          <p>No bonus earnings received yet.</p>
        </div>
      ` : `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>Bonus</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              ${data.earnings_history.map((earning) => {
                const amount = Number(earning.amount || 0);
                const isNegative = amount < 0;
                const formatted = `${isNegative ? '-' : '+'}$${formatUSD(Math.abs(amount))}`;
                return `
                  <tr>
                    <td><strong>${escapeHtml(earning.bonus_name)}</strong></td>
                    <td class="mono" style="color:${isNegative ? 'var(--red)' : 'var(--mint)'};">${formatted}</td>
                    <td>${formatDate(earning.created_at)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="section-title">All transactions info <span style="color:var(--text-dim); font-weight:500;">(deposits + withdrawals)</span></div>
      ${(!data.all_transactions || data.all_transactions.length === 0) ? `
        <div class="card empty-state">
          <div class="icon">◇</div>
          <p>No transactions yet. Head to the Deposit page to submit a USDT (BEP20) deposit.</p>
        </div>
      ` : `
        <div class="card" style="padding:0;">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Asset</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Tx ID / Address</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${data.all_transactions.map((t) => `
                <tr>
                  <td><strong>${t.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}</strong></td>
                  <td><strong>${t.asset}</strong></td>
                  <td class="mono">$${formatUSD(t.amount)}</td>
                  <td>${t.status === 'approved' ? Badge('approved') : t.status === 'pending' ? Badge('pending') : Badge('rejected')}</td>
                  <td>${t.type === 'withdrawal'
                    ? `<span class="mono" style="font-size:12px;" title="${t.address || ''}">${truncateAddr(t.address || '—', 6)}</span>`
                    : t.tx_id
                      ? `<span class="mono" style="font-size:12px;" title="${t.tx_id}">${truncateAddr(t.tx_id, 6)}</span>`
                      : `<span style="color:var(--text-dim); font-size:12px;">—</span>`}</td>
                  <td>${formatDate(t.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
    wireCopyButtons(content);
  } catch (err) {
    content.innerHTML = Alert('error', err.message);
  }
}
