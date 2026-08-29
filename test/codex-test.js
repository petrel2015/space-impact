/* Codex tests — run: node test/codex-test.js
   Validates data/codex.json against enemies.json (key parity, bilingual
   completeness), the i18n attack/movement templates against everything
   the data actually uses, discovery persistence, and display order. */
'use strict';

global.window = global;

/* storage stub must exist before codex.js loads its state */
var mem = {};
global.localStorage = {
  getItem: function (k) { return (k in mem) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};

require('../js/sprites.js');
require('../js/behaviors.js');
require('../js/i18n.js');
require('../js/engine.js');
require('../js/codex.js');

var fs = require('fs');
var path = require('path');

var SI = global.SI;
var fails = 0;

function check(cond, msg) {
  if (!cond) { fails++; console.error('FAIL: ' + msg); }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

var enemies = readJson('data/enemies.json');
var codexData = readJson('data/codex.json');
var defs = SI.engine.compileEnemies(enemies);
/* single source of truth: the engine's own pickup-type registry */
var POWERUP_TYPES = SI.engine.POWERUP_TYPES;

/* ── codex.json ↔ enemies.json parity ────────── */
var ek = Object.keys(enemies), ck = Object.keys(codexData.enemies);
ek.forEach(function (id) {
  check(ck.indexOf(id) >= 0, 'enemy ' + id + ' has no codex entry');
});
ck.forEach(function (id) {
  check(ek.indexOf(id) >= 0, 'codex entry ' + id + ' matches no enemy');
});
ek.forEach(function (id) {
  var e = codexData.enemies[id];
  ['name', 'review'].forEach(function (f) {
    check(e && e[f] && e[f].en && e[f].zh, 'codex ' + id + '.' + f + ' needs non-empty en+zh');
  });
});

/* ── items: exactly the engine's pickup types ── */
var ik = Object.keys(codexData.items);
check(ik.length === POWERUP_TYPES.length, 'expected ' + POWERUP_TYPES.length + ' item entries, got ' + ik.length);
POWERUP_TYPES.forEach(function (type) {
  var e = codexData.items[type];
  check(!!e, 'item ' + type + ' has no codex entry');
  ['name', 'desc', 'review'].forEach(function (f) {
    check(e && e[f] && e[f].en && e[f].zh, 'codex item ' + type + '.' + f + ' needs non-empty en+zh');
  });
});

/* ── i18n templates cover every attack/movement in use ── */
var needAtk = {}, needMv = {};
Object.keys(enemies).forEach(function (id) {
  var d = enemies[id];
  needMv[d.movement || 'straight'] = 1;
  var at = d.attack || 'none';
  if (at !== 'none') needAtk[at] = 1;
  if (at === 'cycle') {
    ((d.attackParams && d.attackParams.list) || []).forEach(function (sub) {
      needAtk[typeof sub === 'string' ? sub : sub.id] = 1;
    });
  }
});
['en', 'zh'].forEach(function (lang) {
  Object.keys(needAtk).forEach(function (a) {
    check(typeof SI.i18n.DICT[lang]['atk' + cap(a)] === 'string',
      lang + ' missing i18n template atk' + cap(a));
  });
  Object.keys(needMv).forEach(function (m) {
    check(typeof SI.i18n.DICT[lang]['mv' + cap(m)] === 'string',
      lang + ' missing i18n template mv' + cap(m));
  });
  check(typeof SI.i18n.DICT[lang].codexNoAttack === 'string', lang + ' missing codexNoAttack');
});

/* ── localized text generation for every enemy, both languages ── */
SI.Codex.init({ data: codexData, defs: defs, firstSeen: {} });
['en', 'zh'].forEach(function (lang) {
  SI.i18n.setLang(lang);
  Object.keys(defs).forEach(function (id) {
    var atk = SI.Codex.attackText(defs[id]);
    var mv = SI.Codex.movementText(defs[id]);
    check(typeof atk === 'string' && atk.length > 0 && !/^atk[A-Z]/.test(atk),
      lang + ' attackText(' + id + ') leaks a missing template key: ' + atk);
    check(typeof mv === 'string' && mv.length > 0 && !/^mv[A-Z]/.test(mv),
      lang + ' movementText(' + id + ') leaks a missing template key: ' + mv);
  });
});
/* cycle text composes sub-attacks — the composite boss must mention them */
SI.i18n.setLang('en');
check(SI.Codex.attackText(defs.boss1).indexOf('→') >= 0, 'cycle attack text should join sub-attacks');
/* spawn text names the spawned enemy in the current language */
SI.i18n.setLang('zh');
check(SI.Codex.attackText(defs.boss2).indexOf('侦察机') >= 0,
  'spawn attack text should name the spawned enemy (侦察机)');

/* ── discovery state + persistence ───────────── */
check(SI.Codex.counts().enemies === 0, 'codex should start empty');
SI.Codex.markEnemySeen('drone');
SI.Codex.markEnemySeen('drone');            /* idempotent */
check(SI.Codex.counts().enemies === 1, 'markEnemySeen should be idempotent');
check(SI.Codex.isEnemySeen('drone'), 'drone should be seen');
check(!SI.Codex.isEnemySeen('bat'), 'bat should be unseen');
SI.Codex.markItemSeen('heal');
check(SI.Codex.isItemSeen('heal') && SI.Codex.counts().items === 1, 'heal should be seen');
var persisted = JSON.parse(mem['si-codex-v1']);
check(persisted.v === 1, 'persisted codex state needs v:1');
check(persisted.enemies.indexOf('drone') >= 0, 'persisted state should include drone');
check(persisted.items.indexOf('heal') >= 0, 'persisted state should include heal');

/* ── display order: first-seen level, then normal → miniboss → boss ── */
SI.Codex.init({
  data: codexData, defs: defs,
  firstSeen: { drone: 1, bat: 1, boss1: 1, mb1: 2, wasp: 2 }
});
var ord = SI.Codex.order();
check(SI.Codex.counts().enemiesTotal === Object.keys(defs).length,
  'enemiesTotal should equal enemies.json count');
check(ord.indexOf('drone') < ord.indexOf('boss1') && ord.indexOf('bat') < ord.indexOf('boss1'),
  'level-1 normals should sort before the level-1 boss');
check(ord.indexOf('wasp') < ord.indexOf('mb1'),
  'a same-level normal (wasp) should sort before the miniboss (mb1)');
check(SI.Codex.enemyName('drone') === '侦察机', 'zh enemyName should localize');
SI.i18n.setLang('en');
check(SI.Codex.enemyName('drone') === 'Drone', 'en enemyName should localize');

/* ── every enemy shows up in some built-in level (hint coverage) ── */
/* Loop-only variants stay out of the 5-level campaign on purpose — they
   are reserved for the second playthrough (difficulty loop), so their
   locked cards carry no first-appearance hint. */
var LOOP_ONLY = ['boss2b', 'boss4b', 'boss5', 'boss5b', 'boss6b'];
var index = readJson('data/levels.json');
var referenced = {};
index.levels.forEach(function (file) {
  var lvl = readJson('data/' + file);
  lvl.events.forEach(function (ev) {
    referenced[ev.boss || ev.enemy] = file;
  });
});
Object.keys(enemies).forEach(function (id) {
  check(referenced[id] != null || LOOP_ONLY.indexOf(id) >= 0,
    'enemy ' + id + ' appears in no built-in level — codex hint would be empty');
});

/* ── summary ─────────────────────────────────── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('codex-test: all checks passed (' + ek.length + ' enemies, ' +
    ik.length + ' items, ' + Object.keys(needAtk).length + ' attack templates).');
}
