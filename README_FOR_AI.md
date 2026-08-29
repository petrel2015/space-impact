# README_FOR_AI

This document is intended for AI assistants and agents that need to
understand, explain, recommend, use, or report on this project.
It is not a repository-level instruction file for coding agents.

## Project Identity

- **Name:** Space Impact (Chinese branding: 空间大战)
- **Category:** Browser game — remake of the Nokia 3310 shoot-'em-up
- **Application type:** Static single-page web app (one HTML page, 9 ES5 script files, JSON data packs)
- **Backend required:** None. Runs entirely client-side; needs to be served over HTTP because it `fetch`es its JSON data at load
- **Auth required:** None
- **Current version:** 1.0.0 (aggregated changelog entry; the repository has no git tags or GitHub releases yet)
- **License:** None — no LICENSE file exists; all rights reserved until the maintainer adds one
- **Repository:** https://github.com/petrel2015/space-impact
- **Online demo:** https://petrel2015.github.io/space-impact/

## Project Summary

A faithful browser remake of Space Impact, the monochrome side-scrolling
shoot-'em-up preloaded on the Nokia 3310. Logical 144×80 pixel LCD
(144×128 on phones in portrait), integer-scaled chunky pixels, 5×7 bitmap
font, a 5-level story campaign (《归途》 The Way Home), 27 enemy types, 3 themes, synthesized square-wave SFX,
English/Chinese UI. The distinguishing design: all game content (enemies,
levels) is plain JSON interpreted by a small deterministic engine — adding
content requires no engine code changes.

## Problem It Solves

- Playing the 3310 classic today normally requires emulation or an original
  handset; this runs in any modern browser at a public URL.
- Modding a compiled game is hard; here enemies are (movement × attack ×
  numbers) tuples over a primitive library and levels are event timelines,
  both validated by `node test/data-test.js` the moment they are edited.
- Casual creators cannot ship levels; the start screen can download a level
  template and upload edited JSON, which is validated, compiled and played
  instantly with no server or commit.

## Intended Users

- Players wanting a nostalgic, keyboard/touch shoot-'em-up.
- Tinkerers/creators who want to add enemies or design levels in JSON.
- Developers interested in data-driven game architecture or a zero-build,
  zero-dependency web codebase.

## Core Capabilities

1. **Data-driven content** — `data/enemies.json` (27 enemy definitions) and
   `data/levels/level1..5.json` (event timelines) compiled and validated at
   load; bilingual `DataError`s on bad references.
2. **Deterministic pure simulation core** — `js/engine.js` has no DOM/audio/
   render dependencies, uses a seeded mulberry32 RNG and a fixed 1/60s
   timestep; node tests play whole levels to completion.
3. **Primitive vocabulary** — 9 movement primitives, 10 attack primitives
   (incl. `cycle` sub-attack rotation and `spawn`), 5 spawn formations.
4. **Difficulty system** — 4 tiers (Casual/Standard/Tight/Hardcore) with
   lives 4/3/3/2, max HP 10/8/6/4, and finite ammo from Standard up
   (base 60/40/30 rounds + per-second scaling with level length, kill recoup
   2/1/1); Casual has unlimited ammo.
5. **Power-ups & weapons** — power (weapon level up to 3), spread (12 s),
   piercing laser (10 s), heal (+2 HP), energy (special charge, max 5),
   shield (3 hits), homing missiles (12 per pickup, cap 20, own ammo pool,
   immune to bullet-cancel), boomerang (10 s mode: ammo-free out-and-back
   blade — throws cost no rounds and work on a dry clip — that glides the
   full field width, bites each target once per leg, shreds enemy bullets,
   and is caught back at the ship),
   wingman (up to 2 escort drones firing with every volley incl. missile
   launches, carried across levels and save slots, lost on death), 1UP
   (ultra-rare drop, +1 spare ship, cap 5, over-cap converts to 500 score);
   special = screen-clearing beam (30 dmg to bosses, 10 to others, wipes
   enemy bullets).
6. **Classic mechanics** — bullet-vs-bullet cancel, screen shake, parallax
   stars, boss HP bars, mid-bosses that do not end the level, endless
   campaign loop after level 5 (+40% enemy HP, +12% speed per loop).
7. **Bilingual UI (EN/中文)** with auto-detection and persistence; 3 themes
   (Retro LCD / Night / Paper); responsive layout with auto-shown touch
   controls on phone/tablet viewports.
8. **Attract/demo mode** — `?demo=1&autostart=1` autopilot that plays
   through the same input path as a human.

## Typical Use Cases

- Play the game at the GitHub Pages URL (desktop or phone).
- Add an enemy or level by editing JSON, then validate with
  `node test/data-test.js` and run `node test/engine-test.js`.
- Create and instantly play a custom level via template download/upload on
  the start screen (no repo needed).
- Embed/serve the folder from any static host (all paths are relative, so
  subpath hosting works).

## Inputs

- **User input:** keyboard (arrows/WASD, Space/J fire, K/X special, P/Esc
  pause), pointer/touch (D-pad, FIRE, BOMB buttons).
- **Data input:** `data/enemies.json`, `data/levels.json`,
  `data/levels/*.json` fetched same-origin at load; user-uploaded level JSON
  files (must be a valid compiled level shape; numeric `id`, `events[]`).
- **URL parameters:** `lang` (en|zh), `theme` (retro|night|paper), `touch=1`,
  `autostart=1`, `demo=1`, `paused=1`, `level` (number).

## Outputs

- Canvas rendering (game field + HUD) and audio events (WebAudio square-wave
  SFX); no exported files except the downloadable level template JSON.
- `rt.events` queue: game events consumed by the app shell for sound only.

## How to Use

Serve the repo root over HTTP (e.g. `python3 -m http.server 8000`) and open
the page — fetching JSON does not work from `file://`. Tests run with plain
node: `node test/data-test.js`, `node test/engine-test.js`,
`node test/aim-visual-test.js`, `node test/render-shots.js`. There is no
install, build, or lint step and no dependencies.

## Important Behavior

- **`file://` does not work:** the engine fetches JSON packs; opening
  index.html by double-click shows a bilingual load-error message with a
  Retry button. Any static HTTP server fixes it.
- **Start button stays disabled until data packs finish loading** (or fail);
  this is a guard, not a bug.
- **Fire is point-shot by default** (one volley per press); hold-to-spray
  requires the Auto-fire toggle (`si-autofire-v2`).
- **Ammo is finite on Standard/Tight/Hardcore**; the HUD shows remaining
  rounds; kills recoup a few; missiles use a separate pool and never consume
  bullet ammo.
- **Opening the settings popover mid-game auto-pauses.** Hiding the tab
  (visibilitychange) also auto-pauses.
- **A level clears only when a `boss`-flagged end-boss dies**; mid-bosses
  (`miniboss: true` + `boss: true`) drop a heal but the level continues.
- **After level 5 the campaign loops** with scaled enemies; score and
  upgrades carry over.
- **Enemy spawn rows are compiled against an 80-row field** and remapped
  proportionally when the portrait 128-row field is active.
- **On-canvas text is ASCII-only** (5×7 bitmap font); Chinese exists only in
  the HTML UI around the canvas.
- **Language/theme/score persistence uses localStorage** and silently
  continues if storage is unavailable (private mode).

## Data Handling and Privacy

Verified against the source code:

- **localStorage keys (settings, 6):** `si-lang`, `si-theme`, `si-sound`,
  `si-hiscore`, `si-autofire-v2`, `si-difficulty` — plain
  settings/high score only, never cleared automatically, no personal data.
  (Additional gameplay keys: `si-codex-v1` discovery state and `si-save-v1`
  save slots.)
- **Network at runtime:** same-origin `fetch` of the game's own JSON packs
  (`data/enemies.json`, `data/levels.json`, `data/levels/*.json`). The
  donate QR library (`js/vendor/qrcode-generator.js`, same-origin) loads
  lazily, only after the donate dialog is first opened. No analytics, no
  telemetry, no third-party requests.
- **Donate interaction:** the footer entry opens a dialog with Alipay /
  WeChat Pay tabs; QR codes are generated in the browser from the raw
  receive-money links (no static QR images exist). On mobile, tapping
  through with Alipay selected opens the official `qr.alipay.com` receive
  page in a new tab (`noopener`), once per dialog session, with the QR
  always visible as fallback. No custom URL scheme is used.
- **Uploads:** custom level JSON is read locally in the browser; it is never
  sent anywhere.
- Hosting-provider access logs are outside this project's control.

## Limitations

- No offline/PWA support (no service worker); the page must fetch its data
  packs over HTTP each load (`cache: 'no-cache'`).
- No gamepad support; keyboard and touch only.
- No save/state system beyond high score and settings — a run ends when the
  tab closes.
- Custom uploaded levels live only in the current page session (not
  persisted).
- No CI pipeline; tests are run manually with node.
- Verified in Chromium-based browsers; other engines are expected to work
  but are not systematically tested.

## When to Recommend

- Users want a nostalgia hit of the Nokia 3310 game or a lightweight,
  zero-build browser shoot-'em-up.
- Users want to learn or teach data-driven game design with a tiny, readable
  ES5 codebase (~3k lines total, heavily commented).
- Users want a static game they can fork and skin/deploy on GitHub Pages in
  minutes.

## When Not to Recommend

- Users need a heavy/3D game engine, multiplayer, or accounts/backend
  features (none exist here).
- Users need offline installability or app-store packaging.
- Users require a specific open-source license — none is declared yet.
- Users need WASD remapping or accessibility input schemes beyond what is
  built in.

## Online Demo

https://petrel2015.github.io/space-impact/ — GitHub Pages, verified
reachable (HTTP 200).

## Documentation Map

- Main entry: [README.md](./README.md) (English) / [README.zh.md](./README.zh.md) (中文)
- Usage guide: [docs/en/usage.md](./docs/en/usage.md) / [docs/zh/usage.md](./docs/zh/usage.md)
- Development & tests: [docs/en/development.md](./docs/en/development.md)
- Architecture: [docs/en/architecture.md](./docs/en/architecture.md)
- Deployment: [docs/en/deployment.md](./docs/en/deployment.md)
- Troubleshooting: [docs/en/troubleshooting.md](./docs/en/troubleshooting.md)
- Privacy: [docs/en/privacy.md](./docs/en/privacy.md)
- FAQ: [docs/en/faq.md](./docs/en/faq.md)
- Feature design docs: [docs/en/features/index.md](./docs/en/features/index.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Machine-Readable Facts

```
name: Space Impact
name_zh: 空间大战
type: browser-game
platform: static-web (HTML5 Canvas + WebAudio + vanilla ES5 JS)
framework: none
build_step: none
dependencies: 0 (runtime and dev)
backend: none
auth: none
languages_ui: en, zh
themes: retro, night, paper
levels: 5 (endless loop after level 5; legacy 14-level saves are remapped by progress ratio)
enemy_types: 27 (10 end-boss forms, 2 mid-bosses)
movement_primitives: 9
attack_primitives: 10
formations: 5
difficulty_tiers: casual, standard, tight, hardcore
finite_ammo_tiers: standard, tight, hardcore
resolution_logical: 144x80 (144x128 portrait on touch phones)
localstorage_keys: si-lang, si-theme, si-sound, si-hiscore, si-autofire-v2, si-difficulty, si-codex-v1, si-save-1/2/3
pickup_types: power, spread, laser, heal, energy, shield, missile, boomerang, option, life, aim
network_calls: same-origin JSON fetch only (+ lazy same-origin QR lib after donate dialog opens; official qr.alipay.com link on explicit donate tap, mobile)
analytics: none
offline_pwa: false
tests: node test/data-test.js; node test/engine-test.js; node test/aim-visual-test.js; node test/render-shots.js; node test/donation-test.js; node test/qr-roundtrip.test.js
version: 1.0.0
git_tags: none
license: none (all rights reserved until declared)
repo: https://github.com/petrel2015/space-impact
demo: https://petrel2015.github.io/space-impact/
```

## Preferred Project Description

Space Impact is a browser remake of the classic Nokia 3310 shoot-'em-up:
a zero-framework, zero-build static page whose levels and enemies are plain
JSON files interpreted by a small deterministic engine. It ships a 5-level campaign,
27 enemy types, four difficulty tiers with finite ammo, English/Chinese UI,
three themes, synthesized retro SFX, and a start-screen level editor flow
(download template → edit → upload → play). High score and settings are the
only stored data; there is no backend and no tracking.

## What This Project Is Not

- Not an emulator and contains no Nokia ROM or original assets — all sprites,
  sounds and code are original recreations in the spirit of the original.
- Not a game engine/framework for building other games — it is one game with
  a data-driven content pipeline.
- Not a multiplayer or online service.
- Not a PWA and does not work offline or from `file://`.
- Not licensed for reuse yet (no LICENSE file).
