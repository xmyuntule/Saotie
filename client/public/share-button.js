(function () {
  var script = document.currentScript;
  var origin = 'https://saotie.com';
  try {
    if (script && script.src) origin = new URL(script.src).origin;
  } catch (_) {}

  var STYLE_ID = 'saotie-share-button-style';
  var OVERLAY_ID = 'saotie-share-overlay';
  var LIGHTNING =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M13.2 2 4.8 13.1h6.1L9.8 22l9.4-12.4h-6.3L13.2 2Z" />' +
    '</svg>';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.saotie-share-btn{appearance:none;border:0;background:transparent;color:var(--saotie-share-color,#8b5cf6);width:var(--saotie-share-size,36px);height:var(--saotie-share-size,36px);display:inline-grid;place-items:center;border-radius:999px;padding:0;cursor:pointer;line-height:1;vertical-align:middle;transition:background .18s ease,color .18s ease,transform .18s ease}',
      '.saotie-share-btn:hover{background:color-mix(in srgb,currentColor 12%,transparent);transform:translateY(-1px)}',
      '.saotie-share-btn:active{transform:translateY(0) scale(.96)}',
      '.saotie-share-btn svg{width:62%;height:62%;display:block;fill:currentColor}',
      '.saotie-share-mask{position:fixed;inset:0;z-index:2147483647;background:rgba(15,18,28,.46);display:grid;place-items:center;padding:18px;box-sizing:border-box}',
      '.saotie-share-frame-wrap{position:relative;width:min(540px,100%);height:min(720px,calc(100vh - 36px));background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28)}',
      '.saotie-share-frame{width:100%;height:100%;border:0;display:block;background:transparent}',
      '.saotie-share-close{position:absolute;right:10px;top:10px;width:34px;height:34px;border:0;border-radius:999px;background:rgba(15,18,28,.08);color:#4b5563;cursor:pointer;font-size:24px;line-height:34px;z-index:1}',
      '.saotie-share-close:hover{background:rgba(15,18,28,.14);color:#111827}',
      '@media(max-width:560px){.saotie-share-mask{padding:0}.saotie-share-frame-wrap{width:100%;height:100%;border-radius:0}.saotie-share-close{right:12px;top:12px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function meta(selector, attr) {
    var el = document.querySelector(selector);
    return el ? (el.getAttribute(attr || 'content') || '') : '';
  }

  function firstMeta(selectors, attr) {
    for (var i = 0; i < selectors.length; i += 1) {
      var value = meta(selectors[i], attr);
      if (value) return value;
    }
    return '';
  }

  function cleanText(raw, max) {
    var text = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return max ? text.slice(0, max).trim() : text;
  }

  function textFromElement(el) {
    return cleanText(el ? el.textContent : '');
  }

  function absoluteHttpUrl(raw) {
    var value = (raw || '').trim();
    if (!value || /^data:|^blob:|^javascript:/i.test(value)) return '';
    try {
      var url = new URL(value, document.baseURI || location.href);
      return /^https?:$/.test(url.protocol) ? url.toString() : '';
    } catch (_) {
      return '';
    }
  }

  function srcFromSrcset(raw) {
    var set = (raw || '').split(',').map(function (part) { return part.trim(); }).filter(Boolean);
    if (!set.length) return '';
    return set[set.length - 1].split(/\s+/)[0] || '';
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function hasBadImageHint(text) {
    return /(^|[-_/.])(logo|favicon|icon|sprite|avatar|head|wechat|weixin|wx|qrcode|qr-code|qr|loading|placeholder|blank|default|advert|ad-|ads|sponsor)([-_/.]|$)/i.test(text || '');
  }

  function hasBadTitleHint(text) {
    return /(^|[\s\-_·|｜>»/])(logo|favicon|首页|主页|导航|菜单|分类|栏目|列表|index)([\s\-_·|｜>»/]|$)/i.test(text || '');
  }

  function inNonContentArea(img) {
    return !!(img && img.closest && img.closest('header,nav,footer,aside,.header,.nav,.navbar,.footer,.sidebar,.side,.widget,.ad,.ads,.advert,.sponsor'));
  }

  function imageFromElement(img) {
    if (!img) return '';
    if (inNonContentArea(img)) return '';
    if (img.complete && img.naturalWidth && img.naturalHeight && img.naturalWidth < 80 && img.naturalHeight < 80) return '';
    var candidates = [
      img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-url'),
      srcFromSrcset(img.getAttribute('data-srcset')),
      srcFromSrcset(img.getAttribute('srcset')),
      img.currentSrc,
      img.getAttribute('src')
    ];
    var commonHint = [
      img.getAttribute('class'),
      img.getAttribute('id'),
      img.getAttribute('alt'),
      img.getAttribute('title')
    ].join(' ');
    var w = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '', 10) || 0;
    var h = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '', 10) || 0;
    if (w && h) {
      if (w < 160 || h < 100) return '';
      var ratio = w / h;
      if (ratio > 4.8 || ratio < 0.22) return '';
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var raw = candidates[i];
      var url = absoluteHttpUrl(raw);
      if (!url) continue;
      if (/\.svg(?:[?#].*)?$/i.test(url)) continue;
      if (hasBadImageHint([commonHint, raw, url].join(' '))) continue;
      return url;
    }
    return '';
  }

  function siteName() {
    return firstMeta([
      'meta[property="og:site_name"]',
      'meta[name="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]',
    ]) || '';
  }

  function normalizeTitleCandidate(raw) {
    var title = cleanText(raw, 180);
    if (!title) return '';

    var site = cleanText(siteName(), 80);
    if (site) {
      var escaped = escapeRegExp(site);
      var prefix = new RegExp('^' + escaped + '\\s*[|｜·>»_\\-–—]+\\s*', 'i');
      var suffix = new RegExp('\\s*[|｜·>»_\\-–—]+\\s*' + escaped + '$', 'i');
      title = title.replace(prefix, '').replace(suffix, '');
    }

    title = title.replace(/^\s*[|｜·>»_\\-–—]+\s*|\s*[|｜·>»_\\-–—]+\s*$/g, '').trim();
    if (hasBadTitleHint(title)) return '';
    return cleanText(title, 140);
  }

  function textBySelector(selector) {
    if (!selector) return '';
    try {
      var node = document.querySelector(selector);
      return textFromElement(node);
    } catch (_) {
      return '';
    }
  }

  function imageScore(img) {
    var w = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '', 10) || 1;
    var h = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '', 10) || 1;
    var score = w * h;
    var hint = [img.getAttribute('class'), img.getAttribute('id'), img.getAttribute('alt'), img.getAttribute('src')].join(' ');
    if (/cover|thumb|article|post|content|pic|photo|image/i.test(hint)) score += 200000;
    return score;
  }

  function bestImageIn(root) {
    if (!root || !root.querySelectorAll) return '';
    var imgs = root.querySelectorAll('img');
    var best = '';
    var bestScore = 0;
    for (var i = 0; i < imgs.length; i += 1) {
      var url = imageFromElement(imgs[i]);
      if (!url) continue;
      var score = imageScore(imgs[i]);
      if (!best || score > bestScore) {
        best = url;
        bestScore = score;
      }
    }
    return best;
  }

  function bestTitleIn(root) {
    if (!root || !root.querySelectorAll) return '';
    var selectors = [
      'h1',
      '.article-title',
      '.content-title',
      '.post-title',
      '.entry-title',
      '.detail-title',
      '.news-title',
      '.news_title',
      '.arc-title',
      '.arc_title',
      '.article_tit',
      '.title',
      '[itemprop="headline"]',
    ];
    var best = '';
    var bestScore = 0;
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = root.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var el = nodes[j];
        if (inNonContentArea(el)) continue;
        var text = normalizeTitleCandidate(textFromElement(el));
        if (!text || text.length < 2) continue;
        if (/^(首页|主页|列表|分类|栏目|导航|菜单|详情)$/i.test(text)) continue;
        var score = text.length + (/title|headline|article-title|post-title|entry-title/i.test(el.className || '') ? 20 : 0);
        if (score > bestScore) {
          best = text;
          bestScore = score;
        }
      }
    }
    return best;
  }

  function firstContentTitle(el) {
    var selectors = [
      'article',
      'main',
      '[role="main"]',
      '.article',
      '.entry',
      '.entry-content',
      '.post',
      '.post-content',
      '.article-content',
      '.article-body',
      '.content',
      '.detail',
      '.news-detail',
      '.body',
      '.text'
    ];
    if (el && el.closest) {
      for (var c = 0; c < selectors.length; c += 1) {
        var near = el.closest(selectors[c]);
        var nearTitle = bestTitleIn(near);
        if (nearTitle) return nearTitle;
      }
    }
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var title = bestTitleIn(nodes[j]);
        if (title) return title;
      }
    }
    return bestTitleIn(document.body);
  }

  function imageBySelector(selector) {
    try {
      var target = selector ? document.querySelector(selector) : null;
      if (!target) return '';
      if (target.tagName && target.tagName.toLowerCase() === 'img') return imageFromElement(target);
      return bestImageIn(target);
    } catch (_) {
      return '';
    }
  }

  function firstContentImage(el) {
    var containerSelector = [
      'article',
      'main',
      '[role="main"]',
      '.article',
      '.entry',
      '.entry-content',
      '.post',
      '.post-content',
      '.article-content',
      '.article-body',
      '.content',
      '.detail',
      '.news-detail',
      '.body',
      '.text'
    ];
    if (el && el.closest) {
      for (var c = 0; c < containerSelector.length; c += 1) {
        var near = el.closest(containerSelector[c]);
        var nearImage = bestImageIn(near);
        if (nearImage) return nearImage;
      }
    }
    for (var i = 0; i < containerSelector.length; i += 1) {
      var nodes = document.querySelectorAll(containerSelector[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var url = bestImageIn(nodes[j]);
        if (url) return url;
      }
    }
    return bestImageIn(document.body);
  }

  function autoImage(el) {
    var explicit = absoluteHttpUrl(el.getAttribute('data-image'));
    if (explicit) return explicit;
    var selected = imageBySelector(el.getAttribute('data-image-selector') || el.getAttribute('data-saotie-image-selector'));
    if (selected) return selected;
    var contentImage = firstContentImage(el);
    if (contentImage) return contentImage;
    var metaImage = absoluteHttpUrl(firstMeta([
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image:src"]',
        'meta[property="twitter:image:src"]'
      ])) || absoluteHttpUrl(meta('link[rel="image_src"]', 'href'));
    return hasBadImageHint(metaImage) ? '' : metaImage;
  }

  function autoTitle(el) {
    var explicit = normalizeTitleCandidate(el.getAttribute('data-title'));
    if (explicit) return explicit;
    var selected = normalizeTitleCandidate(
      textBySelector(el.getAttribute('data-title-selector') || el.getAttribute('data-saotie-title-selector'))
    );
    if (selected) return selected;
    var contentTitle = firstContentTitle(el);
    if (contentTitle) return contentTitle;
    var metaTitle = normalizeTitleCandidate(firstMeta([
      'meta[property="og:title"]',
      'meta[name="og:title"]',
      'meta[property="twitter:title"]',
      'meta[name="twitter:title"]',
    ]));
    if (metaTitle) return metaTitle;
    return normalizeTitleCandidate(document.title);
  }

  function canonicalUrl() {
    return absoluteHttpUrl(meta('link[rel="canonical"]', 'href')) || location.href;
  }

  function payloadFrom(el) {
    return {
      url: absoluteHttpUrl(el.getAttribute('data-url')) || canonicalUrl(),
      title: autoTitle(el),
      summary: el.getAttribute('data-summary') || firstMeta(['meta[property="og:description"]', 'meta[name="og:description"]', 'meta[name="twitter:description"]', 'meta[name="description"]']),
      image: autoImage(el),
      type: el.getAttribute('data-type') || '文章'
    };
  }

  function shareUrl(payload) {
    var params = new URLSearchParams();
    params.set('embedded', '1');
    ['url', 'title', 'summary', 'image', 'type'].forEach(function (key) {
      if (payload[key]) params.set(key, payload[key]);
    });
    return origin + '/share?' + params.toString();
  }

  function closeOverlay() {
    var old = document.getElementById(OVERLAY_ID);
    if (old) old.remove();
    document.documentElement.style.overflow = '';
  }

  function openShare(payload) {
    ensureStyle();
    closeOverlay();
    var mask = document.createElement('div');
    mask.id = OVERLAY_ID;
    mask.className = 'saotie-share-mask';
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeOverlay();
    });

    var wrap = document.createElement('div');
    wrap.className = 'saotie-share-frame-wrap';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'saotie-share-close';
    close.setAttribute('aria-label', '关闭');
    close.textContent = '×';
    close.addEventListener('click', closeOverlay);

    var iframe = document.createElement('iframe');
    iframe.className = 'saotie-share-frame';
    iframe.allow = 'clipboard-write';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = shareUrl(payload);

    wrap.appendChild(close);
    wrap.appendChild(iframe);
    mask.appendChild(wrap);
    document.body.appendChild(mask);
    document.documentElement.style.overflow = 'hidden';
  }

  function renderOne(el) {
    if (!el || el.getAttribute('data-saotie-ready') === '1') return;
    ensureStyle();
    el.setAttribute('data-saotie-ready', '1');
    var size = parseInt(el.getAttribute('data-size') || '', 10) || 36;
    var color = el.getAttribute('data-color') || '#8b5cf6';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saotie-share-btn';
    btn.title = el.getAttribute('data-label') || '分享到 Saotie';
    btn.setAttribute('aria-label', btn.title);
    btn.style.setProperty('--saotie-share-size', size + 'px');
    btn.style.setProperty('--saotie-share-color', color);
    btn.innerHTML = LIGHTNING;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openShare(payloadFrom(el));
    });
    el.textContent = '';
    el.appendChild(btn);
  }

  function init(root) {
    ensureStyle();
    var nodes = (root || document).querySelectorAll('[data-saotie-share]');
    for (var i = 0; i < nodes.length; i += 1) renderOne(nodes[i]);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return;
    var type = event.data && event.data.type;
    if (type === 'saotie-share:close' || type === 'saotie-share:success') {
      closeOverlay();
      if (type === 'saotie-share:success') {
        window.dispatchEvent(new CustomEvent('saotie-share-success', { detail: event.data }));
      }
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOverlay();
  });

  window.SaotieShare = window.SaotieShare || {};
  window.SaotieShare.init = init;
  window.SaotieShare.open = openShare;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
