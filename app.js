(() => {
  'use strict';
  const data = window.PSP_GUIDE_DATA;
  if (!data || !Array.isArray(data.pages)) return;

  const pages = data.pages;
  const pageById = new Map(pages.map(page => [page.id, page]));
  const navigation = document.getElementById('siteNavigation');
  const searchInput = document.getElementById('guideSearch');
  const searchResults = document.getElementById('searchResults');
  const article = document.getElementById('article');
  const pageCounter = document.getElementById('pageCounter');
  const printButton = document.getElementById('printButton');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');
  let currentPageId = 'p0';
  let lastFocusedImage = null;

  const displayTitle = page => page.displayTitle || page.title;
  const searchCorpus = new Map(pages.map(page => [page.id, [displayTitle(page), page.title, ...page.blocks.filter(block => block.type === 'text').map(block => block.text)].join(' ').toLocaleLowerCase()]));

  function categoryFor(pageId) {
    const category = data.categories.find(item => item.pages.includes(pageId));
    return category ? category.title : 'Guide';
  }

  function makeInternalLink(pageId, label, className = 'nav-link') {
    const link = document.createElement('a');
    link.href = `#${pageId}`;
    link.className = className;
    link.textContent = label;
    link.addEventListener('click', () => {
      if (pageId === currentPageId) window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    });
    return link;
  }

  function renderNavigation(activeId) {
    navigation.textContent = '';
    for (const category of data.categories) {
      const group = document.createElement('details');
      group.className = 'nav-group';
      group.open = category.pages.includes(activeId) || category.title === 'Start here' && (activeId === 'p0' || activeId === 'p1');
      const summary = document.createElement('summary');
      summary.textContent = category.title;
      const links = document.createElement('div');
      links.className = 'nav-group-links';
      for (const id of category.pages) {
        const page = pageById.get(id);
        if (!page) continue;
        const link = makeInternalLink(id, displayTitle(page));
        link.className = 'nav-link';
        if (id === activeId) link.setAttribute('aria-current', 'page');
        links.appendChild(link);
      }
      group.append(summary, links);
      navigation.appendChild(group);
    }
  }

  function renderSearch() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    searchResults.textContent = '';
    if (!query) {
      searchResults.hidden = true;
      navigation.hidden = false;
      return;
    }
    navigation.hidden = true;
    searchResults.hidden = false;
    const heading = document.createElement('div');
    heading.className = 'result-heading';
    searchResults.appendChild(heading);
    const matches = pages.filter(page => searchCorpus.get(page.id).includes(query)).slice(0, 14);
    heading.textContent = `${matches.length}${matches.length === 14 ? '+' : ''} matching screens`;
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'no-results';
      empty.textContent = 'No matching guide pages. Try a shorter search term.';
      searchResults.appendChild(empty);
      return;
    }
    for (const page of matches) {
      const link = makeInternalLink(page.id, '');
      link.className = 'result-link';
      const name = document.createElement('strong');
      name.textContent = displayTitle(page);
      const meta = document.createElement('span');
      meta.textContent = categoryFor(page.id);
      link.append(name, meta);
      searchResults.appendChild(link);
    }
  }

  function safeExternalLink(text) {
    const link = document.createElement('a');
    const raw = text.trim();
    link.href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = raw;
    return link;
  }

  function makeFigure(block, gallery = false) {
    const figure = document.createElement('figure');
    figure.className = 'guide-figure';
    const base = block.src.split('/').pop().toLowerCase();
    if (/signature/.test(base)) figure.classList.add('is-signature');
    else if (/logo|psn/.test(base)) figure.classList.add('is-logo');
    const image = document.createElement('img');
    image.src = block.src;
    image.alt = block.alt || base;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Expand image: ${image.alt}`);
    image.addEventListener('click', () => openLightbox(image));
    image.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openLightbox(image); } });
    figure.appendChild(image);
    if (gallery) {
      figure.classList.remove('guide-figure');
      const caption = document.createElement('figcaption');
      caption.textContent = block.alt || base;
      figure.appendChild(caption);
    }
    return figure;
  }

  function isNumberedItem(text) { return /^\d+\.\s+/.test(text); }
  function isBulletItem(text) { return /^\*\s+/.test(text); }
  function appendText(stream, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (/^www\.[^\s]+$/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      const p = document.createElement('p');
      p.appendChild(safeExternalLink(trimmed));
      stream.appendChild(p);
      return;
    }
    if (/\bCAUTION\b/i.test(trimmed)) {
      const note = document.createElement('aside');
      note.className = 'warning-note';
      const label = document.createElement('strong');
      label.textContent = 'Caution';
      const body = document.createElement('span');
      body.textContent = trimmed.replace(/^CAUTION\s*:?\s*/i, '');
      note.append(label, body);
      stream.appendChild(note);
      return;
    }
    const shortAllCaps = trimmed.length <= 60 && /[A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed) && /[A-Z]{3}/.test(trimmed);
    if (shortAllCaps) {
      const heading = document.createElement('h2');
      heading.className = 'source-heading';
      heading.textContent = trimmed;
      stream.appendChild(heading);
      return;
    }
    if (/^(Tools needed:|Tools[-,:]?|Supplies[-,:]?)$/i.test(trimmed)) {
      const heading = document.createElement('h3');
      heading.textContent = trimmed;
      stream.appendChild(heading);
      return;
    }
    const p = document.createElement('p');
    p.textContent = trimmed;
    stream.appendChild(p);
  }

  function renderContentBlocks(stream, blocks) {
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (block.type === 'image') {
        stream.appendChild(makeFigure(block));
        i++;
        continue;
      }
      const text = block.text || '';
      if (isBulletItem(text)) {
        const list = document.createElement('ul');
        list.className = 'content-list';
        while (i < blocks.length && blocks[i].type === 'text' && isBulletItem(blocks[i].text)) {
          const li = document.createElement('li');
          li.textContent = blocks[i].text.replace(/^\*\s+/, '');
          list.appendChild(li);
          i++;
        }
        stream.appendChild(list);
        continue;
      }
      if (isNumberedItem(text)) {
        const list = document.createElement('ol');
        list.className = 'content-list';
        const firstNum = Number(text.match(/^\d+/)[0]);
        list.start = firstNum;
        while (i < blocks.length && blocks[i].type === 'text' && isNumberedItem(blocks[i].text)) {
          const li = document.createElement('li');
          li.textContent = blocks[i].text.replace(/^\d+\.\s+/, '');
          list.appendChild(li);
          i++;
        }
        stream.appendChild(list);
        continue;
      }
      appendText(stream, text);
      i++;
    }
  }

  function renderMenuLinks(host, page) {
    const items = page.links.filter(link => link.href && !['BACK', 'BACK TO MAIN MENU', 'MAIN MENU'].includes((link.label || '').toUpperCase()));
    if (!items.length) return;
    const panel = document.createElement('section');
    panel.className = 'page-menu';
    const heading = document.createElement('h2');
    heading.className = 'page-menu-heading';
    heading.textContent = page.id === 'p1' ? 'Choose a repair guide' : page.id === 'p53' ? 'Choose a board-level repair' : 'Choose a disassembly guide';
    const grid = document.createElement('div');
    grid.className = 'page-menu-grid';
    for (const item of items) {
      const link = makeInternalLink(item.href, '', 'page-menu-link');
      const label = document.createElement('span');
      label.textContent = item.label;
      const arrow = document.createElement('span');
      arrow.className = 'link-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      link.append(label, arrow);
      grid.appendChild(link);
    }
    panel.append(heading, grid);
    host.appendChild(panel);
  }

  function renderPageActions(host, page, menuPage) {
    const actions = page.links.filter(link => link.href && (!menuPage || ['BACK', 'BACK TO MAIN MENU', 'MAIN MENU'].includes((link.label || '').toUpperCase())));
    if (!actions.length) return;
    const row = document.createElement('nav');
    row.className = 'page-actions';
    row.setAttribute('aria-label', 'Continue through this guide');
    for (const item of actions) {
      const upper = (item.label || '').toUpperCase();
      const isBack = upper.includes('BACK') || upper === 'MAIN MENU';
      const link = makeInternalLink(item.href, '', `action-link${isBack ? ' is-secondary' : ''}`);
      const arrow = document.createElement('span');
      arrow.className = 'action-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = isBack ? '←' : upper.includes('NEXT') ? '→' : '↗';
      const label = document.createElement('span');
      label.textContent = item.label;
      if (isBack) link.append(arrow, label); else link.append(label, arrow);
      row.appendChild(link);
    }
    host.appendChild(row);
  }

  function renderArchiveGallery(host) {
    if (!data.archiveGallery || !data.archiveGallery.length) return;
    const details = document.createElement('details');
    details.className = 'archive-gallery';
    const summary = document.createElement('summary');
    summary.textContent = `Additional image files from the original archive (${data.archiveGallery.length})`;
    const note = document.createElement('p');
    note.className = 'gallery-note';
    note.textContent = 'These image files were included in the archive but were not attached to a specific visible guide screen in the recovered page data.';
    const grid = document.createElement('div');
    grid.className = 'archive-gallery-grid';
    for (const item of data.archiveGallery) grid.appendChild(makeFigure(item, true));
    details.append(summary, note, grid);
    host.appendChild(details);
  }

  function renderPage(id) {
    const page = pageById.get(id) || pageById.get('p0');
    currentPageId = page.id;
    document.title = `${displayTitle(page)} — ${data.title}`;
    const position = pages.findIndex(item => item.id === page.id) + 1;
    pageCounter.textContent = `Screen ${position} of ${pages.length}`;
    renderNavigation(page.id);
    if (searchInput.value.trim()) renderSearch();

    article.textContent = '';
    const headingWrap = document.createElement('header');
    headingWrap.className = 'page-heading';
    const kicker = document.createElement('p');
    kicker.className = 'page-kicker';
    kicker.textContent = `${categoryFor(page.id)} · screen ${String(position).padStart(2, '0')}`;
    const heading = document.createElement('h1');
    heading.textContent = displayTitle(page);
    const rule = document.createElement('div');
    rule.className = 'heading-rule';
    rule.setAttribute('aria-hidden', 'true');
    rule.append(document.createElement('span'), document.createElement('span'));
    headingWrap.append(kicker, heading, rule);
    article.appendChild(headingWrap);

    const menuPage = ['p1', 'p2', 'p53'].includes(page.id);
    if (menuPage) renderMenuLinks(article, page);
    const stream = document.createElement('section');
    stream.className = 'content-stream';
    stream.setAttribute('aria-label', 'Guide content');
    renderContentBlocks(stream, page.blocks);
    article.appendChild(stream);
    renderPageActions(article, page, menuPage);
    if (page.id === 'p0') renderArchiveGallery(article);

    const meta = document.createElement('div');
    meta.className = 'article-meta';
    const left = document.createElement('span');
    left.textContent = `Original source screen: ${page.title}`;
    const right = document.createElement('span');
    right.textContent = 'Text and imagery preserved from the supplied archive';
    meta.append(left, right);
    article.appendChild(meta);
  }

  function routeFromHash() {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    return pageById.has(id) ? id : 'p0';
  }

  function navigateFromHash() {
    renderPage(routeFromHash());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openLightbox(image) {
    lastFocusedImage = image;
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = image.alt;
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocusedImage) lastFocusedImage.focus();
  }

  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      renderSearch();
      searchInput.blur();
    } else if (event.key === 'Enter') {
      const first = searchResults.querySelector('a[href^="#"]');
      if (first) window.location.hash = first.getAttribute('href').slice(1);
    }
  });
  printButton.addEventListener('click', () => window.print());
  window.addEventListener('hashchange', navigateFromHash);
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLightbox(); });

  if (!window.location.hash || !pageById.has(window.location.hash.slice(1))) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#p0`);
  }
  renderPage(routeFromHash());
})();
