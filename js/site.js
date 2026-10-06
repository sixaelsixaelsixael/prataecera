/* Prata + Cera - global theme + language controls (loaded at the top of <body>) */
(function () {
  var d = document, h = d.documentElement, cs = d.currentScript;
  var base = cs && cs.src ? cs.src.replace(/site\.js.*$/, '') : 'js/';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var lang = store.get('lang') === 'pt' ? 'pt' : 'en';
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

  function paint() {
    var dark = h.dataset.theme === 'dark', t = TXT[lang];
    th.textContent = dark ? '\u2600\uFE0E' : '\u263E';
    th.title = dark ? t.light : t.dark;
    th.setAttribute('aria-label', th.title);
    lg.innerHTML = '<span' + (lang === 'en' ? ' class="on"' : '') + '>EN</span> / <span' + (lang === 'pt' ? ' class="on"' : '') + '>PT</span>';
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
  if (!h.dataset.theme) {
    h.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  th.addEventListener('click', function () {
    var n = h.dataset.theme === 'dark' ? 'light' : 'dark';
    h.dataset.theme = n;
    store.set('theme', n);
    paint();
  });
  lg.addEventListener('click', function () { setLang(lang === 'en' ? 'pt' : 'en'); });
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!store.get('theme')) { h.dataset.theme = e.matches ? 'dark' : 'light'; paint(); }
    });
  } catch (e) {}

  paint();
  if (lang === 'pt') load(function () { onDom(apply); });
  else onDom(function () { h.classList.add('i18n-ready'); });
})();
