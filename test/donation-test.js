/* Donation widget tests — run: node test/donation-test.js
   Part 1 (always, zero-dependency): contract assertions that keep the
     donation feature compliant — no static QR images, no alipays://
     scheme, lazy-loaded QR lib only, zh/en key parity, class/CSS parity.
   Part 2 (optional): jsdom drives the real index.html scripts. Skipped
     with a notice when jsdom is not resolvable; install it somewhere and
     point NODE_PATH there for the full run, e.g.
       NODE_PATH=/tmp/node-deps/node_modules node test/donation-test.js */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var fails = 0, total = 0;

function check(cond, msg) {
  total++;
  if (!cond) { fails++; console.error('FAIL: ' + msg); }
}

/* ═══ Part 1 — contract assertions (no dependencies) ═══════════════ */

var donationJs = fs.readFileSync(path.join(ROOT, 'js/donation.js'), 'utf8');
var appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

check(!/alipays:\/\//.test(donationJs + appJs + html), 'no alipays:// scheme anywhere in donation code');
check(!/\.(png|jpe?g|svg)/i.test(donationJs), 'donation.js references no image files');
check(!/donate\//.test(html + appJs + donationJs), 'no donate/ static QR references remain');
check(!fs.existsSync(path.join(ROOT, 'donate')), 'donate/ directory removed');
check(!/<script[^>]*qrcode-generator/.test(html), 'QR lib not loaded in index.html (lazy-load only)');
check(donationJs.indexOf('js/vendor/qrcode-generator.js') !== -1, 'donation.js lazy-loads the vendored QR lib');
check(donationJs.indexOf("'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79'") !== -1, 'alipay receive link configured');
check(donationJs.indexOf("'wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM'") !== -1, 'wechat receive link configured');
check(html.indexOf('id="donate-entry"') !== -1 && /data-i18n="donateEntry"/.test(html), 'footer entry button present with i18n');

/* i18n: zh/en key sets identical + spec-exact entry/title copy */
global.window = global;
require('../js/i18n.js');
var DICT = global.SI.i18n.DICT;
var enKeys = Object.keys(DICT.en).sort().join(',');
var zhKeys = Object.keys(DICT.zh).sort().join(',');
check(enKeys === zhKeys, 'i18n zh/en key sets identical');
check(DICT.zh.donateEntry === '☕ 请作者喝杯咖啡', 'zh entry copy is spec-exact');
check(DICT.en.donateEntry === '☕ Buy me a coffee', 'en entry copy is spec-exact');
check(DICT.zh.donateTitle === '请作者喝杯咖啡 ☕' && DICT.en.donateTitle === 'Buy me a coffee ☕', 'dialog titles spec-exact');
['donateSubtitle', 'donateAlipay', 'donateWechatPay', 'donateScanAlipay',
 'donateScanWechat', 'donateFallbackHint', 'donateQrAlt', 'donateQrError', 'donateClose']
  .forEach(function (k) {
    check(DICT.en[k] && DICT.zh[k], 'i18n key present in both langs: ' + k);
  });

/* class-name parity between markup and stylesheet (donation block) */
var usedClasses = {};
html.replace(/class="([^"]*)"/g, function (_, cls) {
  cls.split(/\s+/).forEach(function (c) {
    if (/^donat/.test(c)) usedClasses[c] = true;
  });
  return _;
});
Object.keys(usedClasses).forEach(function (c) {
  check(css.indexOf('.' + c) !== -1, 'class has a CSS rule: ' + c);
});

/* ═══ Part 2 — jsdom interaction tests (optional) ══════════════════ */

var jsdom = null;
try { jsdom = require('jsdom'); } catch (e) { jsdom = null; }

if (!jsdom) {
  console.log('jsdom not resolvable — skipping interaction tests ' +
    '(NODE_PATH=<dir with jsdom> node test/donation-test.js)');
  done();
} else {
  interact();
}

function done() {
  console.log('donation tests: ' + (total - fails) + '/' + total + ' passed' + (fails ? (' — ' + fails + ' FAILED') : ''));
  process.exit(fails ? 1 : 0);
}

function interact() {
  var JSDOM = jsdom.JSDOM;
  var vc = new jsdom.VirtualConsole();
  var seen = {};
  vc.on('jsdomError', function (e) {
    if (/Not implemented/.test(e.message)) return;   /* canvas 2d absent without node-canvas */
    if (!seen[e.message]) { seen[e.message] = true; console.error('jsdomError: ' + e.message); }
  });

  var dom = new JSDOM(html, {
    url: 'file://' + path.join(ROOT, 'index.html'),
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse: function (w) {
      if (!w.fetch) w.fetch = function () { return Promise.reject(new Error('offline test')); };
    }
  });
  var w = dom.window, d = w.document;

  /* jsdom can fire `load` twice for file:// pages — run the suite once */
  var started = false;
  w.addEventListener('load', function () {
    if (started) return;
    started = true;
    run().then(done, function (err) { fails++; console.error('FAIL: interaction suite crashed: ' + err); done(); });
  });

  function $(id) { return d.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); }
  function until(cond) {
    return (function poll(i) {
      return cond() ? Promise.resolve(true) : (i > 100 ? Promise.resolve(false) : sleep(10).then(function () { return poll(i + 1); }));
    })(0);
  }

  function run() {
    var overlay = $('donation-dialog'), entry = $('donate-entry');
    var tabA = $('donation-tab-alipay'), tabW = $('donation-tab-wechat');
    var canvas = $('donation-qr'), hint = $('donation-hint');

    return until(function () { return w.SI && w.SI.Donation; })
      .then(function (booted) {
        check(booted, 'page scripts booted, SI.Donation exposed');
        if (!booted) return;

        /* QR lib absent from DOM before the dialog ever opens */
        check(!d.querySelector('script[src*="qrcode-generator"]'), 'QR lib script not in DOM before first open');

        /* T1 — entry copy (default en markup) */
        check(entry.textContent === '☕ Buy me a coffee', 'T1 footer entry text (en)');

        /* T2 — open via entry click: dialog, tabs, hint, focus.
           jsdom's .click() does not move focus; real browsers focus the
           clicked button, so focus it explicitly before clicking. */
        entry.focus();
        entry.click();
        check(!overlay.hidden, 'T2 dialog opens on entry click');
        check(tabA.getAttribute('aria-pressed') === 'true' && tabW.getAttribute('aria-pressed') === 'false', 'T2 alipay tab active');
        check(hint.textContent === 'Scan with Alipay', 'T2 desktop alipay hint');
        check(canvas.getAttribute('aria-label') === 'Alipay tip QR code', 'T2 canvas aria-label');
        check(d.activeElement === tabA, 'T2 focus moved into dialog');

        /* T3 — QR lib lazy-injected and executed */
        check(!!d.querySelector('script[src*="qrcode-generator"]'), 'T3 QR lib script injected after open');
        return until(function () { return typeof w.qrcode === 'function'; })
          .then(function (loaded) { check(loaded, 'T3 QR lib executed (window.qrcode)'); });
      })
      .then(function () {
        if (!w.SI || !w.SI.Donation) return;

        /* T4 — desktop never calls window.open */
        var opens = [];
        w.open = function (u, t, f) { opens.push([u, t, f]); return {}; };
        w.SI.Donation.close(); w.SI.Donation.open();
        check(opens.length === 0, 'T4 desktop: no window.open');

        /* T5 — channel switch */
        tabW.click();
        check(tabW.getAttribute('aria-pressed') === 'true' && tabA.getAttribute('aria-pressed') === 'false', 'T5 wechat tab active');
        check(hint.textContent === 'Scan with WeChat', 'T5 wechat hint');
        check(canvas.getAttribute('aria-label') === 'WeChat Pay tip QR code', 'T5 canvas label follows channel');
        tabA.click();
        check(hint.textContent === 'Scan with Alipay', 'T5 back to alipay hint');

        /* T6 — ESC closes and focus returns to the entry */
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
        check(overlay.hidden, 'T6 ESC closes dialog');
        check(d.activeElement === entry, 'T6 focus returned to entry');

        /* T7 — overlay click closes */
        w.SI.Donation.open();
        overlay.click();
        check(overlay.hidden, 'T7 overlay click closes');

        /* T8 — mobile UA: alipay opens official link once per session */
        Object.defineProperty(w.navigator, 'userAgent', {
          get: function () { return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1'; }
        });
        check(/Mobi|Android|iPhone|iPad|iPod/.test(w.navigator.userAgent), 'T8 mobile UA override active');
        var opens2 = [];
        w.open = function (u, t, f) { opens2.push([u, t, f]); return {}; };
        w.SI.Donation.open('alipay');
        check(opens2.length === 1 && opens2[0][0] === 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79' &&
              opens2[0][1] === '_blank' && opens2[0][2] === 'noopener', 'T8 mobile alipay: official https link, _blank noopener');
        check(hint.textContent === 'Didn’t open automatically? Scan the QR code instead.', 'T8 mobile alipay fallback hint');
        tabW.click();
        check(opens2.length === 1, 'T8 mobile wechat: no navigation attempt');
        tabA.click();
        check(opens2.length === 1, 'T8 same dialog session: no repeat jump');
        w.SI.Donation.close();
        w.SI.Donation.open('alipay');
        check(opens2.length === 2, 'T8 new dialog session: jump allowed again');

        /* T9 — language switch updates dialog texts (zh) */
        w.SI.i18n.setLang('zh');
        check(entry.textContent === '☕ 请作者喝杯咖啡', 'T9 zh entry copy');
        check($('donation-dialog').querySelector('.donation-title').textContent === '请作者喝杯咖啡 ☕', 'T9 zh title via data-i18n');
        tabW.click();
        check(hint.textContent === '打开微信扫一扫', 'T9 zh hint follows langchange');
        w.SI.i18n.setLang('en');
        check(hint.textContent === 'Scan with WeChat', 'T9 back to en hint');
      });
  }
}
