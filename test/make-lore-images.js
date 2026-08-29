/* Lore book image generator — run: node test/make-lore-images.js
   Renders docs/lore/images/ from the game's own sprite grids and the
   five unit palettes: one portrait per monster (foe-*.png) and one
   banner per campaign unit (banner-l*.png). Same zero-dependency PNG
   writer as make-icons.js, so the book always matches the game's look. */
'use strict';

global.window = global;
require('../js/sprites.js');

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var SI = global.SI;
var OUT = path.join(__dirname, '..', 'docs', 'lore', 'images');
fs.mkdirSync(OUT, { recursive: true });

/* ── pixel canvas + PNG writer (same approach as make-icons.js) ── */
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
  fs.writeFileSync(path.join(OUT, file), png);
  console.log('wrote', file, w + 'x' + h);
}

/* ── drawing helpers ────────────────────────────────────────── */
function drawSprite(ctx, name, x, y, color, scale) {
  var sp = SI.sprites.get(name);
  if (!sp) throw new Error('no sprite: ' + name);
  var s = scale || 1;
  sp.rows.forEach(function (row, r) {
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== 'X') continue;
      if (s === 1) ctx.px(x + c, y + r, color);
      else for (var dy = 0; dy < s; dy++) for (var dx = 0; dx < s; dx++) ctx.px(x + c * s + dx, y + r * s + dy, color);
    }
  });
  return sp;
}

function drawText(ctx, text, x, y, color, scale) {
  var s = scale || 1, cx = x, FONT = SI.sprites.FONT;
  text.toUpperCase().split('').forEach(function (ch) {
    var g = FONT[ch];
    if (!g) { cx += 4 * s; return; }
    g.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        if (row[c] !== 'X') continue;
        if (s === 1) ctx.px(cx + c, y + r, color);
        else for (var dy = 0; dy < s; dy++) for (var dx = 0; dx < s; dx++) ctx.px(cx + c * s + dx, y + r * s + dy, color);
      }
    });
    cx += 6 * s;
  });
}

function mix(a, b, t) {
  var ca = hex(a), cb = hex(b);
  function ch(i) {
    var v = Math.round(ca[i] + (cb[i] - ca[i]) * t);
    return (v < 16 ? '0' : '') + v.toString(16);
  }
  return '#' + ch(0) + ch(1) + ch(2);
}

function gradient(ctx, top, bottom) {
  for (var y = 0; y < ctx.h; y++) {
    var c = mix(top, bottom, y / (ctx.h - 1));
    for (var x = 0; x < ctx.w; x++) ctx.px(x, y, c);
  }
}

/* deterministic star scatter so re-runs are identical */
function stars(ctx, seed, n, color) {
  var s = seed;
  function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
  for (var i = 0; i < n; i++) ctx.px(Math.floor(rnd() * ctx.w), Math.floor(rnd() * ctx.h), color);
}

/* ── five unit palettes ─────────────────────────────────────── */
var UNITS = [
  {
    id: 'l1', tag: 'EP01 THE DRIFT', accent: '#e0b36a', dim: '#7d6b4c',
    bgTop: '#4a4136', bgBot: '#16120e'
  },
  {
    id: 'l2', tag: 'EP02 SWARM NEBULA', accent: '#ff8fb8', dim: '#8a4a72',
    bgTop: '#472052', bgBot: '#130a1a'
  },
  {
    id: 'l3', tag: 'EP03 IRON GRAVEYARD', accent: '#7fd8ff', dim: '#3f5f8a',
    bgTop: '#1d2c52', bgBot: '#090c18'
  },
  {
    id: 'l4', tag: 'EP04 THE BLOCKADE', accent: '#ffa25c', dim: '#8a4a3a',
    bgTop: '#4c1f1c', bgBot: '#150808'
  },
  {
    id: 'l5', tag: 'EP05 THE WAY HOME', accent: '#7dffe8', dim: '#4a6a9a',
    bgTop: '#23305e', bgBot: '#0b1320'
  }
];

/* which sprite portraits belong to which unit (for accent color) */
var PORTRAITS = {
  l1: ['rock', 'bat', 'manta', 'boss1'],
  l2: ['wasp', 'sting', 'chaser', 'boss2'],
  l3: ['drone', 'cube', 'spinner', 'spider', 'boss3'],
  l4: ['gunner', 'bomber', 'crab', 'lasher', 'bastion', 'boss4'],
  l5: ['boss6']
};

/* ── portraits: 34×34 logical, sprite centered on dark card ── */
UNITS.forEach(function (u) {
  PORTRAITS[u.id].forEach(function (name) {
    var sp = SI.sprites.get(name);
    var S = 34;
    var c = makeCtx(S, S, '#0d0d10');
    /* 1px frame + corner ticks in the unit's dim tone */
    for (var i = 1; i < S - 1; i++) {
      c.px(i, 0, u.dim); c.px(i, S - 1, u.dim);
      c.px(0, i, u.dim); c.px(S - 1, i, u.dim);
    }
    [1, S - 2].forEach(function (e) {
      c.px(e, 1, u.accent); c.px(1, e, u.accent);
      c.px(e, S - 2, u.accent); c.px(S - 2, e, u.accent);
    });
    var x = Math.floor((S - sp.w) / 2), y = Math.floor((S - sp.h) / 2);
    drawSprite(c, name, x, y, u.accent);
    writePng('foe-' + name + '.png', c, 6);
  });
});

/* ── banners: 240×72 logical scene per unit, ×4 ─────────────── */
function banner(u, paint) {
  var W = 240, H = 72;
  var c = makeCtx(W, H, '#000000');
  gradient(c, u.bgTop, u.bgBot);
  stars(c, W + H, 30, u.dim);
  paint(c, u);
  /* player ship + tracers, bottom-left */
  drawSprite(c, 'player', 12, 48, '#f2f2f2');
  drawSprite(c, 'pbullet', 36, 51, '#f2f2f2');
  drawSprite(c, 'pbullet', 46, 51, '#f2f2f2');
  /* unit tag */
  drawText(c, u.tag, 10, 60, u.dim);
  writePng('banner-' + u.id + '.png', c, 4);
}

/* EP01 — drift field: rocks near and far, cave fauna, boss dead ahead */
banner(UNITS[0], function (c, u) {
  drawSprite(c, 'rock', 42, 8, u.dim, 2);
  drawSprite(c, 'rock', 60, 40, u.dim, 2);
  drawSprite(c, 'rock', 78, 22, u.accent);
  drawSprite(c, 'rock', 96, 44, u.accent);
  drawSprite(c, 'bat', 108, 16, u.accent);
  drawSprite(c, 'bat', 122, 30, u.accent);
  drawSprite(c, 'manta', 136, 40, u.accent);
  drawSprite(c, 'boss1', 182, 14, u.accent, 2);
});

/* EP02 — swarm nebula: fast bugs in loose scatter, broodmother behind */
banner(UNITS[1], function (c, u) {
  drawSprite(c, 'sting', 60, 10, u.dim, 2);
  drawSprite(c, 'wasp', 92, 14, u.accent);
  drawSprite(c, 'wasp', 104, 30, u.accent);
  drawSprite(c, 'wasp', 118, 18, u.accent);
  drawSprite(c, 'sting', 132, 36, u.accent);
  drawSprite(c, 'chaser', 146, 22, u.accent);
  drawSprite(c, 'chaser', 152, 42, u.accent);
  drawSprite(c, 'boss2', 180, 12, u.accent, 2);
});

/* EP03 — iron graveyard: orderly guard drones, fortress core */
banner(UNITS[2], function (c, u) {
  drawSprite(c, 'drone', 96, 10, u.dim, 2);
  drawSprite(c, 'drone', 92, 22, u.accent);
  drawSprite(c, 'drone', 104, 22, u.accent);
  drawSprite(c, 'drone', 116, 22, u.accent);
  drawSprite(c, 'cube', 132, 34, u.accent);
  drawSprite(c, 'spinner', 138, 12, u.accent);
  drawSprite(c, 'spider', 152, 42, u.accent);
  drawSprite(c, 'boss3', 182, 8, u.accent, 2);
});

/* EP04 — raider blockade: mixed fleet line, flagship at the rear */
banner(UNITS[3], function (c, u) {
  drawSprite(c, 'bomber', 60, 8, u.dim, 2);
  drawSprite(c, 'bomber', 96, 16, u.accent);
  drawSprite(c, 'gunner', 118, 30, u.accent);
  drawSprite(c, 'crab', 112, 44, u.accent);
  drawSprite(c, 'lasher', 138, 18, u.accent);
  drawSprite(c, 'bastion', 146, 38, u.accent);
  drawSprite(c, 'boss4', 182, 14, u.accent, 2);
});

/* EP05 — maelstrom: a wormhole vortex swallows everything at once */
banner(UNITS[4], function (c, u) {
  /* wormhole vortex: dotted rings around the boss */
  var cx = 204, cy = 30;
  [[16, u.dim], [23, u.accent], [30, u.dim]].forEach(function (ring) {
    var r = ring[0];
    for (var a = 0; a < 36; a++) {
      var ang = a * Math.PI / 18;
      c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.8), ring[1]);
    }
  });
  drawSprite(c, 'rock', 88, 14, u.accent);
  drawSprite(c, 'bat', 100, 34, u.accent);
  drawSprite(c, 'wasp', 112, 20, u.accent);
  drawSprite(c, 'cube', 124, 40, u.accent);
  drawSprite(c, 'crab', 136, 12, u.accent);
  drawSprite(c, 'spider', 150, 30, u.accent);
  drawSprite(c, 'boss6', 184, 14, u.accent, 2);
});
