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

  function imageFromElement(img) {
    if (!img) return '';
    if (img.complete && img.naturalWidth && img.naturalHeight && img.naturalWidth < 80 && img.naturalHeight < 80) return '';
    var raw = img.currentSrc ||
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-url') ||
      srcFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
    var url = absoluteHttpUrl(raw);
    if (/\.svg(?:[?#].*)?$/i.test(url)) return '';
    return url;
  }

  function firstContentImage() {
    var selectors = [
      'article img',
      'main img',
      '.article img',
      '.entry img',
      '.entry-content img',
      '.post img',
      '.post-content img',
      '.article-content img',
      '.content img',
      '.detail img',
      'img'
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var imgs = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < imgs.length; j += 1) {
        var url = imageFromElement(imgs[j]);
        if (url) return url;
      }
    }
    return '';
  }

  function autoImage(el) {
    return absoluteHttpUrl(el.getAttribute('data-image')) ||
      absoluteHttpUrl(firstMeta([
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image:src"]',
        'meta[property="twitter:image:src"]'
      ])) ||
      absoluteHttpUrl(meta('link[rel="image_src"]', 'href')) ||
      firstContentImage();
  }

  function canonicalUrl() {
    return absoluteHttpUrl(meta('link[rel="canonical"]', 'href')) || location.href;
  }

  function payloadFrom(el) {
    return {
      url: absoluteHttpUrl(el.getAttribute('data-url')) || canonicalUrl(),
      title: el.getAttribute('data-title') || firstMeta(['meta[property="og:title"]', 'meta[name="og:title"]', 'meta[name="twitter:title"]']) || document.title,
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
