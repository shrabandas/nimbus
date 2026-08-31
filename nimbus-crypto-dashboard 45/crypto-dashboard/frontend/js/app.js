(async function bootstrap() {
  const token = Api.loadToken();

  if (token) {
    try {
      const { user } = await Api.me();
      State.setUser(user);
    } catch (err) {
      // Token invalid/expired
      Api.setToken(null);
      State.setUser(null);
    }
  }

  if (!window.location.hash) {
    window.location.hash = State.isLoggedIn() ? '/dashboard' : '/login';
  }

  renderRoute();
})();
