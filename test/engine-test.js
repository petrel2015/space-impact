/* Engine simulation tests — run: node test/engine-test.js
   Runs the real data packs through the engine deterministically and
   asserts simulation invariants, special-weapon rules and that every
   level is completable (invulnerable scripted player kills the boss). */
'use strict';

global.window = global;
require('../js/sprites.js');
require('../js/behaviors.js');
require('../js/engine.js');

var fs = require('fs');
var path = require('path');

var SI = global.SI;
var fails = 0;
var STEP = 1 / 60;

function check(cond, msg) {
  if (!cond) { fails++; console.error('FAIL: ' + msg); }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
}

var enemiesRaw = readJson('data/enemies.json');
var defs = SI.engine.compileEnemies(enemiesRaw);
var index = readJson('data/levels.json');
var levels = index.levels.map(function (f) {
  return SI.engine.compileLevel(readJson('data/' + f), defs);
});

var KNOWN_EVENTS = ['shoot', 'eshoot', 'hitEnemy', 'cancel', 'explode', 'bigExplode', 'hitPlayer',
  'shieldHit', 'powerup', 'special', 'bossWarn', 'bossDie', 'lifeLost',
  'levelClear', 'gameOver'];

/* ── invariants while simulating a whole level ── */
function simulate(level, seed, inputFn, maxSeconds, godMode) {
  var rt = SI.engine.createRuntime({
    defs: defs, level: level, seed: seed, difficulty: 1
  });
  var score = 0;
  var steps = Math.floor(maxSeconds / STEP);
  for (var i = 0; i < steps; i++) {
    var input = inputFn(rt, i * STEP);
    if (godMode) rt.player.invuln = 1; /* test hook: never take damage */
    SI.engine.step(rt, input, STEP);

    check(rt.player.hp >= 0 && rt.player.hp <= rt.player.maxHp, 'hp out of range');
    check(rt.player.lives >= 0 && rt.player.lives <= 4, 'lives out of range');
    check(rt.player.score >= score, 'score decreased');
    score = rt.player.score;
    check(rt.player.special >= 0 && rt.player.special <= 5, 'special charges out of range');
    check(rt.player.x >= -1 && rt.player.x + rt.player.w <= rt.W + 1, 'player x out of bounds');
    check(rt.player.y >= SI.engine.HUD_TOP - 1 && rt.player.y + rt.player.h <= rt.H - SI.engine.HUD_BOTTOM + 1,
      'player y leaks into HUD');
    rt.bullets.forEach(function (b) {
      check(b.x - b.w / 2 >= -2 && b.x - b.w / 2 <= rt.W + 5, 'player bullet leaked: ' + b.x.toFixed(2));
    });
    rt.ebullets.forEach(function (b) {
      check(b.x >= -6 && b.x <= rt.W + 8, 'enemy bullet leaked: ' + b.x);
    });
    rt.events.forEach(function (ev) {
      check(KNOWN_EVENTS.indexOf(ev.type) >= 0, 'unknown event type ' + ev.type);
    });
    rt.events.length = 0;

    if (rt.status === 'clear' && rt.clearTimer <= 0) return rt;
    if (rt.status === 'over') return rt;
  }
  return rt;
}

var NO_INPUT = { up: false, down: false, left: false, right: false, fire: false, special: false };

/* 1. every level completable: scripted invincible player, autofire */
levels.forEach(function (lvl) {
  var cap = (lvl.duration || 180) + 150;
  var rt = simulate(lvl, 42, function () {
    return { up: false, down: false, left: false, right: false, fire: true, special: false };
  }, cap, true);
  check(rt.status === 'clear',
    'level ' + lvl.id + ' not completed within ' + cap + 's (status=' + rt.status + ', t=' + rt.t.toFixed(1) + ')');
});

/* 2. mid-boss death must NOT clear the level (level 8 has mb1 + end boss) */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[7], seed: 11, difficulty: 1.2 });
  var sawBigDie = false;
  var steps = Math.floor(150 / STEP);   /* mb1 shows up around t≈137 */
  for (var i = 0; i < steps; i++) {
    rt.player.invuln = 1;
    SI.engine.step(rt, { up: false, down: false, left: false, right: false, fire: true, special: false }, STEP);
    for (var j = 0; j < rt.events.length; j++) {
      if (rt.events[j].type === 'bigExplode') {
        check(rt.status === 'play', 'level cleared by a non-end-boss death');
        sawBigDie = true;
      }
    }
    rt.events.length = 0;
  }
  check(sawBigDie, 'expected a mid-boss/big enemy death on level 8');
})();

/* 3. passive player dies eventually on level 2 (difficulty is real) */
(function () {
  var rt = simulate(levels[1], 7, function () { return NO_INPUT; }, 120, false);
  check(rt.status === 'over' || rt.player.hp < rt.player.maxHp || rt.player.lives < 3,
    'passive player took no damage on level 2');
})();

/* 4. determinism: same seed → identical trajectory */
(function () {
  var a = simulate(levels[0], 99, function () { return NO_INPUT; }, 30, false);
  var b = simulate(levels[0], 99, function () { return NO_INPUT; }, 30, false);
  var strip = function (rt) {
    return JSON.stringify({
      t: rt.t, status: rt.status,
      score: rt.player.score, hp: rt.player.hp, lives: rt.player.lives,
      enemies: rt.enemies.map(function (e) { return [e.id, Math.round(e.x * 100), Math.round(e.y * 100), e.hp]; }),
      bullets: rt.bullets.map(function (b) { return [Math.round(b.x), Math.round(b.y)]; }),
      ebullets: rt.ebullets.map(function (b) { return [Math.round(b.x), Math.round(b.y)]; })
    });
  };
  check(strip(a) === strip(b), 'same seed produced different runs');
})();

/* 5. special weapon: needs charges, consumes one per trigger */
(function () {
  var rt = SI.engine.createRuntime({
    defs: defs, level: levels[0], seed: 5, difficulty: 1,
    player: { special: 2 }
  });
  var input = { up: false, down: false, left: false, right: false, fire: false, special: true };
  SI.engine.step(rt, input, STEP);
  check(rt.player.special === 1, 'special should consume one charge');
  check(!!rt.beam, 'beam effect should be active');
  check(rt.events.some(function (e) { return e.type === 'special'; }), 'special event missing');
  SI.engine.step(rt, input, STEP); /* still held: no re-fire (edge) */
  check(rt.player.special === 1, 'held special key must not fire twice');
  rt.player.special = 0;
  rt.prevSpecial = false;
  SI.engine.step(rt, input, STEP);
  check(!rt.beam || rt.beam.t > 0.4, 'special with 0 charges must not fire');
})();

/* 6. powerups apply and clamp */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  var types = { power: 'weaponLevel', heal: 'hp', energy: 'special', shield: 'shield' };
  rt.player.hp = 4; /* leave headroom for the heal pickup */
  Object.keys(types).forEach(function (t) {
    var before = rt.player[types[t]];
    rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: t, age: 0 });
    SI.engine.step(rt, NO_INPUT, STEP);
    check(rt.powerups.length === 0, 'powerup ' + t + ' not collected');
    check(rt.player[types[t]] > before, 'powerup ' + t + ' had no effect');
  });
  rt.player.special = 5;
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'energy', age: 0 });
  SI.engine.step(rt, NO_INPUT, STEP);
  check(rt.player.special === 5, 'special charges exceeded max');
})();

/* 7. bad data rejected with bilingual error keys */
(function () {
  var threw = null;
  try {
    SI.engine.compileLevel({ id: 9, events: [{ t: 1, enemy: 'nope' }] }, defs);
  } catch (e) { threw = e; }
  check(threw && threw.key === 'errEnemyRef', 'unknown enemy should throw errEnemyRef');

  threw = null;
  try {
    var bad = JSON.parse(JSON.stringify(enemiesRaw));
    bad.drone.sprite = 'ghost';
    SI.engine.compileEnemies(bad);
  } catch (e) { threw = e; }
  check(threw && threw.key === 'errSpriteRef', 'unknown sprite should throw errSpriteRef');
})();

/* 8. opposing bullets cancel each other out */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 9, difficulty: 1 });
  rt.bullets.push({ x: 60, y: 40, vx: 110, vy: 0, w: 3, h: 2, dmg: 1, pierce: false });
  rt.ebullets.push({ x: 70, y: 40, vx: -30, vy: 0, w: 3, h: 3 });
  var sawCancel = false;
  for (var i = 0; i < 10; i++) {
    SI.engine.step(rt, NO_INPUT, STEP);
    if (rt.events.some(function (e) { return e.type === 'cancel'; })) sawCancel = true;
    rt.events.length = 0;
  }
  check(sawCancel, 'bullet-vs-bullet cancel event never fired');
  check(rt.bullets.every(function (b) { return b.x > 75; }), 'player bullet survived the collision');
  check(!rt.ebullets.some(function (b) { return b.y === 40 && b.x > 60 && b.x < 80; }),
    'enemy bullet survived the collision');
})();

/* 9. finite ammo: volleys cost one round, dry trigger blocks fire, kills recoup */
(function () {
  var rt = SI.engine.createRuntime({
    defs: defs, level: levels[0], seed: 9, difficulty: 1,
    player: { ammo: 3, ammoGain: 2, maxHp: 6 }
  });
  check(rt.player.maxHp === 6, 'difficulty maxHp not applied');
  var input = { up: false, down: false, left: false, right: false, fire: true, special: false };
  var shots = 0;
  for (var i = 0; i < 200; i++) {
    SI.engine.step(rt, input, STEP);
    rt.events.forEach(function (e) { if (e.type === 'shoot') shots++; });
    rt.events.length = 0;
  }
  check(shots === 3, 'expected exactly 3 volleys from 3 rounds, got ' + shots);
  check(rt.player.ammo === 0, 'ammo should hit 0 and stay');
  /* feed one kill's worth of rounds and confirm firing resumes */
  rt.player.ammo = 2;
  var more = 0;
  for (var j = 0; j < 120; j++) {
    SI.engine.step(rt, input, STEP);
    rt.events.forEach(function (e) { if (e.type === 'shoot') more++; });
    rt.events.length = 0;
  }
  check(more === 2, 'refilled rounds should fire exactly twice, got ' + more);
  /* kills recoup ammo on gain tiers: level 6 opens with a crab at t=5 */
  var crabRt = SI.engine.createRuntime({ defs: defs, level: levels[5], seed: 5, difficulty: 1 });
  crabRt.player.ammo = 200;
  crabRt.player.ammoGain = 2;
  var recouped = false, killed = false, prev;
  for (var k = 0; k < 600 && !recouped; k++) {
    crabRt.player.invuln = 1;
    prev = crabRt.player.ammo;
    SI.engine.step(crabRt, input, STEP);
    if (crabRt.events.some(function (e) { return e.type === 'explode' || e.type === 'bigExplode'; })) killed = true;
    if (crabRt.player.ammo > prev) recouped = true;   /* ammo only ever rises via kills */
    rt.events.length = 0;
  }
  check(killed, 'crab never died — test setup wrong');
  check(recouped, 'kill did not recoup ammo on a gain tier');
})();

/* 10. tall portrait resolution (144×128): spawns remap into the field */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 3, difficulty: 1, W: 144, H: 128 });
  check(rt.W === 144 && rt.H === 128, 'portrait runtime resolution not applied');
  for (var i = 0; i < Math.floor(7 * 60); i++) {   /* first wave lands at t=5 (+float slack) */
    rt.player.invuln = 1;
    SI.engine.step(rt, { up: false, down: false, left: false, right: false, fire: true, special: false }, STEP);
    rt.events.length = 0;
  }
  check(rt.enemies.length > 0, 'no enemies spawned on tall field');
  rt.enemies.forEach(function (e) {
    check(e.y >= 8 && e.y + e.h <= 128 - 8, 'enemy leaks out of tall field: ' + e.id + ' y=' + e.y.toFixed(1));
  });
  check(rt.player.y + rt.player.h <= 128 - 8, 'player outside tall field');
  /* boss recentres vertically on the tall field (level 1 boss at t≈178) */
  var rt2 = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 4, difficulty: 1, W: 144, H: 128 });
  var bossAt = levels[0].duration - 2;
  for (var j = 0; j < Math.floor((bossAt + 2) * 60); j++) {
    rt2.player.invuln = 1;
    SI.engine.step(rt2, { up: false, down: false, left: false, right: false, fire: false, special: false }, STEP);
  }
  var boss = rt2.enemies.filter(function (e) { return e.def.boss; })[0];
  check(boss && Math.abs((boss.y + boss.h / 2) - 64) < 12, 'boss not centred on tall field');
})();

/* ── summary ─────────────────────────────────── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('engine-test: all checks passed (' + levels.length + ' levels simulated).');
}
