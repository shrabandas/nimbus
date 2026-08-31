async function renderReferral(container, navigate) {
  container.innerHTML = Layout('referral', `
    <div class="page-header">
      <h1 class="page-title">Referrals</h1>
      <p class="page-sub">Invite others and earn 20% commission of their first plan purchase </p>
    </div>
    <div id="referral-content">
      <div class="loading-spin"></div>
    </div>
  `);
  wireLayoutEvents(container, navigate);

  const content = container.querySelector('#referral-content');

  try {
    const data = await Api.referralOverview();

    const formatPlanLabel = (planId) => {
      if (!planId) return 'No plan';
      return planId.charAt(0).toUpperCase() + planId.slice(1);
    };

    content.innerHTML = `
      <div class="grid-3">
        <div class="stat-card">
          <div class="stat-label">Your referral code</div>
          <div class="stat-value mono">${data.referral_code}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">People referred</div>
          <div class="stat-value">${data.total_referred}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overall earned commission</div>
          <div class="stat-value" style="color:var(--mint);">$${formatUSD(data.overall_earned_commission ?? data.available_bonus_points ?? 0)}</div>
        </div>
      </div>

      <div class="section-title">Your referral link</div>
      <div class="address-box">
        <span class="addr mono">${data.referral_link}</span>
        <button class="copy-btn" data-copy="${data.referral_link}">${Icons.copy} Copy</button>
      </div>

      <div class="section-title">People you've referred</div>
      ${data.referred_users.length === 0 ? `
        <div class="card empty-state"><div class="icon">◇</div><p>Nobody has signed up with your link yet.</p></div>
      ` : `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Referral code</th><th>Joined</th></tr></thead>
            <tbody>
              ${data.referred_users.map((u) => `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <span>${escapeHtml(u.name)}</span>
                      ${u.latest_plan_id ? `<span class="badge badge-approved" style="font-size:10px; padding:4px 7px;">${escapeHtml(formatPlanLabel(u.latest_plan_id))}</span>` : '<span style="color:var(--text-dim); font-size:12px;">No plan</span>'}
                    </div>
                  </td>
                  <td>${escapeHtml(u.email)}</td>
                  <td class="mono">${escapeHtml(u.referral_code || '—')}</td>
                  <td>${formatDate(u.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="section-title">Bonus history</div>
      ${data.bonus_history.length === 0 ? `
        <div class="card empty-state"><div class="icon">◇</div><p>No bonus points earned yet.</p></div>
      ` : `
        <div class="card" style="padding:0;">
          <table>
            <thead><tr><th>Referred user</th><th>Reason</th><th>Commission</th><th>Date</th></tr></thead>
            <tbody>
              ${data.bonus_history.map((b) => `
                <tr>
                  <td>${escapeHtml(b.referred_name)}</td>
                  <td>${escapeHtml(b.reason)}</td>
                  <td class="mono" style="color:var(--mint);">+$${formatUSD(b.bonus_points)}</td>
                  <td>${formatDate(b.created_at)}</td>
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
