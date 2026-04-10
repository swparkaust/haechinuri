const fs = require('fs');
const path = require('path');
const I18n = require('./i18n');
const Renderer = require('./renderer');

class Builder {
  constructor(siteName, projectRoot) {
    this.siteName = siteName;
    this.projectRoot = projectRoot;
    this.siteDir = path.join(projectRoot, 'sites', siteName);
    this.distDir = path.join(projectRoot, 'dist', siteName);
    this.componentsDir = path.join(projectRoot, 'haechinuri', 'components');

    this.config = this.loadConfig();
    this.i18n = new I18n(this.siteDir, this.config);
    this.renderer = new Renderer(this.config, this.i18n, this.componentsDir, this.siteDir);
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.siteDir, 'config.json'), 'utf8'));
    } catch (e) {
      throw new Error(`Cannot load config for site "${this.siteName}": ${e.message}`);
    }
  }

  clean() {
    fs.rmSync(this.distDir, { recursive: true, force: true });
  }

  build() {
    console.log(`Building site: ${this.siteName}`);
    this.clean();
    fs.mkdirSync(this.distDir, { recursive: true });

    const languages = this.i18n.getAvailableLanguages();
    const pages = this.config.pages || [];

    for (const lang of languages) {
      const langDir = path.join(this.distDir, lang);
      fs.mkdirSync(langDir, { recursive: true });

      for (const page of pages) {
        const html = this.renderer.renderPage(page, lang);
        if (page.slug === 'index') {
          fs.writeFileSync(path.join(langDir, 'index.html'), html);
        } else {
          const pageDir = path.join(langDir, page.slug);
          fs.mkdirSync(pageDir, { recursive: true });
          fs.writeFileSync(path.join(pageDir, 'index.html'), html);
        }
      }
    }

    this.copyAssets();
    this.generateRootRedirect(languages);
    this.generateClientJS(languages);
    console.log(`Build complete: ${this.distDir}`);
  }

  copyAssets() {
    const assetsDir = path.join(this.siteDir, 'assets');
    const distAssets = path.join(this.distDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      this.copyDir(assetsDir, distAssets);
    }
  }

  copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  generateRootRedirect(languages) {
    const defaultLang = this.i18n.defaultLanguage;
    const langList = JSON.stringify(languages);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>
    (function() {
      var supported = ${langList};
      var defaultLang = "${defaultLang}";
      var nav = navigator.language || navigator.userLanguage || "";
      var lang = nav.toLowerCase().split("-")[0];
      var target = supported.indexOf(lang) !== -1 ? lang : defaultLang;
      window.location.replace("/" + target + "/");
    })();
  </script>
  <meta http-equiv="refresh" content="0;url=/${defaultLang}/">
</head>
<body></body>
</html>`;
    fs.writeFileSync(path.join(this.distDir, 'index.html'), html);
  }

  generateClientJS(languages) {
    const jsDir = path.join(this.distDir, 'js');
    fs.mkdirSync(jsDir, { recursive: true });

    const js = `(function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(function(el) {
    observer.observe(el);
  });

  var hamburger = document.querySelector('.nav-hamburger');
  var navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function() {
      navLinks.classList.toggle('open');
      hamburger.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
      });
    });
  }

  document.querySelectorAll('.lang-switch').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var targetLang = this.getAttribute('data-lang');
      var currentPath = window.location.pathname;
      var parts = currentPath.split('/').filter(Boolean);
      if (parts.length > 0) {
        parts[0] = targetLang;
      } else {
        parts = [targetLang];
      }
      window.location.href = '/' + parts.join('/') + '/';
    });
  });
})();`;
    fs.writeFileSync(path.join(jsDir, 'main.js'), js);
  }
}

module.exports = Builder;
