/* Prata + Cera - global theme + language controls (loaded at the top of <body>) */
(function () {
  var d = document, h = d.documentElement, cs = d.currentScript;
  var base = cs && cs.src ? cs.src.replace(/site\.js.*$/, '') : 'js/';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var lang = store.get('lang') === 'pt' ? 'pt' : 'en';

  /* FLAG BUTTONS (optional): when your flag images are ready, put the full address of each one
     between the quotes. Leave both empty to keep the text EN / PT. */
  var FLAGS = { en: '', pt: '' };
  var TXT = {
    en: { dark: 'Switch to dark mode', light: 'Switch to light mode', lang: 'Switch to Portuguese (Brazil)' },
    pt: { dark: 'Mudar para o modo escuro', light: 'Mudar para o modo claro', lang: 'Mudar para ingl\u00eas' }
  };

  function onDom(fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn); else fn();
  }

  /* ---- build the buttons (inserted synchronously, so the page never jumps) ---- */
  var nav = d.createElement('div');
  nav.className = 'site-controls';
  var th = d.createElement('button'), lg = d.createElement('button');
  th.type = lg.type = 'button';
  th.className = lg.className = 'ctl';
  nav.appendChild(th); nav.appendChild(lg);
  d.body.insertBefore(nav, d.body.firstChild);

  function flag(code) {
    var f = FLAGS[code];
    return '<span' + (lang === code ? ' class="on"' : '') + '>' +
      (f ? '<img src="' + f + '" alt="" height="16">' : code.toUpperCase()) + '</span>';
  }

  function paint() {
    var dark = h.dataset.theme === 'dark', t = TXT[lang], flags = !!(FLAGS.en && FLAGS.pt);
    th.textContent = dark ? '\u263E' : '\u2600\uFE0E';        /* moon = dark mode, sun = light mode */
    th.title = dark ? t.light : t.dark;                          /* tooltip says what a click does */
    th.setAttribute('aria-label', th.title);
    lg.classList.toggle('flags', flags);
    lg.innerHTML = flag('en') + (flags ? '' : ' / ') + flag('pt');
    lg.title = t.lang;
    lg.setAttribute('aria-label', t.lang);
  }

  /* ---- language ---- */
  function load(cb) {
    if (window.PT) return cb();
    var s = d.createElement('script');
    s.src = base + 'lang-pt.js';
    s.onload = s.onerror = cb;
    d.head.appendChild(s);
  }

  function apply() {
    var P = lang === 'pt' ? window.PT : null;
    [].forEach.call(d.querySelectorAll('[data-i18n]'), function (el) {
      var isTitle = el.tagName === 'TITLE';
      if (el._en === undefined) el._en = isTitle ? el.textContent : el.innerHTML;
      var v = P && P[el.getAttribute('data-i18n')];
      v = v == null ? el._en : v;
      if (isTitle) d.title = v; else el.innerHTML = v;
    });
    [].forEach.call(d.querySelectorAll('[data-i18n-alt]'), function (el) {
      if (el._alt === undefined) el._alt = el.getAttribute('alt');
      var v = P && P[el.getAttribute('data-i18n-alt')];
      el.setAttribute('alt', v == null ? el._alt : v);
    });
    h.lang = lang === 'pt' ? 'pt-BR' : 'en';
    h.dataset.lang = lang;
    h.classList.add('i18n-ready');
  }

  function setLang(l) {
    lang = l;
    store.set('lang', l);
    paint();
    if (l === 'pt') load(function () { onDom(apply); }); else onDom(apply);
  }

  /* ---- theme ---- */
  if (!h.dataset.theme) h.dataset.theme = 'light';
  th.addEventListener('click', function () {
    var n = h.dataset.theme === 'dark' ? 'light' : 'dark';
    h.dataset.theme = n;
    store.set('theme', n);
    paint();
  });
  lg.addEventListener('click', function () { setLang(lang === 'en' ? 'pt' : 'en'); });

  /* pixel-accurate link areas (only loads when a page uses data-mask links) */
  onDom(function () {
    if (d.querySelector('a[data-mask]')) {
      var hs = d.createElement('script');
      hs.src = base + 'hit.js';
      d.head.appendChild(hs);
    }
  });

  paint();
  if (lang === 'pt') load(function () { onDom(apply); });
  else onDom(function () { h.classList.add('i18n-ready'); });
})();
