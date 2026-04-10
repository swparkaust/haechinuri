const { getIcon } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const links = config.footerLinks || config.links || [];

    const contactLinks = links.map(item => {
      const icon = getIcon(item.icon, 18);
      const label = item.label || item.url;
      return `<a href="${item.url}" class="footer-link" target="_blank" rel="noopener noreferrer">${icon} ${label}</a>`;
    }).join('\n          ');

    const year = new Date().getFullYear();
    const raw = t('footer.copyright', `\u00A9 ${year} ${t('site.title', '')}`);
    const copyright = raw.replace('{year}', year);

    return `<footer class="site-footer fade-in">
      <div class="footer-inner">
        ${contactLinks ? `<div class="footer-links">${contactLinks}</div>` : ''}
        <p class="footer-copy">${copyright}</p>
      </div>
    </footer>`;
  }
};
