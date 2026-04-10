const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('./utils');

class Renderer {
  constructor(config, i18n, componentsDir, siteDir) {
    this.config = config;
    this.i18n = i18n;
    this.componentsDir = componentsDir;
    this.siteDir = siteDir;
    this.components = {};
    this.cssCache = null;
    this.loadComponents();
    this.loadCSS();
  }

  loadComponents() {
    this.loadComponentsFrom(this.componentsDir);
    this.loadComponentsFrom(path.join(this.siteDir, 'pages'));
  }

  loadComponentsFrom(dir) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        delete require.cache[require.resolve(fullPath)];
        this.components[path.basename(file, '.js')] = require(fullPath);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`Failed loading components from ${dir}:`, e.message);
    }
  }

  loadCSS() {
    let componentsCSS = '';
    let themeCSS = '';
    try { componentsCSS = fs.readFileSync(path.join(this.componentsDir, 'styles.css'), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') console.warn('Failed loading styles.css:', e.message); }
    try { themeCSS = fs.readFileSync(path.join(this.siteDir, 'theme.css'), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') console.warn('Failed loading theme.css:', e.message); }
    this.cssCache = `${componentsCSS}\n${themeCSS}`;
  }

  renderComponent(name, props) {
    const component = this.components[name];
    if (!component) {
      console.warn(`Component "${name}" not found`);
      return '';
    }
    return component.render(props);
  }

  renderPage(pageConfig, lang) {
    const locale = this.i18n.getLocaleData(lang);
    const t = (key, fallback) => this.i18n.get(lang, key, fallback);
    const languages = this.i18n.getAvailableLanguages();
    const siteName = t('site.title', this.config.title || '');
    const isRtl = this.config.rtlLanguages?.includes(lang) || false;

    const nav = this.renderComponent('nav', {
      config: this.config,
      lang,
      languages,
      t,
      currentPage: pageConfig.slug || 'index'
    });

    const footer = this.renderComponent('footer', {
      config: this.config,
      lang,
      t
    });

    let bodyContent = '';
    const sections = pageConfig.sections || [];
    for (const section of sections) {
      bodyContent += this.renderComponent(section.component, {
        ...section,
        config: this.config,
        lang,
        t,
        locale
      });
    }

    const pageTitle = pageConfig.titleKey ? t(pageConfig.titleKey, '') : '';
    const fullTitle = pageTitle ? `${pageTitle} — ${siteName}` : siteName;
    const description = pageConfig.descriptionKey ? t(pageConfig.descriptionKey, '') : t('site.description', '');
    const currentPage = pageConfig.slug || 'index';

    return this.wrapHtml({ lang, isRtl, title: fullTitle, description, nav, body: bodyContent, footer, currentPage });
  }

  wrapHtml({ lang, isRtl, title, description, nav, body, footer, currentPage }) {
    const canonicalUrl = currentPage === 'index' ? `/${lang}/` : `/${lang}/${currentPage}/`;
    const languages = this.i18n.getAvailableLanguages();
    const alternateLinks = languages
      .map(l => `<link rel="alternate" hreflang="${l}" href="/${l}/${currentPage === 'index' ? '' : currentPage + '/'}">`)
      .join('\n    ');

    return `<!DOCTYPE html>
<html lang="${lang}"${isRtl ? ' dir="rtl"' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  ${alternateLinks}
  <link rel="icon" href="${this.config.favicon || this.config.logo || '/assets/logo.png'}" type="image/png">
  <style>${this.cssCache}</style>
</head>
<body>
  ${nav}
  <main>
    ${body}
  </main>
  ${footer}
  <script src="/js/main.js"></script>
</body>
</html>`;
  }
}

module.exports = Renderer;
