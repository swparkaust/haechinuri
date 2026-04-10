const { getNestedValue, getIcon } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const dataKey = section.dataKey || '';
    const configKey = section.configKey || dataKey;
    const data = dataKey ? getNestedValue(locale, dataKey, {}) : {};
    const itemConfig = configKey ? getNestedValue(config, configKey, {}) : {};

    const title = data.title || '';
    const tagline = data.tagline || '';
    const description = data.description || '';
    const overview = data.overview || '';
    const tags = itemConfig.tags || [];
    const link = itemConfig.link || '';
    const gradient = itemConfig.gradient || section.gradient || 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)';

    const tagBadges = tags.map(
      tag => `<span class="tech-badge">${tag}</span>`
    ).join('\n          ');

    const overviewIsHtml = /<(p|b|strong|em|a |ul|ol|h[2-3]|blockquote|img )/.test(overview);
    const overviewParagraphs = overview
      ? (overviewIsHtml ? overview : overview.split('\n\n').map(p => `<p>${p}</p>`).join('\n          '))
      : '';

    const sections = (data.sections || []).map(s => {
      if (s.type === 'tags' && tagBadges) {
        return `<div class="detail-section"><h2>${s.title}</h2><div class="detail-tags">${tagBadges}</div></div>`;
      }
      if (s.type === 'placeholder') {
        return `<div class="detail-section"><h2>${s.title}</h2><div class="detail-placeholder"><p>${s.text || ''}</p></div></div>`;
      }
      return '';
    }).join('\n        ');

    let linkHtml = '';
    if (link) {
      const linkLabel = data.linkLabel || '';
      const iconType = itemConfig.linkIcon || '';
      const icon = iconType ? getIcon(iconType, 20) : '';
      linkHtml = `<a href="${link}" class="detail-link" target="_blank" rel="noopener noreferrer">
        ${icon}
        ${linkLabel}
      </a>`;
    }

    return `<section class="detail-hero fade-in" style="background: ${gradient}">
      <div class="detail-hero-content">
        <h1 class="detail-title">${title}</h1>
        <p class="detail-tagline">${tagline}</p>
      </div>
    </section>
    <section class="detail-body fade-in">
      <div class="detail-inner">
        ${description ? `<div class="detail-description"><p>${description}</p></div>` : ''}
        ${overviewParagraphs ? `<div class="detail-overview">${overviewParagraphs}</div>` : ''}
        ${sections}
        ${linkHtml ? `<div class="detail-actions">${linkHtml}</div>` : ''}
      </div>
    </section>`;
  }
};
