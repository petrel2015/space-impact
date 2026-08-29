/* Visual-feature verification for the aim tracer + missiles — run: node test/aim-visual-test.js
   Renders frames through the REAL renderer into a pixel-recording mock and
   asserts the dashed ray geometry, impact marker and missile trail. */
'use strict';

global.window = global;
require('../js/i18n.js');
require('../js/theme.js');
require('../js/sprites.js');
require('../js/behaviors.js');
require('../js/engine.js');
require('../js/render.js');
require('../js/level-template.js');

var fs = require('fs');
var path = require('path');
var SI = global.SI;
var fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.error('FAIL: ' + msg); } }

var defs = SI.engine.compileEnemies(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/enemies.json'), 'utf8')));
/* the custom-level template has no scenery entry, so the renderer stays
   on the plain theme LCD palette this test asserts pixel colors against */
var levels = [SI.engine.compileLevel(JSON.parse(JSON.stringify(SI.levelTemplate)), defs)];

/* pixel-recording 2D context: fillRect(x,y,w,h) lights w×h pixels */
function makeCtx(w, h) {
  var px = {};
  var color = null, alpha = 1;
  return {
    canvas: { width: w, height: h },
    set fillStyle(v) { color = v; },
    get fillStyle() { return color; },
    get globalAlpha() { return alpha; },
    set globalAlpha(v) { alpha = v; },
    createLinearGradient: function () { return { addColorStop: function () {} }; },
    save: function () {}, restore: function () {}, translate: function () {},
    fillRect: function (x, y, rw, rh) {
      x = Math.round(x); y = Math.round(y); rw = Math.round(rw); rh = Math.round(rh);
      for (var yy = y; yy < y + rh; yy++) {
        for (var xx = x; xx < x + rw; xx++) {
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          px[xx + ',' + yy] = color;
        }
      }
    },
    px: px
  };
}

var lcd = SI.theme.def().lcd;
function dimPx(ctx, x, y) { return ctx.px[x + ',' + y] === lcd.dim; }
function inkPx(ctx, x, y) { return ctx.px[x + ',' + y] === lcd.ink; }

/* ── scene 1: aim tracer with an enemy ahead ── */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 42, difficulty: 1 });
  rt.t = 3;                                  /* freeze dash phase at a known point */
  rt.player.aimTimer = 30;                   /* item active */
  var cy0 = Math.floor(rt.player.y + rt.player.h / 2);
  rt.enemies.push({
    id: 'drone', def: defs.drone, x: 90, y: cy0 - 2, baseY: cy0 - 2,
    w: defs.drone.w, h: defs.drone.h, hp: 5, maxHp: 5,
    speed: 0, fireInterval: Infinity, cooldown: Infinity, age: 0, phase: 0, state: {}, isBoss: false
  });
  var ctx = makeCtx(144, 80);
  SI.render.draw(ctx, rt, {});

  var p = rt.player;
  var cy = Math.floor(p.y + p.h / 2);
  var dashLit = 0, dashGap = 0;
  for (var x = p.x + p.w; x < 88; x++) {     /* up to the enemy's leading edge */
    if (dimPx(ctx, x, cy)) dashLit++; else dashGap++;
  }
  check(dashLit > 10, 'expected a dashed tracer, only ' + dashLit + ' lit pixels');
  check(dashGap > 10, 'tracer is solid, not dashed (' + dashGap + ' gaps)');

  /* nothing drawn past the enemy rect on the ray's row */
  var enemy = rt.enemies[0];
  var pastLit = 0;
  for (var x2 = enemy.x + enemy.w + 1; x2 < 143; x2++) {
    if (dimPx(ctx, x2, cy) || inkPx(ctx, x2, cy)) pastLit++;
  }
  check(pastLit === 0, 'tracer leaked past the target (' + pastLit + ' px)');

  /* impact cross: ink or dim pixels just right of/around the leading edge */
  var hitX = enemy.x, hitY = cy;
  var cross = inkPx(ctx, hitX - 1, hitY) || inkPx(ctx, hitX, hitY - 1) ||
              dimPx(ctx, hitX - 1, hitY) || dimPx(ctx, hitX, hitY - 1);
  check(cross, 'no impact marker at the tracer terminus');

  /* tracer only while the item's timer runs: expired → no dashes at all */
  var ctx2 = makeCtx(144, 80);
  rt.player.aimTimer = 0;
  SI.render.draw(ctx2, rt, {});
  var anyDim = false;
  for (var x3 = p.x + p.w; x3 < 88 && !anyDim; x3++) anyDim = dimPx(ctx2, x3, cy);
  check(!anyDim, 'tracer drawn with the aim item expired');

  /* the pickup itself renders with the crosshair sprite */
  rt.player.aimTimer = 5;
  rt.powerups.push({ x: 70, y: cy, type: 'aim', age: 0 });
  var ctx3 = makeCtx(144, 80);
  SI.render.draw(ctx3, rt, {});
  var icon = false;
  for (var ix = 66; ix <= 74 && !icon; ix++) {
    for (var iy = cy - 4; iy <= cy + 4 && !icon; iy++) { if (inkPx(ctx3, ix, iy)) icon = true; }
  }
  check(icon, 'aim pickup icon (pAim) not drawn on the field');
})();

/* ── scene 2: missile in flight gets warhead + exhaust trail ── */
(function () {
  var rt = SI.engine.createRuntime({ defs: defs, level: levels[0], seed: 42, difficulty: 1 });
  rt.t = 3;
  rt.bullets.push({ x: 60, y: 40, vx: 80, vy: 0, w: 4, h: 3, dmg: 3, pierce: false, missile: true });
  var ctx = makeCtx(144, 80);
  SI.render.draw(ctx, rt, {});
  var head = inkPx(ctx, 58, 39) || inkPx(ctx, 59, 40);
  check(head, 'missile warhead not drawn in ink');
  var trail = false;
  for (var tx = 53; tx <= 59; tx++) { if (dimPx(ctx, tx, 40)) trail = true; }
  check(trail, 'missile exhaust trail not drawn in dim');

  /* HUD shows the M count */
  rt.player.missiles = 7;
  var ctx2 = makeCtx(144, 80);
  SI.render.draw(ctx2, rt, {});
  var found = false;
  for (var y = 72; y < 80 && !found; y++) {
    for (var x = 95; x < 120 && !found; x++) { if (inkPx(ctx2, x, y)) found = true; }
  }
  check(found, 'M7 missile counter missing from the bottom HUD');
})();

/* ── summary ── */
if (fails) {
  console.error('\n' + fails + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('aim-visual-test: all checks passed.');
}
