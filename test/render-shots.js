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
    set fillStyle(v) { st = { c: v, rgb: hex(v) }; },
    get fillStyle() { return st.c; },
    save: function () { stack.push({ tx: ctx.tx, ty: ctx.ty }); },
    restore: function () { var s = stack.pop(); ctx.tx = s ? s.tx : 0; ctx.ty = s ? s.ty : 0; },
    translate: function (x, y) { ctx.tx += x; ctx.ty += y; },
    tx: 0, ty: 0,
    fillRect: function (x, y, rw, rh) {
      x = Math.round(x + ctx.tx); y = Math.round(y + ctx.ty);
      rw = Math.round(rw); rh = Math.round(rh);
      for (var yy = y; yy < y + rh; yy++) {
        if (yy < 0 || yy >= h) continue;
        for (var xx = x; xx < x + rw; xx++) {
          if (xx < 0 || xx >= w) continue;
          var i = (yy * w + xx) * 3;
          buf[i] = Math.round(st.rgb[0] * alpha + buf[i] * (1 - alpha));
          buf[i + 1] = Math.round(st.rgb[1] * alpha + buf[i + 1] * (1 - alpha));
          buf[i + 2] = Math.round(st.rgb[2] * alpha + buf[i + 2] * (1 - alpha));
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
  var steps = Math.floor(atSeconds * 60);
  for (var i = 0; i < steps; i++) {
    if (o.godmode) rt.player.invuln = 1;
    SI.engine.step(rt, input, 1 / 60);
  }
  var ctx = makeCtx(144, 80);
  SI.render.draw(ctx, rt, { hiScore: o.hiScore || 0, aim: o.aim });
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
  /* default gallery set */
  shot('n1-l5-wasps-cube', 4, 14, { godmode: true });
  shot('n2-l5-miniboss', 4, 42, { godmode: true });
  shot('n3-l5-boss4', 4, 66, { godmode: true });
  shot('n4-l6-curtain', 5, 10, { godmode: true });
  shot('n5-l7-manta-dive', 6, 12, { godmode: true });
  shot('n6-l14-final-boss', 13, 96, { godmode: true });
  shot('n8-ammo-hud', 0, 12, { godmode: true, player: { ammo: 348, ammoGain: 2, maxHp: 6 } });
  shot('n9-aim-tracer', 4, 14, { godmode: true, aim: true });
  shot('n10-missiles', 4, 14, { godmode: true, aim: true, player: { missiles: 7, ammo: 120, ammoGain: 2, maxHp: 6 } });
  shot('n11-aim-spread', 4, 20, { godmode: true, aim: true, mode: 'spread' });
  shot('n7-gameover', 1, 200, { input: { up: false, down: false, left: false, right: false, fire: false, special: false } });
}
