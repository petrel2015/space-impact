/* Data-pack validation tests — run: node test/data-test.js
   Checks enemies.json + levels/*.json against the engine's behavior
   vocabulary and sprite registry, plus i18n dictionary parity and
   sprite grid sanity. These catch typos the moment you add content. */
'use strict';

global.window = global;
require('../js/sprites.js');
require('../js/behaviors.js');
require('../js/i18n.js');
require('../js/level-template.js');

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

/* ── sprites: rectangular grids, known chars ─── */
Object.keys(SI.sprites.SPRITES).forEach(function (name) {
  var rows = SI.sprites.SPRITES[name];
  check(rows.length > 0, 'sprite ' + name + ' has rows');
  for (var r = 1; r < rows.length; r++) {
    check(rows[r].length === rows[0].length,
      'sprite ' + name + ' row ' + r + ' length ' + rows[r].length + ' != ' + rows[0].length);
  }
  rows.forEach(function (row) {
    check(/^[X.]+$/.test(row), 'sprite ' + name + ' has stray chars: ' + row);
  });
});
Object.keys(SI.sprites.FONT).forEach(function (ch) {
  var rows = SI.sprites.FONT[ch];
  check(rows.length === 7, 'font glyph ' + JSON.stringify(ch) + ' must have 7 rows');
  rows.forEach(function (row) {
    check(row.length === 5, 'font glyph ' + JSON.stringify(ch) + ' row width != 5: ' + row);
    check(/^[X.]+$/.test(row), 'font glyph ' + JSON.stringify(ch) + ' stray chars: ' + row);
  });
});

/* ── enemies.json ────────────────────────────── */
var enemies = readJson('data/enemies.json');
var MOVES = Object.keys(SI.behaviors.movements);
var ATKS = Object.keys(SI.behaviors.attacks);
var FORMS = Object.keys(SI.behaviors.formations);

check(Object.keys(enemies).length >= 25, 'expected at least 25 enemies, got ' + Object.keys(enemies).length);

Object.keys(enemies).forEach(function (id) {
  var d = enemies[id];
  ['hp', 'score', 'speed'].forEach(function (f) {
    check(typeof d[f] === 'number' && d[f] > 0, 'enemy ' + id + ' field ' + f + ' must be a positive number');
  });
  if (d.miniboss) check(!!d.boss, 'enemy ' + id + ' is miniboss but lacks boss:true');
  check(SI.sprites.has(d.sprite), 'enemy ' + id + ' references unknown sprite ' + d.sprite);
  check(MOVES.indexOf(d.movement || 'straight') >= 0,
    'enemy ' + id + ' unknown movement ' + d.movement);
  check(ATKS.indexOf(d.attack || 'none') >= 0,
    'enemy ' + id + ' unknown attack ' + d.attack);
  if (typeof d.fireRate === 'number') check(d.fireRate >= 0, 'enemy ' + id + ' fireRate < 0');
  if (d.attack && d.attack !== 'none') {
    check(typeof d.fireRate === 'number' && d.fireRate > 0,
      'enemy ' + id + ' has attack ' + d.attack + ' but no fireRate');
  }
  if (d.attack === 'spawn') {
    check(d.attackParams && enemies[d.attackParams.enemy],
      'enemy ' + id + ' spawn references unknown enemy ' + (d.attackParams && d.attackParams.enemy));
  }
  if (d.attack === 'cycle') {
    var list = (d.attackParams && d.attackParams.list) || [];
    check(list.length > 0, 'enemy ' + id + ' cycle list empty');
    list.forEach(function (sub) {
      var subId = typeof sub === 'string' ? sub : sub && sub.id;
      check(ATKS.indexOf(subId) >= 0, 'enemy ' + id + ' cycle has unknown attack ' + subId);
      if (subId === 'spawn') {
        var ap = (typeof sub === 'object' && sub.params) ? sub.params : d.attackParams;
        check(ap && enemies[ap.enemy], 'enemy ' + id + ' cycle spawn references unknown enemy');
      }
    });
  }
  if (d.drop) {
    var VALID = ['power', 'spread', 'laser', 'heal', 'energy', 'shield', 'missile',
      'boomerang', 'option', 'life'];
    Object.keys(d.drop).forEach(function (k) {
      check(VALID.indexOf(k) >= 0, 'enemy ' + id + ' drop has unknown type ' + k);
      check(typeof d.drop[k] === 'number' && d.drop[k] >= 0 && d.drop[k] <= 1,
        'enemy ' + id + ' drop prob for ' + k + ' must be within [0,1]');
    });
  }
});

/* ── levels.json + level files ───────────────── */
var index = readJson('data/levels.json');
check(Array.isArray(index.levels) && index.levels.length > 0, 'levels.json has no level list');

var seenIds = [];
index.levels.forEach(function (file) {
  check(!/[\\/]\.\.|^\/|^[A-Za-z]:/.test(file),
    'levels.json entry escapes the data dir: ' + file);
  var p = path.join(__dirname, '..', 'data', path.normalize(file));
  check(p.startsWith(path.join(__dirname, '..', 'data')),
    'levels.json resolved outside data dir: ' + file);
  check(fs.existsSync(p), 'levels.json references missing file ' + file);
  var lvl = readJson('data/' + file);

  check(typeof lvl.id === 'number', file + ': id must be numeric');
  check(lvl.difficulty == null || (typeof lvl.difficulty === 'number' && lvl.difficulty >= 0.5 && lvl.difficulty <= 3),
    file + ': difficulty must be a number within [0.5, 3]');
  seenIds.push(lvl.id);
  check(Array.isArray(lvl.events) && lvl.events.length > 0, file + ': events array required');

  var bossCount = 0;
  var lastT = -1;
  lvl.events.forEach(function (ev, i) {
    check(typeof ev.t === 'number' && ev.t >= 0, file + ' event ' + i + ': bad t');
    check(ev.t >= lastT, file + ' event ' + i + ': t not sorted (' + ev.t + ' after ' + lastT + ')');
    lastT = ev.t;
    if (ev.boss) {
      bossCount++;
      check(!!enemies[ev.boss], file + ' event ' + i + ': unknown boss ' + ev.boss);
      check(!!enemies[ev.boss].boss, file + ' event ' + i + ': ' + ev.boss + ' is not flagged boss:true');
      return;
    }
    check(!!enemies[ev.enemy], file + ' event ' + i + ': unknown enemy ' + ev.enemy);
    check(FORMS.indexOf(ev.formation || 'single') >= 0,
      file + ' event ' + i + ': unknown formation ' + ev.formation);
    if (ev.y != null) check(ev.y >= 0 && ev.y <= 1, file + ' event ' + i + ': y must be 0..1');
    if (ev.count != null) check(ev.count >= 1 && ev.count <= 20, file + ' event ' + i + ': count out of range');
    if (ev.interval != null) check(ev.interval >= 0 && ev.interval <= 5, file + ' event ' + i + ': interval out of range');
  });
  check(bossCount >= 1, file + ': level must end with at least one boss event');
});
check(seenIds.every(function (v, i) { return i === 0 || v > seenIds[i - 1]; }),
  'level ids must be strictly increasing: ' + seenIds.join(','));

/* ── level template: compiles against the real engine vocabulary ── */
global.window = global;
require('../js/engine.js');
var compiled = SI.engine.compileLevel(
  JSON.parse(JSON.stringify(SI.levelTemplate)),
  SI.engine.compileEnemies(enemies)
);
check(compiled.id === 90, 'template id should survive compilation');
check(compiled.duration > 0, 'template should have positive duration');
check(SI.levelTemplate.events.every(function (ev) {
  return !('enemy' in ev) || !!enemies[ev.enemy];
}), 'template references unknown enemy');

/* ── i18n parity + markup coverage ───────────── */
var en = SI.i18n.DICT.en, zh = SI.i18n.DICT.zh;
var enKeys = Object.keys(en).sort();
var zhKeys = Object.keys(zh).sort();
check(enKeys.length === zhKeys.length, 'i18n key count mismatch en=' + enKeys.length + ' zh=' + zhKeys.length);
enKeys.forEach(function (k) {
  check(typeof zh[k] === 'string' && zh[k].length > 0, 'i18n key ' + k + ' missing in zh');
});
zhKeys.forEach(function (k) {
  check(typeof en[k] === 'string' && en[k].length > 0, 'i18n key ' + k + ' missing in en');
});

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var m = html.match(/data-i18n="([^"]+)"/g) || [];
m.forEach(function (attr) {
  var key = attr.slice('data-i18n="'.length, -1);
  check(en[key] != null, 'index.html references unknown i18n key ' + key);
});

/* ── summary ─────────────────────────────────── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('data-test: all checks passed (' +
    Object.keys(enemies).length + ' enemies, ' + index.levels.length + ' levels, ' +
    enKeys.length + ' i18n keys).');
}
