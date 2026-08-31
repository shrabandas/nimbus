async function renderAdmin(container, navigate) {
  if (!State.isAdmin()) {
    container.innerHTML = Layout('admin', `
      <div class="page-header"><h1 class="page-title">Admin panel</h1></div>
      ${Alert('error', 'You do not have access to this page.')}
    `);
    wireLayoutEvents(container, navigate);
    return;
  }

  container.innerHTML = Layout('admin', `
    <div class="page-header">
      <h1 class="page-title">Admin panel</h1>
      <p class="page-sub">Review deposit and withdrawal requests and see platform-wide activity.</p>
    </div>
    <div id="admin-content">
      <div class="loading-spin"></div>
    </div>
  `);
  wireLayoutEvents(container, navigate);

  const content = container.querySelector('#admin-content');

  try {
    const [stats, depositsData, withdrawalsData, usersData, earningsData, planPurchasesData] = await Promise.all([
      Api.adminStats(),
      Api.adminAllDeposits(),
      Api.adminAllWithdrawals(),
      Api.adminUsers(),
      Api.adminAllEarnings(),
      Api.adminPlanPurchases(),
    ]);

    function formatPlanLabel(planId) {
      if (!planId) return 'No plan';
      return planId.charAt(0).toUpperCase() + planId.slice(1);
    }

    content.innerHTML = `
      <div class="grid-3 admin-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total users</div>
          <div class="stat-value">${stats.totalUsers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Approved deposits</div>
          <div class="stat-value">$${formatUSD(stats.totalDeposited)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending deposits</div>
          <div class="stat-value" style="color:var(--amber);">${stats.pendingDeposits}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending withdrawals</div>
          <div class="stat-value" style="color:var(--amber);">${stats.pendingWithdrawals}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Approved withdrawals</div>
          <div class="stat-value" style="color:var(--mint);">$${formatUSD(stats.approvedWithdrawals)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Admin balance</div>
          <div class="stat-value" style="color:${(stats.adminBalance ?? (Number(stats.totalDeposited || 0) - Number(stats.approvedWithdrawals || 0) - Number(stats.totalUserEarnings || 0))) < 0 ? 'var(--danger)' : 'var(--mint)'};">$${formatUSD(stats.adminBalance ?? (Number(stats.totalDeposited || 0) - Number(stats.approvedWithdrawals || 0) - Number(stats.totalUserEarnings || 0)))}</div>
        </div>
      </div>

      <div class="section-title">Add user earnings</div>
      <div class="card" style="padding:20px; margin-bottom:18px;">
        <form id="earnings-form" class="earnings-form">
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">User</label>
            <select id="earning-user" required style="width:100%;">
              ${usersData.users.filter((u) => !u.is_admin).map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)}) - ${escapeHtml(formatPlanLabel(u.latest_plan_id))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">Amount</label>
            <input id="earning-amount" type="number" min="0" step="0.01" placeholder="250" required style="width:100%;" />
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">Bonus name</label>
            <input id="earning-name" type="text" placeholder="Referral bonus" required style="width:100%;" />
          </div>
          <button class="btn btn-approve" type="submit">Add earning</button>
        </form>
      </div>

      <div class="section-title">Deduct mistaken user earning</div>
      <div class="card" style="padding:20px;">
        <form id="deduct-earnings-form" class="earnings-form">
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">User</label>
            <select id="deduct-user" required style="width:100%;">
              ${usersData.users.filter((u) => !u.is_admin).map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)}) - ${escapeHtml(formatPlanLabel(u.latest_plan_id))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">Amount</label>
            <input id="deduct-amount" type="number" min="0" step="0.01" placeholder="75" required style="width:100%;" />
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; color:var(--text-dim); font-size:12px;">Reason</label>
            <input id="deduct-reason" type="text" placeholder="Wrong bonus entry" required style="width:100%;" />
          </div>
          <button class="btn btn-danger" type="submit">Deduct from user</button>
        </form>
      </div>

      <div class="section-title">Deposit requests</div>
      <div id="deposits-table"></div>

      <div class="section-title">Withdrawal requests</div>
      <div id="withdrawals-table"></div>

      <div class="section-title">User earnings</div>
      <div id="earnings-table"></div>

      <div class="section-title">Users and purchased plans</div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Plan</th><th>Plan price</th><th>Purchased</th></tr></thead>
          <tbody>
            ${usersData.users.filter((u) => !u.is_admin).map((u) => `
              <tr>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(formatPlanLabel(u.latest_plan_id))}</td>
                <td>${u.latest_plan_price ? `$${formatUSD(u.latest_plan_price)}` : '—'}</td>
                <td>${u.latest_plan_purchased_at ? formatDate(u.latest_plan_purchased_at) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section-title">All user plan purchases</div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>User</th><th>Plan</th><th>Price</th><th>Date & time</th></tr></thead>
          <tbody>
            ${planPurchasesData.purchases.map((p) => `
              <tr>
                <td>${escapeHtml(p.user_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(p.user_email)}</span></td>
                <td>${escapeHtml(formatPlanLabel(p.plan_id))}</td>
                <td class="mono">$${formatUSD(p.price_usdt)}</td>
                <td>${formatDate(p.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section-title">Referral bonus notifications</div>
      <div id="referral-bonuses-table"></div>

      <div class="section-title">All users</div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Referral code</th><th>Referred by</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>
            ${usersData.users.map((u) => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span>${escapeHtml(u.name)}</span>
                    ${u.latest_plan_id ? `<span class="badge badge-approved" style="font-size:10px; padding:4px 7px;">${escapeHtml(formatPlanLabel(u.latest_plan_id))}</span>` : '<span style="color:var(--text-dim); font-size:12px;">No plan</span>'}
                  </div>
                </td>
                <td>${escapeHtml(u.email)}</td>
                <td class="mono">${escapeHtml(u.referral_code || '—')}</td>
                <td>${u.referrer_name ? `${escapeHtml(u.referrer_name)} (${escapeHtml(u.referrer_code || '—')})` : '<span style="color:var(--text-dim);">—</span>'}</td>
                <td>${u.is_admin ? '<span class="badge badge-approved">Admin</span>' : 'User'}</td>
                <td>${formatDate(u.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // ---------- Earnings table ----------
    function renderEarningsTable(earnings) {
      const tableRoot = content.querySelector('#earnings-table');
      if (earnings.length === 0) {
        tableRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No earnings credited yet.</p></div>`;
        return;
      }
      tableRoot.innerHTML = `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>User</th><th>Bonus</th><th>Amount</th><th>Added by</th><th>Date</th></tr></thead>
            <tbody>
              ${earnings.map((e) => {
                const amount = Number(e.amount || 0);
                const isNegative = amount < 0;
                const formatted = `${isNegative ? '-' : '+'}$${formatUSD(Math.abs(amount))}`;
                return `
                  <tr>
                    <td>${escapeHtml(e.user_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(e.user_email)}</span></td>
                    <td><strong>${escapeHtml(e.bonus_name)}</strong></td>
                    <td class="mono" style="color:${isNegative ? 'var(--red)' : 'var(--mint)'};">${formatted}</td>
                    <td>${escapeHtml(e.admin_name || 'Admin')}</td>
                    <td>${formatDate(e.created_at)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderReferralBonusesTable(referralBonuses) {
      const tableRoot = content.querySelector('#referral-bonuses-table');
      if (referralBonuses.length === 0) {
        tableRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No referral bonuses have been added yet.</p></div>`;
        return;
      }
      tableRoot.innerHTML = `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>Referrer</th><th>For user</th><th>Bonus</th><th>Reason</th><th>Date</th></tr></thead>
            <tbody>
              ${referralBonuses.map((bonus) => `
                <tr>
                  <td>${escapeHtml(bonus.referrer_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(bonus.referrer_email)}</span></td>
                  <td>${escapeHtml(bonus.referred_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(bonus.referred_email)}</span></td>
                  <td class="mono" style="color:var(--mint);">+$${formatUSD(bonus.bonus_points)}</td>
                  <td>${escapeHtml(bonus.reason)}</td>
                  <td>${formatDate(bonus.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const earningsForm = content.querySelector('#earnings-form');
    if (earningsForm) {
      earningsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = content.querySelector('#earning-user').value;
        const amount = content.querySelector('#earning-amount').value;
        const bonusName = content.querySelector('#earning-name').value;

        try {
          await Api.adminAddEarning({ user_id: Number(userId), amount: Number(amount), bonus_name: bonusName });
          earningsForm.reset();
          const [updatedUsers, updatedEarnings] = await Promise.all([
            Api.adminUsers(),
            Api.adminAllEarnings(),
          ]);
          renderEarningsTable(updatedEarnings.earnings);
          const userSelect = content.querySelector('#earning-user');
          if (userSelect) {
            userSelect.innerHTML = updatedUsers.users.filter((u) => !u.is_admin).map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)}) - ${escapeHtml(formatPlanLabel(u.latest_plan_id))}</option>`).join('');
          }
        } catch (err) {
          alert(err.message);
        }
      });
    }

    const deductForm = content.querySelector('#deduct-earnings-form');
    if (deductForm) {
      deductForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = content.querySelector('#deduct-user').value;
        const amount = content.querySelector('#deduct-amount').value;
        const reason = content.querySelector('#deduct-reason').value;

        try {
          await Api.adminDeductEarning({ user_id: Number(userId), amount: Number(amount), reason });
          deductForm.reset();
          const [updatedUsers, updatedEarnings] = await Promise.all([
            Api.adminUsers(),
            Api.adminAllEarnings(),
          ]);
          renderEarningsTable(updatedEarnings.earnings);
          const userSelect = content.querySelector('#deduct-user');
          if (userSelect) {
            userSelect.innerHTML = updatedUsers.users.filter((u) => !u.is_admin).map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)}) - ${escapeHtml(formatPlanLabel(u.latest_plan_id))}</option>`).join('');
          }
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // ---------- Deposits table ----------
    function renderDepositsTable(deposits) {
      const tableRoot = content.querySelector('#deposits-table');
      if (deposits.length === 0) {
        tableRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No deposit requests yet.</p></div>`;
        return;
      }
      tableRoot.innerHTML = `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>User</th><th>Amount</th><th>Asset</th><th>Tx ID</th><th>Format check</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
            <tbody>
              ${deposits.map((d) => `
                <tr>
                  <td>${escapeHtml(d.user_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(d.user_email)}</span></td>
                  <td class="mono">$${formatUSD(d.amount)}</td>
                  <td><strong>${d.asset}</strong></td>
                  <td class="mono admin-full-value" style="font-size:12px;" title="${d.tx_id || ''}">${d.tx_id ? truncateAddr(d.tx_id, 8, true) : '—'}</td>
                  <td>${d.tx_status === 'format_valid'
                    ? '<span class="badge badge-approved">Valid format</span>'
                    : '<span class="badge badge-rejected">Invalid format</span>'}</td>
                  <td>${Badge(d.status)}</td>
                  <td>${formatDate(d.created_at)}</td>
                  <td>
                    ${d.status === 'pending' ? `
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-approve" data-decide-dep="${d.id}" data-decision="approved" style="padding:6px 12px; font-size:12.5px;">Approve</button>
                        <button class="btn btn-danger" data-decide-dep="${d.id}" data-decision="rejected" style="padding:6px 12px; font-size:12.5px;">Decline</button>
                      </div>
                    ` : `<span style="color:var(--text-dim); font-size:12px;">—</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      tableRoot.querySelectorAll('[data-decide-dep]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-decide-dep');
          const decision = btn.getAttribute('data-decision');
          btn.disabled = true;
          try {
            await Api.adminDecideDeposit(id, decision);
            const [refreshedDeposits, refreshedStats] = await Promise.all([
              Api.adminAllDeposits(),
              Api.adminStats(),
            ]);
            renderDepositsTable(refreshedDeposits.deposits);
            updateStatCards(refreshedStats);
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
    }

    // ---------- Withdrawals table ----------
    function renderWithdrawalsTable(withdrawals) {
      const tableRoot = content.querySelector('#withdrawals-table');
      if (withdrawals.length === 0) {
        tableRoot.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No withdrawal requests yet.</p></div>`;
        return;
      }
      tableRoot.innerHTML = `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>User</th><th>Amount</th><th>Address</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead>
            <tbody>
              ${withdrawals.map((w) => `
                <tr>
                  <td>${escapeHtml(w.user_name)}<br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(w.user_email)}</span></td>
                  <td class="mono">$${formatUSD(w.amount)}</td>
                  <td class="mono admin-full-value">${truncateAddr(w.address, 24, true)}</td>
                  <td>${Badge(w.status)}</td>
                  <td>${formatDate(w.created_at)}</td>
                  <td>
                    ${w.status === 'pending' ? `
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-approve" data-decide="${w.id}" data-decision="approved" style="padding:6px 12px; font-size:12.5px;">Approve</button>
                        <button class="btn btn-danger" data-decide="${w.id}" data-decision="rejected" style="padding:6px 12px; font-size:12.5px;">Reject</button>
                      </div>
                    ` : `<span style="color:var(--text-dim); font-size:12px;">—</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      tableRoot.querySelectorAll('[data-decide]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-decide');
          const decision = btn.getAttribute('data-decision');
          btn.disabled = true;
          try {
            await Api.adminDecideWithdrawal(id, decision);
            const [refreshedWithdrawals, refreshedStats] = await Promise.all([
              Api.adminAllWithdrawals(),
              Api.adminStats(),
            ]);
            renderWithdrawalsTable(refreshedWithdrawals.withdrawals);
            updateStatCards(refreshedStats);
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
    }

    function updateStatCards(stats) {
      const cards = content.querySelectorAll('.stat-card .stat-value');
      cards[0].textContent = stats.totalUsers;
      cards[1].textContent = `$${formatUSD(stats.totalDeposited)}`;
      cards[2].textContent = stats.pendingDeposits;
      cards[3].textContent = stats.pendingWithdrawals;
      cards[4].textContent = `$${formatUSD(stats.approvedWithdrawals)}`;
      cards[5].textContent = `$${formatUSD(stats.adminBalance ?? (Number(stats.totalDeposited || 0) - Number(stats.approvedWithdrawals || 0)))}`;
    }

    renderEarningsTable(earningsData.earnings);
    renderReferralBonusesTable(earningsData.referralBonuses || []);
    renderDepositsTable(depositsData.deposits);
    renderWithdrawalsTable(withdrawalsData.withdrawals);
  } catch (err) {
    content.innerHTML = Alert('error', err.message);
  }
}
