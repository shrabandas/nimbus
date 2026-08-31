async function renderWithdraw(container, navigate) {
  container.innerHTML = Layout('withdraw', `
    <div class="page-header">
      <h1 class="page-title">Withdraw</h1>
      <p class="page-sub">Request a withdrawal. Every request is reviewed by an admin before it's approved.</p>
    </div>
    <div id="withdraw-content">
      <div class="loading-spin"></div>
    </div>
  `);
  wireLayoutEvents(container, navigate);

  const content = container.querySelector('#withdraw-content');

  try {
    const overview = await Api.walletOverview();

    content.innerHTML = `
      <div class="grid-3">
        <div class="stat-card">
          <div class="stat-label">Available balance</div>
          <div class="stat-value">$${formatUSD(overview.available_balance)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Reserved (pending/approved withdrawals)</div>
          <div class="stat-value">$${formatUSD(overview.reserved_for_withdrawals)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Spent on plans</div>
          <div class="stat-value">$${formatUSD(overview.spent_on_plans)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="section-title" style="margin-top:0;">Request a withdrawal</div>
        <div id="withdraw-alert"></div>
        <form id="withdraw-form">
          <div class="field">
            <label for="w-amount">Amount (USDT)</label>
            <input type="number" id="w-amount" min="1" step="0.01" required placeholder="e.g. 50.00" />
          </div>
          <div class="field">
            <label for="w-address">Destination address USDT (BEP20)</label>
            <input type="text" id="w-address" required placeholder="0x..." class="mono" />
          </div>
          <button class="btn btn-primary" type="submit" id="withdraw-submit">Submit request</button>
        </form>
      </div>

      <div class="section-title">Your withdrawal requests</div>
      <div id="withdraw-history"><div class="loading-spin"></div></div>
    `;

    const form = content.querySelector('#withdraw-form');
    const alertBox = content.querySelector('#withdraw-alert');
    const submitBtn = content.querySelector('#withdraw-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.innerHTML = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      try {
        const amount = content.querySelector('#w-amount').value;
        const address = content.querySelector('#w-address').value;
        await Api.requestWithdraw({ amount, address });
        alertBox.innerHTML = Alert('success', 'Withdrawal request submitted. An admin will review it shortly.');
        form.reset();
        loadHistory();
      } catch (err) {
        alertBox.innerHTML = Alert('error', err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit request';
      }
    });

    async function loadHistory() {
      const historyRoot = content.querySelector('#withdraw-history');
      try {
        const { withdrawals } = await Api.myWithdrawals();
        if (withdrawals.length === 0) {
          historyRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No withdrawal requests yet.</p></div>`;
          return;
        }
        historyRoot.innerHTML = `
          <div class="card" style="padding:0;">
            <table>
              <thead><tr><th>Amount</th><th>Address</th><th>Status</th><th>Requested</th></tr></thead>
              <tbody>
                ${withdrawals.map((w) => `
                  <tr>
                    <td class="mono">$${formatUSD(w.amount)}</td>
                    <td class="mono">${truncateAddr(w.address)}</td>
                    <td>${Badge(w.status)}</td>
                    <td>${formatDate(w.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (err) {
        historyRoot.innerHTML = Alert('error', err.message);
      }
    }

    loadHistory();
  } catch (err) {
    content.innerHTML = Alert('error', err.message);
  }
}
