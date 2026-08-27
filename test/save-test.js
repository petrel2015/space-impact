/* Save-slot tests — run: node test/save-test.js
   Roundtrip, slot isolation, corruption and version tolerance for the
   three browser-local save slots (storage half only; the picker dialog
   is DOM and stays out of node). */
'use strict';

global.window = global;

var store = {};
global.localStorage = {
  getItem: function (k) { return (k in store) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};

require('../js/i18n.js');
require('../js/save.js');

var SI = global.SI;
var fails = 0;

function check(cond, msg) {
  if (!cond) { fails++; console.error('FAIL: ' + msg); }
}

var SNAP = {
  v: 1,
  levelId: 5,
  loop: 1,
  difficulty: 'tight',
  carry: { score: 12345, lives: 2, weaponLevel: 3, missiles: 8, special: 2, maxHp: 6, options: 1 },
  savedAt: 1700000000000
};

/* ── empty start ─────────────────────────────── */
SI.Save.SLOTS.forEach(function (n) {
  check(SI.Save.read(n) === null, 'slot ' + n + ' should start empty');
});
check(SI.Save.hasAny() === false, 'hasAny should be false with no saves');

/* ── validation: garbage never round-trips ───── */
check(SI.Save.write(1, null) === false, 'writing null must fail');
check(SI.Save.write(1, { v: 2, levelId: 1 }) === false, 'writing a v:2 snapshot must fail');
check(SI.Save.write(1, { v: 1 }) === false, 'writing an incomplete snapshot must fail');
check(SI.Save.read(1) === null, 'failed writes must leave the slot empty');

/* ── roundtrip ───────────────────────────────── */
check(SI.Save.write(2, SNAP) === true, 'write should succeed');
var back = SI.Save.read(2);
check(back && back.levelId === 5 && back.loop === 1 && back.difficulty === 'tight',
  'roundtrip should preserve level/loop/difficulty');
check(back.carry.score === 12345 && back.carry.lives === 2 && back.carry.weaponLevel === 3 &&
  back.carry.missiles === 8 && back.carry.special === 2 && back.carry.maxHp === 6 &&
  back.carry.options === 1,
  'roundtrip should preserve the whole carry block');
check(back.savedAt === SNAP.savedAt, 'roundtrip should preserve savedAt');
check(SI.Save.hasAny() === true, 'hasAny should be true after a write');

/* ── slot isolation ──────────────────────────── */
check(SI.Save.read(1) === null && SI.Save.read(3) === null,
  'writing slot 2 must not touch slots 1/3');
var other = JSON.parse(JSON.stringify(SNAP));
other.levelId = 9;
SI.Save.write(1, other);
check(SI.Save.read(1).levelId === 9 && SI.Save.read(2).levelId === 5,
  'slot 1 and slot 2 must hold independent snapshots');

/* ── clear ───────────────────────────────────── */
SI.Save.clear(1);
check(SI.Save.read(1) === null, 'clear should empty the slot');
check(SI.Save.read(2) !== null, 'clear(1) must not affect slot 2');
SI.Save.clear(3);
check(SI.Save.hasAny() === true, 'slot 2 still holds a save');

/* ── corruption / version tolerance ──────────── */
store['si-save-2'] = '{not json';
check(SI.Save.read(2) === null, 'corrupt JSON should read as empty, not throw');
store['si-save-2'] = JSON.stringify({ v: 99, levelId: 1, loop: 0, carry: { score: 1, lives: 1 } });
check(SI.Save.read(2) === null, 'future snapshot versions should read as empty');
check(SI.Save.hasAny() === false, 'no valid saves remain');
SI.Save.clear(2);   /* tidy the poisoned slot */

/* ── UI half is present but DOM-free here ────── */
check(typeof SI.SaveUI.init === 'function' && typeof SI.SaveUI.open === 'function',
  'SaveUI should expose init/open');
check(SI.SaveUI.isOpen() === false, 'SaveUI.isOpen false without DOM');

/* ── summary ─────────────────────────────────── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('save-test: all checks passed (' + SI.Save.SLOTS.length + ' slots).');
}
