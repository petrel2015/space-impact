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
  'shieldHit', 'powerup', 'special', 'missileShoot', 'bossWarn', 'bossDie', 'lifeLost',
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
    if (godMode) {
      rt.player.invuln = 1;                 /* test hook: never take damage */
      /* and never lose rounds to bullet-cancel: scripted shots pierce */
      rt.bullets.forEach(function (b) { b.pierce = true; });
    }
    SI.engine.step(rt, input, STEP);

    check(rt.player.hp >= 0 && rt.player.hp <= rt.player.maxHp, 'hp out of range');
    check(rt.player.lives >= 0 && rt.player.lives <= 5, 'lives out of range');
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

/* 2. mid-boss death must NOT clear the level (level 4 has mb1+mb2 + end boss) */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[3], seed: 11, difficulty: 1.2 });
  var sawBigDie = false;
  var steps = Math.floor(150 / STEP);   /* mb1 shows up around t≈95, mb2 at t≈125 */
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
  check(sawBigDie, 'expected a mid-boss/big enemy death on level 4');
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
  /* kills recoup ammo on gain tiers: level 4's opening bomber (t=12,
     y=0.45) crosses the stationary gunner's row and dies */
  var gainRt = SI.engine.createRuntime({ defs: defs, level: levels[3], seed: 5, difficulty: 1 });
  gainRt.player.ammo = 200;
  gainRt.player.ammoGain = 2;
  var recouped = false, killed = false, prev;
  for (var k = 0; k < 3000 && !recouped; k++) {
    gainRt.player.invuln = 1;
    prev = gainRt.player.ammo;
    SI.engine.step(gainRt, input, STEP);
    if (gainRt.events.some(function (e) { return e.type === 'explode' || e.type === 'bigExplode'; })) killed = true;
    if (gainRt.player.ammo > prev) recouped = true;   /* ammo only ever rises via kills */
    rt.events.length = 0;
  }
  check(killed, 'opening bomber never died — test setup wrong');
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

/* 11. reward weapon: homing missiles drop-pickup, own ammo pool, home in */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 21, difficulty: 1 });
  var input = { up: false, down: false, left: false, right: false, fire: false, special: false };
  var fireOn = { up: false, down: false, left: false, right: false, fire: true, special: false };

  /* pickup grants a capped stockpile */
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'missile', age: 0 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.missiles === 12, 'missile pickup should grant 12 warheads, got ' + rt.player.missiles);
  rt.player.missiles = 18;
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'missile', age: 0 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.missiles === 20, 'missile stockpile should cap at 20, got ' + rt.player.missiles);

  /* firing consumes one missile, emits missileShoot, never touches
     the finite-round stockpile, and works with a dry bullet mag */
  rt.player.ammo = 0;
  rt.player.cooldown = 0;
  SI.engine.step(rt, fireOn, STEP);
  check(rt.player.missiles === 19, 'volley should spend one missile');
  check(rt.events.some(function (e) { return e.type === 'missileShoot'; }), 'missileShoot event missing');
  check(!rt.events.some(function (e) { return e.type === 'shoot'; }), 'missile volley must not also fire bullets');

  /* the launched missile curves onto a target ahead and kills it */
  rt.player.missiles = 5;
  rt.player.cooldown = 0;
  rt.enemies.push({
    id: 'drone', def: defs.drone, x: rt.player.x + 60, y: rt.player.y - 14, baseY: rt.player.y - 14,
    w: defs.drone.w, h: defs.drone.h, hp: 1, maxHp: 1,
    speed: 0, fireInterval: Infinity, cooldown: Infinity,
    age: 0, phase: 0, state: {}, isBoss: false
  });
  var missile = rt.bullets.filter(function (b) { return b.missile; })[0];
  check(!!missile, 'no missile in flight after firing');
  check(missile.dmg === 3, 'missile should carry heavy damage');
  var killed = false;
  for (var i = 0; i < 240 && !killed; i++) {
    rt.player.invuln = 1;
    SI.engine.step(rt, input, STEP);
    killed = rt.events.some(function (e) { return e.type === 'explode'; });
    rt.events.length = 0;
  }
  check(killed, 'off-axis homing missile never reached its target');

  /* missiles plow through enemy fire instead of cancelling out */
  rt.bullets.push({ x: 60, y: 40, vx: 60, vy: 0, w: 4, h: 3, dmg: 3, pierce: false, missile: true });
  rt.ebullets.push({ x: 64, y: 40, vx: -30, vy: 0, w: 3, h: 3 });
  SI.engine.step(rt, input, STEP);
  check(rt.bullets.some(function (b) { return b.missile; }), 'missile was eaten by bullet-cancel');
  check(rt.ebullets.length === 1, 'missile should not consume enemy bullets either');

  /* stockpile exhausted → trigger falls back to normal bullets */
  rt.player.missiles = 1;
  rt.player.cooldown = 0;
  rt.player.ammo = Infinity;
  SI.engine.step(rt, fireOn, STEP);
  rt.player.cooldown = 0;
  SI.engine.step(rt, fireOn, STEP);
  check(rt.player.missiles === 0, 'last missile should have been spent');
  check(rt.events.some(function (e) { return e.type === 'shoot'; }), 'depleted missiles should revert to bullets');

  /* losing a life forfeits the reward weapon, like the power level */
  rt.player.missiles = 7;
  rt.player.hp = 1;
  rt.player.invuln = 0;
  rt.ebullets.push({ x: rt.player.x + 1, y: rt.player.y + 1, vx: 0, vy: 0, w: 3, h: 3 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.missiles === 0, 'death should drop the missile stockpile');
})();

/* 12. aim tracer geometry mirrors the real volley for every weapon mode */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  var p = rt.player;
  var cases = [
    { mode: 'normal', weaponLevel: 1, missiles: 0, options: 0, expect: 1 },
    { mode: 'normal', weaponLevel: 2, missiles: 0, options: 0, expect: 2 },
    { mode: 'normal', weaponLevel: 3, missiles: 0, options: 0, expect: 3 },
    { mode: 'spread', weaponLevel: 1, missiles: 0, options: 0, expect: 3 },
    { mode: 'laser', weaponLevel: 1, missiles: 0, options: 0, expect: 1 },
    { mode: 'boomerang', weaponLevel: 1, missiles: 0, options: 0, expect: 1 },
    { mode: 'normal', weaponLevel: 1, missiles: 4, options: 0, expect: 1 },
    { mode: 'normal', weaponLevel: 1, missiles: 0, options: 1, expect: 2 },
    { mode: 'normal', weaponLevel: 1, missiles: 4, options: 2, expect: 3 }
  ];
  cases.forEach(function (c) {
    p.mode = c.mode; p.modeTimer = 5; p.weaponLevel = c.weaponLevel; p.missiles = c.missiles;
    p.options = c.options; p.optionY.length = 0;
    for (var oi = 0; oi < p.options; oi++) p.optionY.push(p.y + p.h / 2);
    rt.bullets.length = 0;
    var rays = SI.engine.volleyRays(p);
    check(rays.length === c.expect,
      'mode ' + c.mode + ' lvl' + c.weaponLevel + ' m' + c.missiles + ' o' + c.options + ': ' + rays.length + ' rays, expected ' + c.expect);
    rays.forEach(function (r) {
      var len = Math.sqrt(r.ux * r.ux + r.uy * r.uy);
      check(Math.abs(len - 1) < 1e-9, 'ray direction not normalized (len=' + len + ')');
      check(r.x > p.x - 14 && r.y >= p.y - 1 && r.y <= p.y + p.h + 1, 'ray origin outside the formation');
    });
    /* the real volley pushes exactly as many bullets as the tracer shows */
    p.cooldown = 0;
    var before = rt.bullets.length;
    SI.engine.step(rt, { up: false, down: false, left: false, right: false, fire: true, special: false }, STEP);
    check(rt.bullets.length - before === c.expect,
      'volley pushed ' + (rt.bullets.length - before) + ' bullets but tracer showed ' + c.expect);
  });
})();

/* 13. 1UP: rare pickup grants a spare ship, converts to points at full strength */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  rt.player.lives = 3;
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'life', age: 0 });
  SI.engine.step(rt, NO_INPUT, STEP);
  check(rt.player.lives === 4, '1UP should grant one spare ship');
  var score = rt.player.score;
  rt.player.lives = SI.engine.LIFE_MAX;
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'life', age: 0 });
  SI.engine.step(rt, NO_INPUT, STEP);
  check(rt.player.lives === SI.engine.LIFE_MAX, 'lives must cap at LIFE_MAX');
  check(rt.player.score === score + 500,
    'overflow 1UP should convert to 500 points, got +' + (rt.player.score - score));
})();

/* 14. boomerang: free throws, full-field glide, one bite per leg, catch */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  var input = NO_INPUT;
  var fireOn = { up: false, down: false, left: false, right: false, fire: true, special: false };

  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'boomerang', age: 0 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.mode === 'boomerang', 'boomerang pickup should switch the weapon mode');

  /* the blade comes back to hand: throws never spend a round */
  rt.player.cooldown = 0;
  rt.player.ammo = 5;
  SI.engine.step(rt, fireOn, STEP);
  check(rt.player.ammo === 5, 'boomerang throw should not consume ammo');
  var rang = rt.bullets.filter(function (b) { return b.boomerang; })[0];
  check(!!rang && rang.pierce && rang.vx > 0, 'volley should launch a piercing outbound boomerang');

  /* even a dry clip keeps the blade looping */
  rt.player.cooldown = 0;
  rt.player.ammo = 0;
  var bladesBefore = rt.bullets.filter(function (b) { return b.boomerang; }).length;
  SI.engine.step(rt, fireOn, STEP);
  var bladesAfter = rt.bullets.filter(function (b) { return b.boomerang; }).length;
  check(bladesAfter === bladesBefore + 1, 'dry clip should still throw the blade');

  /* a tanky target on the pilot's row: the blade must pierce it both
     ways, once per leg */
  rt.bullets.length = 0;
  var cy = rt.player.y + rt.player.h / 2;
  rt.enemies.push({
    id: 'drone', def: defs.drone, x: rt.player.x + 40, y: rt.player.y, baseY: rt.player.y,
    w: defs.drone.w, h: defs.drone.h, hp: 60, maxHp: 60,
    speed: 0, fireInterval: Infinity, cooldown: Infinity,
    age: 0, phase: 0, state: {}, isBoss: false
  });
  rt.player.cooldown = 0;
  SI.engine.step(rt, fireOn, STEP);   /* dry clip still launches the blade */
  var rang = rt.bullets.filter(function (b) { return b.boomerang; })[0];
  check(!!rang, 'blade should be in flight for the two-leg test');

  var flipped = false, recovered = false, hpAfterOut = null, minD = 1e9, maxX = 0;
  for (var i = 0; i < 600; i++) {
    rt.player.invuln = 1;
    SI.engine.step(rt, input, STEP);
    rt.events.length = 0;
    var r2 = rt.bullets.filter(function (b) { return b.boomerang; })[0];
    if (!r2) { recovered = true; break; }
    if (r2.x > maxX) maxX = r2.x;
    if (!flipped && r2.vx < 0) {
      flipped = true;
      hpAfterOut = rt.enemies.length ? rt.enemies[0].hp : 60;
    }
    if (flipped) {
      var d = Math.abs(r2.x - rt.player.x - rt.player.w / 2) + Math.abs(r2.y - cy);
      if (d < minD) minD = d;
    }
  }
  check(flipped, 'boomerang never turned around');
  check(recovered, 'returning boomerang was never caught');
  check(minD < 12, 'return leg never came back to the ship (closest ' + minD.toFixed(1) + 'px)');
  check(maxX > 100, 'blade should glide across the field (reached x=' + maxX.toFixed(1) + ')');
  check(hpAfterOut === 58, 'outbound leg should bite the target exactly once for 2 (hp ' + hpAfterOut + ')');
  var finalHp = rt.enemies.length ? rt.enemies[0].hp : 60;
  check(finalHp === 56, 'return leg should bite again exactly once (hp ' + finalHp + ' after ' + hpAfterOut + ')');

  /* the mode expires back to the normal trigger */
  rt.player.mode = 'boomerang'; rt.player.modeTimer = 0.01;
  SI.engine.step(rt, input, STEP);
  check(rt.player.mode === 'normal', 'boomerang mode should expire');
})();

/* 15. wingmen: count caps, escort every weapon, death scatters, carry re-arms */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  var input = NO_INPUT;
  var fireOn = { up: false, down: false, left: false, right: false, fire: true, special: false };

  for (var k = 0; k < 3; k++) {
    rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'option', age: 0 });
    SI.engine.step(rt, input, STEP);
  }
  check(rt.player.options === SI.engine.OPTION_MAX, 'wingmen should cap at ' + SI.engine.OPTION_MAX);
  check(rt.player.optionY.length === SI.engine.OPTION_MAX, 'every wingman needs a tracked row');

  /* a full escort still fires alongside homing missile launches */
  rt.player.missiles = 3;
  rt.player.cooldown = 0;
  rt.bullets.length = 0;
  SI.engine.step(rt, fireOn, STEP);
  check(rt.bullets.length === 3 && rt.bullets.filter(function (b) { return b.missile; }).length === 1,
    'missile volley should be escorted by two wingman bullets');

  /* losing a life forfeits the escorts, like the missile stockpile
     (clear the lane first so escort bullets can't cancel the kill shot) */
  rt.bullets.length = 0;
  rt.player.hp = 1;
  rt.player.invuln = 0;
  rt.ebullets.push({ x: rt.player.x + 1, y: rt.player.y + 1, vx: 0, vy: 0, w: 3, h: 3 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.options === 0 && rt.player.optionY.length === 0, 'death should scatter the wingmen');

  /* the carry block re-arms them on the next level / save load */
  var rt2 = SI.engine.createRuntime({
    defs: defs, level: levels[0], seed: 5, difficulty: 1,
    player: { options: 2 }
  });
  SI.engine.step(rt2, input, STEP);
  check(rt2.player.options === 2 && rt2.player.optionY.length === 2, 'carry.options should re-arm the wingmen');
})();

/* 16. aim tracer item: timed pickup, stacks with a cap, lost on death */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 5, difficulty: 1 });
  var input = NO_INPUT;

  check(rt.player.aimTimer === 0, 'aim tracer must start inactive');

  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'aim', age: 0 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.aimTimer > 19 && rt.player.aimTimer <= 20,
    'aim pickup should grant ~20s, got ' + rt.player.aimTimer);

  /* repeat pickups stack up to the cap */
  rt.player.aimTimer = 44;
  rt.powerups.push({ x: rt.player.x + 2, y: rt.player.y + 2, type: 'aim', age: 0 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.aimTimer <= 45, 'aim time exceeded the 45s cap: ' + rt.player.aimTimer);

  /* the timer runs down to expiry */
  rt.player.aimTimer = 1.5;
  for (var i = 0; i < Math.ceil(2 / STEP); i++) SI.engine.step(rt, input, STEP);
  check(rt.player.aimTimer === 0, 'aim timer should expire');

  /* losing a life forfeits the tracer */
  rt.player.aimTimer = 10;
  rt.player.hp = 1;
  rt.player.invuln = 0;
  rt.ebullets.push({ x: rt.player.x + 1, y: rt.player.y + 1, vx: 0, vy: 0, w: 3, h: 3 });
  SI.engine.step(rt, input, STEP);
  check(rt.player.aimTimer === 0, 'death should drop the aim tracer');
})();

/* ── summary ─────────────────────────────────── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('engine-test: all checks passed (' + levels.length + ' levels simulated).');
}
