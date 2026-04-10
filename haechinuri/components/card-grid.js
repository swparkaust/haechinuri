const { getNestedValue } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const titleKey = section.titleKey || '';
    const title = titleKey ? t(titleKey, '') : '';
    const dataKey = section.dataKey || '';
    const items = getNestedValue(locale, dataKey) || [];
    const itemConfigs = getNestedValue(config, dataKey) || [];

    const cards = items.map((item, i) => {
      const itemConfig = itemConfigs[i] || {};
      const tags = itemConfig.tags || item.tags || [];
      const link = itemConfig.link || '';

      const tagBadges = (Array.isArray(tags) ? tags : []).map(
        tag => `<span class="tech-badge tech-badge-sm">${tag}</span>`
      ).join('');

      let linkHtml = '';
      if (link) {
        const linkLabel = item.linkLabel || (section.linkLabelKey ? t(section.linkLabelKey, '') : '');
        linkHtml = linkLabel ? `<a href="${link}" class="card-link" target="_blank" rel="noopener noreferrer">${linkLabel}</a>` : '';
      }

      return `<div class="content-card fade-in">
        <h3 class="card-title">${item.title || ''}</h3>
        <p class="card-description">${item.description || ''}</p>
        <div class="card-tags">${tagBadges}</div>
        ${linkHtml}
      </div>`;
    }).join('\n      ');

    return `<section class="card-grid-section fade-in">
      ${title ? `<h2 class="section-title">${title}</h2>` : ''}
      <div class="card-grid">
        ${cards}
      </div>
    </section>`;
  }
};
