/* =====================================================================
   Space Impact — synthesized sound effects (WebAudio, zero assets)
   Hand-crafted bleeps, noise bursts and layered explosions in the
   spirit of the original handset, run through a master compressor.

   Design notes:
   - tone()  : oscillator with pitch sweep + exponential decay envelope
   - noise() : white-noise buffer through a lowpass whose cutoff sweeps
   - sounds  : layered combinations of the two, tuned by ear
   - throttle: identical sounds within a few ms are skipped so
               auto-fire doesn't turn into mush
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var STORE_KEY = 'si-sound';

  var ctx = null;
  var master = null;
  var enabled = true;
  var lastPlay = {};

  function detect() {
    var saved = null;
    try { saved = global.localStorage && global.localStorage.getItem(STORE_KEY); } catch (e) {}
    return saved === null ? true : saved === '1';
  }

  function unlock() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        /* glue + protect ears from layered explosions clipping */
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 8;
        master.connect(comp);
        comp.connect(ctx.destination);
      } catch (e) { ctx = null; return; }
    }
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (e) {}
    }
  }

  /* ── synth helpers (t0 = seconds from now) ── */
  function tone(o) {
    var t0 = ctx.currentTime + (o.at || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t0);
    if (o.f1 && o.f1 !== o.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    }
    var v = o.vol || 0.1;
    var atk = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  }

  var noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function noise(o) {
    var t0 = ctx.currentTime + (o.at || 0);
    var src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = o.q || 0.8;
    lp.frequency.setValueAtTime(Math.max(40, o.f0 || 1500), t0);
    if (o.f1) lp.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + o.dur);
    var g = ctx.createGain();
    var v = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.03);
  }

  /* ── the sound palette ── */
  var SFX = {
    shoot: function () {                      /* light laser pew */
      tone({ f0: 920, f1: 660, dur: 0.05, type: 'square', vol: 0.04 });
      tone({ f0: 1400, f1: 980, dur: 0.03, type: 'sine', vol: 0.022 });
    },
    eshoot: function () {                     /* enemy thunk */
      tone({ f0: 330, f1: 290, dur: 0.045, type: 'square', vol: 0.026 });
    },
    hitEnemy: function () {                   /* metal tick */
      tone({ f0: 210, f1: 170, dur: 0.03, type: 'triangle', vol: 0.05 });
      noise({ f0: 2600, f1: 900, dur: 0.025, vol: 0.03 });
    },
    explode: function () {                    /* crunchy small boom */
      noise({ f0: 1400, f1: 160, dur: 0.22, vol: 0.15 });
      tone({ f0: 190, f1: 42, dur: 0.2, type: 'square', vol: 0.08 });
    },
    bigExplode: function () {                 /* layered deep boom */
      noise({ f0: 2200, f1: 80, dur: 0.7, vol: 0.2 });
      tone({ f0: 95, f1: 28, dur: 0.6, type: 'sine', vol: 0.18 });
      noise({ f0: 900, f1: 120, dur: 0.3, vol: 0.12, at: 0.06 });
      tone({ f0: 320, f1: 60, dur: 0.25, type: 'sawtooth', vol: 0.07, at: 0.02 });
    },
    hitPlayer: function () {                  /* harsh shell hit */
      tone({ f0: 165, f1: 78, dur: 0.17, type: 'sawtooth', vol: 0.11 });
      noise({ f0: 1900, f1: 300, dur: 0.09, vol: 0.08 });
    },
    shieldHit: function () {                  /* metallic dyad ring */
      tone({ f0: 523, dur: 0.09, type: 'triangle', vol: 0.09 });
      tone({ f0: 784, dur: 0.11, type: 'triangle', vol: 0.07, at: 0.015 });
    },
    powerup: function () {                    /* weapon sparkle arpeggio */
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ f0: f, dur: 0.07, type: 'square', vol: 0.085, at: i * 0.055 });
      });
    },
    heal: function () {                       /* soft major third chime */
      tone({ f0: 659, dur: 0.1, type: 'sine', vol: 0.1 });
      tone({ f0: 880, dur: 0.14, type: 'sine', vol: 0.09, at: 0.09 });
    },
    energy: function () {                     /* electric zap pickup */
      tone({ f0: 200, f1: 1600, dur: 0.12, type: 'sawtooth', vol: 0.08 });
      tone({ f0: 2400, f1: 600, dur: 0.08, type: 'square', vol: 0.05, at: 0.1 });
    },
    special: function () {                    /* charge-up then discharge */
      tone({ f0: 150, f1: 1500, dur: 0.38, type: 'sawtooth', vol: 0.11 });
      noise({ f0: 500, f1: 4500, dur: 0.35, vol: 0.05 });
      tone({ f0: 900, f1: 180, dur: 0.16, type: 'square', vol: 0.1, at: 0.36 });
    },
    bossWarn: function () {                   /* urgent two-tone alarm */
      for (var i = 0; i < 3; i++) {
        tone({ f0: 440, dur: 0.09, type: 'square', vol: 0.11, at: i * 0.22 });
        tone({ f0: 311, dur: 0.09, type: 'square', vol: 0.11, at: i * 0.22 + 0.11 });
      }
    },
    levelStart: function () {                 /* three-note lift-off */
      [392, 523, 659].forEach(function (f, i) {
        tone({ f0: f, dur: 0.08, type: 'square', vol: 0.09, at: i * 0.09 });
      });
      tone({ f0: 784, dur: 0.14, type: 'square', vol: 0.08, at: 0.27 });
    },
    levelClear: function () {                 /* victory fanfare */
      var seq = [[523, 0], [523, 0.11], [659, 0.22], [784, 0.33], [1047, 0.5]];
      seq.forEach(function (n) {
        tone({ f0: n[0], dur: 0.1, type: 'square', vol: 0.1, at: n[1] });
      });
    },
    bossDie: function () {                    /* boom + sting */
      SFX.bigExplode();
      [659, 784, 1046].forEach(function (f, i) {
        tone({ f0: f, dur: 0.09, type: 'square', vol: 0.09, at: 0.35 + i * 0.09 });
      });
    },
    lifeLost: function () {                   /* falling drone */
      tone({ f0: 300, f1: 48, dur: 0.45, type: 'sawtooth', vol: 0.13 });
      noise({ f0: 1000, f1: 120, dur: 0.3, vol: 0.06 });
    },
    gameOver: function () {                   /* requiem */
      [392, 330, 262, 196].forEach(function (f, i) {
        tone({ f0: f, dur: 0.16, type: 'square', vol: 0.1, at: i * 0.17 });
      });
      tone({ f0: 131, dur: 0.45, type: 'triangle', vol: 0.11, at: 0.68 });
    },
    ui: function () {                         /* click tick */
      tone({ f0: 720, dur: 0.03, type: 'square', vol: 0.05 });
    }
  };

  /* same-sound throttle: auto-fire / bullet storms stay readable */
  var GAPS = { shoot: 0.05, eshoot: 0.06, hitEnemy: 0.06 };

  function play(name) {
    if (!ctx || !enabled) return;
    var fn = SFX[name];
    if (!fn) return;
    var t = ctx.currentTime;
    var gap = GAPS[name] || 0;
    if (lastPlay[name] && t - lastPlay[name] < gap) return;
    lastPlay[name] = t;
    try { fn(); } catch (e) {}
  }

  function setEnabled(on) {
    enabled = !!on;
    try { global.localStorage && global.localStorage.setItem(STORE_KEY, enabled ? '1' : '0'); } catch (e) {}
  }

  enabled = detect();

  SI.audio = {
    get enabled() { return enabled; },
    unlock: unlock,
    play: play,
    setEnabled: setEnabled
  };
})(typeof window !== 'undefined' ? window : globalThis);
