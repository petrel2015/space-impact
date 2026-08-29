/* =====================================================================
   Space Impact — custom level template
   Offered as a download from the start screen ("Download level
   template"); users edit it and upload it back to play. _help is
   ignored by the compiler, so this file doubles as a playable sample.
   ===================================================================== */
(function (global) {
  'use strict';
  var SI = global.SI = global.SI || {};
  SI.levelTemplate = {
    _help: [
      'Space Impact custom level — edit, then upload it from the start screen.',
      'id: number; use 90+ so built-in levels stay untouched.',
      'difficulty: strength factor 0.5 ~ 3 (default 1).',
      'events[].t: seconds into the level.',
      'events[].enemy / boss: enemy id (see README for the roster).',
      'count / interval: how many spawn and the gap between them.',
      'formation: single | lineV | lineH | stagger | scatter.',
      'y: spawn height 0 (top) ~ 1 (bottom).',
      'Every level needs exactly one boss event — killing it clears the level.',
      'lore: optional link to the level book page for this level (e.g. docs/lore/level-01.md).'
    ],
    id: 90,
    difficulty: 1,
    events: [
      { t: 0.5, enemy: 'drone', count: 4, interval: 0.5, formation: 'lineV', y: 0.5 },
      { t: 6,   enemy: 'bat',   count: 3, interval: 0.3, formation: 'stagger', y: 0.4 },
      { t: 12,  enemy: 'wasp',  count: 6, interval: 0.3, formation: 'scatter' },
      { t: 20,  enemy: 'crab',  count: 2, interval: 2.5, formation: 'single', y: 0.5 },
      { t: 34,  boss: 'boss1' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
