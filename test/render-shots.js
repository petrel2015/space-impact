/* Headless scene renderer — run: node test/render-shots.js
   Drives the REAL engine + renderer + data packs with a mock 2D context
   and writes PNG screenshots of any level at any moment. No browser
   needed — used for visual verification and as a dev tool.

   Usage:
     node test/render-shots.js                # renders the default set
     node test/render-shots.js 5 42           # level 5, t=42s
   Output: PNG files in /tmp/si-shots/ (upscaled 4×, nearest neighbor). */
'use strict';

global.window = global;
require('../js/i18n.js');
require('../js/theme.js');
require('../js/sprites.js');
require('../js/behaviors.js');
require('../js/engine.js');
require('../js/render.js');

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var SI = global.SI;

/* ── minimal 2D context over a pixel buffer ─── */
function hex(c) {
  var m = /^#([0-9a-f]{6})$/i.exec(c || '#000000');
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [0, 0, 0];
}

function makeCtx(w, h) {
  var buf = new Uint8Array(w * h * 3);
  var st = { r: 0, g: 0, b: 0 };
  var stack = [];
  var alpha = 1;
  var ctx = {
    canvas: { width: w, height: h },
    get globalAlpha() { return alpha; },
    set globalAlpha(v) { alpha = v; },
    set fillStyle(v) { st = { c: v, grad: (v && typeof v === 'object' && v.at) ? v : null, rgb: hex(v) }; },
    get fillStyle() { return st.c; },
    /* vertical linear gradients are all the game uses (level scenery) */
    createLinearGradient: function (x0, y0, x1, y1) {
      var stops = [];
      return {
        addColorStop: function (off, color) { stops.push({ off: off, rgb: hex(color) }); },
        at: function (y) {
          if (!stops.length) return [0, 0, 0];
          var t = Math.max(0, Math.min(1, (y - y0) / ((y1 - y0) || 1)));
          stops.sort(function (a, b) { return a.off - b.off; });
          if (t <= stops[0].off) return stops[0].rgb;
          for (var i = 0; i < stops.length - 1; i++) {
            var a = stops[i], b = stops[i + 1];
            if (t >= a.off && t <= b.off) {
              var f = (t - a.off) / ((b.off - a.off) || 1);
              return [0, 1, 2].map(function (k) { return Math.round(a.rgb[k] + (b.rgb[k] - a.rgb[k]) * f); });
            }
          }
          return stops[stops.length - 1].rgb;
        }
      };
    },
    save: function () { stack.push({ tx: ctx.tx, ty: ctx.ty }); },
    restore: function () { var s = stack.pop(); ctx.tx = s ? s.tx : 0; ctx.ty = s ? s.ty : 0; },
    translate: function (x, y) { ctx.tx += x; ctx.ty += y; },
    tx: 0, ty: 0,
    fillRect: function (x, y, rw, rh) {
      x = Math.round(x + ctx.tx); y = Math.round(y + ctx.ty);
      rw = Math.round(rw); rh = Math.round(rh);
      for (var yy = y; yy < y + rh; yy++) {
        if (yy < 0 || yy >= h) continue;
        var rgb = st.grad ? st.grad.at(yy) : st.rgb;
        for (var xx = x; xx < x + rw; xx++) {
          if (xx < 0 || xx >= w) continue;
          var i = (yy * w + xx) * 3;
          buf[i] = Math.round(rgb[0] * alpha + buf[i] * (1 - alpha));
          buf[i + 1] = Math.round(rgb[1] * alpha + buf[i + 1] * (1 - alpha));
          buf[i + 2] = Math.round(rgb[2] * alpha + buf[i + 2] * (1 - alpha));
        }
      }
    },
    buf: buf, w: w, h: h
  };
  return ctx;
}

/* ── tiny PNG encoder (RGB, filter 0) ───────── */
var CRC = (function () {
  var t = new Uint32Array(256), c, n, k;
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return function (buf) {
    var v = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) v = t[(v ^ buf[i]) & 0xFF] ^ (v >>> 8);
    return (v ^ 0xFFFFFFFF) >>> 0;
  };
})();

function chunk(type, data) {
  var body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  var out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(CRC(body), 8 + data.length);
  return out;
}

function writePng(file, ctx, scale) {
  var w = ctx.w * scale, h = ctx.h * scale;
  var raw = Buffer.alloc(h * (1 + w * 3));
  for (var y = 0; y < h; y++) {
    var sy = Math.floor(y / scale);
    raw[y * (1 + w * 3)] = 0;
    for (var x = 0; x < w; x++) {
      var sx = Math.floor(x / scale);
      var si = (sy * ctx.w + sx) * 3;
      var di = y * (1 + w * 3) + 1 + x * 3;
      raw[di] = ctx.buf[si]; raw[di + 1] = ctx.buf[si + 1]; raw[di + 2] = ctx.buf[si + 2];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  return file;
}

/* ── scene helpers ──────────────────────────── */
function readJson(p) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8')); }
var defs = SI.engine.compileEnemies(readJson('data/enemies.json'));
var levels = readJson('data/levels.json').levels.map(function (f) {
  return SI.engine.compileLevel(readJson('data/' + f), defs);
});

function shot(name, levelIdx, atSeconds, opts) {
  var o = opts || {};
  var lvl = levels[levelIdx];
  var rt = SI.engine.createRuntime({
    defs: defs, level: lvl, seed: o.seed || 42,
    difficulty: o.difficulty || lvl.difficulty || 1,
    player: o.player
  });
  var input = o.input || { up: false, down: false, left: false, right: false, fire: true, special: false };
  if (o.mode) { rt.player.mode = o.mode; rt.player.modeTimer = o.modeTimer || 30; }
  /* aim tracer is now an item: activate by giving the timer seconds */
  if (o.aim) rt.player.aimTimer = o.aim === true ? 30 : o.aim;
  var steps = Math.floor(atSeconds * 60);
  for (var i = 0; i < steps; i++) {
    if (o.godmode) rt.player.invuln = 1;
    SI.engine.step(rt, input, 1 / 60);
  }
  /* optional state injection (pickups on field, wingmen, modes) plus
     extra simulated seconds after it, e.g. a blade mid-flight */
  if (o.setup) o.setup(rt);
  var tail = Math.floor((o.tail || 0) * 60);
  for (var t2 = 0; t2 < tail; t2++) {
    if (o.godmode) rt.player.invuln = 1;
    SI.engine.step(rt, input, 1 / 60);
  }
  var ctx = makeCtx(144, 80);
  SI.render.draw(ctx, rt, { hiScore: o.hiScore || 0 });
  var file = '/tmp/si-shots/' + name + '.png';
  writePng(file, ctx, 4);
  console.log('wrote', file, '(t=' + rt.t.toFixed(1) + 's, score=' + rt.player.score +
    ', status=' + rt.status + ', enemies=' + rt.enemies.map(function (e) { return e.id; }).join(',') + ')');
  return file;
}

/* CLI: node test/render-shots.js <level> <seconds> */
if (process.argv.length >= 4) {
  shot('cli-shot', parseInt(process.argv[2], 10) - 1, parseFloat(process.argv[3]), { godmode: true });
} else {
  /* default gallery: one scenery shot per campaign unit + boss beats */
  shot('s1-l1-drift', 0, 20, { godmode: true });
  shot('s2-l2-swarm', 1, 40, { godmode: true });
  shot('s3-l3-graveyard', 2, 70, { godmode: true });
  shot('s4-l4-blockade', 3, 45, { godmode: true });
  shot('s5-l5-turbulence', 4, 55, { godmode: true });
  shot('s6-l1-boss1', 0, 183, { godmode: true });
  shot('s7-l4-boss4', 3, 183, { godmode: true });
  shot('s8-l5-boss6', 4, 183, { godmode: true });
  shot('s9-ammo-hud', 0, 12, { godmode: true, player: { ammo: 348, ammoGain: 2, maxHp: 6 } });
  shot('s10-aim-tracer', 0, 14, { godmode: true, aim: true });
  shot('s11-missiles', 0, 14, { godmode: true, aim: true, player: { missiles: 7, ammo: 120, ammoGain: 2, maxHp: 6 } });
  shot('s12-aim-spread', 0, 20, { godmode: true, aim: true, mode: 'spread' });
  shot('p1-new-pickups', 0, 14, {
    godmode: true, aim: true,
    setup: function (rt) {
      rt.player.y = 46;
      rt.powerups.push({ x: 60, y: 30, type: 'boomerang', age: 0 });
      rt.powerups.push({ x: 85, y: 46, type: 'option', age: 0.3 });
      rt.powerups.push({ x: 110, y: 62, type: 'life', age: 0.6 });
    }
  });
  shot('p2-wingmen', 0, 14, {
    godmode: true, aim: true, tail: 0.5,
    setup: function (rt) {
      rt.player.y = 30;
      rt.player.options = 2;
      rt.player.optionY = [33.5, 52];
    }
  });
  shot('p3-boomerang', 0, 14, {
    godmode: true, aim: true, tail: 0.35,
    setup: function (rt) {
      rt.player.mode = 'boomerang';
      rt.player.modeTimer = 9;
      rt.player.cooldown = 0;
    }
  });
  shot('p4-aim-item', 0, 14, {
    godmode: true, aim: true,
    setup: function (rt) {
      rt.player.y = 46;
      rt.powerups.push({ x: 78, y: 40, type: 'aim', age: 0.3 });
    }
  });
  shot('n7-gameover', 1, 200, { input: { up: false, down: false, left: false, right: false, fire: false, special: false } });
}
