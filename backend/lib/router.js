class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, ...handlers) {
    const paramNames = [];
    const pattern = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    this.routes.push({ method, regex, paramNames, handlers });
  }

  get(path, ...h) { this.add('GET', path, ...h); }
  post(path, ...h) { this.add('POST', path, ...h); }
  put(path, ...h) { this.add('PUT', path, ...h); }
  delete(path, ...h) { this.add('DELETE', path, ...h); }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.regex);
      if (!match) continue;

      const params = {};
      route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      req.params = params;
      req.query = Object.fromEntries(url.searchParams);

      for (const handler of route.handlers) {
        let nextCalled = false;
        const next = () => { nextCalled = true; };
        await handler(req, res, next);
        if (res.writableEnded) return;
        if (!nextCalled) return;
      }
      return;
    }

    res.json({ error: 'Not found' }, 404);
  }
}

module.exports = { Router };
