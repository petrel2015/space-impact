/* =====================================================================
   Space Impact — theme registry
   Each theme provides page chrome colors (applied as CSS custom
   properties on <html>) plus an LCD palette consumed by js/render.js.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var STORE_KEY = 'si-theme';

  var THEMES = {
    /* The signature one: yellow-green Nokia 3310 LCD. */
    retro: {
      page: {
        bg: '#b8c765',        /* yellow-green paper */
        bgDot: '#aab95b',
        ink: '#2c3417',       /* deep olive */
        muted: '#5c6437',
        panel: '#c4d274',
        accent: '#2c3417',
        shadow: 'rgba(44, 52, 23, 0.35)'
      },
      lcd: {
        bg: '#c3d179',        /* LCD cell background */
        ink: '#252d12',       /* lit pixels */
        dim: '#8a9a4e',       /* faint pixels / ghosting */
        grid: true            /* pixel-grid overlay */
      }
    },

    /* Phosphor dark: near-black with green-amber glow. */
    night: {
      page: {
        bg: '#101410',
        bgDot: '#161c16',
        ink: '#8fe6a0',
        muted: '#4f7a58',
        panel: '#151b15',
        accent: '#ffd166',
        shadow: 'rgba(0, 0, 0, 0.6)'
      },
      lcd: {
        bg: '#0b0f0b',
        ink: '#93e6a4',
        dim: '#274431',
        grid: false
      }
    },

    /* Neutral paper: light gray, charcoal ink. */
    paper: {
      page: {
        bg: '#e9e7df',
        bgDot: '#dddad0',
        ink: '#26241f',
        muted: '#6d6a60',
        panel: '#f4f2ea',
        accent: '#26241f',
        shadow: 'rgba(38, 36, 31, 0.3)'
      },
      lcd: {
        bg: '#f0eee6',
        ink: '#26241f',
        dim: '#b5b1a4',
        grid: false
      }
    }
  };

  var ORDER = ['retro', 'night', 'paper'];
  var current = 'retro';

  /* Per-level scenery: the five《归途》campaign units' palettes (same
     values as the lore-book banners, test/make-lore-images.js UNITS).
     While a scene is active the playfield paints a bgTop→bgBot gradient
     with accent ink and dim stars; levels without an entry (custom
     uploads) keep the plain theme LCD look. */
  var LEVEL_SCENES = {
    1: { bgTop: '#4a4136', bgBot: '#16120e', accent: '#e0b36a', dim: '#7d6b4c' },
    2: { bgTop: '#472052', bgBot: '#130a1a', accent: '#ff8fb8', dim: '#8a4a72' },
    3: { bgTop: '#1d2c52', bgBot: '#090c18', accent: '#7fd8ff', dim: '#3f5f8a' },
    4: { bgTop: '#4c1f1c', bgBot: '#150808', accent: '#ffa25c', dim: '#8a4a3a' },
    5: { bgTop: '#23305e', bgBot: '#0b1320', accent: '#7dffe8', dim: '#4a6a9a' }
  };

  function levelScene(id) {
    return LEVEL_SCENES[id] || null;
  }

  function detect() {
    var saved = null;
    try { saved = global.localStorage && global.localStorage.getItem(STORE_KEY); } catch (e) {}
    return THEMES[saved] ? saved : 'retro';
  }

  function currentDef() {
    return THEMES[current];
  }

  function apply() {
    if (!global.document) return;
    var root = global.document.documentElement;
    var p = currentDef().page;
    root.setAttribute('data-theme', current);
    root.style.setProperty('--bg', p.bg);
    root.style.setProperty('--bg-dot', p.bgDot);
    root.style.setProperty('--ink', p.ink);
    root.style.setProperty('--muted', p.muted);
    root.style.setProperty('--panel', p.panel);
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--shadow', p.shadow);
    var meta = global.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
  }

  function setTheme(name) {
    if (!THEMES[name]) return;
    current = name;
    try { global.localStorage && global.localStorage.setItem(STORE_KEY, name); } catch (e) {}
    apply();
  }

  current = detect();

  SI.theme = {
    THEMES: THEMES,
    ORDER: ORDER,
    LEVEL_SCENES: LEVEL_SCENES,
    get current() { return current; },
    def: currentDef,
    levelScene: levelScene,
    setTheme: setTheme,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
