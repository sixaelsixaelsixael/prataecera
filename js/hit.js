/* Prata + Cera - click only on the visible parts of transparent images.
   Mark a link with data-mask="name"; it then uses masks/name.png (white = clickable).
   Loaded by site.js only on pages that have such links. */
(function () {
  var d = document, src = d.currentScript && d.currentScript.src;
  function maskURL(k) { return new URL('../masks/' + k + '.png', src || location.href).href; }

  [].forEach.call(d.querySelectorAll('a[data-mask]'), function (a) {
    var img = a.querySelector('img');
    if (!img) return;
    var m = null, st = 0;                     /* 0 idle, 1 loading, 2 ready, 3 failed */
    a.classList.add('px');

    function load() {
      if (st) return;
      st = 1;
      var i = new Image();
      i.onload = function () {
        try {
          var c = d.createElement('canvas');
          c.width = i.naturalWidth; c.height = i.naturalHeight;
          var x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(i, 0, 0);
          m = { w: c.width, h: c.height, p: x.getImageData(0, 0, c.width, c.height).data };
          st = 2;
        } catch (e) { st = 3; a.classList.add('hit'); }
      };
      i.onerror = function () { st = 3; a.classList.add('hit'); };
      i.src = maskURL(a.getAttribute('data-mask'));
    }

    function over(e) {                        /* is the pointer on a visible part? */
      if (st !== 2) return true;              /* no mask (yet): act like a normal link */
      var r = img.getBoundingClientRect();
      var x = Math.floor((e.clientX - r.left) / r.width * m.w);
      var y = Math.floor((e.clientY - r.top) / r.height * m.h);
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
      return m.p[(y * m.w + x) * 4] > 127;
    }

    a.addEventListener('pointerenter', load);
    a.addEventListener('touchstart', load, { passive: true });
    a.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'touch') a.classList.toggle('hit', over(e));
    });
    a.addEventListener('pointerleave', function () { if (st === 2) a.classList.remove('hit'); });
    a.addEventListener('click', function (e) {
      if (e.detail === 0) return;             /* keyboard (Enter) always works */
      if (!over(e)) e.preventDefault();
    });
    window.addEventListener('load', function () { setTimeout(load, 400); });
  });
})();
