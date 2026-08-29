/* =====================================================================
   Space Impact — save slots (三档存档)
   Three browser-local slots. A slot stores a level-boundary snapshot
   {v, levelId, loop, difficulty, carry:{score,lives,weaponLevel,
   missiles,special,maxHp}, savedAt} — the same carry shape
   advanceLevel() hands to startLevel(), so resuming is just
   startLevel(idx, loop, carry) after restoring the difficulty preset.
   The picker dialog works in two modes: 'save' (overwrite a slot with
   the live snapshot) and 'load' (continue from a slot).
   Storage half is DOM-free and node-testable; UI binds only in browser.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var t = function (key, params) { return SI.i18n.t(key, params); };

  var PREFIX = 'si-save-';
  var SLOTS = [1, 2, 3];
  var DIFF_LABEL = {
    casual: 'diffCasual', standard: 'diffStandard',
    tight: 'diffTight', hardcore: 'diffHardcore'
  };

  /* ── storage (node-testable) ───────────────── */

  /* The campaign was re-cut from 14 levels to 5 (《归途》). A snapshot
     taken before the rework can sit at old level 6-14; map it onto the
     new campaign by progress ratio — old 8 ≈ new 3 (round(8×5/14)), the
     mapped level never leads the old progress by more than rounding.
     Ids inside the new campaign pass through; ids outside both (custom
     uploads like 90) also pass through untouched so the picker keeps
     reporting them as "level data missing" instead of guessing. */
  var LEGACY_LEVEL_COUNT = 14;

  function remapLegacyLevel(id, total) {
    var n = Math.max(1, total | 0);
    if (id >= 1 && id <= n) return id;
    if (id > n && id <= LEGACY_LEVEL_COUNT) {
      return Math.max(1, Math.min(n, Math.round(id * n / LEGACY_LEVEL_COUNT)));
    }
    return id;
  }

  function store() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  function valid(snap) {
    return !!(snap && snap.v === 1 && typeof snap.levelId === 'number' &&
      typeof snap.loop === 'number' && snap.carry &&
      typeof snap.carry.score === 'number' && typeof snap.carry.lives === 'number');
  }

  function read(n) {
    var raw;
    try { raw = store() && store().getItem(PREFIX + n); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var snap = JSON.parse(raw);
      return valid(snap) ? snap : null;
    } catch (e) { return null; }
  }

  function write(n, snap) {
    if (!valid(snap)) return false;
    try { store() && store().setItem(PREFIX + n, JSON.stringify(snap)); return true; }
    catch (e) { return false; }
  }

  function clear(n) {
    try { store() && store().removeItem(PREFIX + n); } catch (e) {}
  }

  function hasAny() {
    return SLOTS.some(function (n) { return !!read(n); });
  }

  /* ── picker dialog (browser only) ──────────── */
  var opts = null;      /* {snapshot, resolveLevel, onLoad, onChange} */
  var overlay, titleEl, hintEl, slotsEl, toastEl;
  var mode = 'save';    /* 'save' | 'load' */
  var toastTimer = null;
  var lastFocused = null;

  function isOpen() {
    return !!(overlay && !overlay.hidden);
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString(
        SI.i18n.lang === 'zh' ? 'zh-CN' : 'en-US',
        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function slotSummary(snap) {
    if (!snap) return t('saveEmpty');
    if (opts && opts.resolveLevel && opts.resolveLevel(snap.levelId) < 0) {
      return t('saveMissingLevel');
    }
    /* pre-rework snapshots display the level they were mapped onto */
    var shownId = opts && opts.mapLevel ? opts.mapLevel(snap.levelId) : snap.levelId;
    var bits = [t('saveLevelLabel', { n: shownId })];
    if (snap.loop > 0) bits.push(t('saveLoopLabel', { n: snap.loop + 1 }));
    bits.push(t('scoreLabel') + ' ' + snap.carry.score);
    if (DIFF_LABEL[snap.difficulty]) bits.push(t(DIFF_LABEL[snap.difficulty]));
    return bits.join(' · ');
  }

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderSlots() {
    slotsEl.innerHTML = '';
    SLOTS.forEach(function (n) {
      var snap = read(n);

      var row = el('div', 'save-slot' + (snap ? '' : ' is-empty'));
      var main = global.document.createElement('button');
      main.type = 'button';
      main.className = 'save-slot-main';
      main.appendChild(el('span', 'slot-no', t('saveSlotN', { n: n })));
      main.appendChild(el('span', 'slot-meta', slotSummary(snap)));
      main.appendChild(el('span', 'slot-time', snap ? fmtTime(snap.savedAt) : ''));
      main.addEventListener('click', function () { pickSlot(n); });
      row.appendChild(main);

      if (snap) {
        var del = global.document.createElement('button');
        del.type = 'button';
        del.className = 'save-slot-del';
        del.setAttribute('aria-label', t('saveDelete'));
        del.textContent = '×';
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          clear(n);
          if (opts && opts.onChange) opts.onChange();
          toast(t('saveClearedToast', { n: n }));
          renderSlots();
        });
        row.appendChild(del);
      }
      slotsEl.appendChild(row);
    });
  }

  function pickSlot(n) {
    if (mode === 'save') {
      var snap = opts && opts.snapshot && opts.snapshot();
      if (!snap) return;
      write(n, snap);
      if (opts && opts.onChange) opts.onChange();
      toast(t('saveSavedToast', { n: n }));
      renderSlots();
      return;
    }
    /* load mode */
    var data = read(n);
    if (!data) return;
    if (!opts || !opts.resolveLevel || opts.resolveLevel(data.levelId) < 0) {
      toast(t('saveMissingLevel'));
      return;
    }
    if (opts.onLoad && opts.onLoad(data)) close();
  }

  function open(nextMode) {
    if (!overlay) return;
    mode = nextMode === 'load' ? 'load' : 'save';
    lastFocused = global.document.activeElement;
    titleEl.textContent = t(mode === 'save' ? 'saveModeTitle' : 'loadModeTitle');
    hintEl.textContent = t(mode === 'save' ? 'saveSaveHint' : 'saveLoadHint');
    overlay.hidden = false;
    renderSlots();
    var first = slotsEl.querySelector('.save-slot-main');
    if (first) first.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    if (toastTimer) global.clearTimeout(toastTimer);
    if (toastEl) toastEl.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function init(nextOpts) {
    opts = nextOpts || {};
  }

  function bind() {
    overlay = global.document.getElementById('save-dialog');
    titleEl = global.document.getElementById('save-title');
    hintEl = global.document.getElementById('save-hint');
    slotsEl = global.document.getElementById('save-slots');
    toastEl = global.document.getElementById('save-toast');
    if (!overlay) return;

    global.document.getElementById('save-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    global.document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
    global.document.addEventListener('langchange', function () {
      if (isOpen()) {
        titleEl.textContent = t(mode === 'save' ? 'saveModeTitle' : 'loadModeTitle');
        hintEl.textContent = t(mode === 'save' ? 'saveSaveHint' : 'saveLoadHint');
        renderSlots();
      }
    });
  }

  if (global.document && global.document.getElementById) bind();

  SI.Save = {
    SLOTS: SLOTS,
    LEGACY_LEVEL_COUNT: LEGACY_LEVEL_COUNT,
    remapLegacyLevel: remapLegacyLevel,
    read: read,
    write: write,
    clear: clear,
    hasAny: hasAny
  };
  SI.SaveUI = {
    init: init,
    open: open,
    close: close,
    isOpen: isOpen
  };
})(typeof window !== 'undefined' ? window : globalThis);
