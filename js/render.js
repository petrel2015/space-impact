/* =====================================================================
   Space Impact — canvas renderer
   Draws engine state onto the 144×80 logical canvas using the active
   theme's LCD palette. The canvas element is CSS-upscaled with
   image-rendering: pixelated, so every fillRect here is one LCD pixel.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};

  var POWERUP_SPRITES = {
    power: 'pPower', spread: 'pSpread', laser: 'pLaser',
    heal: 'pHeal', energy: 'pEnergy', shield: 'pShield', missile: 'pMissile',
    boomerang: 'pBoomerang', option: 'pOption', life: 'pLife'
  };

  /* Static parallax starfield — deterministic, engine-independent. */
  var STARS = (function () {
    var rng = SI.engine.mulberry32(7);
    var out = [], i;
    for (i = 0; i < 22; i++) {
      out.push({
        x: Math.floor(rng() * 144),
        y: 10 + Math.floor(rng() * 60),
        v: 4 + Math.floor(rng() * 3) * 3,
        big: rng() < 0.3
      });
    }
    return out;
  })();

  function text(ctx, str, x, y, opts) {
    var o = opts || {};
    var scale = o.scale || 1;
    var color = o.color;
    str = String(str).toUpperCase();
    ctx.fillStyle = color;
    for (var i = 0; i < str.length; i++) {
      var glyph = SI.sprites.FONT[str[i]];
      if (!glyph) continue;
      for (var r = 0; r < 7; r++) {
        var row = glyph[r];
        for (var c = 0; c < 5; c++) {
          if (row[c] === 'X') {
            ctx.fillRect(x + i * 6 * scale + c * scale, y + r * scale, scale, scale);
          }
        }
      }
    }
  }

  function measure(str, scale) {
    return String(str).length * 6 * (scale || 1) - (scale || 1);
  }

  function sprite(ctx, name, x, y, opts) {
    var o = opts || {};
    var scale = o.scale || 1;
    var sp = SI.sprites.get(name);
    if (!sp) return;
    ctx.fillStyle = o.color;
    var r, c;
    for (r = 0; r < sp.rows.length; r++) {
      var row = sp.rows[r];
      for (c = 0; c < row.length; c++) {
        if (row[c] === 'X') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  function centeredBox(ctx, lcd, str, scale, rt) {
    var W = rt.W, H = rt.H;
    var w = measure(str, scale) + 10;
    var h = 7 * scale + 8;
    var x = Math.floor((W - w) / 2);
    var y = Math.floor((H - h) / 2);
    ctx.fillStyle = lcd.bg;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = lcd.ink;
    ctx.fillRect(x - 2, y - 2, w + 4, 1);
    ctx.fillRect(x - 2, y + h + 1, w + 4, 1);
    ctx.fillRect(x - 2, y - 2, 1, h + 4);
    ctx.fillRect(x + w + 1, y - 2, 1, h + 4);
    text(ctx, str, x + 5, y + 4, { scale: scale, color: lcd.ink });
  }

  /* Aim tracer: faint animated dashed rays from the muzzle along the
     next volley's real trajectories (engine.volleyRays), each stopping
     at the first enemy it would hit — a blinking cross marks impact.
     Helps finite-ammo pilots line up before spending a round. */
  function drawAim(ctx, rt, lcd) {
    var rays = SI.engine.volleyRays(rt.player);
    var phase = Math.floor(rt.t * 14);
    var top = 9, bottom = rt.H - 9;
    for (var r = 0; r < rays.length; r++) {
      var ray = rays[r];
      var hit = null;
      ctx.fillStyle = lcd.dim;
      for (var d = 0; d < rt.W + 8; d++) {
        var sx = ray.x + ray.ux * d, sy = ray.y + ray.uy * d;
        if (sx > rt.W - 1 || sy < top || sy > bottom) break;
        for (var e = 0; e < rt.enemies.length; e++) {
          var en = rt.enemies[e];
          if (sx >= en.x && sx <= en.x + en.w && sy >= en.y && sy <= en.y + en.h) {
            hit = { x: sx, y: sy };
            break;
          }
        }
        if (hit) break;
        if ((d + phase) % 5 < 2) ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
      }
      if (hit) {
        ctx.fillStyle = Math.floor(rt.t * 6) % 2 === 0 ? lcd.ink : lcd.dim;
        var hx = Math.floor(hit.x), hy = Math.floor(hit.y);
        ctx.fillRect(hx - 1, hy, 3, 1);
        ctx.fillRect(hx, hy - 1, 1, 3);
      }
    }
  }

  function draw(ctx, rt, opts) {
    var o = opts || {};
    var lcd = SI.theme.def().lcd;
    var W = rt.W, H = rt.H;
    var p = rt.player;

    ctx.fillStyle = lcd.bg;
    ctx.fillRect(0, 0, W, H);

    /* starfield (playfield only, mapped onto this field height) */
    ctx.fillStyle = lcd.dim;
    for (var s = 0; s < STARS.length; s++) {
      var star = STARS[s];
      var sx = (star.x - rt.t * star.v) % W;
      if (sx < 0) sx += W;
      var sy = 10 + Math.round((star.y - 10) * (H - 20) / 60);
      ctx.fillRect(Math.floor(sx), sy, 1, star.big ? 2 : 1);
    }

    /* world (with shake offset) */
    var shx = 0, shy = 0;
    if (rt.shake > 0) {
      shx = Math.round(Math.sin(rt.t * 97) * rt.shake * 2);
      shy = Math.round(Math.cos(rt.t * 83) * rt.shake * 2);
    }
    ctx.save();
    ctx.translate(shx, shy);

    /* powerups (blink dim/ink) */
    for (var i = 0; i < rt.powerups.length; i++) {
      var pu = rt.powerups[i];
      var blink = Math.floor(pu.age * 5) % 2 === 0;
      sprite(ctx, POWERUP_SPRITES[pu.type], Math.floor(pu.x) - 3, Math.floor(pu.y) - 3,
        { color: blink ? lcd.ink : lcd.dim });
    }

    /* enemies */
    for (var e = 0; e < rt.enemies.length; e++) {
      var en = rt.enemies[e];
      sprite(ctx, en.def.sprite, Math.floor(en.x), Math.floor(en.y), { color: lcd.ink });
    }

    /* player bullets (missiles get a warhead + flickering exhaust) */
    for (var b = 0; b < rt.bullets.length; b++) {
      var bl = rt.bullets[b];
      if (bl.missile) {
        ctx.fillStyle = lcd.ink;
        ctx.fillRect(Math.floor(bl.x) - 2, Math.floor(bl.y) - 1, 4, 3);
        ctx.fillStyle = lcd.dim;
        var ex = Math.floor(bl.x) - 3 - (Math.floor(rt.t * 30) % 2);
        ctx.fillRect(ex, Math.floor(bl.y), 3, 1);
        continue;
      }
      if (bl.boomerang) {
        /* spinning blade: horizontal ↔ vertical bar swap reads as rotation */
        var rgx = Math.floor(bl.x), rgy = Math.floor(bl.y);
        ctx.fillStyle = lcd.ink;
        if (Math.floor(rt.t * 20) % 2 === 0) {
          ctx.fillRect(rgx - 2, rgy, 5, 1);
          ctx.fillRect(rgx, rgy - 1, 1, 3);
        } else {
          ctx.fillRect(rgx, rgy - 2, 1, 5);
          ctx.fillRect(rgx - 1, rgy, 3, 1);
        }
        continue;
      }
      ctx.fillStyle = lcd.ink;
      ctx.fillRect(Math.floor(bl.x - bl.w / 2), Math.floor(bl.y - bl.h / 2), bl.w, bl.h);
    }

    /* enemy bullets */
    for (var eb = 0; eb < rt.ebullets.length; eb++) {
      var q = rt.ebullets[eb];
      sprite(ctx, 'ebullet', Math.floor(q.x) - 1, Math.floor(q.y) - 1, { color: lcd.ink });
    }

    /* player (blink while invulnerable) */
    if (rt.status !== 'over' && !(p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0)) {
      sprite(ctx, 'player', Math.floor(p.x), Math.floor(p.y), { color: lcd.ink });
      if (p.shield > 0) {
        ctx.fillStyle = lcd.dim;
        ctx.fillRect(Math.floor(p.x) - 2, Math.floor(p.y) - 2, p.w + 4, 1);
        ctx.fillRect(Math.floor(p.x) - 2, Math.floor(p.y) + p.h + 1, p.w + 4, 1);
        ctx.fillRect(Math.floor(p.x) - 2, Math.floor(p.y) - 2, 1, p.h + 4);
        ctx.fillRect(Math.floor(p.x) + p.w + 1, Math.floor(p.y) - 2, 1, p.h + 4);
      }
    }

    /* wingmen trail the ship (mini hulls, y eased by the engine) */
    if (rt.status !== 'over') {
      for (var wo = 0; wo < p.options; wo++) {
        var wpos = SI.engine.optionPos(p, wo);
        sprite(ctx, 'playerMini', Math.floor(wpos.x), Math.floor(wpos.y) - 1, { color: lcd.ink });
      }
    }

    /* explosion particles */
    for (var pa = 0; pa < rt.particles.length; pa++) {
      var pt = rt.particles[pa];
      var frame = pt.age / pt.ttl < 0.33 ? 'ex1' : (pt.age / pt.ttl < 0.66 ? 'ex2' : 'ex3');
      sprite(ctx, frame, Math.floor(pt.x - (frame === 'ex1' ? 2.5 : frame === 'ex2' ? 3.5 : 4.5) * pt.scale),
        Math.floor(pt.y - (frame === 'ex1' ? 2.5 : frame === 'ex2' ? 3.5 : 4.5) * pt.scale),
        { scale: pt.scale, color: lcd.ink });
    }

    /* special beam */
    if (rt.beam) {
      var by = Math.floor(rt.beam.y);
      ctx.fillStyle = lcd.ink;
      ctx.fillRect(0, by - 1, W, 3);
      ctx.fillStyle = lcd.dim;
      ctx.fillRect(0, by - 3, W, 1);
      ctx.fillRect(0, by + 2, W, 1);
    }

    /* aim tracer sits on top of the world, under HUD and overlays */
    if (o.aim && rt.status !== 'over') drawAim(ctx, rt, lcd);

    ctx.restore();

    /* ── HUD ── */
    ctx.fillStyle = lcd.dim;
    ctx.fillRect(0, HUD_LINE_TOP_Y, W, 1);
    ctx.fillRect(0, H - 8, W, 1);

    text(ctx, 'SCORE ' + p.score, 1, 0, { color: lcd.ink });
    var hi = 'HI ' + (o.hiScore != null ? o.hiScore : 0);
    text(ctx, hi, W - 1 - measure(hi, 1), 0, { color: lcd.dim });

    /* bottom: spare ships, HP bar, special charges */
    var bx = 1;
    for (var l = 0; l < p.lives; l++) {
      sprite(ctx, 'playerMini', bx, H - 6, { color: lcd.ink });
      bx += 6;
    }
    bx += 3;
    for (var hp = 0; hp < p.maxHp; hp++) {
      ctx.fillStyle = hp < p.hp ? lcd.ink : lcd.dim;
      ctx.fillRect(bx + hp * 4, H - 6, 3, 4);
    }
    /* ammo counter (finite-ammo difficulty tiers only) */
    if (p.ammo !== Infinity) {
      bx += p.maxHp * 4 + 5;
      var dry = p.ammo <= 0;
      ctx.fillStyle = dry ? lcd.dim : lcd.ink;
      ctx.fillRect(bx, H - 4, 4, 2);
      text(ctx, String(p.ammo), bx + 6, H - 8, { color: dry ? lcd.dim : lcd.ink });
    }
    var sx2 = W - 1 - (5 * 3 + 4);
    /* reward-weapon stock: M + count, left of the special charges */
    if (p.missiles > 0) {
      var mt = 'M' + p.missiles;
      text(ctx, mt, sx2 - 7 - measure(mt, 1) - 3, H - 8, { color: lcd.ink });
    }
    text(ctx, 'S', sx2 - 7, H - 8, { color: lcd.dim });
    for (var sp2 = 0; sp2 < 5; sp2++) {
      ctx.fillStyle = sp2 < p.special ? lcd.ink : lcd.dim;
      ctx.fillRect(sx2 + sp2 * 3, H - 6, 2, 4);
    }

    /* boss HP bar */
    var boss = null;
    for (var bo = 0; bo < rt.enemies.length; bo++) {
      if (rt.enemies[bo].isBoss) { boss = rt.enemies[bo]; break; }
    }
    if (boss) {
      var bw = 60;
      var bxx = Math.floor((W - bw) / 2);
      ctx.fillStyle = lcd.dim;
      ctx.fillRect(bxx - 1, 9, bw + 2, 3);
      ctx.fillStyle = lcd.bg;
      ctx.fillRect(bxx, 10, bw, 1);
      ctx.fillStyle = lcd.ink;
      ctx.fillRect(bxx, 10, Math.max(0, Math.round(bw * boss.hp / boss.maxHp)), 1);
    }

    /* ── status texts ── */
    if (rt.warning > 0 && Math.floor(rt.warning * 4) % 2 === 0) {
      centeredBox(ctx, lcd, 'WARNING', 2, rt);
    } else if (rt.status === 'clear') {
      centeredBox(ctx, lcd, 'CLEAR!', 2, rt);
    } else if (rt.status === 'over') {
      centeredBox(ctx, lcd, 'GAME OVER', 2, rt);
    } else if (rt.t < 2.0) {
      centeredBox(ctx, lcd, 'LEVEL ' + rt.levelId, 1, rt);
    }

    /* flash overlay */
    if (rt.flash > 0) {
      ctx.globalAlpha = Math.min(0.4, rt.flash * 0.5);
      ctx.fillStyle = lcd.ink;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  var HUD_LINE_TOP_Y = 8;

  SI.render = {
    draw: draw,
    text: text,
    sprite: sprite,
    measure: measure
  };
})(typeof window !== 'undefined' ? window : globalThis);
