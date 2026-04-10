const { getNestedValue } = require('../core/utils');

module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const titleKey = section.titleKey || '';
    const title = titleKey ? t(titleKey, '') : '';
    const dataKey = section.dataKey || '';
    const images = dataKey ? getNestedValue(locale, dataKey) : [];
    const fit = ['cover', 'contain'].includes(section.fit) ? section.fit : 'cover';

    if (!Array.isArray(images) || images.length === 0) {
      return '';
    }

    const fitClass = fit !== 'cover' ? ` gallery-fit-${fit}` : '';

    const items = images.map(img => {
      const src = img.src || img;
      const alt = img.alt || '';
      const caption = img.caption || '';
      return `<figure class="gallery-item">
        <img src="${src}" alt="${alt}" loading="lazy">
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>`;
    }).join('\n      ');

    return `<section class="image-gallery${fitClass} fade-in">
      ${title ? `<h2 class="section-title">${title}</h2>` : ''}
      <div class="gallery-grid">
        ${items}
      </div>
    </section>`;
  }
};
