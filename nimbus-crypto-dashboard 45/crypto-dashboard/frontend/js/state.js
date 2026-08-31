const State = {
  user: null,
  listeners: [],

  setUser(user) {
    this.user = user;
    this.listeners.forEach((fn) => fn(user));
  },

  onUserChange(fn) {
    this.listeners.push(fn);
  },

  isLoggedIn() {
    return !!this.user;
  },

  isAdmin() {
    return !!(this.user && this.user.is_admin);
  },
};
