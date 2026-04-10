const { getNestedValue } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const titleKey = section.titleKey || '';
    const title = titleKey ? t(titleKey, '') : '';
    const dataKey = section.dataKey || '';
    const data = dataKey ? getNestedValue(locale, dataKey, {}) : {};

    const embedUrl = data.url || section.url || '';
    const embedType = data.type || section.type || 'iframe';
    const aspectRatio = section.aspectRatio || '16/9';

    if (!embedUrl) return '';

    let embedHtml = '';
    if (embedType === 'video') {
      embedHtml = `<video controls preload="metadata"><source src="${embedUrl}"></video>`;
    } else {
      embedHtml = `<iframe src="${embedUrl}" loading="lazy" allowfullscreen title="${title}"></iframe>`;
    }

    return `<section class="embed-section fade-in">
      ${title ? `<h2 class="section-title">${title}</h2>` : ''}
      <div class="embed-container" style="aspect-ratio: ${aspectRatio}">
        ${embedHtml}
      </div>
    </section>`;
  }
};
