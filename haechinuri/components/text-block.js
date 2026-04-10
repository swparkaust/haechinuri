module.exports = {
  render({ config, lang, t, locale, ...section }) {
    const titleKey = section.titleKey || '';
    const contentKey = section.contentKey || section.dataKey || '';
    const title = titleKey ? t(titleKey, '') : '';
    const content = contentKey ? t(contentKey, '') : '';
    const align = section.align || 'left';
    const image = section.image || '';

    let imageHtml = '';
    if (image) {
      imageHtml = `<div class="text-block-image"><img src="${image}" alt="${title}" loading="lazy"></div>`;
    }

    const isHtml = /<(p|b|strong|em|a |ul|ol|h[2-3]|blockquote|img )/.test(content);
    const paragraphs = isHtml ? content : content.split('\n\n').map(p => `<p>${p}</p>`).join('\n        ');

    return `<section class="text-block text-block-${align} fade-in">
      <div class="text-block-inner">
        ${imageHtml}
        <div class="text-block-content">
          ${title ? `<h2 class="section-title">${title}</h2>` : ''}
          ${paragraphs}
        </div>
      </div>
    </section>`;
  }
};
