/* =====================================================================
   Space Impact — pixel art + 5×7 bitmap font
   Sprites are string grids: 'X' = lit pixel, anything else = off.
   Pure data + tiny helpers; required by engine.js (hitbox sizes) and
   render.js (drawing). No DOM access, safe under node.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};

  var SPRITES = {

    /* ── player ─────────────────────────────── */
    player: [
      '......X...',
      '.....XX...',
      '....XXXX..',
      'XXXXXXXXXX',
      '....XXXX..',
      '.....XX...',
      '......X...'
    ],
    playerMini: [
      '....X',
      'XXXXX',
      '....X'
    ],

    /* ── bullets ────────────────────────────── */
    pbullet: [
      'XXX',
      'XXX'
    ],
    ebullet: [
      '.X.',
      'XXX',
      '.X.'
    ],

    /* ── enemies ────────────────────────────── */
    drone: [
      'X..X..X',
      '.XXXXX.',
      'XX.X.XX',
      '.XXXXX.',
      'X..X..X'
    ],
    bat: [
      'X......X',
      'XX.XX.XX',
      '.XXXXXX.',
      '.X.XX.X.',
      '...XX...'
    ],
    sting: [
      '..X...XX',
      '.XX..XXX',
      'XXXXXXX.',
      '.XXXXXX.',
      '.XX..XXX',
      '..X...XX'
    ],
    rock: [
      '...XXX...',
      '..XXXXX..',
      '.XXXXXXX.',
      '.XXXXXXX.',
      'XXXXXXXXX',
      '.XXXXXXX.',
      '.XX.XXXXX',
      '..XXXXX..',
      '...X.XX..'
    ],
    gunner: [
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXX..XXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..X..X..'
    ],
    chaser: [
      '.....X.',
      '....XX.',
      '...XXX.',
      'XXXXXXX',
      '...XXX.',
      '....XX.',
      '.....X.'
    ],
    bomber: [
      '...XXXXXX...',
      '..XXXXXXXX..',
      '.XXXXXXXXXX.',
      'XXX..XX..XXX',
      '.XXXXXXXXXX.',
      '..XXXXXXXX..',
      '...XXXXXX...',
      '....XXXX....'
    ],
    spinner: [
      'X......X',
      'XX....XX',
      '.XX..XX.',
      '..XXXX..',
      '..XXXX..',
      '.XX..XX.',
      'XX....XX',
      'X......X'
    ],

    /* ── bosses ─────────────────────────────── */
    boss1: [
      '........XXXXXXXX........',
      '......XXXXXXXXXXXX......',
      '.....XXXXXXXXXXXXXX.....',
      '....XXXXXXXXXXXXXXXX....',
      'XX..XXXXXXXXXXXXXXXX..XX',
      'XXXXXXXX...XXXX...XXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXX',
      'XXX..XXXX.XXXX.XXXX..XXX',
      'XX....XXXXXXXXXXXX....XX',
      '.X.....XXXXXXXXXX.....X.',
      '.......XXXXXXXXXX.......',
      '........XXXXXXXX........',
      '.........XXXXXX.........'
    ],
    boss2: [
      '..XX..................XX..',
      '.XXXX................XXXX.',
      'XXXXXX..............XXXXXX',
      'XXXXXX....XXXXXX....XXXXXX',
      '.XXXX...XXXXXXXXXX...XXXX.',
      '..XX....XXXXXXXXXX....XX..',
      '........XX.XXXX.XX........',
      '..........XXXXXXXX........',
      '...........XXXXXX.........'
    ],
    boss3: [
      '............XXXX............',
      '.........XXXXXXXXXX.........',
      '.......XXXXXXXXXXXXXX.......',
      '.....XXXXXXXXXXXXXXXXXX.....',
      '....XXXXXXXXXXXXXXXXXXXX....',
      '..XXXXXXXX..XXXX..XXXXXXXX..',
      '.XXXXXXXXXXXXXXXXXXXXXXXXXX.',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXX..XXXX.XXXX.XXXX.XXXX..XX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      '.XXXXXXXXXXXXXXXXXXXXXXXXXX.',
      '..XXXXXXX.XXXXXXXX.XXXXXXX..',
      '....XXXXXXXXXXXXXXXXXXXX....',
      '......XXXXXXXXXXXXXXXX......',
      '........XXXXXXXXXXXX........',
      '..........XXXXXXXX..........'
    ],

    /* ── wave 2 enemies ───────────────────────── */
    wasp: [
      '.X....X.',
      'XXX..XXX',
      '.XXXXXX.',
      '..X..X..'
    ],
    crab: [
      'XX........XX',
      '.XX..XX..XX.',
      '.XXXXXXXXXX.',
      'XXXXXXXXXXXX',
      '.XX.X..X.XX.',
      '..X.XX.X.X..',
      '....X..X....'
    ],
    manta: [
      'X........X',
      'XX..XX..XX',
      '.XXXXXXXX.',
      '.XXXXXXXX.',
      '..XXXXXX..',
      '....XX....'
    ],
    cube: [
      'XXXXXX',
      'X....X',
      'X.XX.X',
      'X.XX.X',
      'X....X',
      'XXXXXX'
    ],
    lasher: [
      'X........X',
      'XXX....XXX',
      '.XXXXXXXX.',
      'XXXXXXXXXX',
      '.X.XXXX.X.'
    ],
    spider: [
      'X...X...X',
      '.X..X..X.',
      '..XXXXX..',
      '.XXXXXXX.',
      '..XXXXX..',
      '.X.XXX.X.',
      'X..X.X..X'
    ],
    bastion: [
      '...XXXX...',
      '..XXXXXX..',
      '.XXXXXXXX.',
      'XXX.XX.XXX',
      '.XXXXXXXX.',
      '.XX.XX.XX.',
      '.XXXXXXXX.',
      '.XX....XX.',
      '.X......X.'
    ],

    /* ── wave 2 bosses ────────────────────────── */
    boss4: [
      '..XX................XX..',
      '.XXXX..............XXXX.',
      '.XXXXX...XXXXXX...XXXXX.',
      'XXXXXX..XXXXXXXX..XXXXXX',
      'XXXXXXX.XXXXXXXX.XXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXX',
      'XXXX.XXX.XXXXXX.XXX.XXXX',
      'XXX...XX.XXXXXX.XX...XXX',
      'XX.....XXXXXXXXXX.....XX',
      '.X......XXXXXXXX......X.',
      '........XXXXXXXX........',
      '.........XXXXXX.........'
    ],
    boss5: [
      '....XX....XX....XX....XX....XX',
      '..XXXX....XXXX....XXXX....XXXX',
      '.XXXXX...XXXXX...XXXXX...XXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XX..XX..XX..XX..XX..XX..XX..XX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XX..XX..XX..XX..XX..XX..XX..XX',
      '.XXXX.XXXX.XXXX.XXXX.XXXX.XXX.',
      '..XX..XX..XX..XX..XX..XX..XX..',
      '...X...X...X...X...X...X...X..'
    ],
    boss6: [
      '..............XXXX..............',
      '...........XXXXXXXXXX...........',
      '........XXXXXXXXXXXXXXXX........',
      '......XXXXXXXXXXXXXXXXXXXX......',
      '.....XXXXXXXXXXXXXXXXXXXXXX.....',
      '...XXXXXXX..XXXXXXXX..XXXXXXX...',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXX..XXXXXXXXXXXXXXXXXXXXXX..XXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '...XXXX..XXXXXXXXXXXXXX..XXXX...',
      '....XXX....XXXXXXXXXX....XXX....',
      '.....XX......XXXXXX......XX.....',
      '......X.......XXXX.......X......'
    ],

    /* ── powerups (7×7 icons) ───────────────── */
    pPower: [
      '...X...',
      '..XXX..',
      '.XXXXX.',
      'XXXXXXX',
      '..XXX..',
      '..XXX..',
      '..XXX..'
    ],
    pSpread: [
      '..X.X..',
      '.X.X.X.',
      'X..X..X',
      'X.XXX.X',
      '.XXXXX.',
      '..X.X..',
      '..X.X..'
    ],
    pLaser: [
      '.......',
      '.......',
      'XXXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      '.......',
      '.......'
    ],
    pHeal: [
      '..XXX..',
      '..XXX..',
      'XXXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      '..XXX..',
      '..XXX..'
    ],
    pEnergy: [
      '....XX.',
      '...XX..',
      '..XXXX.',
      '....XX.',
      '...XX..',
      '..XX...',
      '.XX....'
    ],
    pShield: [
      '.XXXXX.',
      'XXXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      '.XXXXX.',
      '..XXX..',
      '...X...'
    ],

    /* ── explosions ─────────────────────────── */
    ex1: [
      'X...X',
      '.XXX.',
      'XX.XX',
      '.XXX.',
      'X...X'
    ],
    ex2: [
      'X.....X',
      '..X.X..',
      '.XXXXX.',
      'XX.X.XX',
      '.XXXXX.',
      '..X.X..',
      'X.....X'
    ],
    ex3: [
      'X...X...X',
      '.X..X..X.',
      '..X.X.X..',
      '...X.X...',
      'XX.....XX',
      '...X.X...',
      '..X.X.X..',
      '.X..X..X.',
      'X...X...X'
    ]
  };

  /* 5×7 bitmap font — uppercase A–Z, 0–9 and a few symbols.
     Lowercase input is uppercased by the text renderer. */
  var FONT = {
    'A': ['..X..', '.X.X.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X'],
    'B': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
    'C': ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
    'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    'E': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
    'F': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
    'G': ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
    'H': ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'I': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    'J': ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
    'K': ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
    'L': ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
    'M': ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
    'N': ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
    'O': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    'P': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
    'Q': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
    'R': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
    'S': ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
    'T': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    'U': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    'V': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
    'W': ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
    'X': ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
    'Y': ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
    'Z': ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
    '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
    '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
    '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
    '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
    '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
    '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
    '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
    '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
    '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
    ':': ['.....', '.XX..', '.XX..', '.....', '.XX..', '.XX..', '.....'],
    '!': ['..X..', '..X..', '..X..', '..X..', '..X..', '.....', '..X..'],
    '-': ['.....', '.....', '.....', 'XXXXX', '.....', '.....', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.XX..', '.XX..'],
    '+': ['.....', '..X..', '..X..', 'XXXXX', '..X..', '..X..', '.....']
  };

  var cache = {};

  function get(name) {
    if (cache[name]) return cache[name];
    var rows = SPRITES[name];
    if (!rows) return null;
    var w = 0, i;
    for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    return (cache[name] = { w: w, h: rows.length, rows: rows });
  }

  function has(name) {
    return !!SPRITES[name];
  }

  SI.sprites = {
    SPRITES: SPRITES,
    FONT: FONT,
    get: get,
    has: has
  };
})(typeof window !== 'undefined' ? window : globalThis);
