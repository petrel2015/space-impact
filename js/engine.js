/* =====================================================================
   Space Impact — engine core
   Interprets JSON data (enemies + levels) and runs a pure simulation.
   No DOM, no audio, no rendering — app.js drives it with input and a
   fixed timestep, render.js draws the state, so node tests can run
   whole levels deterministically.

   Data flow:
     raw JSON ──compileEnemies/compileLevel──▶ normalized defs
     defs ──createRuntime──▶ rt (mutable state) ──step(rt, input, dt)──▶ rt.events
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};

  /* ── constants (logical pixels) ───────────── */
  var W = 144, H = 80;
  var HUD_TOP = 8, HUD_BOTTOM = 8;
  var PLAYER_SPEED = 36;
  var FIRE_COOLDOWN = 0.26;
  var MAX_HP = 8, MAX_LIVES = 3, MAX_SPECIAL = 5;
  var POWERUP_TYPES = ['power', 'spread', 'laser', 'heal', 'energy', 'shield'];

  function DataError(key, params) {
    var e = new Error(key);
    e.name = 'DataError';
    e.key = key;
    e.params = params || {};
    return e;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* ── compile: enemies.json ────────────────── */
  function compileEnemies(raw) {
    if (!raw || typeof raw !== 'object') throw DataError('errLevelShape', { f: 'enemies.json' });
    var B = SI.behaviors, S = SI.sprites;
    var defs = {};
    Object.keys(raw).forEach(function (id) {
      var d = raw[id];
      var miss = function (f) { throw DataError('errField', { id: id, f: f }); };
      if (typeof d.hp !== 'number' || d.hp < 1) miss('hp');
      if (typeof d.score !== 'number' || d.score < 0) miss('score');
      if (typeof d.speed !== 'number' || d.speed <= 0) miss('speed');
      if (!S.has(d.sprite)) throw DataError('errSpriteRef', { id: id, sp: d.sprite });
      var mv = d.movement || 'straight';
      if (!B.movements[mv]) throw DataError('errMovement', { id: id, mv: mv });
      var at = d.attack || 'none';
      if (!B.attacks[at]) throw DataError('errAttack', { id: id, at: at });
      if (at === 'spawn' && !(d.attackParams && d.attackParams.enemy)) miss('attackParams.enemy');
      if (at === 'cycle') {
        var list = (d.attackParams && d.attackParams.list) || [];
        list.forEach(function (sub) {
          var subId = typeof sub === 'string' ? sub : (sub && sub.id);
          if (!subId || !B.attacks[subId]) throw DataError('errCycle', { id: id, at: subId });
        });
        if (!list.length) miss('attackParams.list');
      }
      var sp = S.get(d.sprite);
      defs[id] = {
        id: id,
        hp: d.hp, score: d.score, speed: d.speed,
        sprite: d.sprite, w: sp.w, h: sp.h,
        movement: mv, mp: d.params || {},
        attack: at, ap: d.attackParams || {},
        fireRate: typeof d.fireRate === 'number' ? d.fireRate : 0,
        bulletSpeed: typeof d.bulletSpeed === 'number' ? d.bulletSpeed : 24,
        drop: (d.drop && typeof d.drop === 'object') ? d.drop : null,
        boss: !!d.boss,
        miniboss: !!d.miniboss
      };
    });
    return defs;
  }

  /* ── compile: levels/levelN.json ──────────── */
  function compileLevel(raw, defs) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.events) || typeof raw.id !== 'number') {
      throw DataError('errLevelShape', { f: 'level?' });
    }
    var B = SI.behaviors;
    var lvlId = String(raw.id);
    var queue = [];
    var fieldH = H - HUD_TOP - HUD_BOTTOM;
    var compileRng = mulberry32(1); /* formation randomness is compile-time, not run-time */

    raw.events.forEach(function (ev) {
      var isBoss = !!ev.boss;
      var enemyId = isBoss ? ev.boss : ev.enemy;
      if (!enemyId || !defs[enemyId]) throw DataError('errEnemyRef', { lvl: lvlId, id: enemyId });
      var count = isBoss ? 1 : Math.max(1, Math.round(ev.count || 1));
      var interval = Math.max(0, ev.interval || 0.3);
      var formation = ev.formation || 'single';
      if (!isBoss && !B.formations[formation]) throw DataError('errFormation', { lvl: lvlId, f: formation });
      var frac = typeof ev.y === 'number' ? ev.y : 0.5;
      var baseY = HUD_TOP + frac * fieldH;

      if (isBoss) {
        queue.push({ t: Math.max(0, ev.t || 0), enemy: enemyId, x: W + 6, y: (H - defs[enemyId].h) / 2, boss: true });
        return;
      }
      var offs = B.formations[formation](count, compileRng);
      for (var i = 0; i < count; i++) {
        var y = baseY + (offs[i] ? offs[i].dy : 0);
        y = Math.max(HUD_TOP, Math.min(H - HUD_BOTTOM - defs[enemyId].h, y));
        queue.push({
          t: Math.max(0, ev.t || 0) + i * interval,
          enemy: enemyId,
          x: W + 6 + (offs[i] ? offs[i].dx : 0),
          y: y,
          boss: false
        });
      }
    });

    queue.sort(function (a, b) { return a.t - b.t; });
    var diff = typeof raw.difficulty === 'number' ? Math.min(3, Math.max(0.5, raw.difficulty)) : 1;
    return { id: raw.id, scrollSpeed: raw.scrollSpeed || 0, difficulty: diff, queue: queue };
  }

  /* ── runtime ──────────────────────────────── */
  function createRuntime(opts) {
    var rng = mulberry32(opts.seed == null ? 12345 : opts.seed);
    var difficulty = opts.difficulty || 1;   /* 1 = first loop */
    var carry = opts.player || {};

    var rt = {
      W: W, H: H,
      levelId: opts.level.id,
      difficulty: difficulty,
      t: 0,
      status: 'play',          /* play | clear | over */
      clearTimer: 0,
      warning: 0,
      beam: null,              /* {t, y} special beam effect */
      flash: 0,
      shake: 0,
      defs: opts.defs,
      level: opts.level,
      queue: opts.level.queue.slice(),
      cursor: 0,
      enemies: [], bullets: [], ebullets: [], powerups: [], particles: [],
      events: [],
      rng: rng,
      prevSpecial: false,
      player: {
        x: 12, y: (H - 7) / 2,
        w: SI.sprites.get('player').w, h: SI.sprites.get('player').h,
        hp: MAX_HP, maxHp: MAX_HP,
        lives: carry.lives != null ? carry.lives : MAX_LIVES,
        score: carry.score || 0,
        special: carry.special || 0,
        weaponLevel: carry.weaponLevel || 1,
        mode: 'normal', modeTimer: 0,
        shield: 0,
        invuln: 2,
        cooldown: 0
      }
    };
    return rt;
  }

  function spawnEnemy(rt, id, x, y, isBoss) {
    var def = rt.defs[id];
    if (!def) return;
    var loop = rt.difficulty - 1;
    var hp = Math.max(1, Math.round(def.hp * (1 + 0.4 * loop)));
    rt.enemies.push({
      id: id, def: def,
      x: x, y: y, baseY: y,
      w: def.w, h: def.h,
      hp: hp, maxHp: hp,
      speed: def.speed * (1 + 0.12 * loop),
      fireInterval: def.fireRate > 0 ? def.fireRate / (1 + 0.1 * loop) : Infinity,
      cooldown: def.fireRate > 0 ? def.fireRate * (0.4 + rt.rng()) : Infinity,
      age: 0, phase: rt.rng() * Math.PI * 2,
      state: {}, isBoss: !!def.boss || !!isBoss
    });
  }

  function pushEvent(rt, type, data) {
    rt.events.push({ type: type, data: data });
  }

  function explode(rt, x, y, big) {
    rt.particles.push({ x: x, y: y, age: 0, ttl: big ? 0.55 : 0.32, scale: big ? 2 : 1 });
    rt.shake = Math.min(1, rt.shake + (big ? 0.9 : 0.18));
  }

  function rollDrop(rt, def, x, y) {
    if (!def.drop) return;
    var roll = rt.rng(), acc = 0;
    for (var k in def.drop) {
      acc += def.drop[k];
      if (roll < acc) {
        if (POWERUP_TYPES.indexOf(k) >= 0) rt.powerups.push({ x: x, y: y, type: k, age: 0 });
        return;
      }
    }
  }

  function damagePlayer(rt, n) {
    var p = rt.player;
    if (p.invuln > 0 || rt.status !== 'play') return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.5;
      pushEvent(rt, 'shieldHit');
      return;
    }
    p.hp -= n;
    p.invuln = 1.2;
    rt.flash = Math.max(rt.flash, 0.3);
    pushEvent(rt, 'hitPlayer');
    if (p.hp <= 0) killPlayer(rt);
  }

  function killPlayer(rt) {
    var p = rt.player;
    explode(rt, p.x + p.w / 2, p.y + p.h / 2, true);
    p.lives--;
    if (p.lives > 0) {
      p.hp = p.maxHp;
      p.invuln = 2.5;
      p.weaponLevel = 1;
      p.mode = 'normal'; p.modeTimer = 0;
      p.shield = 0;
      p.y = (H - p.h) / 2;
      pushEvent(rt, 'lifeLost', { lives: p.lives });
    } else {
      p.hp = 0;
      rt.status = 'over';
      pushEvent(rt, 'gameOver');
    }
  }

  function killEnemy(rt, e, idx) {
    rt.enemies.splice(idx, 1);
    rt.player.score += e.def.score;
    explode(rt, e.x + e.w / 2, e.y + e.h / 2, e.def.boss || e.def.score >= 500);
    pushEvent(rt, e.def.boss ? 'bigExplode' : 'explode');
    if (e.def.boss && e.def.miniboss) {
      /* mid-boss: big reward, but the level goes on */
      rt.powerups.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, type: 'heal', age: 0 });
      return;
    }
    if (e.def.boss) {
      rt.powerups.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 - 8, type: 'heal', age: 0 });
      rt.powerups.push({ x: e.x + e.w / 2 + 8, y: e.y + e.h / 2 + 4, type: 'energy', age: 0 });
      pushEvent(rt, 'bossDie');
      rt.status = 'clear';
      rt.clearTimer = 2.2;
      pushEvent(rt, 'levelClear');
    } else {
      rollDrop(rt, e.def, e.x + e.w / 2, e.y + e.h / 2);
    }
  }

  function firePlayer(rt) {
    var p = rt.player;
    var cx = p.x + p.w, cy = p.y + p.h / 2;
    var B = 110;
    if (p.mode === 'laser') {
      rt.bullets.push({ x: cx + 4, y: cy, vx: 130, vy: 0, w: 8, h: 1, dmg: 2, pierce: true });
      p.cooldown = 0.2;
    } else if (p.mode === 'spread') {
      [-0.35, 0, 0.35].forEach(function (a) {
        rt.bullets.push({ x: cx, y: cy, vx: Math.cos(a) * B, vy: Math.sin(a) * B, w: 3, h: 2, dmg: 1, pierce: false });
      });
      p.cooldown = 0.3;
    } else if (p.weaponLevel >= 3) {
      [0, -3, 3].forEach(function (dy) {
        rt.bullets.push({ x: cx, y: cy + dy, vx: B, vy: 0, w: 3, h: 2, dmg: 1, pierce: false });
      });
      p.cooldown = FIRE_COOLDOWN;
    } else if (p.weaponLevel === 2) {
      [-2, 2].forEach(function (dy) {
        rt.bullets.push({ x: cx, y: cy + dy, vx: B, vy: 0, w: 3, h: 2, dmg: 1, pierce: false });
      });
      p.cooldown = FIRE_COOLDOWN;
    } else {
      rt.bullets.push({ x: cx, y: cy, vx: B, vy: 0, w: 3, h: 2, dmg: 1, pierce: false });
      p.cooldown = FIRE_COOLDOWN;
    }
    pushEvent(rt, 'shoot');
  }

  function fireSpecial(rt) {
    var p = rt.player;
    if (p.special <= 0 || rt.status !== 'play') return;
    p.special--;
    rt.beam = { t: 0.5, y: p.y + p.h / 2 };
    rt.flash = 0.5;
    rt.shake = 1;
    rt.ebullets.length = 0;
    for (var i = rt.enemies.length - 1; i >= 0; i--) {
      var e = rt.enemies[i];
      e.hp -= e.isBoss ? 30 : 10;
      if (e.hp <= 0) killEnemy(rt, e, i);
    }
    pushEvent(rt, 'special');
  }

  function applyPowerup(rt, pu) {
    var p = rt.player;
    switch (pu.type) {
      case 'power':
        if (p.weaponLevel < 3) p.weaponLevel++;
        else p.score += 200;
        break;
      case 'spread': p.mode = 'spread'; p.modeTimer = 12; break;
      case 'laser': p.mode = 'laser'; p.modeTimer = 10; break;
      case 'heal': p.hp = Math.min(p.maxHp, p.hp + 2); break;
      case 'energy': p.special = Math.min(MAX_SPECIAL, p.special + 1); break;
      case 'shield': p.shield = 3; break;
    }
    pushEvent(rt, 'powerup', { type: pu.type });
  }

  /* ── the simulation step ──────────────────── */
  function step(rt, input, dt) {
    dt = Math.min(dt, 0.05);
    var p = rt.player;
    var world = {
      W: W, H: H,
      player: p,
      rng: rt.rng
    };

    /* particles / timers tick even after game over */
    for (var pi = rt.particles.length - 1; pi >= 0; pi--) {
      rt.particles[pi].age += dt;
      if (rt.particles[pi].age >= rt.particles[pi].ttl) rt.particles.splice(pi, 1);
    }
    rt.shake = Math.max(0, rt.shake - dt * 2.4);
    rt.flash = Math.max(0, rt.flash - dt * 1.6);
    if (rt.warning > 0) rt.warning = Math.max(0, rt.warning - dt);
    if (rt.beam) { rt.beam.t -= dt; if (rt.beam.t <= 0) rt.beam = null; }

    if (rt.status === 'over') return;
    if (rt.status === 'clear') {
      rt.clearTimer -= dt;
    }

    rt.t += dt;

    /* scheduled spawns */
    while (rt.cursor < rt.queue.length && rt.queue[rt.cursor].t <= rt.t) {
      var q = rt.queue[rt.cursor++];
      spawnEnemy(rt, q.enemy, q.x, q.y, q.boss);
      if (q.boss) {
        rt.warning = 2.2;
        pushEvent(rt, 'bossWarn');
      }
    }

    /* player movement */
    var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    p.x += dx * PLAYER_SPEED * dt;
    p.y += dy * PLAYER_SPEED * dt;
    p.x = Math.max(0, Math.min(W - p.w, p.x));
    p.y = Math.max(HUD_TOP, Math.min(H - HUD_BOTTOM - p.h, p.y));
    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown -= dt;
    if (p.modeTimer > 0) {
      p.modeTimer -= dt;
      if (p.modeTimer <= 0) p.mode = 'normal';
    }

    /* fire & special */
    if (input.fire && p.cooldown <= 0 && rt.status !== 'over') firePlayer(rt);
    if (input.special && !rt.prevSpecial) fireSpecial(rt);
    rt.prevSpecial = !!input.special;

    /* enemies */
    for (var ei = rt.enemies.length - 1; ei >= 0; ei--) {
      var e = rt.enemies[ei];
      e.age += dt;
      SI.behaviors.movements[e.def.movement](e, dt, world);
      e.y = Math.max(HUD_TOP, Math.min(H - HUD_BOTTOM - e.h, e.y));
      if (!e.isBoss && e.x < -e.w - 6) { rt.enemies.splice(ei, 1); continue; }

      if (e.fireInterval !== Infinity) {
        e.cooldown -= dt;
        if (e.cooldown <= 0 && e.x < W - 4 && rt.status === 'play') {
          e.cooldown = e.fireInterval;
          var r = SI.behaviors.attacks[e.def.attack](e, world);
          var bl = r.bullets || [];
          for (var bi = 0; bi < bl.length; bi++) {
            rt.ebullets.push({ x: bl[bi].x, y: bl[bi].y, vx: bl[bi].vx, vy: bl[bi].vy, w: 3, h: 3 });
          }
          pushEvent(rt, 'eshoot');
          var sp = r.spawns || [];
          for (var si = 0; si < sp.length; si++) {
            for (var n = 0; n < sp[si].count; n++) {
              var my = e.y + e.h / 2 + (rt.rng() * 30 - 15);
              my = Math.max(HUD_TOP, Math.min(H - HUD_BOTTOM - 10, my));
              spawnEnemy(rt, sp[si].enemy, e.x + rt.rng() * 8 - 4, my, false);
            }
          }
        }
      }
    }

    /* bullets */
    for (var b1 = rt.bullets.length - 1; b1 >= 0; b1--) {
      var b = rt.bullets[b1];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x - b.w / 2 > W + 4 || b.y < HUD_TOP - 4 || b.y > H + 4) rt.bullets.splice(b1, 1);
    }
    for (var b2 = rt.ebullets.length - 1; b2 >= 0; b2--) {
      var eb = rt.ebullets[b2];
      eb.x += eb.vx * dt; eb.y += eb.vy * dt;
      if (eb.x < -4 || eb.x > W + 6 || eb.y < HUD_TOP - 4 || eb.y > H + 4) rt.ebullets.splice(b2, 1);
    }

    /* powerups drift */
    for (var pu1 = rt.powerups.length - 1; pu1 >= 0; pu1--) {
      var pu = rt.powerups[pu1];
      pu.age += dt;
      pu.x -= 14 * dt;
      pu.y += Math.sin(pu.age * 3) * 6 * dt;
      if (pu.x < -8) { rt.powerups.splice(pu1, 1); continue; }
      if (aabb(pu.x - 3, pu.y - 3, 7, 7, p.x, p.y, p.w, p.h)) {
        applyPowerup(rt, pu);
        rt.powerups.splice(pu1, 1);
      }
    }

    /* player bullets × enemies */
    for (var hb = rt.bullets.length - 1; hb >= 0; hb--) {
      var pb = rt.bullets[hb];
      for (var he = rt.enemies.length - 1; he >= 0; he--) {
        var te = rt.enemies[he];
        if (!aabb(pb.x - pb.w / 2, pb.y - pb.h / 2, pb.w, pb.h, te.x, te.y, te.w, te.h)) continue;
        te.hp -= pb.dmg;
        if (te.hp <= 0) killEnemy(rt, te, he);
        else pushEvent(rt, 'hitEnemy');
        if (!pb.pierce) { rt.bullets.splice(hb, 1); break; }
      }
    }

    if (rt.status === 'over') return;

    /* enemy bullets × player */
    for (var q1 = rt.ebullets.length - 1; q1 >= 0; q1--) {
      var qb = rt.ebullets[q1];
      if (aabb(qb.x - 1, qb.y - 1, 3, 3, p.x, p.y, p.w, p.h)) {
        rt.ebullets.splice(q1, 1);
        damagePlayer(rt, 1);
      }
    }

    /* enemies × player (ramming, throttled per enemy) */
    for (var q2 = rt.enemies.length - 1; q2 >= 0; q2--) {
      var re = rt.enemies[q2];
      re.ramCd = Math.max(0, (re.ramCd || 0) - dt);
      if (aabb(re.x, re.y, re.w, re.h, p.x, p.y, p.w, p.h)) {
        if (re.ramCd <= 0) {
          re.ramCd = 0.8;
          re.hp -= 3;
          re.x += 5; /* bump apart so it is one hit, not a meat grinder */
          if (re.hp <= 0) killEnemy(rt, re, q2);
          damagePlayer(rt, 2);
        }
      }
    }
  }

  SI.engine = {
    W: W, H: H, HUD_TOP: HUD_TOP, HUD_BOTTOM: HUD_BOTTOM,
    MAX_HP: MAX_HP, MAX_SPECIAL: MAX_SPECIAL,
    DataError: DataError,
    mulberry32: mulberry32,
    aabb: aabb,
    compileEnemies: compileEnemies,
    compileLevel: compileLevel,
    createRuntime: createRuntime,
    step: step
  };
})(typeof window !== 'undefined' ? window : globalThis);
