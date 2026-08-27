# Architecture

Why the game is built the way it is. Chinese version: [架构](../zh/architecture.md).

## High-Level Design

The one decision everything else follows from: **content is data, the
browser is just the player.** Enemies are (movement × attack × numbers)
tuples and levels are event timelines — both plain JSON, both validated and
compiled at load. The simulation core is pure and deterministic so tests can
play the whole game in node.

```
             ┌────────────────────────── browser ──────────────────────────┐
             │                                                              │
 data/enemies.json ──┐                                                     │
 data/levels.json ───┤ fetch (same-origin, no-cache)                       │
 data/levels/*.json ─┘                                                     │
             │                                                              │
             ▼                                                              │
      engine.compileEnemies ──▶ defs (validated, normalized)                │
      engine.compileLevel   ──▶ level {queue, difficulty, duration}         │
             │                    bad JSON → bilingual DataError → UI       │
             ▼                                                              │
      engine.createRuntime ──▶ rt (mutable state: player, enemies,          │
             │                bullets, powerups, particles, events)         │
             │                                                              │
   app.js: requestAnimationFrame loop                                      │
     accumulate real time → engine.step(rt, input, 1/60) per tick           │
     rt.events ──▶ audio.js (SFX only)                                      │
     render.draw(ctx, rt) ──▶ canvas (144×80 / 144×128 logical)             │
             │                                                              │
 input: keyboard / D-pad + FIRE + BOMB ──▶ app.js ──▶ engine.step           │
 demo mode autopilot ───────────── produces the same input shape ──┘        │
             └──────────────────────────────────────────────────────────────┘

 node tests require the same files and call engine.step directly —
 no DOM, no canvas, no audio needed.
```

## Module Responsibilities

| File | Responsibility | Depends on |
|------|----------------|-----------|
| `js/engine.js` | Compile/validate JSON → defs; pure deterministic simulation; `volleyRays` geometry shared by fire + aim tracer | behaviors, sprites (only via `SI.*`) |
| `js/behaviors.js` | The primitive vocabulary: 9 movements, 10 attacks, 5 formations — the only place enemy behavior logic lives | none |
| `js/sprites.js` | Sprite string-grids (`X`/`.`) and the 5×7 ASCII bitmap font | none |
| `js/render.js` | Draws `rt` to canvas with the theme's LCD palette; HUD, parallax, effects | sprites, theme |
| `js/app.js` | Everything impure: input wiring, main loop, screen flow, localStorage, URL params, level upload, donate | all of the above |
| `js/i18n.js` | EN/zh dictionaries, `data-i18n` DOM application, persistence | none (node-safe) |
| `js/theme.js` | 3 themes = page CSS custom properties + LCD palettes | none (node-safe) |
| `js/audio.js` | WebAudio square-wave SFX synth, gesture unlock | none (node-safe) |
| `js/level-template.js` | The downloadable template object (compiles, playable, `_help` hints) | none |

## Determinism

- **RNG:** every random draw at runtime goes through a mulberry32
  generator seeded per runtime (`createRuntime({seed})`). Same seed → same
  run, verified byte-for-byte by `engine-test.js`.
- **Compile-time randomness** (formation jitter) uses a fixed seed (1) at
  compile, so a compiled level is stable across sessions.
- **Fixed timestep:** `app.js` accumulates frame time and steps the engine
  in exact 1/60 s ticks (capped to avoid spiral-of-death), decoupling
  simulation speed from display refresh.

## The Compile Step

`compileEnemies` / `compileLevel` turn raw JSON into normalized definitions
once at load:

- reject unknown sprite/movement/attack/formation/enemy ids with bilingual
  `DataError`s (keys like `errEnemyRef`, rendered by `i18n.t`);
- expand formations into concrete spawn offsets at compile time;
- sort the event queue by `t`, record level `duration` (drives ammo
  stockpile sizing);
- clamp per-level `difficulty` to [0.5, 3].

Runtime (`createRuntime`) then remaps spawn rows when the portrait 144×128
field is active — levels are authored against the 80-row field and scale
proportionally.

## Event Flow (engine → app)

The engine never touches audio directly. Anything the outside world should
react to is pushed onto `rt.events` (`shoot`, `bossWarn`, `powerup`,
`levelClear`, `gameOver`, …). `app.js` drains the queue each frame and maps
events to SFX. This is what keeps the core pure and node-testable, and the
event vocabulary is itself asserted by the tests.

## Difficulty & Scaling

Two independent multipliers compose in `app.js` → passed to the engine as a
single `difficulty` number:

```
effective = level.difficulty (0.5–3, per-level JSON)
          × tier multiplier   (0.8 / 1.0 / 1.15 / 1.3)
          × (1 + 0.35 × campaignLoop)
```

The engine derives enemy stat scaling from it: HP ×(1+0.4·loop'), speed
×(1+0.12·loop'), fire interval ÷(1+0.1·loop'). Lives/HP/ammo come from the
tier preset directly (see the [difficulty feature doc](./features/difficulty-and-ammo.md)).

## Theming

A theme is one object with two halves: `page` (CSS custom properties set on
`<html>` by `theme.js`) and `lcd` (background/ink/dim pixel colors + pixel
grid on/off consumed by `render.js`). Adding a theme is adding one registry
entry + one button; no render code changes.

## LCD Discipline

Everything drawn on canvas comes from the built-in 5×7 ASCII font and sprite
grids — no canvas text API, no image assets. Chinese strings live only in
the surrounding HTML UI. This keeps the canvas renderer trivially portable
and is why headless PNG rendering in tests looks identical to the browser.
