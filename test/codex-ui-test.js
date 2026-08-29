/* Codex + save-slot UI tests — run:
     NODE_PATH=<dir with jsdom> node test/codex-ui-test.js
   Drives the real index.html in jsdom with the data packs served from
   disk: homepage entries, codex dialog (locked/unlocked, zh/en), the
   per-frame discovery hook, the 3-slot save picker and continue flow.
   Skipped with a notice when jsdom is not resolvable. */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DATA_ROOT = path.join(ROOT, 'data');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var fails = 0, total = 0;

function check(cond, msg) {
  total++;
  if (!cond) { fails++; console.error('FAIL: ' + msg); }
}

var jsdom = null;
try { jsdom = require('jsdom'); } catch (e) { jsdom = null; }

if (!jsdom) {
  console.log('jsdom not resolvable — skipping UI tests ' +
    '(NODE_PATH=<dir with jsdom> node test/codex-ui-test.js)');
  process.exit(0);
}

var JSDOM = jsdom.JSDOM;
var vc = new jsdom.VirtualConsole();
var seen = {};
vc.on('jsdomError', function (e) {
  if (/Not implemented/.test(e.message)) return;   /* canvas 2d stubbed below */
  if (!seen[e.message]) { seen[e.message] = true; console.error('jsdomError: ' + e.message); }
});

/* minimal no-op 2d context so app.js/render.js/codex.js boot headlessly */
function ctxStub() {
  return {
    imageSmoothingEnabled: false, fillStyle: '', globalAlpha: 1,
    clearRect: function () {}, fillRect: function () {}, fillText: function () {},
    save: function () {}, restore: function () {}, beginPath: function () {},
    moveTo: function () {}, lineTo: function () {}, stroke: function () {},
    setLineDash: function () {}, translate: function () {}, drawImage: function () {}
  };
}

/* serve the real data packs from disk; only whitelisted .json basenames
   under data/ (and data/levels/) resolve — anything else rejects */
function serveData(url) {
  var m = String(url).match(/data\/([A-Za-z0-9/_-]+\.json)$/);
  if (!m) return Promise.reject(new Error('offline test: ' + url));
  var target = path.resolve(DATA_ROOT, m[1]);
  if (target !== DATA_ROOT && !target.startsWith(DATA_ROOT + path.sep)) {
    return Promise.reject(new Error('path escapes data dir'));
  }
  if (!fs.existsSync(target)) return Promise.reject(new Error('missing ' + m[1]));
  return Promise.resolve({
    ok: true,
    json: function () { return Promise.resolve(JSON.parse(fs.readFileSync(target, 'utf8'))); }
  });
}

var dom = new JSDOM(html, {
  url: 'file://' + path.join(ROOT, 'index.html'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse: function (w) {
    w.fetch = serveData;
    w.HTMLCanvasElement.prototype.getContext = function () { return ctxStub(); };
    /* jsdom denies localStorage on file://'s opaque origin — swap in an
       in-memory shim so both the page and our assertions can use it */
    try { w.localStorage.getItem('probe'); } catch (e) {
      var mem = {};
      Object.defineProperty(w, 'localStorage', {
        configurable: true,
        value: {
          getItem: function (k) { return (k in mem) ? mem[k] : null; },
          setItem: function (k, v) { mem[k] = String(v); },
          removeItem: function (k) { delete mem[k]; }
        }
      });
    }
  }
});
var w = dom.window, d = w.document;

var started = false;
w.addEventListener('load', function () {
  if (started) return;
  started = true;
  run().then(done, function (err) { fails++; console.error('FAIL: UI suite crashed: ' + err); done(); });
});

function done() {
  console.log('codex-ui tests: ' + (total - fails) + '/' + total + ' passed' +
    (fails ? (' — ' + fails + ' FAILED') : ''));
  process.exit(fails ? 1 : 0);
}

function $(id) { return d.getElementById(id); }
function sleep(ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); }
function until(cond, maxPolls) {
  var max = maxPolls || 300;
  return (function poll(i) {
    return cond() ? Promise.resolve(true) : (i > max ? Promise.resolve(false) : sleep(10).then(function () { return poll(i + 1); }));
  })(0);
}
function pressKey(key) {
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: key }));
}

function run() {
  return until(function () { return w.SI && w.SI.Codex && w.SI.SaveUI && !$('btn-start').disabled; })
    .then(function (booted) {
      check(booted, 'page booted, data packs loaded, start enabled');
      if (!booted) return;

      /* ── T1 homepage entries ── */
      check(!$('btn-codex').disabled, 'T1 codex button enabled after data load');
      check($('btn-continue').hidden, 'T1 continue hidden with no saves');

      /* ── T2 codex opens, everything locked ── */
      $('btn-codex').click();
      check(!$('codex-dialog').hidden, 'T2 codex dialog opens from homepage');
      var cards = d.querySelectorAll('#codex-body .codex-card');
      check(cards.length === 27, 'T2 27 enemy cards rendered, got ' + cards.length);
      check(d.querySelectorAll('#codex-body .codex-card.is-locked').length === 27,
        'T2 all cards locked on a fresh profile');
      check($('codex-progress').textContent === 'Enemies 0/27 · Items 0/11',
        'T2 progress text: ' + $('codex-progress').textContent);
      check(cards[0].textContent.indexOf('first appears in level 1') >= 0,
        'T2 locked card carries the first-appearance hint');
      check(d.querySelector('#codex-body .codex-card .codex-sprite') != null,
        'T2 sprite canvas present on cards');

      /* ── T3 items tab + zh rendering ── */
      $('codex-tab-items').click();
      var items = d.querySelectorAll('#codex-body .codex-card');
      check(items.length === 11, 'T3 11 item cards rendered, got ' + items.length);
      w.SI.i18n.setLang('zh');
      check($('codex-progress').textContent === '敌人 0/27 · 道具 0/11',
        'T3 zh progress via langchange: ' + $('codex-progress').textContent);

      /* ── T4 discovery unlocks entries ── */
      w.SI.Codex.markEnemySeen('drone');
      w.SI.Codex.markItemSeen('heal');
      $('codex-tab-enemies').click();
      var unlocked = d.querySelector('#codex-body .codex-card:not(.is-locked)');
      check(!!unlocked, 'T4 drone card unlocked after markEnemySeen');
      check(unlocked && unlocked.textContent.indexOf('侦察机') >= 0, 'T4 zh enemy name renders');
      check(unlocked && unlocked.textContent.indexOf('血量') >= 0 && unlocked.textContent.indexOf('攻击方式') >= 0,
        'T4 stat rows (HP / attack) render on unlocked card');
      check(unlocked && unlocked.textContent.indexOf('炮灰中的劳模') >= 0, 'T4 one-line review renders');
      check(d.querySelectorAll('#codex-body .codex-card.is-locked').length === 26,
        'T4 remaining 26 stay locked');
      $('codex-tab-items').click();
      var healCard = d.querySelector('#codex-body .codex-card:not(.is-locked)');
      check(healCard && healCard.textContent.indexOf('回血') >= 0 && healCard.textContent.indexOf('生命 +2') >= 0,
        'T4 heal item unlocked with name + effect desc');

      /* ── T5 persistence ── */
      var stored = w.localStorage.getItem('si-codex-v1');
      check(stored && stored.indexOf('drone') >= 0 && stored.indexOf('heal') >= 0,
        'T5 codex state persisted to localStorage');

          /* ── T6 close, run the game, per-frame discovery hook ── */
          d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
          check($('codex-dialog').hidden, 'T6 Escape closes codex');
          w.SI.i18n.setLang('zh');
          $('btn-start').click();
          check($('screen-play') && !$('screen-play').hidden, 'T6 game screen visible');
          /* rock is not pre-marked by T4 (that was drone), so this is a real
             end-to-end check: the first rocks spawn at t=5s game time */
          return until(function () { return w.SI.Codex.isEnemySeen('rock') || false; }, 900)
            .then(function (marked) {
              /* level 1 spawns its first rocks at t=5s — the frame loop hook
                 should mark them without any direct call */
              check(marked, 'T6 per-frame discovery hook marks spawned rocks');
          pressKey('p');
          return until(function () { return !$('ov-pause').hidden; });
        })
        .then(function (paused) {
          check(paused, 'T6 game paused via P key');
          if (!paused) return;

          /* ── T7 save picker: 3 slots, save into slot 1 ── */
          $('btn-save').click();
          check(!$('save-dialog').hidden, 'T7 save picker opens from pause menu');
          var slots = d.querySelectorAll('#save-slots .save-slot');
          check(slots.length === 3, 'T7 three slots rendered, got ' + slots.length);
          check($('save-title').textContent === '保存进度', 'T7 save-mode title');
          var before = w.localStorage.getItem('si-save-1');
          check(before === null, 'T7 slot 1 empty before saving');
          slots[0].querySelector('.save-slot-main').click();
          var snap = w.localStorage.getItem('si-save-1');
          check(!!snap, 'T7 snapshot written on slot click');
          var parsed = snap ? JSON.parse(snap) : null;
          check(parsed && parsed.levelId === 1 && parsed.difficulty === 'standard',
            'T7 snapshot holds level 1 + difficulty');
          check(parsed && typeof parsed.carry.score === 'number' && typeof parsed.carry.lives === 'number',
            'T7 snapshot carry block present');
          check($('save-toast').textContent.indexOf('档位 1') >= 0, 'T7 saved toast shown');
          check(d.querySelector('#save-slots .save-slot .slot-meta').textContent.indexOf('第 1 关') >= 0,
            'T7 slot summary refreshed with 第 1 关');
          d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));

          /* ── T8 quit → continue flow ── */
          $('btn-quit').click();
          check(!$('screen-start').hidden, 'T8 back on start screen');
          check(!$('btn-continue').hidden, 'T8 continue button appears with a save present');
          $('btn-continue').click();
          check(!$('save-dialog').hidden, 'T8 load picker opens');
          check($('save-title').textContent === '继续游戏', 'T8 load-mode title');
          d.querySelector('#save-slots .save-slot-main').click();
          check($('save-dialog').hidden, 'T8 picker closes after loading');
          check(!$('screen-play').hidden && $('ov-pause').hidden,
            'T8 run resumed at the saved level');

          /* ── T9 delete slot → continue disappears ── */
          pressKey('p');
          return until(function () { return !$('ov-pause').hidden; });
        })
        .then(function (paused) {
          if (!paused) { check(false, 'T9 could not pause again'); return; }
          $('btn-save').click();
          var del = d.querySelector('#save-slots .save-slot-del');
          check(!!del, 'T9 delete button rendered on occupied slot');
          if (del) {
            del.click();
            check(w.localStorage.getItem('si-save-1') === null, 'T9 slot cleared');
          }
          d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
          $('btn-quit').click();
          check($('btn-continue').hidden, 'T9 continue hidden again after deleting the save');
        });
    });
}
