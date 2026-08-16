// Photo tryout - try real photos on the phone, without a build and without a push.
//
// The menu's photos are files under assets/menu/opt, so answering "does this
// shot work in the tile?" costs an edit, a rebuild and a deploy. That loop is
// too slow for a question you can only settle by looking at it on the device the
// menu is actually read on, which is a phone held at arm's length in a cafe.
//
// <image-slot> already does the hard half: it takes a picked file, downscales it
// through a canvas and shows it in the frame. What it cannot do on a static host
// is REMEMBER it. The component reads its state from a .image-slots.state.json
// sidecar and writes it back through window.omelette.writeFile, which exists
// only inside the design-canvas tool - so on GitHub Pages every slot is
// read-only and a pick is gone on the next scroll. This file supplies that
// missing pair against IndexedDB: writes land on the phone instead of in a file,
// reads are answered from the phone instead of from the network. image-slot.js
// itself is not touched - README is explicit that the canvas tool owns it.
//
// OFF unless asked for. Open a page with ?photos to arm it; it stays armed on
// that device until ?photos=off. It refuses to arm anywhere but GitHub Pages and
// localhost, so a stray ?photos link can never put upload controls in front of a
// customer on lcafe-esf.ir.
(function () {
  'use strict';

  // ── Gate ────────────────────────────────────────────────────────────────
  var FLAG = 'lcafe:photo-tryout';

  function armedHost() {
    var h = location.hostname;
    // file:// has an empty hostname. Anything else is the real site.
    return !h || h === 'localhost' || h === '127.0.0.1' || /(^|\.)github\.io$/i.test(h);
  }

  // ?photos / ?photos=on arms it and is remembered; ?photos=off forgets it. No
  // parameter at all means "whatever this device last decided", which is what
  // lets the flag survive the link from the landing page to the menu.
  function armed() {
    var q = /[?&]photos(?:=([^&]*))?/i.exec(location.search);
    if (q) {
      var v = (q[1] || 'on').toLowerCase();
      var on = v !== 'off' && v !== '0' && v !== 'false';
      try {
        if (on) localStorage.setItem(FLAG, '1');
        else localStorage.removeItem(FLAG);
      } catch (e) {}
      return on;
    }
    try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
  }

  // Host before flag, so a ?photos that reached the real site leaves nothing at
  // all behind it - not even the localStorage key armed() would otherwise write
  // on its way to being ignored.
  if (!armedHost()) {
    if (/[?&]photos\b/i.test(location.search)) {
      console.info('photo tryout: ignored - it only runs on GitHub Pages and localhost.');
    }
    return;
  }
  if (!armed()) return;
  // Opened through the design-canvas tool: the real bridge owns the sidecar
  // there, and standing on top of it would send picks to IndexedDB instead of to
  // the file the tool round-trips. build.py strips the runtime from the
  // published pages, so this tag is an exact test for "this is a .dc.html".
  if (window.__resources || document.querySelector('script[src*="support.js"]')) return;

  // ── Store ───────────────────────────────────────────────────────────────
  // One row holding exactly the JSON the sidecar would. IndexedDB rather than
  // localStorage because that JSON is every picked photo inlined as a data URL:
  // a menu tile encodes to ~20 KB, but the landing photo is full-width and
  // encodes to a few hundred, and localStorage's ~5 MB ceiling is a throw, not a
  // slow degrade - it would start failing silently mid-session.
  var DB = 'lcafe-photo-tryout', STORE = 'state', ROW = 'image-slots';
  var dbP = null;

  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbP;
  }

  function row(mode, run) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var req = run(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function readState() { return row('readonly', function (s) { return s.get(ROW); }); }
  function writeState(t) { return row('readwrite', function (s) { return s.put(t, ROW); }); }
  function dropState() { return row('readwrite', function (s) { return s['delete'](ROW); }); }

  // ── The pair <image-slot> is missing ────────────────────────────────────
  // Matches the bare './x' form the component fetches and the absolute form a
  // Request object would carry.
  var STATE = /(^|\/)\.image-slots\.state\.json(\?|$)/;

  window.omelette = window.omelette || {};
  window.omelette.writeFile = function (path, content) {
    if (!STATE.test(String(path))) return Promise.resolve();
    var text = String(content);
    return writeState(text).then(function () { count(text); }, function (e) {
      console.warn('photo tryout: could not save', e);
    });
  };

  // The read is a plain fetch of a file that on this host holds "{}" and always
  // will, so it is answered from the store instead. One URL is intercepted;
  // everything else goes straight through.
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!STATE.test(url)) return realFetch(input, init);
    return readState()['catch'](function () { return null; }).then(function (text) {
      count(text);
      return new Response(text || '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  };

  // ── What the mode changes on the page ───────────────────────────────────
  var PLACEHOLDER = /item-placeholder\.webp(\?|$)/;
  var HINT = 'برای انتخاب عکس بزن';

  function dress() {
    document.querySelectorAll('image-slot').forEach(function (slot) {
      // The branded "this item has no photo yet" card is the right answer for a
      // visitor and stays in menu.html for the host. Here it is the one thing
      // standing between you and an empty slot to upload into, so it comes off
      // the element - the file and the generated markup are untouched. Both
      // attributes, because the menu defers its photos: the source sits in
      // data-src until the tile nears the viewport, then moves to src.
      if (PLACEHOLDER.test(slot.getAttribute('src') || '')) slot.removeAttribute('src');
      if (PLACEHOLDER.test(slot.getAttribute('data-src') || '')) slot.removeAttribute('data-src');

      // The empty state's second line reads "or browse files" - English, on a
      // page that is Persian throughout. It only becomes visible at all once
      // writeFile exists, which is to say only in this mode, so relabelling it
      // here is relabelling something this file is responsible for.
      if (slot.__faHint) return;
      var sub = slot.shadowRoot && slot.shadowRoot.querySelector('.sub');
      if (!sub) return;
      sub.textContent = HINT;
      slot.__faHint = true;
    });
  }

  // Coalesced to one pass per frame: dress() removes attributes, which the
  // observer sees, and the menu's own lazy loader moves data-src to src as you
  // scroll. Both settle because dress() is idempotent.
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; dress(); });
  }
  dress();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-src']
  });
  // The element upgrades after this script runs, and a shadow root that does not
  // exist yet has no .sub to relabel. define() upgrades every slot already in
  // the document before this promise resolves, so one pass here catches all of
  // them - directly, not through the frame-coalesced path, because that pass is
  // the only thing that relabels and a frame is not guaranteed to come.
  if (window.customElements) {
    customElements.whenDefined('image-slot').then(dress)['catch'](function () {});
  }

  // A filled slot's Replace button asks the host to run its own picker. There is
  // no host here, so hand it straight back to the slot's local browse.
  document.addEventListener('image-slot:pick', function (e) {
    var slot = e.target;
    if (slot && slot.openFilePicker) slot.openFilePicker();
  });

  // On a phone that Replace button is unreachable: it lives in a hover-only
  // overlay, and there is no hover. So on touch, a tap on a filled slot IS
  // replace. An empty slot already opens the picker on tap by itself, and a
  // pointer-fine device keeps the designed hover controls, where a single click
  // must stay free for the double-click that enters reframe.
  var touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (touch) {
    document.addEventListener('click', function (e) {
      var path = e.composedPath ? e.composedPath() : [];
      var slot = null;
      for (var i = 0; i < path.length; i++) {
        if (path[i] && path[i].tagName === 'IMAGE-SLOT') { slot = path[i]; break; }
      }
      if (!slot || !slot.openFilePicker) return;
      if (!slot.hasAttribute('data-filled') || slot.hasAttribute('data-reframe')) return;
      e.preventDefault();
      slot.openFilePicker();
    });
  }

  // ── The bar ─────────────────────────────────────────────────────────────
  // Says the mode is on - without it an accidental ?photos is a site that has
  // quietly started eating taps - and carries the two ways out of it.
  var host = document.createElement('div');
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    // Measured at 375px: the fuller wording ran to 361px, a bar the width of the
    // phone parked over the menu. Kept to what it has to say.
    '.bar{position:fixed;z-index:2147483000;inset-inline-start:12px;' +
    '  bottom:calc(12px + env(safe-area-inset-bottom));' +
    '  max-width:calc(100vw - 24px);' +
    '  display:flex;align-items:center;flex-wrap:wrap;gap:8px;' +
    '  padding:7px 10px;border-radius:12px;' +
    '  background:rgba(71,16,25,.92);color:#F3F1EC;' +
    "  font:400 12px/1.6 'Vazirmatn',system-ui,sans-serif;direction:rtl;" +
    '  box-shadow:0 6px 20px rgba(0,0,0,.28);backdrop-filter:blur(8px)}' +
    '.n{opacity:.7;font-size:11px}' +
    'button{appearance:none;border:1px solid rgba(243,241,236,.35);border-radius:8px;' +
    '  padding:4px 9px;background:transparent;color:inherit;font:inherit;font-size:11px;' +
    '  cursor:pointer}' +
    'button:hover{background:rgba(243,241,236,.14)}' +
    '</style>' +
    '<div class="bar">' +
    '<span>آزمایش عکس</span><span class="n"></span>' +
    '<button class="clear">پاک‌کردن</button>' +
    '<button class="off">خاموش</button>' +
    '</div>';

  var label = shadow.querySelector('.n');

  function fa(n) {
    return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.charAt(+d); });
  }

  // Read back from the same JSON the component just wrote, so the number is what
  // was actually stored rather than what was picked.
  function count(text) {
    if (!label) return;
    var n = 0;
    try {
      var o = JSON.parse(text || '{}');
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n++;
    } catch (e) {}
    label.textContent = n ? '· ' + fa(n) + ' عکس' : '· خالی';
  }
  count('{}');

  shadow.querySelector('.clear').addEventListener('click', function () {
    if (!confirm('همه‌ی عکس‌های آزمایشی این دستگاه پاک شود؟')) return;
    dropState().then(function () { location.reload(); }, function () { location.reload(); });
  });

  shadow.querySelector('.off').addEventListener('click', function () {
    try { localStorage.removeItem(FLAG); } catch (e) {}
    // Drop the query string on the way out, otherwise a ?photos still in the bar
    // re-arms the mode on the very next load.
    location.href = location.pathname;
  });

  function mount() { document.body.appendChild(host); }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
