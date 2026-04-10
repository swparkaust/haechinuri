const fs = require('fs');
const path = require('path');

class I18n {
  constructor(siteDir, config) {
    this.siteDir = siteDir;
    this.config = config;
    this.locales = {};
    this.defaultLanguage = config.defaultLanguage || 'en';
    this.loadLocales();
  }

  loadLocales() {
    const contentDir = path.join(this.siteDir, 'content');
    try {
      const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const lang = path.basename(file, '.json');
        try {
          this.locales[lang] = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8'));
        } catch (e) {
          console.warn(`Failed to load locale ${file}: ${e.message}`);
        }
      }
    } catch (e) {}
  }

  getAvailableLanguages() {
    return Object.keys(this.locales);
  }

  get(lang, key, fallback) {
    const locale = this.locales[lang] || this.locales[this.defaultLanguage] || {};
    const keys = key.split('.');
    let value = locale;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        if (lang !== this.defaultLanguage) {
          return this.get(this.defaultLanguage, key, fallback);
        }
        return fallback !== undefined ? fallback : key;
      }
    }
    return value;
  }

  getLocaleData(lang) {
    return this.locales[lang] || this.locales[this.defaultLanguage] || {};
  }

  detectLanguage(acceptLanguage) {
    if (!acceptLanguage) return this.defaultLanguage;
    const available = this.getAvailableLanguages();
    const preferred = acceptLanguage
      .split(',')
      .map(part => {
        const [lang, q] = part.trim().split(';q=');
        return { lang: lang.trim().toLowerCase(), q: parseFloat(q) || 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of preferred) {
      if (available.includes(lang)) return lang;
      const prefix = lang.split('-')[0];
      if (available.includes(prefix)) return prefix;
    }
    return this.defaultLanguage;
  }


}

module.exports = I18n;
