/* Icon generator — run: node test/make-icons.js
   Renders favicon-16/32.png and apple-touch-icon.png (180×180) from the
   game's own sprite grids and LCD palette, so the icons always match
   the game's look. Zero dependencies. */
'use strict';

global.window = global;
require('../js/sprites.js');

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var SI = global.SI;

/* ── pixel canvas + PNG writer (same approach as render-shots.js) ── */
function hex(c) {
  var m = /^#([0-9a-f]{6})$/i.exec(c);
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
}

function makeCtx(w, h, bg) {
  var rgb = hex(bg);
  var buf = new Uint8Array(w * h * 3);
  for (var i = 0; i < buf.length; i += 3) {
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
  }
  return {
    w: w, h: h, buf: buf,
    px: function (x, y, color) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      var c = hex(color), i = (y * w + x) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  };
}

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
      var si = (sy * ctx.w + Math.floor(x / scale)) * 3;
      var di = y * (1 + w * 3) + 1 + x * 3;
      raw[di] = ctx.buf[si]; raw[di + 1] = ctx.buf[si + 1]; raw[di + 2] = ctx.buf[si + 2];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  var png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  console.log('wrote', file, w + 'x' + h);
}

/* ── compose ────────────────────────────────── */
var INK = '#252d12';      /* LCD foreground (retro theme) */
var DIM = '#8a9a4e';      /* faint stars */
var BG = '#c3d179';       /* LCD cell background */

function drawSprite(ctx, name, x, y, color) {
  var sp = SI.sprites.get(name);
  sp.rows.forEach(function (row, r) {
    for (var c = 0; c < row.length; c++) {
      if (row[c] === 'X') ctx.px(x + c, y + r, color);
    }
  });
}

/* small favicon grid (16): ship + one star, breathing room */
(function () {
  var c = makeCtx(16, 16, BG);
  drawSprite(c, 'player', 3, 5, INK);
  c.px(12, 3, DIM); c.px(2, 12, DIM); c.px(13, 11, DIM);
  writePng('favicon-16.png', c, 1);
  writePng('favicon-32.png', c, 2);
})();

/* apple-touch-icon (180 = 45×4): a tiny battle scene */
(function () {
  var c = makeCtx(45, 45, BG);
  /* stars */
  [[3, 6], [11, 3], [22, 7], [36, 4], [41, 13], [6, 36], [18, 41], [33, 39], [42, 30], [27, 34]].forEach(function (s) {
    c.px(s[0], s[1], DIM);
  });
  /* player ship + tracer */
  drawSprite(c, 'player', 7, 20, INK);
  c.px(18, 23, INK); c.px(19, 23, INK); c.px(20, 23, INK);
  /* two drones closing in */
  drawSprite(c, 'drone', 29, 11, INK);
  drawSprite(c, 'drone', 32, 27, INK);
  writePng('apple-touch-icon.png', c, 4);
})();
