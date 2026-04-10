const { getIcon, getNestedValue } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const titleKey = section.titleKey || '';
    const title = titleKey ? t(titleKey, '') : '';
    const dataKey = section.dataKey || '';
    const items = dataKey ? (getNestedValue(config, dataKey) || []) : [];

    const links = items.map(item => {
      const label = item.labelKey ? t(item.labelKey, item.label || item.url) : (item.label || item.url);
      const icon = getIcon(item.icon, 24);
      return `<a href="${item.url}" class="contact-link" target="_blank" rel="noopener noreferrer">
        ${icon}
        <span>${label}</span>
      </a>`;
    }).join('\n      ');

    return `<section class="contact-section fade-in">
      <div class="contact-inner">
        ${title ? `<h2 class="section-title">${title}</h2>` : ''}
        <div class="contact-links">
          ${links}
        </div>
      </div>
    </section>`;
  }
};
