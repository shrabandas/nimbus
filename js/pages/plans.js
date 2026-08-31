async function renderPlans(container, navigate) {
  container.innerHTML = Layout('plans', `
    <div class="page-header">
      <h1 class="page-title">Plans</h1>
      <p class="page-sub">Buy a tier from your wallet balance. Tiers unlock access and support level — not a promised return.</p>
    </div>
    <div id="plans-content">
      <div class="loading-spin"></div>
    </div>
  `);
  wireLayoutEvents(container, navigate);

  const content = container.querySelector('#plans-content');

  try {
    const [{ plans }, overview] = await Promise.all([Api.plans(), Api.walletOverview()]);
    let availableBalance = overview.available_balance;

    content.innerHTML = `
      <div class="stat-card" style="margin-bottom:20px; max-width:280px;">
        <div class="stat-label">Available wallet balance</div>
        <div class="stat-value" id="available-balance-display">$${formatUSD(availableBalance)}</div>
      </div>

      ${availableBalance <= 0 ? `
        <div class="notice-box">
          Your wallet balance is $0. <a href="#/deposit" style="color:var(--mint); font-weight:600;">Deposit USDT</a>
          and wait for approval before buying a plan.
        </div>
      ` : ''}

      <div id="plan-purchase-result"></div>
      <div class="grid-3" id="plan-cards"></div>
      <div class="section-title">Your plan purchases</div>
      <div id="plan-history"><div class="loading-spin"></div></div>
    `;

    function renderPlanCards() {
      const cardsRoot = content.querySelector('#plan-cards');
      cardsRoot.innerHTML = plans.map((p, i) => {
        const affordable = availableBalance >= p.price_usdt;
        return `
        <div class="plan-card">
          <div class="plan-name">${p.name}</div>
          <div class="plan-price">$${p.price_usdt} <span>USDT</span></div>
          <ul class="plan-features">
            ${p.features.map((f) => `<li>${f}</li>`).join('')}
          </ul>
          <button class="btn ${affordable ? 'btn-primary' : 'btn-secondary'}" data-plan-id="${p.id}" ${affordable ? '' : 'disabled'} title="${affordable ? '' : 'Not enough balance — deposit first'}">
            ${affordable ? `Buy ${p.name}` : 'Insufficient balance'}
          </button>
        </div>
      `;
      }).join('');

      cardsRoot.querySelectorAll('[data-plan-id]').forEach((btn) => {
        if (btn.disabled) return;
        btn.addEventListener('click', async () => {
          const resultBox = content.querySelector('#plan-purchase-result');
          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = 'Processing…';
          try {
            const res = await Api.buyPlan(btn.getAttribute('data-plan-id'));
            resultBox.innerHTML = Alert('success', res.message);
            resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            availableBalance = res.available_balance;
            content.querySelector('#available-balance-display').textContent = `$${formatUSD(availableBalance)}`;
            renderPlanCards();
            loadPlanHistory();
          } catch (err) {
            resultBox.innerHTML = Alert('error', err.message);
            btn.disabled = false;
            btn.textContent = original;
          }
        });
      });
    }

    renderPlanCards();

    async function loadPlanHistory() {
      const historyRoot = content.querySelector('#plan-history');
      try {
        const { purchases } = await Api.myPlans();
        if (purchases.length === 0) {
          historyRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No plans purchased yet.</p></div>`;
          return;
        }
        historyRoot.innerHTML = `
          <div class="card" style="padding:0;">
            <table>
              <thead><tr><th>Plan</th><th>Price</th><th>Date</th></tr></thead>
              <tbody>
                ${purchases.map((p) => `
                  <tr>
                    <td style="text-transform:capitalize;">${p.plan_id}</td>
                    <td class="mono">$${formatUSD(p.price_usdt)}</td>
                    <td>${formatDate(p.created_at)}</td>
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

    loadPlanHistory();
  } catch (err) {
    content.innerHTML = Alert('error', err.message);
  }
}
