function getQueryParam(name) {
  const hash = window.location.hash; // e.g. #/signup?ref=ABC123
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get(name);
}

function renderLogin(container, navigate) {
  container.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark">N</div>
          <div class="brand-name" style="font-family: var(--font-display); font-size:18px; font-weight:600;">Nimbus</div>
        </div>
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-sub">Log in to your account dashboard.</p>
        <div id="login-alert"></div>
        <form id="login-form">
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" required placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input type="password" id="password" required placeholder="••••••••" autocomplete="current-password" />
          </div>
          <button class="btn btn-primary" type="submit" id="login-submit">Log in</button>
        </form>
        <p class="auth-switch">Don't have an account? <a href="#/signup">Sign up</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const alertBox = container.querySelector('#login-alert');
  const submitBtn = container.querySelector('#login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';
    try {
      const email = container.querySelector('#email').value.trim();
      const password = container.querySelector('#password').value;
      const { token, user } = await Api.login({ email, password });
      Api.setToken(token);
      State.setUser(user);
      navigate('dashboard');
    } catch (err) {
      alertBox.innerHTML = Alert('error', err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
}

function renderSignup(container, navigate) {
  const refFromUrl = getQueryParam('ref') || '';

  container.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark">N</div>
          <div class="brand-name" style="font-family: var(--font-display); font-size:18px; font-weight:600;">Nimbus</div>
        </div>
        <h1 class="auth-title">Create your account</h1>
        <p class="auth-sub">Start earning online with crypto.</p>
        <div id="signup-alert"></div>
        <form id="signup-form">
          <div class="field">
            <label for="name">Full name</label>
            <input type="text" id="name" required placeholder="Jordan Lee" autocomplete="name" />
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" required placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input type="password" id="password" required minlength="6" placeholder="At least 6 characters" autocomplete="new-password" />
          </div>
          <div class="field">
            <label for="referral_code">Referral code <span style="font-weight:400; color:var(--text-dim);">(optional)</span></label>
            <input type="text" id="referral_code" placeholder="e.g. A1B2C3D4" value="${escapeHtml(refFromUrl)}" style="text-transform:uppercase;" />
          </div>
          <button class="btn btn-primary" type="submit" id="signup-submit">Create account</button>
        </form>
        <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#signup-form');
  const alertBox = container.querySelector('#signup-alert');
  const submitBtn = container.querySelector('#signup-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';
    try {
      const name = container.querySelector('#name').value.trim();
      const email = container.querySelector('#email').value.trim();
      const password = container.querySelector('#password').value;
      const referral_code = container.querySelector('#referral_code').value.trim();
      const payload = { name, email, password };
      if (referral_code) payload.referral_code = referral_code;

      const { token, user } = await Api.signup(payload);
      Api.setToken(token);
      State.setUser(user);
      navigate('dashboard');
    } catch (err) {
      alertBox.innerHTML = Alert('error', err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}
