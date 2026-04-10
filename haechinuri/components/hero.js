const { getNestedValue } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const dataKey = section.dataKey || '';
    const data = dataKey ? getNestedValue(locale, dataKey, {}) : {};

    const title = data.title || t(`${dataKey}.title`, '');
    const subtitle = data.subtitle || t(`${dataKey}.subtitle`, '');
    const description = data.description || t(`${dataKey}.description`, '');
    const cta = data.cta || {};
    const image = data.image || section.image || '';
    const gradient = section.gradient || '';
    const align = section.align || 'center';

    let ctaHtml = '';
    if (cta.url) {
      const ctaUrl = cta.url.startsWith('/') ? `/${lang}${cta.url}` : cta.url;
      const external = cta.url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
      ctaHtml = `<a href="${ctaUrl}" class="hero-cta"${external}>${cta.label || ''}</a>`;
    }

    let imageHtml = '';
    if (image) {
      imageHtml = `<div class="hero-image"><img src="${image}" alt="${title}" loading="lazy"></div>`;
    }

    const style = gradient ? ` style="background: ${gradient}"` : '';

    return `<section class="hero hero-${align} fade-in"${style}>
      <div class="hero-content">
        ${title ? `<h1 class="hero-title">${title}</h1>` : ''}
        ${subtitle ? `<p class="hero-subtitle">${subtitle}</p>` : ''}
        ${description ? `<p class="hero-description">${description}</p>` : ''}
        ${ctaHtml}
      </div>
      ${imageHtml}
    </section>`;
  }
};
