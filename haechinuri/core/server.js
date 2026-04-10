const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const I18n = require('./i18n');
const Renderer = require('./renderer');
const Builder = require('./builder');

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_KEYS = 10000;
const LOCALE_ROUTE = /^\/admin\/api\/locales\/(\w+)$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const ASSET_EXTENSIONS = new Set(Object.keys(MIME_TYPES).filter(e => e !== '.html' && e !== '.json'));

class Server {
  constructor(siteName, projectRoot, options = {}) {
    this.siteName = siteName;
    this.projectRoot = projectRoot;
    this.siteDir = path.join(projectRoot, 'sites', siteName);
    this.distDir = path.join(projectRoot, 'dist', siteName);
    this.port = options.port || 3000;
    this.mode = options.mode || 'serve';
    this.passwordFile = path.join(this.siteDir, '.admin-password');
    this.adminPassword = this.loadPassword(options.adminPassword || process.env.ADMIN_PASSWORD || 'admin');
    this.sessions = new Map();
    this.analyticsFile = path.join(this.siteDir, '.analytics.json');
    this.analytics = this.loadAnalytics();
    this.analyticsDirty = false;
    this.sseClients = [];

    this.config = JSON.parse(fs.readFileSync(path.join(this.siteDir, 'config.json'), 'utf8'));
    this.i18n = new I18n(this.siteDir, this.config);
  }

  start() {
    const server = http.createServer((req, res) => {
      try {
        this.handleRequest(req, res);
      } catch (e) {
        console.error('Request error:', e.message);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      }
    });

    if (this.mode === 'dev') {
      this.watchFiles();
    }

    this.saveInterval = setInterval(() => this.saveAnalytics(), 60000);
    process.on('SIGINT', () => { this.saveAnalytics(); process.exit(0); });
    process.on('SIGTERM', () => { this.saveAnalytics(); process.exit(0); });

    server.listen(this.port, () => {
      console.log(`Server running at http://localhost:${this.port}`);
      if (this.mode === 'dev') {
        console.log('Watching for changes...');
      }
    });
    return server;
  }

  handleRequest(req, res) {
    const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

    if (pathname.startsWith('/admin/api/')) {
      return this.handleAdminApi(req, res, pathname);
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return this.serveAdmin(req, res, pathname);
    }

    if (pathname === '/__livereload' && this.mode === 'dev') {
      return this.handleSSE(req, res);
    }

    if (pathname === '/api/analytics' && req.method === 'POST') {
      return this.recordAnalytics(req, res);
    }

    if (!ASSET_EXTENSIONS.has(path.extname(pathname))) {
      this.recordPageView(pathname, req.headers.referer);
    }
    return this.serveStatic(req, res, pathname);
  }

  serveStatic(req, res, pathname) {
    if (pathname === '/') {
      const acceptLang = req.headers['accept-language'];
      const lang = this.i18n.detectLanguage(acceptLang);
      res.writeHead(302, { 'Location': `/${lang}/` });
      res.end();
      return;
    }

    if (pathname.length > 1 && !pathname.endsWith('/') && !path.extname(pathname)) {
      try {
        if (fs.statSync(path.join(this.distDir, pathname)).isDirectory()) {
          res.writeHead(301, { 'Location': pathname + '/' });
          res.end();
          return;
        }
      } catch (e) {}
    }

    let filePath = path.join(this.distDir, pathname);

    if (!filePath.startsWith(this.distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch (e) {
      if (!path.extname(filePath)) {
        filePath = filePath + '.html';
      }
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    if (this.mode === 'dev' && ext === '.html') {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        const livereloadScript = `<script>(function(){var es=new EventSource("/__livereload");es.onmessage=function(){window.location.reload()};})();</script>`;
        content = content.replace('</body>', livereloadScript + '</body>');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (e) {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('open', () => {
      res.writeHead(200, { 'Content-Type': contentType });
      stream.pipe(res);
    });
    stream.on('error', () => {
      res.writeHead(404);
      res.end('Not Found');
    });
  }

  handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: connected\n\n');
    this.sseClients.push(res);
    req.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c !== res);
    });
  }

  notifyClients() {
    for (const client of this.sseClients) {
      client.write('data: reload\n\n');
    }
  }

  serveAdmin(req, res, pathname) {
    const adminDir = path.join(this.projectRoot, 'haechinuri', 'admin');
    let filePath;

    if (pathname === '/admin' || pathname === '/admin/') {
      filePath = path.join(adminDir, 'index.html');
    } else {
      const relativePath = pathname.replace('/admin/', '');
      filePath = path.join(adminDir, relativePath);
      if (!filePath.startsWith(adminDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    }

    try {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    } catch (e) {
      try {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(path.join(adminDir, 'index.html')));
      } catch (e2) {
        res.writeHead(404);
        res.end('Admin UI not found');
      }
    }
  }

  handleAdminApi(req, res, pathname) {
    res.setHeader('Content-Type', 'application/json');

    if (pathname === '/admin/api/login' && req.method === 'POST') {
      return this.handleLogin(req, res);
    }

    if (!this.checkAuth(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const localeMatch = pathname.match(LOCALE_ROUTE);

    if (pathname === '/admin/api/config' && req.method === 'GET') return this.getConfig(res);
    if (pathname === '/admin/api/config' && req.method === 'PUT') return this.updateConfig(req, res);
    if (pathname === '/admin/api/locales' && req.method === 'GET') return this.getLocales(res);
    if (pathname === '/admin/api/locales' && req.method === 'POST') return this.createLocale(req, res);
    if (localeMatch && req.method === 'GET') return this.getLocale(res, localeMatch[1]);
    if (localeMatch && req.method === 'PUT') return this.updateLocale(req, res, localeMatch[1]);
    if (localeMatch && req.method === 'DELETE') return this.deleteLocale(res, localeMatch[1]);
    if (pathname === '/admin/api/rebuild' && req.method === 'POST') return this.triggerRebuild(res);
    if (pathname === '/admin/api/analytics' && req.method === 'GET') return this.getAnalytics(res);
    if (pathname === '/admin/api/assets' && req.method === 'GET') return this.getAssets(res);
    if (pathname === '/admin/api/assets' && req.method === 'POST') return this.uploadAsset(req, res);
    if (pathname.startsWith('/admin/api/assets/') && req.method === 'DELETE') return this.deleteAsset(res, pathname.replace('/admin/api/assets/', ''));
    if (pathname === '/admin/api/theme' && req.method === 'GET') return this.getTheme(res);
    if (pathname === '/admin/api/theme' && req.method === 'PUT') return this.updateTheme(req, res);
    if (pathname === '/admin/api/cache/clear' && req.method === 'POST') return this.clearCache(res);
    if (pathname === '/admin/api/password' && req.method === 'PUT') return this.changePassword(req, res);
    if (pathname === '/admin/api/preview' && req.method === 'POST') return this.renderPreview(req, res);

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  handleLogin(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { password } = JSON.parse(body);
        if (this.verifyPassword(password, this.adminPassword)) {
          const token = crypto.randomBytes(32).toString('hex');
          this.sessions.set(token, { created: Date.now() });
          this.pruneExpiredSessions();
          res.writeHead(200);
          res.end(JSON.stringify({ token }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid password' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  checkAuth(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7);
    const session = this.sessions.get(token);
    if (!session) return false;
    if (Date.now() - session.created > SESSION_TTL) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (now - session.created > SESSION_TTL) {
        this.sessions.delete(token);
      }
    }
  }

  getConfig(res) {
    res.writeHead(200);
    res.end(JSON.stringify(this.config));
  }

  updateConfig(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const config = JSON.parse(body);
        fs.writeFileSync(path.join(this.siteDir, 'config.json'), JSON.stringify(config, null, 2));
        this.config = config;
        this.rebuild();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  getLocales(res) {
    const locales = {};
    for (const lang of this.i18n.getAvailableLanguages()) {
      locales[lang] = this.i18n.getLocaleData(lang);
    }
    res.writeHead(200);
    res.end(JSON.stringify(locales));
  }

  getLocale(res, lang) {
    if (!this.i18n.locales[lang]) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Locale not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(this.i18n.locales[lang]));
  }

  updateLocale(req, res, lang) {
    this.readBody(req, res, (body) => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(path.join(this.siteDir, 'content', `${lang}.json`), JSON.stringify(data, null, 2));
        this.rebuild();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  deleteLocale(res, lang) {
    if (lang === this.config.defaultLanguage) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Cannot delete default language' }));
      return;
    }
    try {
      fs.unlinkSync(path.join(this.siteDir, 'content', `${lang}.json`));
      this.rebuild();
    } catch (e) {}
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }

  createLocale(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { lang, baseOn } = JSON.parse(body);
        if (!lang || !/^\w+$/.test(lang)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid language code' }));
          return;
        }
        const filePath = path.join(this.siteDir, 'content', `${lang}.json`);
        try {
          fs.accessSync(filePath);
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Locale already exists' }));
          return;
        } catch (e) {}
        let data = {};
        if (baseOn && /^\w+$/.test(baseOn)) {
          try {
            data = JSON.parse(fs.readFileSync(path.join(this.siteDir, 'content', `${baseOn}.json`), 'utf8'));
          } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        this.rebuild();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  triggerRebuild(res) {
    try {
      this.rebuild();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  rebuild() {
    const builder = new Builder(this.siteName, this.projectRoot);
    builder.build();
    this.config = builder.config;
    this.i18n = builder.i18n;
  }

  getAnalytics(res) {
    res.writeHead(200);
    res.end(JSON.stringify(this.analytics));
  }

  getAssets(res) {
    const assetsDir = path.join(this.siteDir, 'assets');
    try {
      const files = fs.readdirSync(assetsDir).map(f => ({
        name: f,
        size: fs.statSync(path.join(assetsDir, f)).size,
        url: `/assets/${f}`
      }));
      res.writeHead(200);
      res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify([]));
    }
  }

  uploadAsset(req, res) {
    const filename = req.headers['x-filename'];
    if (!filename) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing filename header' }));
      return;
    }
    const safeName = path.basename(filename);
    const assetsDir = path.join(this.siteDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const filePath = path.join(assetsDir, safeName);
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: 'File too large' }));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size <= MAX_BODY_SIZE) {
        try {
          fs.writeFileSync(filePath, Buffer.concat(chunks));
          this.rebuild();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, url: `/assets/${safeName}` }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      }
    });
  }

  deleteAsset(res, filename) {
    const safeName = path.basename(filename);
    try {
      fs.unlinkSync(path.join(this.siteDir, 'assets', safeName));
      this.rebuild();
    } catch (e) {}
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }

  getTheme(res) {
    let css = '';
    try { css = fs.readFileSync(path.join(this.siteDir, 'theme.css'), 'utf8'); } catch (e) {}
    res.writeHead(200);
    res.end(JSON.stringify({ css }));
  }

  updateTheme(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { css } = JSON.parse(body);
        fs.writeFileSync(path.join(this.siteDir, 'theme.css'), css);
        this.rebuild();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  clearCache(res) {
    try {
      this.rebuild();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  renderPreview(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { lang, locales, pageSlug } = JSON.parse(body);
        if (!lang || !locales) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'lang and locales required' }));
          return;
        }

        const draftI18n = new I18n(this.siteDir, this.config);
        for (const l in locales) draftI18n.locales[l] = locales[l];

        const componentsDir = path.join(this.projectRoot, 'haechinuri', 'components');
        const draftRenderer = new Renderer(this.config, draftI18n, componentsDir, this.siteDir);

        const slug = pageSlug || 'index';
        const page = (this.config.pages || []).find(p => p.slug === slug);
        if (!page) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Page not found' }));
          return;
        }

        let html = draftRenderer.renderPage(page, lang);
        const navScript = `<script>(function(){document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href');if(h&&h.startsWith('/')&&!h.startsWith('/assets')){e.preventDefault();window.parent.postMessage({type:'preview-nav',href:h},'*')}});})()</script>`;
        html = html.replace('</body>', navScript + '</body>');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, stored) {
    if (!stored.includes(':')) {
      const a = Buffer.from(password);
      const b = Buffer.from(stored);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }
    const [salt, hash] = stored.split(':');
    const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  }

  loadPassword(defaultPassword) {
    try {
      return fs.readFileSync(this.passwordFile, 'utf8').trim();
    } catch (e) {
      return defaultPassword;
    }
  }

  changePassword(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { current, newPassword } = JSON.parse(body);
        if (!this.verifyPassword(current, this.adminPassword)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: 'Current password is incorrect' }));
          return;
        }
        if (!newPassword || newPassword.length < 1) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'New password is required' }));
          return;
        }
        const hashed = this.hashPassword(newPassword);
        this.adminPassword = hashed;
        fs.writeFileSync(this.passwordFile, hashed, { mode: 0o600 });
        this.sessions.clear();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  loadAnalytics() {
    try {
      const data = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
      if (data && data.days) return data;
    } catch (e) {}
    return { days: {} };
  }

  saveAnalytics() {
    if (!this.analyticsDirty) return;
    this.pruneAnalytics();
    try {
      fs.writeFileSync(this.analyticsFile, JSON.stringify(this.analytics), { mode: 0o600 });
      this.analyticsDirty = false;
    } catch (e) {
      console.error('Failed to save analytics:', e.message);
    }
  }

  pruneAnalytics() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const days = this.analytics.days;
    for (const date in days) {
      if (date < cutoffStr) delete days[date];
    }
  }

  todayKey() {
    const now = Date.now();
    if (!this._todayExpires || now >= this._todayExpires) {
      const d = new Date(now);
      this._cachedToday = d.toISOString().split('T')[0];
      this._todayExpires = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    }
    return this._cachedToday;
  }

  recordPageView(pathname, referrer) {
    const today = this.todayKey();
    if (!this.analytics.days[today]) {
      this.analytics.days[today] = { views: {}, locales: {}, referrers: {} };
    }
    const day = this.analytics.days[today];

    if (Object.keys(day.views).length < MAX_ANALYTICS_KEYS) {
      const key = pathname || '/';
      day.views[key] = (day.views[key] || 0) + 1;
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && Object.keys(day.locales).length < MAX_ANALYTICS_KEYS) {
      day.locales[parts[0]] = (day.locales[parts[0]] || 0) + 1;
    }

    if (referrer && Object.keys(day.referrers).length < MAX_ANALYTICS_KEYS) {
      try {
        const host = new URL(referrer).hostname;
        day.referrers[host] = (day.referrers[host] || 0) + 1;
      } catch (e) {}
    }

    this.analyticsDirty = true;
  }

  recordAnalytics(req, res) {
    this.readBody(req, res, (body) => {
      try {
        const { page, referrer } = JSON.parse(body);
        if (page) this.recordPageView(page, referrer);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid data' }));
      }
    });
  }

  readBody(req, res, callback) {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE && !aborted) {
        aborted = true;
        if (!res.headersSent) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: 'Request body too large' }));
        }
        req.destroy();
        return;
      }
      if (!aborted) body += chunk;
    });
    req.on('end', () => {
      if (!aborted) callback(body);
    });
    req.on('error', () => {});
  }

  watchFiles() {
    const dirs = [
      path.join(this.siteDir, 'content'),
      path.join(this.siteDir, 'assets'),
      this.siteDir
    ];

    let debounce = null;
    const rebuild = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log('Changes detected, rebuilding...');
        this.rebuild();
        this.notifyClients();
      }, 300);
    };

    for (const dir of dirs) {
      try {
        fs.watch(dir, { recursive: false }, rebuild);
      } catch (e) {}
    }

    try {
      fs.watch(path.join(this.projectRoot, 'haechinuri', 'components'), { recursive: false }, rebuild);
    } catch (e) {}
  }
}

module.exports = Server;
