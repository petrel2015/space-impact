# Changelog

All notable user-visible changes to this project are documented in this file.

> **Note on versioning:** this repository has no git tags and no GitHub
> releases yet (checked with `git tag` — empty — and `gh release list`), and
> there is no `package.json` version field. The single entry below therefore
> aggregates the complete feature set first published on **2026-08-22**
> (initial public commit, live on GitHub Pages) up to the current state.
> Finer-grained history lives in the
> [git log](https://github.com/petrel2015/space-impact/commits/main/).
> Once the maintainer tags the first release, future entries will split
> normally from `[Unreleased]`.

## [Unreleased]

### Added
- Three new pickups (7 → 10 total): **W wingman** (+1 escort drone, max 2,
  fires a straight shot with every volley — missile launches included;
  carried across levels and save slots, lost on death), **B boomerang**
  (10 s weapon mode: the blade flies out, turns back toward your row and
  pierces on both legs, shredding enemy bullets it touches), and **1UP**
  (ultra-rare drop, +1 spare ship, cap 5, over-cap converts to 500 score).
  Ships with three 7×7 icons, bilingual codex entries, drop tables on nine
  enemies, a new `oneUp` pickup fanfare, a wingman field in the save carry,
  and full engine-test coverage.
- Complete bilingual documentation system: `docs/en` + `docs/zh` page sets,
  feature design documents (`docs/*/features/`), this changelog, and
  `README_FOR_AI.md` for AI assistants.

### Changed
- Campaign re-cut from 14 levels into the five-episode story campaign
  **The Way Home (《归途》)**: one star domain per level with a locked
  enemy ecology (Drift / Swarm Nebula / Iron Graveyard / Blockade /
  Turbulence; level 5 mixes them strictly wave by wave), two patrolling
  mid-bosses in level 4, per-level scenery palettes and skippable
  opening/closing narration lines. Boss summons now follow their ecology
  (the Broodmother lays wasps, the Master Brain launches patrol drones).
  Old level-6-14 saves are mapped onto the new cut by progress ratio
  (old level 8 ≈ new level 3); the five loop-only variant bosses stay in
  the data pack for second-loop / endless content. Codex cards gained a
  habitat line naming each enemy's star domain.
- Boomerang pickup reworked: throws are free — no ammo spent on limited-ammo
  tiers and a dry clip still loops the blade; the glide now spans the full
  field width and bounces off the far wall instead of flying off-screen;
  damage doubled to 2 with exactly one bite per target per leg. Codex and
  bilingual usage docs updated; engine tests gained free-throw / dry-clip /
  full-field-glide / one-bite-per-leg assertions.
- Donate flow rebuilt: a single low-key footer entry (`☕ Buy me a coffee /
  ☕ 请作者喝杯咖啡`) opens a dialog with Alipay / WeChat Pay tabs; QR codes
  are now generated in the browser from the raw receive-money links (dark on
  white, ECC M, quiet zone ≥ 4) instead of using committed PNG files. The QR
  library (`js/vendor/qrcode-generator.js`) lazy-loads on first dialog open —
  zero start-screen cost. On mobile, Alipay opens the official `qr.alipay.com`
  receive page in a new tab (`noopener`, once per dialog session) with the QR
  always visible as fallback; the previous `alipays://` scheme attempt and the
  1.5 s timeout were removed. Added `test/donation-test.js` (contract +
  jsdom interaction) and `test/qr-roundtrip.test.js` (jsQR decode roundtrip);
  removed `donate/*.png` and `test/make-donate-qr.sh`.

## [1.0.0] - 2026-08-22

*First release, published 2026-08-22; this entry summarizes the complete
feature set as of the aggregate date through the latest commit.*

### Added
- Full game: 14 levels, 27 enemy types (10 boss forms, 2 mid-bosses), final
  boss cycles 7 attack patterns with reinforcements; endless campaign loop
  with per-loop enemy scaling after level 14.
- Data-driven content: enemies and levels as plain JSON (`data/enemies.json`,
  `data/levels/*.json`), compiled and validated at load with bilingual
  `DataError` messages; add content without engine changes.
- Behavior primitive library: 9 movement primitives, 10 attack primitives
  (incl. `cycle` rotation and `spawn`), 5 spawn formations.
- Four difficulty tiers (Casual / Standard / Tight / Hardcore): HP
  10→8→6→4, lives 4→3→3→2, finite ammo from Standard up with kill recoup.
- Weapons & items: weapon levels 1–3, spread and piercing-laser modes, heal,
  special energy (screen-clearing beam), shield, and homing-missile reward
  weapon with its own ammo pool that flies through enemy fire.
- Point-shot fire by default with an Auto-fire toggle; aim tracer (dashed
  volley preview with impact marker) toggleable in-game.
- Bullet-vs-bullet cancel; screen shake; parallax stars; boss HP bars and
  warning.
- 144×80 logical LCD with integer scaling (nod to the 3310's 84×48), 5×7
  bitmap font; 144×128 portrait field on touch phones.
- EN / 中文 UI with auto-detection and persistence; 3 themes (Retro LCD,
  Night, Paper); header settings popover (auto-pauses the game when opened
  mid-run).
- Responsive layout with auto-shown on-screen D-pad + FIRE/BOMB on touch
  devices and phone/tablet-sized viewports.
- Synthesized WebAudio square-wave SFX (zero audio files).
- Custom-level flow: download a playable level template from the start
  screen, upload edited JSON and play instantly.
- Attract/demo mode autopilot (`?demo=1&autostart=1`) through the same input
  path as a human.
- URL parameters for testing/sharing: `lang`, `theme`, `touch`, `autostart`,
  `demo`, `paused`, `aim`, `level`.
- Node test suites with zero dependencies: data-pack validation
  (`data-test.js`), deterministic full-level simulation (`engine-test.js`),
  aim/missile visual checks (`aim-visual-test.js`), headless PNG scene
  renderer (`render-shots.js`).
- Donations section with Alipay/WeChat QR codes.
