/* =====================================================================
   Space Impact — donation widget (「请作者喝杯咖啡」)
   Footer entry → dialog → Alipay/WeChat Pay tabs → QR generated
   in the browser from the raw receive-money link.
   - No static QR images anywhere; the QR library is lazy-loaded on
     first dialog open, so the start screen pays zero cost.
   - Mobile Alipay opens the official https receive page (once per
     dialog session); the QR stays visible as the natural fallback.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var t = function (key, params) { return SI.i18n.t(key, params); };

  /* Receive-money links — the single source of truth. The wxp:// string
     is a QR payload only; it is never used for navigation. */
  var DONATION_CONFIG = {
    alipay: {
      i18nName: 'donateAlipay',
      qrContent: 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79'
    },
    wechat: {
      i18nName: 'donateWechatPay',
      qrContent: 'wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM'
    }
  };

  var QR_LIB_URL = 'js/vendor/qrcode-generator.js';
  var QR_DISPLAY_SIZE = 220;    /* rendered size in px */
  var QR_ECC = 'M';             /* error correction level M */
  var QR_QUIET_MODULES = 4;     /* quiet zone ≥ 4 modules */

  var overlay, tabAlipay, tabWechat, canvas, hintEl, entryBtn;
  var currentChannel = 'alipay';
  var qrLibPromise = null;
  var attemptedOpen = false;    /* at most one Alipay jump per dialog session */
  var lastFocused = null;

  function isMobileUA() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isOpen() {
    return overlay && !overlay.hidden;
  }

  function playUi() {
    if (SI.audio && SI.audio.play) {
      SI.audio.unlock();
      SI.audio.play('ui');
    }
  }

  /* ── texts ─────────────────────────────────── */

  function applyTexts() {
    /* title/subtitle/tabs carry data-i18n and refresh themselves;
       only the dynamic hint and the QR label are managed here */
    updateHint();
    canvas.setAttribute('aria-label',
      t('donateQrAlt', { channel: t(DONATION_CONFIG[currentChannel].i18nName) }));
  }

  function updateHint() {
    /* mobile Alipay gets the "didn't open?" hint since a jump was
       attempted; every other case shows the scan hint. The QR is
       always visible, so there is no dead end either way. */
    if (currentChannel === 'alipay' && isMobileUA()) {
      hintEl.textContent = t('donateFallbackHint');
    } else {
      hintEl.textContent = t(currentChannel === 'alipay' ? 'donateScanAlipay' : 'donateScanWechat');
    }
  }

  /* ── QR (generated live in the browser) ────── */

  function loadQrLib() {
    if (global.qrcode) return Promise.resolve();
    if (!qrLibPromise) {
      qrLibPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = QR_LIB_URL;
        script.onload = function () { resolve(); };
        script.onerror = function () {
          qrLibPromise = null;
          reject(new Error('QR library failed to load'));
        };
        document.head.appendChild(script);
      });
    }
    return qrLibPromise;
  }

  function drawQrCode(channel) {
    loadQrLib().then(function () {
      var qr = global.qrcode(0, QR_ECC);   /* typeNumber 0 = auto */
      qr.addData(DONATION_CONFIG[channel].qrContent);
      qr.make();

      var modules = qr.getModuleCount();
      var total = modules + QR_QUIET_MODULES * 2;
      /* integer scale keeps module edges sharp; canvas ends up ≤ 220px */
      var px = Math.max(1, Math.floor(QR_DISPLAY_SIZE / total));
      var canvasSize = px * total;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;   /* no canvas 2d → hint text still carries the message */

      ctx.fillStyle = '#ffffff';   /* light background */
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = '#111111';   /* dark modules — contrast over theme */
      for (var row = 0; row < modules; row++) {
        for (var col = 0; col < modules; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect((col + QR_QUIET_MODULES) * px, (row + QR_QUIET_MODULES) * px, px, px);
          }
        }
      }
    }).catch(function () {
      hintEl.textContent = t('donateQrError');
    });
  }

  /* ── dialog ────────────────────────────────── */

  function renderTabs() {
    tabAlipay.classList.toggle('active', currentChannel === 'alipay');
    tabAlipay.setAttribute('aria-pressed', String(currentChannel === 'alipay'));
    tabWechat.classList.toggle('active', currentChannel === 'wechat');
    tabWechat.setAttribute('aria-pressed', String(currentChannel === 'wechat'));
  }

  function openDialog(channel) {
    currentChannel = channel || 'alipay';
    attemptedOpen = false;
    lastFocused = document.activeElement;
    overlay.hidden = false;
    renderTabs();
    applyTexts();
    drawQrCode(currentChannel);
    if (currentChannel === 'alipay') attemptAlipayOpen();
    (currentChannel === 'alipay' ? tabAlipay : tabWechat).focus();
  }

  function closeDialog() {
    overlay.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function switchChannel(channel) {
    if (currentChannel === channel) return;
    currentChannel = channel;
    playUi();
    renderTabs();
    applyTexts();
    drawQrCode(channel);
    if (channel === 'alipay') attemptAlipayOpen();
    (channel === 'alipay' ? tabAlipay : tabWechat).focus();
  }

  /* Mobile Alipay: open the official receive-money https link and let
     Alipay's own page handle the app handoff. No custom URL scheme is
     constructed; the QR in the dialog is the always-on fallback. */
  function attemptAlipayOpen() {
    if (attemptedOpen || !isMobileUA()) return;
    attemptedOpen = true;
    global.open(DONATION_CONFIG.alipay.qrContent, '_blank', 'noopener');
  }

  /* ── init ──────────────────────────────────── */

  function bind() {
    overlay = document.getElementById('donation-dialog');
    tabAlipay = document.getElementById('donation-tab-alipay');
    tabWechat = document.getElementById('donation-tab-wechat');
    canvas = document.getElementById('donation-qr');
    hintEl = document.getElementById('donation-hint');
    entryBtn = document.getElementById('donate-entry');

    entryBtn.addEventListener('click', function () {
      playUi();
      openDialog('alipay');
    });
    tabAlipay.addEventListener('click', function () { switchChannel('alipay'); });
    tabWechat.addEventListener('click', function () { switchChannel('wechat'); });
    document.getElementById('donation-close').addEventListener('click', closeDialog);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDialog();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closeDialog();
    });
    document.addEventListener('langchange', function () {
      if (isOpen()) applyTexts();   /* static texts refresh via data-i18n */
    });
  }

  bind();

  /* exposed for tests / other widgets that need to yield to the dialog */
  SI.Donation = {
    isOpen: isOpen,
    open: openDialog,
    close: closeDialog,
    config: DONATION_CONFIG
  };
})(typeof window !== 'undefined' ? window : globalThis);
