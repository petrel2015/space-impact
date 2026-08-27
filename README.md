# Space Impact

[English](README.md) | [中文](README.zh-CN.md)

![Platform](https://img.shields.io/badge/platform-HTML5_Canvas-2c3417)
![Build](https://img.shields.io/badge/build-no_step_needed-8a9a4e)
![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![i18n](https://img.shields.io/badge/lang-EN_%7C_%E4%B8%AD%E6%96%87-blue)
![Tests](https://img.shields.io/badge/tests-node_test-informational)

A browser remake of the classic **Space Impact** shoot-'em-up that shipped on the Nokia 3310 — the little monochrome side-scroller everyone played in class instead of Snake.

No framework, no build step, no assets to download. And the twist: **levels and enemies are plain JSON files** — the front end is only an engine that interprets them. Add a monster or a whole level without touching a line of engine code.

> 💡 The 3310 classic, reborn at 144×80 — content is data, the browser is just the player.

## Game Content

**14 levels · 27 enemy types · 9 movement primitives · 10 attack primitives**

| Levels | What shows up | Boss |
|--------|---------------|------|
| 1–4 | Wave 1 roster: drones, sine bats, asteroids, gunners, chasers, spinners, bombers | Dreadnought · Crab · Fortress |
| 5–7 | Wave 2 roster joins: zig-zag wasps, curtain-firing crabs, diving mantas, tanks, snipers, spiders | Warbird · Serpent |
| 8–10 | Mixed chaos, double mid-bosses, a "best of" remix storm | Serpent Ⅱ · Overlord · Fortress rematch |
| 11–14 | Elite gauntlets, spider nests, everything at once | Overlord → **Overlord Ω** (final) |

Regular enemies (pick your poison):

| Enemy | Movement | Attack | HP | Score |
|-------|----------|--------|----|----|
| drone / bat / wasp | straight / sine / zigzag | — | 1 | 100–200 |
| sting / lasher | sine | straight / fast aimed | 2–3 | 250–550 |
| rock / cube | drift / pulse | — / cross | 4–8 | 120–350 |
| gunner / bastion | hover | aimed / fan+aimed+burst cycle | 3–12 | 400–900 |
| chaser / spider | chase | — (rams you) | 2–5 | 300–600 |
| spinner | sine | spiral pinwheel | 4 | 500 |
| bomber | straight | 3-way fan | 6 | 600 |
| crab | straight | **curtain** (bullet wall with one gap) | 4 | 700 |
| manta | hover → **dive** | — (kamikaze) | 3 | 450 |

Plus 2 **mid-bosses** (boss HP bar + guaranteed heal drop, but the level goes on) and 10 boss forms — the final one cycles 7 attack patterns and spawns its own reinforcements.

## Features

- 🎮 **Faithful feel** — 144×80 logical LCD (a nod to the 3310's 84×48), integer-scaled chunky pixels, 5×7 bitmap font, screen shake, parallax stars.
- 📦 **Data-driven core** — enemies/levels are JSON; `node test/data-test.js` validates every reference the moment you add content.
- 🌍 **EN / 中文** in one click, auto-detected and remembered.
- 🎨 **3 themes** — Retro LCD (yellow-green, default, with pixel-grid overlay), Night (phosphor), Paper.
- 📱 **Mobile & tablet** — responsive layout; on-screen D-pad + FIRE/BOMB appear automatically on touch devices **and** whenever the viewport is phone/tablet sized.
- 🔫 **Point shots by default** — one volley per FIRE press; flip the **Auto-fire** toggle in settings for hold-to-spray.
- ⚙️ **Settings in the header** — difficulty, theme, sound & auto-fire in a popover available any time (opening it mid-game auto-pauses). How-to lives on the start screen only.
- 🔥 **Four difficulty tiers** — Casual / Standard / Tight / Hardcore: HP steps down 10→8→6→4, enemies hit harder, and from Standard up your **ammo is finite** (plentiful → tight → barely enough; every kill recoups a few rounds).
- ⚡ **Power-ups** — P power · S spread · L piercing laser · + heal · E special energy · G shield; the special is a screen-clearing beam.
- 💥 **Bullet cancel** — the classic detail: your shots and enemy shots annihilate each other mid-air (the piercing laser eats through).
- 🔊 **Synthesized SFX** — WebAudio square-wave bleeps, zero audio files.
- 🤖 **Attract mode** — `?demo=1` autopilot plays the game through the same input path as a human.

## Quick Start

The engine `fetch`es its JSON data packs, so serve the folder over HTTP (double-clicking `index.html` won't work):

```bash
cd space-impact
python3 -m http.server 8000
# open http://localhost:8000/
```

Controls:

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | Arrows / WASD | D-pad (bottom-left) |
| Fire — one volley per press | Space / J | FIRE |
| Auto-fire (hold to spray) | toggle in Settings ⚙ | Auto-fire toggle |
| Special beam | K / X | BOMB |
| Pause | P / Esc | ⏸ top-right |

Handy URL params (testing / shareable links):

| Param | Effect |
|-------|--------|
| `?lang=zh` / `?lang=en` | Force language |
| `?theme=retro` / `night` / `paper` | Force theme |
| `?touch=1` | Show on-screen controls on desktop |
| `?autostart=1` | Start playing on load |
| `?demo=1` | Attract-mode autopilot (with autostart) |
| `?paused=1` | Open paused (overlay testing) |
| `?level=14` | Start at a given level |

## Extending the Game

### Add an enemy

One entry in `data/enemies.json` — combine primitives, tune numbers, point at a sprite:

```json
"myEnemy": {
  "hp": 3,           "score": 300,
  "speed": 18,       "sprite": "spinner",
  "movement": "sine", "params": { "amp": 10, "period": 2 },
  "attack": "aimed",  "fireRate": 1.5, "bulletSpeed": 30,
  "attackParams": { "jitter": 0.2 },
  "drop": { "energy": 0.1 },
  "boss": false
}
```

| Field | Meaning |
|-------|---------|
| `hp` / `score` / `speed` | Hit points, score, speed (logical px/s) |
| `sprite` | Sprite name from `js/sprites.js` (new looks need a new string-grid there) |
| `movement` + `params` | Movement primitive + its knobs (below) |
| `attack` + `attackParams` | Attack primitive + its knobs; `fireRate` (s) and `bulletSpeed` tune it |
| `drop` | Drop table `{type: probability}`, types: power/spread/laser/heal/energy/shield |
| `boss` | `true` = boss: top HP bar, guaranteed drops, death ends the level |
| `miniboss` | With `boss: true` = mid-boss: bar + drops, but the level **continues** |

Movement primitives: `straight` · `sine` `{amp, period}` · `drift` `{vy}` · `hover` `{x, hold}` · `chase` `{rate}` · `zigzag` `{amp, period}` · `dive` `{enter, hover, dive}` · `pulse` `{run, pause}` · `bossHover` `{x, amp, period}`.

Attack primitives: `none` · `straight` · `aimed` · `fan` `{ways, spread}` · `burst` `{count, jitter}` · `spiral` `{step}` · `curtain` `{gap, spacing}` · `cross` `{tilt}` · `spawn` `{enemy, count}` · `cycle` `{list}` (rotate sub-attacks; entries may be ids or `{id, params}` overrides).

### Add a level

Create `data/levels/level15.json`:

```json
{
  "id": 15,
  "difficulty": 1.2,
  "events": [
    { "t": 0.5, "enemy": "drone", "count": 4, "interval": 0.5,
      "formation": "lineV", "y": 0.5 },
    { "t": 38, "enemy": "mb1", "count": 1, "formation": "single", "y": 0.5 },
    { "t": 55, "boss": "boss6b" }
  ]
}
```

- `t` = seconds into the level; `y` = spawn height (0–1); `count`/`interval` = how many + stagger.
- Formations: `single` / `lineV` / `lineH` / `stagger` / `scatter`.
- `difficulty` = per-level strength coefficient (0.5–3, default 1).
- Every level needs at least one `boss` event (that's what clears it). Mid-bosses are spawned as normal `enemy` events.

Then register `"levels/level15.json"` in `data/levels.json` (ids must increase) and run `node test/data-test.js` — typos in ids, formations or sprites fail instantly.

### Or just: download the template, upload your level

The start screen has **Download level template** (a ready-to-edit, playable sample with field hints in `_help`) and **Upload level JSON** — pick your edited file and the level is validated, compiled and launched on the spot. No server, no repo commit needed.

## Development

### Project structure

```
space-impact/
├── index.html            # markup (data-i18n strings)
├── css/style.css         # pixel UI, themed via CSS variables
├── data/                 # ← all game content lives here
│   ├── enemies.json      # enemy roster
│   ├── levels.json       # level order
│   └── levels/*.json     # one timeline per level
├── js/
│   ├── i18n.js           # EN/zh dictionaries
│   ├── theme.js          # theme registry (CSS vars + LCD palettes)
│   ├── audio.js          # WebAudio square-wave SFX
│   ├── sprites.js        # sprite grids + 5×7 bitmap font
│   ├── behaviors.js      # movement/attack/formation primitives
│   ├── engine.js         # data validation/compile + pure simulation
│   ├── render.js         # canvas renderer
│   └── app.js            # input, main loop, screen flow
└── test/
    ├── data-test.js      # data-pack validation
    ├── engine-test.js    # deterministic simulation tests
    └── render-shots.js   # headless PNG scene renderer
```

### Running tests

```bash
node test/data-test.js        # references, sprite grids, i18n parity
node test/engine-test.js      # every level completable + invariants + specials
node test/render-shots.js     # PNG gallery of key moments → /tmp/si-shots/
node test/render-shots.js 5 42  # any level, any second (dev visual check)
```

### Architecture notes

- **Pure core** — `engine.js` is a deterministic simulation (seeded mulberry32 RNG, fixed timestep) with zero DOM/audio/render dependencies; `app.js` feeds it input, `render.js` draws state. That's why node can play whole levels in tests.
- **Compile step** — raw JSON → validated/normalized defs at load (`compileEnemies`/`compileLevel`). Broken data throws bilingual `DataError`s; the UI surfaces them.
- **One vocabulary** — enemies are just (movement × attack × numbers) tuples over the `behaviors.js` primitive library. A genuinely new movement type is the only case that needs engine-side code.
- **LCD discipline** — everything on-canvas is ASCII from the built-in bitmap font; Chinese lives only in the HTML UI.

## Tech Stack

Plain ES5-flavored JavaScript · Canvas 2D (`image-rendering: pixelated`) · CSS custom properties · WebAudio · JSON data packs · node-only tests with zero dev dependencies.

## Buy me a coffee ￥4.9

如果这个小游戏给你带来了几分钟的快乐，可以请作者喝杯速溶咖啡 ☕

| Alipay | WeChat |
|--------|--------|
| ![Alipay](donate/alipay-qr.png) | ![WeChat](donate/wechat-qr.png) |
