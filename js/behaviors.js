/* =====================================================================
   Space Impact — behavior primitives (the engine's vocabulary)
   JSON data references these by id; adding an enemy = combining
   existing primitives + tuning numbers, no engine changes needed.

     movements[e.def.movement](e, dt, world)   — mutates e.x / e.y
     attacks[e.def.attack](e, world)           — returns {bullets, spawns}
     formations[e.formation](count, rng)       — returns [{dx, dy}, …]

   e (enemy instance): x, y (top-left), baseY, w, h, age, phase, speed,
   state {} (free scratch), def (compiled definition with .mp/.ap params).
   world: { W, H, player: {x, y, w, h}, rng }.
   Bullet specs are {x, y, vx, vy} in center coordinates, px/s.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function p(defs, params, key, fallback) {
    var v = params && params[key];
    return typeof v === 'number' ? v : fallback;
  }

  /* ── movement ─────────────────────────────── */
  var movements = {

    /* Fly straight left at e.speed. */
    straight: function (e, dt) {
      e.x -= e.speed * dt;
    },

    /* Leftward drift on a sine wave: mp {amp, period}. */
    sine: function (e, dt) {
      var amp = p(0, e.def.mp, 'amp', 10);
      var period = p(0, e.def.mp, 'period', 2);
      e.x -= e.speed * dt;
      e.y = e.baseY + amp * Math.sin((2 * Math.PI * e.age) / period + e.phase);
    },

    /* Diagonal: mp {vy} — negative climbs, positive dives. */
    drift: function (e, dt) {
      var vy = p(0, e.def.mp, 'vy', 8);
      e.x -= e.speed * dt;
      e.y = e.baseY + vy * e.age;
    },

    /* Advance, hold position, then leave: mp {x, hold}. */
    hover: function (e, dt) {
      var holdX = p(0, e.def.mp, 'x', 92);
      var hold = p(0, e.def.mp, 'hold', 4);
      if (e.state.mode !== 'held') {
        e.x -= e.speed * dt;
        if (e.x <= holdX) e.state.mode = 'held';
      } else {
        e.state.heldFor = (e.state.heldFor || 0) + dt;
        if (e.state.heldFor >= hold) e.state.mode = 'leave';
      }
      if (e.state.mode === 'leave') e.x -= e.speed * dt;
    },

    /* Slow leftward advance, tracking the player's y: mp {rate}. */
    chase: function (e, dt, world) {
      var rate = p(0, e.def.mp, 'rate', 14);
      var targetY = world.player.y + world.player.h / 2 - e.h / 2;
      e.y += clamp(targetY - e.y, -rate * dt, rate * dt);
      e.x -= e.speed * dt;
      e.baseY = e.y;
    },

    /* Boss: enter from the right, then bob vertically forever:
       mp {x, amp, period}. Never exits. */
    bossHover: function (e, dt) {
      var holdX = p(0, e.def.mp, 'x', 94);
      var amp = p(0, e.def.mp, 'amp', 8);
      var period = p(0, e.def.mp, 'period', 4);
      if (e.state.entered) {
        e.y = e.baseY + amp * Math.sin((2 * Math.PI * e.age) / period);
      } else {
        e.x -= e.speed * dt;
        if (e.x <= holdX) {
          e.x = holdX;
          e.state.entered = true;
          e.age0 = e.age;
        }
      }
    },

    /* Sharp triangular zig-zag while advancing: mp {amp, period}. */
    zigzag: function (e, dt) {
      var amp = p(0, e.def.mp, 'amp', 20);
      var period = p(0, e.def.mp, 'period', 1);
      var tri = (2 / Math.PI) * Math.asin(Math.sin((2 * Math.PI * e.age) / period));
      e.x -= e.speed * dt;
      e.y = e.baseY + amp * tri;
    },

    /* Enter, hang back, then kamikaze-dive at the player's row:
       mp {enter, hover, dive}. */
    dive: function (e, dt, world) {
      var enterX = p(0, e.def.mp, 'enter', 110);
      var hover = p(0, e.def.mp, 'hover', 1);
      var diveSpeed = p(0, e.def.mp, 'dive', 60);
      if (!e.state.mode) e.state.mode = 'enter';
      if (e.state.mode === 'enter') {
        e.x -= e.speed * dt;
        if (e.x <= enterX) { e.state.mode = 'hover'; e.state.t = 0; e.state.lockY = null; }
      } else if (e.state.mode === 'hover') {
        e.state.t += dt;
        e.baseY = e.y;
        if (e.state.t >= hover) {
          e.state.mode = 'dive';
          var py = world.player.y + world.player.h / 2;
          var dy = py - (e.y + e.h / 2);
          e.state.vy = dy >= 0 ? diveSpeed : -diveSpeed;
        }
      } else {
        e.y += e.state.vy * dt;
        e.baseY = e.y;
        e.x -= e.speed * dt;
      }
    },

    /* Stop-and-go advance: mp {run, pause}. Fires even while paused. */
    pulse: function (e, dt) {
      var run = p(0, e.def.mp, 'run', 1.2);
      var pause = p(0, e.def.mp, 'pause', 1);
      e.state.t = (e.state.t || 0) + dt;
      var cycle = run + pause;
      var phase = e.state.t % cycle;
      if (phase < run) e.x -= e.speed * dt;
    }
  };

  /* ── attacks ──────────────────────────────── */
  var attacks = {

    none: function () {
      return { bullets: [], spawns: [] };
    },

    /* Single leftward shot. */
    straight: function (e, world) {
      var bs = e.def.bulletSpeed;
      return { bullets: [{ x: e.x - 1, y: e.y + e.h / 2, vx: -bs, vy: 0 }], spawns: [] };
    },

    /* One shot aimed at the player. */
    aimed: function (e, world) {
      var bs = e.def.bulletSpeed;
      var px = world.player.x + world.player.w / 2;
      var py = world.player.y + world.player.h / 2;
      var dx = px - e.x, dy = py - (e.y + e.h / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { bullets: [{ x: e.x - 1, y: e.y + e.h / 2, vx: (dx / len) * bs, vy: (dy / len) * bs }], spawns: [] };
    },

    /* Cone of bullets facing left: ap {ways, spread}. */
    fan: function (e, world) {
      var ways = Math.max(1, Math.round(p(0, e.def.ap, 'ways', 3)));
      var spread = p(0, e.def.ap, 'spread', 0.7);
      var bs = e.def.bulletSpeed;
      var base = Math.PI; /* pointing left */
      var out = [], i, a;
      for (i = 0; i < ways; i++) {
        a = base + (ways === 1 ? 0 : (i / (ways - 1) - 0.5) * spread * 2);
        out.push({ x: e.x - 1, y: e.y + e.h / 2, vx: Math.cos(a) * bs, vy: Math.sin(a) * bs });
      }
      return { bullets: out, spawns: [] };
    },

    /* Quick volley at the player: ap {count, jitter}. */
    burst: function (e, world) {
      var count = Math.max(1, Math.round(p(0, e.def.ap, 'count', 3)));
      var jitter = p(0, e.def.ap, 'jitter', 0.25);
      var bs = e.def.bulletSpeed;
      var px = world.player.x + world.player.w / 2;
      var py = world.player.y + world.player.h / 2;
      var base = Math.atan2(py - (e.y + e.h / 2), px - e.x);
      var out = [], i, a;
      for (i = 0; i < count; i++) {
        a = base + (world.rng() * 2 - 1) * jitter;
        out.push({ x: e.x - 1, y: e.y + e.h / 2, vx: Math.cos(a) * bs, vy: Math.sin(a) * bs });
      }
      return { bullets: out, spawns: [] };
    },

    /* Rotating single shot (pinwheel): ap {step}. */
    spiral: function (e, world) {
      var step = p(0, e.def.ap, 'step', 0.7);
      var bs = e.def.bulletSpeed;
      e.state.spiral = (e.state.spiral || 0) + step;
      return {
        bullets: [{
          x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: Math.cos(e.state.spiral) * bs, vy: Math.sin(e.state.spiral) * bs
        }],
        spawns: []
      };
    },

    /* Vertical wall of slow bullets with one dodge gap:
       ap {gap, spacing}. Gap position is rolled per volley. */
    curtain: function (e, world) {
      var gap = p(0, e.def.ap, 'gap', 16);
      var spacing = p(0, e.def.ap, 'spacing', 8);
      var bs = e.def.bulletSpeed;
      var top = 10, bottom = (world.H || 80) - 9;
      var gapY = top + gap / 2 + world.rng() * Math.max(1, (bottom - top) - gap);
      var out = [], y;
      for (y = top + spacing / 2; y < bottom; y += spacing) {
        if (Math.abs(y - gapY) < gap / 2) continue;
        out.push({ x: e.x + e.w / 2, y: y, vx: -bs, vy: 0 });
      }
      return { bullets: out, spawns: [] };
    },

    /* Four diagonal shots (X pattern): ap {tilt}. */
    cross: function (e, world) {
      var tilt = p(0, e.def.ap, 'tilt', 0.785);
      var bs = e.def.bulletSpeed;
      var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      var out = [-tilt, tilt, Math.PI - tilt, Math.PI + tilt].map(function (a) {
        return { x: cx, y: cy, vx: Math.cos(a) * bs, vy: Math.sin(a) * bs };
      });
      return { bullets: out, spawns: [] };
    },

    /* Release minions: ap {enemy, count}. */
    spawn: function (e, world) {
      var id = e.def.ap && e.def.ap.enemy;
      var count = Math.max(1, Math.round(p(0, e.def.ap, 'count', 1)));
      return { bullets: [], spawns: id ? [{ enemy: id, count: count }] : [] };
    },

    /* Rotate through a list of sub-attacks: ap {list: [...]}.
       Each entry is an attack id, or {id, params} to override the
       shared parameter object just for that sub-attack. */
    cycle: function (e, world) {
      var list = (e.def.ap && e.def.ap.list) || [];
      if (!list.length) return { bullets: [], spawns: [] };
      var idx = e.state.cycleIndex || 0;
      e.state.cycleIndex = (idx + 1) % list.length;
      var entry = list[idx];
      var subId = typeof entry === 'string' ? entry : entry && entry.id;
      var fn = attacks[subId];
      if (!fn) return { bullets: [], spawns: [] };
      var savedAp = e.def.ap;
      if (typeof entry === 'object' && entry.params) e.def.ap = entry.params;
      var r = fn(e, world);
      e.def.ap = savedAp;
      return { bullets: r.bullets || [], spawns: r.spawns || [] };
    }
  };

  /* ── formations (spawn offsets, relative to base point) ── */
  var formations = {

    single: function (count) {
      var out = [], i;
      for (i = 0; i < count; i++) out.push({ dx: 0, dy: 0 });
      return out;
    },

    /* Vertical column, centered on base y. */
    lineV: function (count) {
      var out = [], i, gap = 10;
      for (i = 0; i < count; i++) out.push({ dx: 0, dy: (i - (count - 1) / 2) * gap });
      return out;
    },

    /* Horizontal row trailing right (enters one after another). */
    lineH: function (count) {
      var out = [], i, gap = 13;
      for (i = 0; i < count; i++) out.push({ dx: i * gap, dy: 0 });
      return out;
    },

    /* Zig-zag offsets. */
    stagger: function (count) {
      var out = [], i;
      for (i = 0; i < count; i++) out.push({ dx: i * 9, dy: i % 2 === 0 ? -6 : 6 });
      return out;
    },

    /* Scattered vertically. */
    scatter: function (count, rng) {
      var out = [], i;
      for (i = 0; i < count; i++) out.push({ dx: Math.floor(rng() * 30), dy: Math.floor(rng() * 40) - 20 });
      return out;
    }
  };

  SI.behaviors = {
    movements: movements,
    attacks: attacks,
    formations: formations
  };
})(typeof window !== 'undefined' ? window : globalThis);
