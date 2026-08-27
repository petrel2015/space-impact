/* =====================================================================
   Space Impact — application shell
   Loads the JSON data packs, drives the engine with a fixed timestep,
   renders each frame, wires keyboard + touch input and screen flow.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI;
  var STEP = 1 / 60;
  var HISCORE_KEY = 'si-hiscore';
  var AUTOFIRE_KEY = 'si-autofire-v2';
  var DIFF_KEY = 'si-difficulty';

  /* Difficulty tiers: enemy stat multiplier, lives, HP, and ammo policy.
     Tier 1 has unlimited ammo; higher tiers carry finite rounds with
     per-second top-up at level start plus a small recoup per kill. */
  var DIFF_PRESETS = {
    casual:   { mult: 0.8,  lives: 4, hp: 10, ammoPerSec: 0,   ammoBase: 0,   ammoGain: 0 },
    standard: { mult: 1.0,  lives: 3, hp: 8,  ammoPerSec: 1.6, ammoBase: 60,  ammoGain: 2 },
    tight:    { mult: 1.15, lives: 3, hp: 6,  ammoPerSec: 1.0, ammoBase: 40,  ammoGain: 1 },
    hardcore: { mult: 1.3,  lives: 2, hp: 4,  ammoPerSec: 0.6, ammoBase: 30,  ammoGain: 1 }
  };
  var difficulty = 'standard';

  var $ = function (id) { return document.getElementById(id); };

  /* ── state ─────────────────────────────────── */
  var defs = null;          /* compiled enemy defs */
  var levels = [];          /* compiled levels */
  var levelIdx = 0, loopCount = 0;
  var rt = null;
  var mode = 'menu';        /* menu | play | paused | over */
  var hiScore = 0;
  var autofire = false;
  var raf = 0, lastT = 0, acc = 0;
  var overHandled = false;

  var keys = { up: false, down: false, left: false, right: false, fire: false, special: false };
  var dpadDirs = { up: 0, down: 0, left: 0, right: 0 };
  var touchFire = false, touchBomb = false;

  var canvas, ctx, lcd;

  /* URL params (testing / shareable links):
     ?lang=en|zh  ?theme=retro|night|paper  ?touch=1
     ?autostart=1  ?demo=1 (attract-mode autopilot)  ?paused=1 */
  var QS = (global.location && global.location.search) || '';
  function qsFlag(name) { return new RegExp('[?&]' + name + '=1\\b').test(QS); }
  function qsVal(name) {
    var m = QS.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var OPTS = {
    lang: qsVal('lang'),
    theme: qsVal('theme'),
    touch: qsFlag('touch'),
    autostart: qsFlag('autostart'),
    demo: qsFlag('demo'),
    paused: qsFlag('paused'),
    level: qsVal('level')
  };
  var demoActive = false;

  /* ── boot ──────────────────────────────────── */
  function init() {
    /* surface any runtime error in-page (data pack / engine bugs) */
    global.addEventListener('error', function (e) {
      var s = $('data-status');
      if (s) {
        s.hidden = false;
        s.classList.add('is-error');
        s.textContent = 'JS error: ' + e.message + ' (' + (e.filename || '') + ':' + (e.lineno || 0) + ')';
      }
    });

    canvas = $('game-canvas');
    ctx = canvas.getContext('2d');
    lcd = $('lcd');
    ctx.imageSmoothingEnabled = false;

    try { hiScore = parseInt(localStorage.getItem(HISCORE_KEY) || '0', 10) || 0; } catch (e) {}
    try { autofire = localStorage.getItem(AUTOFIRE_KEY) === '1'; } catch (e) {}
    try { var savedDiff = localStorage.getItem(DIFF_KEY); if (DIFF_PRESETS[savedDiff]) difficulty = savedDiff; } catch (e) {}

    SI.i18n.applyToDom();
    SI.theme.apply();
    if (OPTS.lang === 'en' || OPTS.lang === 'zh') SI.i18n.setLang(OPTS.lang);
    if (OPTS.theme && SI.theme.THEMES[OPTS.theme]) SI.theme.setTheme(OPTS.theme);
    syncLangButtons();
    syncThemeButtons();
    syncDiffButtons();
    syncToggles();
    updateHiScoreUi();

    wireUi();
    wireKeyboard();
    wireTouch();
    /* any gesture may (re)activate audio — covers autostart/demo sessions
       that began without a click */
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ty) {
      global.addEventListener(ty, SI.audio.unlock, { passive: true });
    });
    syncSmall();
    global.addEventListener('resize', function () { syncSmall(); fitLcd(); });
    global.addEventListener('orientationchange', function () {
      setTimeout(function () { syncSmall(); fitLcd(); }, 150);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && mode === 'play' && !demoActive) pauseGame();
    });

    loadData();
    requestAnimationFrame(frame);
  }

  /* ── data loading ──────────────────────────── */
  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function loadData() {
    var status = $('data-status');
    status.hidden = false;
    status.classList.remove('is-error');
    status.textContent = SI.i18n.t('loadingText');
    $('btn-start').disabled = true;
    $('btn-reload-data').hidden = true;

    fetchJson('data/enemies.json').then(function (enemiesRaw) {
      defs = SI.engine.compileEnemies(enemiesRaw);
      return fetchJson('data/levels.json');
    }).then(function (index) {
      var urls = index.levels || [];
      return Promise.all(urls.map(function (u) { return fetchJson('data/' + u); }));
    }).then(function (levelRaws) {
      levels = levelRaws.map(function (raw) { return SI.engine.compileLevel(raw, defs); });
      levels.sort(function (a, b) { return a.id - b.id; });
      status.hidden = true;
      $('btn-start').disabled = false;
      if (OPTS.autostart) {
        demoActive = OPTS.demo;
        startRun();
        if (OPTS.paused) pauseGame();
      }
    }).catch(function (err) {
      status.hidden = false;
      status.classList.add('is-error');
      status.textContent = SI.i18n.t('errorTitle') + '\n' + SI.i18n.t('errorHelp') +
        (err && err.key ? '\n' + SI.i18n.t(err.key, err.params) : '');
      /* stay disabled but offer a retry action */
      $('btn-start').disabled = true;
      $('btn-reload-data').hidden = false;
    });
  }

  /* ── game flow ─────────────────────────────── */
  function startRun(wantId) {
    /* data packs not loaded (or failed) yet — Start stays disabled */
    if (!defs || !levels.length) return;
    var startIdx = 0;
    var want = wantId != null ? wantId : (OPTS.level ? parseInt(OPTS.level, 10) : null);
    if (want != null) {
      for (var i = 0; i < levels.length; i++) {
        if (levels[i].id === want) { startIdx = i; break; }
      }
    }
    startLevel(startIdx, 0, null);
  }

  /* Portrait touch mode runs a taller 144×128 field so the canvas can
     occupy ~half the screen instead of a thin letterbox strip. */
  function portraitRes() {
    return touchMode() && global.innerWidth < global.innerHeight && global.innerWidth <= 820;
  }

  function ammoStock(idx, preset) {
    return preset.ammoPerSec > 0
      ? Math.ceil(preset.ammoBase + preset.ammoPerSec * (levels[idx].duration || 180))
      : Infinity;
  }

  function startLevel(idx, loop, carry) {
    levelIdx = idx;
    loopCount = loop;
    var preset = DIFF_PRESETS[difficulty] || DIFF_PRESETS.standard;
    var lvlDiff = (levels[idx].difficulty || 1) * preset.mult * (1 + 0.35 * loop);
    var tall = portraitRes();
    rt = SI.engine.createRuntime({
      defs: defs,
      level: levels[idx],
      seed: (global.crypto && global.crypto.getRandomValues)
        ? global.crypto.getRandomValues(new Uint32Array(1))[0]
        : (Date.now() & 0x7fffffff),
      difficulty: lvlDiff,
      W: 144,
      H: tall ? 128 : 80,
      player: carry ? carry : {
        lives: preset.lives,
        maxHp: preset.hp,
        /* finite tiers scale their stockpile with the level length */
        ammo: ammoStock(idx, preset),
        ammoGain: preset.ammoGain
      }
    });
    canvas.width = rt.W;
    canvas.height = rt.H;
    overHandled = false;
    prevRawFire = false;
    acc = 0;
    mode = 'play';
    showScreen('play');
    hideOverlays();
    closeSettings();
    fitLcd();
    SI.audio.play('levelStart');
  }

  function advanceLevel() {
    var preset = DIFF_PRESETS[difficulty] || DIFF_PRESETS.standard;
    var next = levelIdx + 1;
    var loop = loopCount;
    if (next >= levels.length) { next = 0; loop++; }
    var carry = {
      score: rt.player.score,
      lives: rt.player.lives,
      weaponLevel: rt.player.weaponLevel,
      special: rt.player.special,
      maxHp: rt.player.maxHp,
      /* fresh stockpile scaled to the upcoming level's length */
      ammo: ammoStock(next, preset),
      ammoGain: rt.player.ammoGain
    };
    saveHiScore(rt.player.score);
    startLevel(next, loop, carry);
  }

  function pauseGame() {
    if (mode !== 'play') return;
    mode = 'paused';
    $('ov-pause').hidden = false;
    saveHiScore(rt ? rt.player.score : 0);
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'play';
    $('ov-pause').hidden = true;
    lastT = performance.now();
  }

  function showGameOver() {
    mode = 'over';
    var score = rt.player.score;
    var isRecord = score > hiScore;
    saveHiScore(score);
    $('over-score').textContent = score;
    $('over-best').textContent = Math.max(hiScore, score);
    $('new-record').hidden = !isRecord;
    $('ov-over').hidden = false;
  }

  function toMenu() {
    mode = 'menu';
    rt = null;
    hideOverlays();
    showScreen('start');
    updateHiScoreUi();
  }

  function showScreen(name) {
    $('screen-start').hidden = name !== 'start';
    $('screen-play').hidden = name !== 'play';
  }

  function closeSettings() {
    var pop = $('settings-pop');
    if (!pop) return;
    pop.hidden = true;
    $('btn-settings').setAttribute('aria-expanded', 'false');
  }

  function hideOverlays() {
    $('ov-pause').hidden = true;
    $('ov-over').hidden = true;
  }

  function saveHiScore(score) {
    if (score > hiScore) hiScore = score;
    try { localStorage.setItem(HISCORE_KEY, String(hiScore)); } catch (e) {}
  }

  function updateHiScoreUi() {
    $('hiscore-value').textContent = hiScore;
  }

  /* ── main loop ─────────────────────────────── */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min((now - lastT) / 1000, 0.25);
    lastT = now;

    if (rt && mode === 'play') {
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP) {
        SI.engine.step(rt, currentInput(), STEP);
        acc -= STEP;
      }
      drainEvents();
      if (rt.status === 'clear' && rt.clearTimer <= 0) advanceLevel();
      if (rt.status === 'over' && !overHandled) {
        overHandled = true;
        showGameOver();
      }
      if (rt.player.score > hiScore) hiScore = rt.player.score;
    }

    if (rt && mode !== 'menu') {
      SI.render.draw(ctx, rt, { hiScore: Math.max(hiScore, rt.player.score) });
    }
  }

  var AUDIO_MAP = {
    shoot: 'shoot', eshoot: 'eshoot', hitEnemy: 'hitEnemy', cancel: 'cancel',
    explode: 'explode', bigExplode: 'bigExplode', hitPlayer: 'hitPlayer',
    shieldHit: 'shieldHit', powerup: 'powerup', special: 'special',
    bossWarn: 'bossWarn', bossDie: 'bigExplode', levelClear: 'levelClear',
    gameOver: 'gameOver', lifeLost: 'lifeLost'
  };

  var PICKUP_SFX = { power: 'powerup', spread: 'powerup', laser: 'powerup', heal: 'heal', energy: 'energy', shield: 'shieldHit' };

  function drainEvents() {
    var evs = rt.events.splice(0);
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].type === 'powerup') {
        SI.audio.play(PICKUP_SFX[evs[i].data && evs[i].data.type] || 'powerup');
        continue;
      }
      var a = AUDIO_MAP[evs[i].type];
      if (a) SI.audio.play(a);
    }
  }

  /* ── input ─────────────────────────────────── */
  /* Attract-mode autopilot: plays through the same input path as a human. */
  function demoInput() {
    var p = rt.player;
    var targetY = (rt.H - p.h) / 2 + Math.sin(rt.t * 0.7) * 22;
    var best = null, bd = 1e9;
    rt.powerups.forEach(function (pu) {
      var d = Math.abs(pu.y - p.y) + Math.max(0, pu.x - p.x) * 0.3;
      if (d < bd) { bd = d; best = pu; }
    });
    if (best && best.x < 110) targetY = best.y;
    var dy = targetY - (p.y + p.h / 2);
    var bossHurt = rt.enemies.some(function (e) { return e.isBoss && e.hp < e.maxHp * 0.7; });
    var wantSpecial = p.special >= 1 && (rt.enemies.length >= 3 || bossHurt);
    return {
      up: dy < -4, down: dy > 4,
      left: p.x > 20, right: p.x < 12,
      fire: true,
      special: wantSpecial
    };
  }

  /* Touch UI shows on real touch devices (coarse pointer), phone-sized
     viewports, once the user actually touches the screen, or via
     ?touch=1 — NOT just because a desktop window is narrow. */
  function syncSmall() {
    var coarse = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    var forced = document.body.classList.contains('touch') || OPTS.touch;
    var small = !!(forced || coarse || global.innerWidth <= 560);
    document.body.classList.toggle('small', small);
    document.body.classList.toggle('portrait', global.innerWidth < global.innerHeight);
  }

  function touchMode() {
    return document.body.classList.contains('touch') ||
           document.body.classList.contains('small');
  }

  function currentInput() {
    if (demoActive && mode === 'play') return demoInput();
    var rawFire = !!(keys.fire || touchFire);
    var out = {
      up: keys.up || dpadDirs.up > 0,
      down: keys.down || dpadDirs.down > 0,
      left: keys.left || dpadDirs.left > 0,
      right: keys.right || dpadDirs.right > 0,
      fire: false,
      special: keys.special || touchBomb
    };
    if (autofire) {
      out.fire = rawFire;               /* hold-to-spray */
    } else {
      out.fire = rawFire && !prevRawFire; /* one volley per press */
      prevRawFire = rawFire;
    }
    return out;
  }
  var prevRawFire = false;

  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
    ' ': 'fire', j: 'fire', J: 'fire',
    k: 'special', x: 'special', K: 'special', X: 'special'
  };

  function wireKeyboard() {
    global.addEventListener('keydown', function (e) {
      SI.audio.unlock();
      var k = KEYMAP[e.key];
      if (k) {
        if (mode === 'play') e.preventDefault();
        keys[k] = true;
      }
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (mode === 'play' || mode === 'paused')) {
        e.preventDefault();
        if (mode === 'play') pauseGame(); else resumeGame();
      }
      if (e.key === 'Enter') {
        if (mode === 'menu' && levels.length) startRun();
        else if (mode === 'over') { $('ov-over').hidden = true; startLevel(levelIdx, loopCount, null); }
      }
    });
    global.addEventListener('keyup', function (e) {
      var k = KEYMAP[e.key];
      if (k) keys[k] = false;
    });
  }

  function dirFromPoint(clientX, clientY) {
    var r = $('dpad').getBoundingClientRect();
    var x = (clientX - r.left) / r.width;
    var y = (clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    var dx = x - 0.5, dy = y - 0.5;
    if (Math.abs(dx) < 0.16 && Math.abs(dy) < 0.16) return null; /* dead center */
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  var dpadPointers = {};

  function refreshDpad() {
    var next = { up: 0, down: 0, left: 0, right: 0 };
    Object.keys(dpadPointers).forEach(function (id) {
      var d = dpadPointers[id];
      if (d) next[d]++;
    });
    dpadDirs = next;
    ['up', 'down', 'left', 'right'].forEach(function (d) {
      var el = document.querySelector('.dp.' + d);
      if (el) el.classList.toggle('active', dpadDirs[d] > 0);
    });
  }

  function wireTouch() {
    if (OPTS.touch) document.body.classList.add('touch');
    document.body.addEventListener('touchstart', function () {
      document.body.classList.add('touch');
      fitLcd();
    }, { passive: true, once: false });

    var dpad = $('dpad');
    dpad.addEventListener('pointerdown', function (e) {
      SI.audio.unlock();
      dpad.setPointerCapture(e.pointerId);
      dpadPointers[e.pointerId] = dirFromPoint(e.clientX, e.clientY);
      refreshDpad();
      e.preventDefault();
    });
    dpad.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in dpadPointers)) return;
      dpadPointers[e.pointerId] = dirFromPoint(e.clientX, e.clientY);
      refreshDpad();
    });
    ['pointerup', 'pointercancel'].forEach(function (ty) {
      dpad.addEventListener(ty, function (e) {
        delete dpadPointers[e.pointerId];
        refreshDpad();
      });
    });
    dpad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function holdButton(el, on, off) {
      el.addEventListener('pointerdown', function (e) {
        SI.audio.unlock();
        el.setPointerCapture(e.pointerId);
        el.classList.add('pressed');
        on();
        e.preventDefault();
      });
      ['pointerup', 'pointercancel'].forEach(function (ty) {
        el.addEventListener(ty, function () { el.classList.remove('pressed'); off(); });
      });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    holdButton($('btn-fire'), function () { touchFire = true; }, function () { touchFire = false; });
    holdButton($('btn-bomb'), function () { touchBomb = true; }, function () { touchBomb = false; });
  }

  /* ── UI wiring ─────────────────────────────── */
  function wireUi() {
    $('btn-start').addEventListener('click', function () {
      if (this.disabled) return;
      SI.audio.unlock();
      SI.audio.play('ui');
      closeSettings();
      startRun();
    });

    /* data load failed → the retry button re-runs the loader */
    $('btn-reload-data').addEventListener('click', function () {
      SI.audio.play('ui');
      loadData();
    });

    wireLevelFiles();
    wireDonate();

    /* header settings popover: opening mid-game auto-pauses */
    $('btn-settings').addEventListener('click', function (e) {
      e.stopPropagation();
      var pop = $('settings-pop');
      var open = pop.hidden;
      pop.hidden = !open;
      this.setAttribute('aria-expanded', String(open));
      if (open && mode === 'play') pauseGame();
      SI.audio.play('ui');
    });
    document.addEventListener('click', function (e) {
      if (!popInSettings(e.target)) closeSettings();
    });
    function popInSettings(el) {
      while (el) {
        if (el.id === 'settings-pop' || el.id === 'btn-settings') return true;
        el = el.parentNode;
      }
      return false;
    }

    $('btn-pause').addEventListener('click', function () {
      if (mode === 'play') pauseGame();
      else if (mode === 'paused') resumeGame();
    });
    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-restart').addEventListener('click', function () { hideOverlays(); startRun(); });
    $('btn-quit').addEventListener('click', toMenu);
    $('btn-retry').addEventListener('click', function () {
      $('ov-over').hidden = true;
      startLevel(levelIdx, loopCount, null);
    });
    $('btn-menu').addEventListener('click', toMenu);

    /* one language button — shows the current language, click toggles */
    $('lang-toggle').addEventListener('click', function () {
      SI.i18n.setLang(SI.i18n.lang === 'zh' ? 'en' : 'zh');
      syncLangButtons();
      SI.audio.play('ui');
    });

    Array.prototype.forEach.call(document.querySelectorAll('#theme-seg button'), function (btn) {
      btn.addEventListener('click', function () {
        SI.theme.setTheme(btn.getAttribute('data-theme'));
        syncThemeButtons();
        SI.audio.play('ui');
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('#diff-seg button'), function (btn) {
      btn.addEventListener('click', function () {
        difficulty = btn.getAttribute('data-diff');
        if (!DIFF_PRESETS[difficulty]) difficulty = 'standard';
        try { localStorage.setItem(DIFF_KEY, difficulty); } catch (e) {}
        syncDiffButtons();
        SI.audio.play('ui');
      });
    });

    $('btn-sound').addEventListener('click', function () {
      SI.audio.setEnabled(!SI.audio.enabled);
      syncToggles();
      SI.audio.unlock();
      SI.audio.play('ui');
    });
    $('btn-autofire').addEventListener('click', function () {
      autofire = !autofire;
      try { localStorage.setItem(AUTOFIRE_KEY, autofire ? '1' : '0'); } catch (e) {}
      syncToggles();
      SI.audio.play('ui');
    });
  }

  function syncLangButtons() {
    $('lang-toggle').textContent = SI.i18n.lang === 'zh' ? '中文' : 'EN';
  }

  function syncThemeButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('#theme-seg button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === SI.theme.current));
    });
  }

  function syncDiffButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('#diff-seg button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-diff') === difficulty));
    });
  }

  function syncToggles() {
    var sound = $('btn-sound');
    sound.setAttribute('aria-pressed', String(SI.audio.enabled));
    sound.querySelector('.toggle-state').textContent = SI.audio.enabled ? 'ON' : 'OFF';
    var af = $('btn-autofire');
    af.setAttribute('aria-pressed', String(autofire));
    af.querySelector('.toggle-state').textContent = autofire ? 'ON' : 'OFF';
  }

  /* ── LCD sizing ────────────────────────────── */
  function fitLcd() {
    if (!lcd) return;
    var touch = touchMode();
    var portrait = global.innerWidth < global.innerHeight;
    var LW = rt ? rt.W : (canvas.width || 144);
    var LH = rt ? rt.H : (canvas.height || 80);

    /* phone/tablet portrait: aspect-locked box of ~42% viewport height —
       screen on top, controls below, consistent on every device.
       Width budget subtracts the wrap padding (16) plus the LCD frame
       (4px borders + 5px outline per side) so it never overflows. */
    if (touch && portrait && global.innerWidth <= 820) {
      lcd.classList.add('fill');
      var w = Math.min(global.innerWidth - 38, global.innerHeight * 0.42 * (LW / LH), 640);
      canvas.style.width = w + 'px';
      canvas.style.height = (w * LH / LW) + 'px';
      lcd.style.setProperty('--px', (w / LW) + 'px');
      return;
    }

    lcd.classList.remove('fill');
    var availW = Math.min(global.innerWidth - 24, 880);
    /* compact controls on short (landscape phone) viewports */
    var chromeH = touch ? (global.innerHeight <= 560 ? 200 : 260) : 170;
    var availH = Math.max(120, global.innerHeight - chromeH);
    var scale = Math.max(2, Math.floor(Math.min(availW / LW, availH / LH)));
    canvas.style.width = LW * scale + 'px';
    canvas.style.height = LH * scale + 'px';
    lcd.style.setProperty('--px', scale + 'px');
  }

  /* ── custom level template (download / upload) ── */
  function wireLevelFiles() {
    var status = $('data-status');
    var fileInput = $('file-level');

    $('btn-download-tpl').addEventListener('click', function () {
      SI.audio.play('ui');
      var blob = new Blob([JSON.stringify(SI.levelTemplate, null, 2)],
        { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'space-impact-level-template.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });

    $('btn-upload-level').addEventListener('click', function () {
      SI.audio.unlock();
      SI.audio.play('ui');
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      file.text().then(function (text) {
        var raw = JSON.parse(text);               /* syntax errors → catch */
        if (typeof raw.id !== 'number') raw.id = 90;
        var compiled = SI.engine.compileLevel(raw, defs);
        /* replace an earlier upload with the same id, else append */
        var at = -1;
        for (var i = 0; i < levels.length; i++) {
          if (levels[i].id === compiled.id) { at = i; break; }
        }
        if (at >= 0) levels[at] = compiled; else { levels.push(compiled); levels.sort(function (a, b) { return a.id - b.id; }); }
        status.hidden = false;
        status.classList.remove('is-error');
        status.textContent = SI.i18n.t('uploadOk');
        SI.audio.play('powerup');
        startRun(compiled.id);                    /* straight into the action */
      }).catch(function (err) {
        status.hidden = false;
        status.classList.add('is-error');
        status.textContent = SI.i18n.t('errorTitle') + '\n' +
          (err && err.key ? SI.i18n.t(err.key, err.params) : String(err && err.message || err));
        SI.audio.play('hitPlayer');
      });
    });
  }

  /* ── donate (footer) ───────────────────────── */
  var ALIPAY_URL = 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79';
  var ALIPAY_SCHEME = 'alipays://platformapi/startapp?saId=10000007&qrcode=' +
    encodeURIComponent(ALIPAY_URL);

  function wireDonate() {
    var modal = $('donate-modal');
    var img = $('donate-qr-img');
    var hint = $('donate-hint');

    function openDonate(channel) {
      var nameKey = channel === 'alipay' ? 'donateAlipay' : 'donateWechat';
      img.src = 'donate/' + channel + '-qr.png';
      img.alt = SI.i18n.t('donateQrAlt', { channel: SI.i18n.t(nameKey) });
      hint.textContent = SI.i18n.t(channel === 'alipay' ? 'donateAlipayHint' : 'donateWechatHint');
      modal.hidden = false;
    }

    function closeDonate() { modal.hidden = true; }

    $('btn-donate-alipay').addEventListener('click', function () {
      SI.audio.unlock();
      SI.audio.play('ui');
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        /* try to wake the Alipay app; fall back to the QR modal */
        var before = document.visibilityState;
        global.location.href = ALIPAY_SCHEME;
        global.setTimeout(function () {
          if (document.visibilityState === before) openDonate('alipay');
        }, 1500);
      } else {
        openDonate('alipay');
      }
    });

    $('btn-donate-wechat').addEventListener('click', function () {
      SI.audio.unlock();
      SI.audio.play('ui');
      openDonate('wechat');
    });

    $('donate-close').addEventListener('click', closeDonate);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeDonate();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeDonate();
    });

    /* warm both QRs so the modal shows instantly */
    ['alipay', 'wechat'].forEach(function (c) {
      var pre = new Image();
      pre.src = 'donate/' + c + '-qr.png';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
