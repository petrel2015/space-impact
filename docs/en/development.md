# Development

How to work on the codebase. Chinese version: [开发](../zh/development.md).

## Environment

- **Node.js** — any release that runs plain CommonJS `.js` (verified on
  Node 22; there is no `engines` field because there is no
  `package.json` at all — the project has **zero runtime and dev
  dependencies**).
- **Python 3** (or any static file server) to serve the folder locally —
  the game `fetch`es its JSON packs, so `file://` does not work.
- No framework, no bundler, no transpiler: the files in `js/` run in the
  browser exactly as they are in the repo.

## Commands

All of the following were executed against this tree and pass:

| Command | What it does | Last verified result |
|---------|--------------|----------------------|
| `python3 -m http.server 8000` | Serve the game at `http://localhost:8000/` | 200 for `/index.html` and `/data/enemies.json` |
| `node test/data-test.js` | Data-pack validation | **all checks passed** (27 enemies, 5 levels, i18n keys) |
| `node test/engine-test.js` | Deterministic simulation tests | **all checks passed** (5 levels simulated to completion) |
| `node test/aim-visual-test.js` | Aim tracer + missile rendering checks | **all checks passed** |
| `node test/render-shots.js` | Headless PNG scene gallery → `/tmp/si-shots/` | 11 PNGs written |
| `node test/render-shots.js 5 42` | Render level 5 at t=42 s (dev visual check) | works for any level/second |

There is no build, bundle or lint step — nothing to configure.

## What the Tests Actually Check

**`test/data-test.js`** — content integrity, runs in milliseconds:

- Every sprite grid is rectangular and uses only `X`/`.`; every font glyph
  is 5×7.
- Every enemy in `data/enemies.json`: positive `hp`/`score`/`speed`, known
  sprite, known movement/attack, consistent `fireRate`, valid drop tables
  (types + probabilities in [0,1]), `miniboss` implies `boss`.
- Every level: numeric `id`, `difficulty` within [0.5, 3], events sorted by
  `t`, known enemies/formations, `y` in 0–1, `count` 1–20, at least one
  boss event, ids strictly increasing across the campaign.
- `levels.json` entries cannot escape the `data/` directory (path traversal
  check).
- The downloadable level template compiles against the real vocabulary.
- i18n: EN/zh dictionaries have identical key sets; every `data-i18n` key
  used in `index.html` exists.

**`test/engine-test.js`** — plays the real data packs through the real
engine with a fixed seed:

1. Every one of the 5 levels is completable (scripted invincible player
   kills the end boss within the time cap).
2. Mid-boss death does **not** clear a level (level 8's mb1 + end boss).
3. A passive player on level 2 takes damage (difficulty is real).
4. Determinism: same seed → byte-identical state trajectory.
5. Special beam consumes exactly one charge per trigger press; holding the
   key does not re-fire.
6. Power-ups apply and clamp (special max 5).
7. Bad data throws the right bilingual error keys.
8. Player bullets and enemy bullets cancel each other on contact.
9. Finite ammo: volleys cost exactly one round, dry trigger blocks firing,
   kills recoup, stockpile refills resume firing.
10. Portrait 144×128 field: spawn rows remap and stay inside the field;
    the boss recentres vertically.
11. Homing missiles: pickup grants 12 (cap 20), own ammo pool, off-axis
    homing kills, immune to bullet-cancel, revert to bullets when depleted,
    stockpile lost on death.
12. Aim tracer ray count equals the real volley's bullet count for every
    weapon mode.

**`test/aim-visual-test.js`** — drives the real renderer into a
pixel-recording mock and asserts the dashed ray geometry, impact marker and
missile trail actually appear on canvas.

**`test/render-shots.js`** — renders key moments (bosses, curtain fire,
game over, aim tracer, missiles…) to PNGs at 4× scale for eyeballing.

## Directory Layout

```
space-impact/
├── index.html            # markup; every UI string keyed by data-i18n
├── css/style.css         # pixel UI; themed via CSS custom properties
├── data/                 # ← all game content lives here
│   ├── enemies.json      # enemy roster (27 entries)
│   ├── levels.json       # level order (ids must increase)
│   └── levels/*.json     # one event timeline per level
├── js/
│   ├── i18n.js           # EN/zh dictionaries + detection/persistence
│   ├── theme.js          # theme registry: page CSS vars + LCD palettes
│   ├── audio.js          # WebAudio square-wave SFX synth
│   ├── sprites.js        # sprite string-grids + 5×7 bitmap font
│   ├── level-template.js # the downloadable custom-level template
│   ├── behaviors.js      # movement/attack/formation primitive library
│   ├── engine.js         # compile (validate) + pure deterministic sim
│   ├── render.js         # canvas renderer (LCD palette, HUD, effects)
│   ├── app.js            # input, main loop, screen flow, persistence
│   ├── donation.js       # footer donate widget (dialog, lazy QR, live render)
│   └── vendor/           # vendored libs (qrcode-generator.js, MIT)
├── test/                 # node-run test suites + asset generators
└── docs/                 # this documentation (en + zh)
```

## Asset Scripts (dev tools, not runtime)

- `node test/make-icons.js` — regenerates `favicon-16/32.png` and
  `apple-touch-icon.png` from the game's own sprite grids (zero deps).

There is no donate-QR asset script and no QR image file — `js/donation.js`
renders the codes live from the receive-money links with the vendored QR
library after the dialog opens. If a link changes, edit `DONATION_CONFIG`
in `js/donation.js` only (and run `node test/donation-test.js`).

## Working on Content vs. Engine

- **Content** (enemies, levels): edit JSON only. Run
  `node test/data-test.js`; if you add a level, register it in
  `data/levels.json` with an increasing id and `engine-test.js` will
  automatically verify it's completable.
- **Engine/behaviors**: keep the simulation pure and deterministic — no
  DOM/audio/render calls inside `engine.js`, all randomness through the
  seeded `rt.rng`, fixed-timestep stepping. That's what lets node play whole
  levels in CI-less tests.
- **New movement/attack primitives** are the only content additions that
  need engine-side code: add the function in `behaviors.js` and it becomes
  available by name in JSON automatically (validation whitelists come from
  the same registry).

## Verifying a "Production" Run Locally

The deployed artifact is the repo itself — there is no build output. To
verify what users get:

```bash
python3 -m http.server 8000
# open http://localhost:8000/ — click through: start screen → play →
# settings popover → pause/resume → game over → custom level upload
```

For automated verification, the four test commands above plus a browser
smoke (the docs screenshots were captured exactly this way, with zero
console errors) cover it.
