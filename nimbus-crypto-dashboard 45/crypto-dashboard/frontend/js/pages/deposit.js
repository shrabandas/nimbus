async function renderDeposit(container, navigate) {

  container.innerHTML = Layout('deposit', `

    <div class="page-header">

      <h1 class="page-title">Deposit</h1>

      <p class="page-sub">Submit a USDT (BEP20) deposit with your transaction ID for admin review.</p>
    </div>

    <div id="deposit-content">

      <div class="loading-spin"></div>

    </div>

  `);

  wireLayoutEvents(container, navigate);



  const content = container.querySelector('#deposit-content');



  try {

    const overview = await Api.walletOverview();



    content.innerHTML = `

      <div class="notice-box">

         Submitting the form below creates a

        <strong>pending</strong> deposit request for review.it does not credit your wallet balance immediately.

      </div>



      <div class="grid-2" style="align-items:start;">

        <div class="card">

          <div class="section-title" style="margin-top:0;">Send USDT bep20</div>

          <p style="font-size:13px; color:var(--text-muted); margin-top:-6px;"> usdt BEP20 deposit address:</p>

          <div class="address-box">

  <span class="addr mono">0x3B88353408f0d55C2c5678206a732b5B501C16e0</span>

  <button class="copy-btn" data-copy="0x3B88353408f0d55C2c5678206a732b5B501C16e0">${Icons.copy} Copy</button>

</div>

          <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${overview.network}</p>

        </div>



        <div class="card">

          <div class="section-title" style="margin-top:0;">Submit deposit for review</div>

          <div id="deposit-alert"></div>

          <form id="deposit-form">

            <div class="field">

              <label for="amount">Amount (USDT)</label>

              <input type="number" id="amount" min="1" step="0.01" required placeholder="100.00" />

            </div>

            <div class="field">

              <label for="asset">Asset</label>

              <select id="asset" required>

                <option value="USDT">USDT (BEP20)</option>

              </select>

            </div>

            <div class="field">

              <label for="tx_id">Transaction ID</label>

              <div class="tx-input-row">

                <input type="text" id="tx_id" required placeholder="0x..." class="mono" />

                <button type="button" class="btn btn-secondary" id="verify-tx-btn">Validate</button>

              </div>

              <div id="tx-verify-result" style="margin-top:8px;"></div>

              <p style="font-size:11.5px; color:var(--text-dim); margin:6px 0 0;">

                Paste the transaction ID from your BEP20 wallet. This check only confirms the format —

                the admin reviewing your request does the actual verification.

              </p>

            </div>

            <button class="btn btn-primary" type="submit" id="deposit-submit">Submit</button>

          </form>

        </div>

      </div>



      <div class="section-title">Your pending deposits</div>

      <div id="pending-deposits"></div>

    `;

    wireCopyButtons(content);

    renderPendingDeposits(content, overview.pending_deposits);



    const form = content.querySelector('#deposit-form');

    const alertBox = content.querySelector('#deposit-alert');

    const submitBtn = content.querySelector('#deposit-submit');

    const verifyBtn = content.querySelector('#verify-tx-btn');

    const verifyResult = content.querySelector('#tx-verify-result');

    const txInput = content.querySelector('#tx_id');



    verifyBtn.addEventListener('click', async () => {

      const txId = txInput.value.trim();

      if (!txId) {

        verifyResult.innerHTML = Alert('error', 'Paste a transaction ID first.');

        return;

      }

      verifyBtn.disabled = true;

      const original = verifyBtn.textContent;

      verifyBtn.textContent = 'Checking…';

      try {

        const result = await Api.verifyTx(txId);

        verifyResult.innerHTML = result.valid

          ? Alert('success', result.reason)

          : Alert('error', result.reason);

      } catch (err) {

        verifyResult.innerHTML = Alert('error', err.message);

      } finally {

        verifyBtn.disabled = false;

        verifyBtn.textContent = original;

      }

    });



    form.addEventListener('submit', async (e) => {

      e.preventDefault();

      alertBox.innerHTML = '';

      submitBtn.disabled = true;

      submitBtn.textContent = 'Submitting…';

      try {

        const amount = content.querySelector('#amount').value;

        const asset = content.querySelector('#asset').value;

        const tx_id = txInput.value.trim();



        const res = await Api.walletDeposit({ amount, asset, tx_id });



        alertBox.innerHTML = Alert('success', res.message);

        verifyResult.innerHTML = '';

        form.reset();



        const refreshed = await Api.walletOverview();

        renderPendingDeposits(content, refreshed.pending_deposits);

      } catch (err) {

        alertBox.innerHTML = Alert('error', err.message);

      } finally {

        submitBtn.disabled = false;

        submitBtn.textContent = 'Submit for admin approval';

      }

    });

  } catch (err) {

    content.innerHTML = Alert('error', err.message);

  }

}



function renderPendingDeposits(content, pendingDeposits) {
  const root = content.querySelector('#pending-deposits');
  if (!pendingDeposits || pendingDeposits.length === 0) {
    root.innerHTML = `<div class="card empty-state"><div class="icon">◇</div><p>No pending deposits.</p></div>`;
    return;
  }
  root.innerHTML = `
    <div class="card" style="padding:0;">
      <table>
        <thead><tr><th>Amount</th><th>Asset</th><th>Tx ID</th><th>Status</th><th>Submitted</th></tr></thead>
        <tbody>
          ${pendingDeposits.map((d) => `
            <tr>
              <td class="mono">$${formatUSD(d.amount)}</td>
              <td><strong>${d.asset}</strong></td>
              <td class="mono" style="font-size:12px;" title="${d.tx_id || ''}">${d.tx_id ? truncateAddr(d.tx_id, 6) : '—'}</td>
              <td>${Badge('pending')}</td>
              <td>${formatDate(d.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
