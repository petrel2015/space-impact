/* =====================================================================
   Space Impact — codex (图鉴)
   Bestiary + item catalog. Discovery state ("seen" enemies/items) is
   persisted in localStorage; display content (bilingual names and
   one-line reviews) comes from data/codex.json, while every stat is
   read live from the compiled enemies.json defs — numbers are never
   duplicated. Unseen entries render as a dim silhouette with a
   first-appearance hint only.
   No DOM access at load time under node; bind() runs only in browser.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var t = function (key, params) { return SI.i18n.t(key, params); };

  var STORE_KEY = 'si-codex-v1';

  /* pickup type → 7×7 icon sprite (kept local so codex.js has no
     dependency on render.js load order) */
  var ITEM_SPRITES = {
    power: 'pPower', spread: 'pSpread', laser: 'pLaser', heal: 'pHeal',
    energy: 'pEnergy', shield: 'pShield', missile: 'pMissile',
    boomerang: 'pBoomerang', option: 'pOption', life: 'pLife'
  };

  var seen = { enemies: {}, items: {} };   /* id/type → 1 */
  var content = null;   /* data/codex.json */
  var defs = null;      /* compiled enemy defs (the numeric truth) */
  var firstSeen = null; /* enemy id → first built-in level id */
  var order = [];       /* enemy display order */
  var itemOrder = [];

  /* ── persistence ───────────────────────────── */
  function loadState() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) {
        (parsed.enemies || []).forEach(function (id) { seen.enemies[id] = 1; });
        (parsed.items || []).forEach(function (id) { seen.items[id] = 1; });
      }
    } catch (e) { /* corrupted or unavailable storage → fresh state */ }
  }

  function saveState() {
    try {
      global.localStorage && global.localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 1,
        enemies: Object.keys(seen.enemies),
        items: Object.keys(seen.items)
      }));
    } catch (e) {}
  }

  function markEnemySeen(id) {
    if (!id || seen.enemies[id]) return false;
    seen.enemies[id] = 1;
    saveState();
    return true;
  }

  function markItemSeen(type) {
    if (!type || seen.items[type]) return false;
    seen.items[type] = 1;
    saveState();
    return true;
  }

  function isEnemySeen(id) { return !!seen.enemies[id]; }
  function isItemSeen(type) { return !!seen.items[type]; }

  function counts() {
    return {
      enemies: Object.keys(seen.enemies).length,
      enemiesTotal: order.length,
      items: Object.keys(seen.items).length,
      itemsTotal: itemOrder.length
    };
  }

  /* ── text helpers ──────────────────────────── */

  /* {en, zh} → current language, en fallback */
  function bi(pair) {
    if (!pair) return '';
    return pair[SI.i18n.lang] || pair.en || '';
  }

  function entryFor(id) {
    return (content && content.enemies && content.enemies[id]) || null;
  }

  /* localized enemy name — codex entry first, id as fallback
     (custom enemies without codex content) */
  function enemyName(id) {
    var e = entryFor(id);
    return e ? bi(e.name) : id;
  }

  function attackText(def) {
    if (!def.attack || def.attack === 'none') return t('codexNoAttack');
    return describeAttack(def.attack, def.ap || {});
  }

  function describeAttack(id, ap) {
    switch (id) {
      case 'straight': return t('atkStraight');
      case 'aimed': return t('atkAimed');
      case 'fan': return t('atkFan', { ways: (ap && ap.ways) || 3 });
      case 'burst': return t('atkBurst', { count: (ap && ap.count) || 3 });
      case 'spiral': return t('atkSpiral');
      case 'curtain': return t('atkCurtain');
      case 'cross': return t('atkCross');
      case 'spawn': return t('atkSpawn', {
        count: (ap && ap.count) || 1,
        enemy: enemyName(ap && ap.enemy)
      });
      case 'cycle': {
        var list = (ap && ap.list) || [];
        return t('atkCycle', {
          list: list.map(function (sub) {
            var subId = typeof sub === 'string' ? sub : sub.id;
            var subParams = (typeof sub === 'object' && sub.params) ? sub.params : {};
            return describeAttack(subId, subParams);
          }).join(' → ')
        });
      }
      default: return id;
    }
  }

  function movementText(def) {
    switch (def.movement) {
      case 'straight': return t('mvStraight');
      case 'sine': return t('mvSine');
      case 'drift': return t('mvDrift');
      case 'hover': return t('mvHover');
      case 'chase': return t('mvChase');
      case 'bossHover': return t('mvBossHover');
      case 'zigzag': return t('mvZigzag');
      case 'dive': return t('mvDive');
      case 'pulse': return t('mvPulse');
      default: return def.movement;
    }
  }

  /* ── display order ─────────────────────────── */
  function rank(id) {
    var d = defs[id];
    if (!d) return 0;
    if (!d.boss) return 0;
    return d.miniboss ? 1 : 2;   /* normal → miniboss → boss */
  }

  function computeOrder() {
    var ids = Object.keys(defs);
    ids.sort(function (a, b) {
      var fa = (firstSeen && firstSeen[a]) || 9999;
      var fb = (firstSeen && firstSeen[b]) || 9999;
      if (fa !== fb) return fa - fb;
      var ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return ids;
  }

  /* ── init ──────────────────────────────────── */
  function init(opts) {
    content = (opts && opts.data) || {};
    defs = (opts && opts.defs) || {};
    firstSeen = (opts && opts.firstSeen) || {};
    order = computeOrder();
    itemOrder = (content.items ? Object.keys(content.items) : []);
  }

  /* ── dialog (browser only) ─────────────────── */
  var overlay, bodyEl, progressEl, tabEnemies, tabItems;
  var currentTab = 'enemies';
  var lastFocused = null;

  function isOpen() {
    return !!(overlay && !overlay.hidden);
  }

  function cssVar(name, fallback) {
    if (!global.document) return fallback;
    var v = global.getComputedStyle(global.document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  /* paint a sprite grid onto a 1px-per-cell canvas, CSS-scaled up;
     locked entries get a dimmed silhouette treatment */
  function paintSprite(canvas, spriteName, locked) {
    var sp = SI.sprites.get(spriteName);
    if (!sp) return;
    var scale = Math.max(2, Math.min(6, Math.floor(48 / sp.h)));
    canvas.width = sp.w;
    canvas.height = sp.h;
    canvas.style.width = (sp.w * scale) + 'px';
    canvas.style.height = (sp.h * scale) + 'px';
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sp.w, sp.h);
    ctx.fillStyle = locked ? cssVar('--muted', '#666') : cssVar('--ink', '#222');
    ctx.globalAlpha = locked ? 0.45 : 1;
    for (var r = 0; r < sp.rows.length; r++) {
      var row = sp.rows[r];
      for (var c = 0; c < row.length; c++) {
        if (row.charAt(c) === 'X') ctx.fillRect(c, r, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function statRow(label, value) {
    var row = el('div', 'codex-stat');
    row.appendChild(el('span', 'codex-stat-k', label));
    row.appendChild(el('span', 'codex-stat-v', value));
    return row;
  }

  function renderEnemyCard(id) {
    var def = defs[id];
    var entry = entryFor(id);
    var unlocked = isEnemySeen(id);
    var card = el('div', 'codex-card' + (unlocked ? '' : ' is-locked'));

    var head = el('div', 'codex-card-head');
    var canvas = el('canvas', 'codex-sprite');
    canvas.setAttribute('aria-hidden', 'true');
    paintSprite(canvas, def.sprite, !unlocked);
    var titleBox = el('div', 'codex-card-title');
    var nameRow = el('div', 'codex-name-row');
    nameRow.appendChild(el('span', 'codex-name', unlocked ? enemyName(id) : '???'));
    if (unlocked && def.boss) {
      nameRow.appendChild(el('span', 'codex-tag',
        def.miniboss ? t('codexTagMiniboss') : t('codexTagBoss')));
    }
    titleBox.appendChild(nameRow);
    if (!unlocked) {
      var hint = t('codexLocked');
      if (firstSeen[id]) hint += ' · ' + t('codexFirstSeen', { n: firstSeen[id] });
      titleBox.appendChild(el('p', 'codex-locknote', hint));
    }
    head.appendChild(canvas);
    head.appendChild(titleBox);
    card.appendChild(head);

    if (unlocked) {
      var stats = el('div', 'codex-stats');
      stats.appendChild(statRow(t('codexStatHp'), def.hp));
      stats.appendChild(statRow(t('codexStatScore'), def.score));
      stats.appendChild(statRow(t('codexStatSpeed'), def.speed));
      stats.appendChild(statRow(t('codexStatMovement'), movementText(def)));
      stats.appendChild(statRow(t('codexStatAttack'), attackText(def)));
      stats.appendChild(statRow(t('codexStatFireRate'),
        def.fireRate > 0 ? t('codexSeconds', { x: def.fireRate }) : '—'));
      stats.appendChild(statRow(t('codexStatBulletSpeed'),
        def.attack && def.attack !== 'none' ? def.bulletSpeed : '—'));
      card.appendChild(stats);
      if (entry && bi(entry.review)) {
        card.appendChild(el('p', 'codex-review', '“' + bi(entry.review) + '”'));
      }
    }
    return card;
  }

  function renderItemCard(type) {
    var entry = (content.items && content.items[type]) || null;
    var unlocked = isItemSeen(type);
    var card = el('div', 'codex-card' + (unlocked ? '' : ' is-locked'));

    var head = el('div', 'codex-card-head');
    var canvas = el('canvas', 'codex-sprite');
    canvas.setAttribute('aria-hidden', 'true');
    paintSprite(canvas, ITEM_SPRITES[type] || 'pPower', !unlocked);
    var titleBox = el('div', 'codex-card-title');
    var nameRow = el('div', 'codex-name-row');
    nameRow.appendChild(el('span', 'codex-name',
      unlocked ? (entry ? bi(entry.name) : type) : '???'));
    titleBox.appendChild(nameRow);
    if (!unlocked) titleBox.appendChild(el('p', 'codex-locknote', t('codexLocked')));
    head.appendChild(canvas);
    head.appendChild(titleBox);
    card.appendChild(head);

    if (unlocked) {
      if (entry && bi(entry.desc)) card.appendChild(el('p', 'codex-desc', bi(entry.desc)));
      if (entry && bi(entry.review)) {
        card.appendChild(el('p', 'codex-review', '“' + bi(entry.review) + '”'));
      }
    }
    return card;
  }

  function renderTabs() {
    tabEnemies.classList.toggle('active', currentTab === 'enemies');
    tabEnemies.setAttribute('aria-pressed', String(currentTab === 'enemies'));
    tabItems.classList.toggle('active', currentTab === 'items');
    tabItems.setAttribute('aria-pressed', String(currentTab === 'items'));
  }

  function render() {
    if (!overlay) return;
    renderTabs();
    var c = counts();
    progressEl.textContent = t('codexProgress', {
      e: c.enemies, E: c.enemiesTotal, i: c.items, I: c.itemsTotal
    });
    bodyEl.innerHTML = '';
    if (currentTab === 'enemies') {
      order.forEach(function (id) { bodyEl.appendChild(renderEnemyCard(id)); });
    } else {
      itemOrder.forEach(function (type) { bodyEl.appendChild(renderItemCard(type)); });
    }
  }

  function open(tab) {
    if (!overlay) return;
    if (tab) currentTab = tab;
    lastFocused = global.document.activeElement;
    overlay.hidden = false;
    render();
    (currentTab === 'items' ? tabItems : tabEnemies).focus();
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function bind() {
    overlay = global.document.getElementById('codex-dialog');
    tabEnemies = global.document.getElementById('codex-tab-enemies');
    tabItems = global.document.getElementById('codex-tab-items');
    progressEl = global.document.getElementById('codex-progress');
    bodyEl = global.document.getElementById('codex-body');
    if (!overlay) return;

    global.document.getElementById('codex-close').addEventListener('click', close);
    tabEnemies.addEventListener('click', function () {
      currentTab = 'enemies';
      render();
    });
    tabItems.addEventListener('click', function () {
      currentTab = 'items';
      render();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    global.document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
    global.document.addEventListener('langchange', function () {
      if (isOpen()) render();   /* static texts refresh via data-i18n */
    });
  }

  loadState();
  if (global.document && global.document.getElementById) bind();

  SI.Codex = {
    init: init,
    open: open,
    close: close,
    isOpen: isOpen,
    markEnemySeen: markEnemySeen,
    markItemSeen: markItemSeen,
    isEnemySeen: isEnemySeen,
    isItemSeen: isItemSeen,
    counts: counts,
    order: function () { return order.slice(); },
    enemyName: enemyName,
    attackText: attackText,
    movementText: movementText
  };
})(typeof window !== 'undefined' ? window : globalThis);
