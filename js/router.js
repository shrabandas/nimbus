const PUBLIC_ROUTES = ['login', 'signup'];

function getCurrentRoute() {
  const hash = window.location.hash.slice(1); // remove '#'
  const path = hash.split('?')[0]; // '/dashboard'
  const route = path.replace(/^\//, '') || 'dashboard';
  return route;
}

function navigate(route) {
  window.location.hash = `/${route}`;
}

async function renderRoute() {
  const container = document.getElementById('app');
  const route = getCurrentRoute();

  const loggedIn = State.isLoggedIn();

  // Auth guard
  if (!loggedIn && !PUBLIC_ROUTES.includes(route)) {
    navigate('login');
    return;
  }
  if (loggedIn && PUBLIC_ROUTES.includes(route)) {
    navigate('dashboard');
    return;
  }

  switch (route) {
    case 'login':
      renderLogin(container, navigate);
      break;
    case 'signup':
      renderSignup(container, navigate);
      break;
    case 'dashboard':
      await renderDashboard(container, navigate);
      break;
    case 'plans':
      await renderPlans(container, navigate);
      break;
    case 'deposit':
      await renderDeposit(container, navigate);
      break;
    case 'withdraw':
      await renderWithdraw(container, navigate);
      break;
    case 'referral':
      await renderReferral(container, navigate);
      break;
    case 'admin':
      await renderAdmin(container, navigate);
      break;
    default:
      navigate('dashboard');
  }
}

window.addEventListener('hashchange', renderRoute);
