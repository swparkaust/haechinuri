module.exports = {
  render({ config, lang, languages, t, currentPage }) {
    const navItems = (config.navigation || []).map(item => {
      const label = t(item.labelKey, item.label || '');
      const href = item.external ? item.url : `/${lang}/${item.slug === 'index' ? '' : item.slug + '/'}`;
      const activeClass = (item.slug === currentPage) ? ' nav-link-active' : '';
      return `<a href="${href}" class="nav-link${activeClass}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    }).join('\n            ');

    const langLinks = languages.map(l => {
      const active = l === lang ? ' lang-active' : '';
      const label = config.languageLabels?.[l] || l.toUpperCase();
      return `<a href="/${l}/" class="lang-switch${active}" data-lang="${l}">${label}</a>`;
    }).join('\n              ');

    return `<header class="site-header">
      <nav class="site-nav">
        <a href="/${lang}/" class="nav-logo">
          <img src="${config.logo || '/assets/logo.png'}" alt="${t('site.title', '')}" width="40" height="40">
        </a>
        <div class="nav-links">
          ${navItems}
          <div class="lang-switcher">
            ${langLinks}
          </div>
        </div>
        <button class="nav-hamburger" aria-label="${t('nav.menu', 'Menu')}">
          <span></span><span></span><span></span>
        </button>
      </nav>
    </header>`;
  }
};
