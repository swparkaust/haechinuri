const { getNestedValue } = require('../core/utils');

const DEFAULT_GRADIENTS = [
  'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%)'
];

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const dataKey = section.dataKey || '';
    const items = getNestedValue(locale, dataKey) || [];
    const itemConfigs = getNestedValue(config, dataKey) || [];

    return items.map((item, i) => {
      const itemConfig = itemConfigs[i] || {};
      const title = item.title || '';
      const tagline = item.tagline || '';
      const tags = itemConfig.tags || item.tags || [];
      const link = itemConfig.link || '';
      const pageSlug = itemConfig.page || '';
      const gradient = itemConfig.gradient || DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
      const icon = itemConfig.icon || '';

      const tagBadges = (Array.isArray(tags) ? tags : []).map(
        tag => `<span class="tech-badge">${tag}</span>`
      ).join('\n            ');

      let ctaHtml = '';
      if (pageSlug) {
        const ctaLabel = item.cta || (section.ctaLabelKey ? t(section.ctaLabelKey, '') : '');
        ctaHtml = ctaLabel ? `<a href="/${lang}/${pageSlug}/" class="banner-cta">${ctaLabel}</a>` : '';
      }

      let linkHtml = '';
      if (link) {
        const linkLabel = item.linkLabel || (section.linkLabelKey ? t(section.linkLabelKey, '') : '');
        linkHtml = linkLabel ? `<a href="${link}" class="banner-link" target="_blank" rel="noopener noreferrer">${linkLabel}</a>` : '';
      }

      const iconHtml = icon ? `<img class="section-icon" src="${icon}" alt="${title}" width="80" height="80">` : '';

      return `<section class="feature-banner fade-in" style="background: ${gradient}">
      <div class="banner-content">
        ${iconHtml}
        <h2 class="banner-title">${title}</h2>
        <p class="banner-tagline">${tagline}</p>
        <div class="banner-tags">
          ${tagBadges}
        </div>
        <div class="banner-actions">
          ${ctaHtml}
          ${linkHtml}
        </div>
      </div>
    </section>`;
    }).join('\n');
  }
};
