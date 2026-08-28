# Playing Guide

How to actually play and configure Space Impact. For what the game contains,
see the [README](../../README.md); for fixing problems, see
[Troubleshooting](./troubleshooting.md). 中文版见[玩法指南](../zh/usage.md).

## Starting the Game

1. Open the [online demo](https://petrel2015.github.io/space-impact/) — or
   serve the repo locally (`python3 -m http.server 8000`, then open
   `http://localhost:8000/`).
2. Optionally pick difficulty / theme / sound / auto-fire in the
   header **Settings ⚙** popover first (see below).
3. Press **Start** (or `Enter`). The button stays disabled until the level
   data has finished loading — on a slow connection that can take a moment;
   if loading fails it turns into an error message with a **Retry** button.

You start at level 1 (or the level forced by `?level=N`). Clearing the final
boss ends the level; after level 14 the campaign loops back to level 1 with
stronger enemies, keeping your score and upgrades.

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | Arrows / WASD | D-pad (bottom-left) |
| Fire | Space / J (one volley per press by default) | FIRE button |
| Special beam | K / X | BOMB button |
| Pause / resume | P / Esc | ⏸ button (top-right of the LCD) |
| Start / retry | Enter | — |

- **Point shots by default:** each FIRE press fires exactly one volley. Turn
  on **Auto-fire** in settings (persisted) to spray while holding.
- **Special beam:** requires at least one ⚡ energy charge (max 5). It clears
  all enemy bullets on screen, deals 30 damage to bosses and 10 to everything
  else.
- The on-screen controls appear automatically on touch devices, on
  phone/tablet-sized windows, or with `?touch=1`.

## Difficulty Tiers

Chosen in Settings ⚙ before (or between) runs; persisted per browser.

| Tier | Lives | Max HP | Ammo | Enemy strength |
|------|-------|--------|------|----------------|
| Casual | 4 | 10 | **Unlimited** | ×0.8 |
| Standard (default) | 3 | 8 | 60 base + 1.6/s of level length | ×1.0 |
| Tight | 3 | 6 | 40 base + 1.0/s of level length | ×1.15 |
| Hardcore | 2 | 4 | 30 base + 0.6/s of level length | ×1.3 |

Ammo rules (Standard and up):

- Each **volley** costs **1 round** regardless of how many barrels fire
  (weapon level 3 still costs one round).
- The starting stockpile scales with the level's length (a 180 s level gives
  Standard 60 + 1.6×180 ≈ 348 rounds; the HUD shows the exact number).
- Every enemy kill **recoups** 2 rounds (Standard) or 1 (Tight/Hardcore).
- Missiles have their **own pool** and never touch this stockpile.
- At 0 rounds the trigger is dry — the HUD number is your guide; the aim
  tracer item helps you not waste shots.

Each new level grants a fresh stockpile sized for that level. Losing a life
resets weapon level and missiles but not your ammo pool.

Enemy scaling per campaign loop (after level 14): +40% HP, +12% speed, 10%
faster fire.

## Power-Ups

Drops drift left; fly into them to collect.

| Item | Effect |
|------|--------|
| **P** power | Weapon level +1 (max 3: 1→2→3 barrels). At max: +200 score instead. |
| **S** spread | 12 s of 3-way angled spread fire |
| **L** laser | 10 s of piercing laser (pierces enemies, eats through bullet-cancel) |
| **+** heal | +2 HP (capped at max HP) |
| **E** energy | +1 special charge (max 5) |
| **G** shield | Absorbs the next 3 hits |
| **M** missile | +12 homing missiles (cap 20) — heavy damage (3× a normal shot), auto-track the nearest enemy ahead, fly straight through enemy bullets |
| **B** boomerang | 10 s of boomerang volleys — the blade flies out, turns back toward your row, and pierces on both legs; it also shreds enemy bullets it touches |
| **W** wingman | +1 escort drone (max 2) firing a straight shot with every volley — missile launches included. Lost on death, carried across levels and saves |
| **1UP** life | +1 spare ship (max 5). At full strength: +500 score instead |
| **◎** aim tracer | 20 s of dashed landing preview (see below). Repeat pickups stack to 45 s; lost on death |

Bosses always drop heal + energy when killed; mid-bosses always drop a heal.
Losing a life resets weapon level to 1 and clears your missile stockpile and wingmen.

## Aim Tracer

An in-game item (the ◎ crosshair drop), not a setting: picking one up grants
**20 seconds** of a faint animated dashed line that previews exactly where
your next volley lands — one ray per barrel, including spread angles — with a
blinking cross on the first enemy it would hit. It always mirrors the real
volley geometry (they share the same ray function in the engine). It is
purely visual: it costs nothing and fires nothing. Repeat pickups extend the
timer up to 45 s; losing a life ends the effect early.

## Pausing & Settings

- Pause with P/Esc or the ⏸ button; Resume / Restart / Menu from the overlay.
- Opening the header Settings ⚙ **mid-game auto-pauses**; switching tabs away
  also auto-pauses.
- Everything in Settings is persisted: difficulty, theme, sound, auto-fire
  (see [Privacy](./privacy.md) for the exact storage keys).
- Language toggles with the header button (中文/EN) and is remembered.

## Custom Levels

No server or repo commit needed:

1. On the start screen, click **Download level template** — you get
   `space-impact-level-template.json`, a small playable sample with a `_help`
   field documenting every key.
2. Edit `events` (the timeline), using any enemy id from
   `data/enemies.json` (full field reference in the
   [README](../../README.md#extending-the-game)).
3. Back on the start screen, click **Upload level JSON** and pick your file.
   The level is validated, compiled and launched immediately.

Rules: numeric `id` (missing id defaults to 90; use 90+ so built-in levels
stay untouched), `events[]` sorted by `t`, at least one `boss` event (that's
what clears the level). Uploading a level with an id you uploaded before
replaces it. A bad file shows a bilingual error message — see the table
below. Uploaded levels live only in the current page session.

## URL Parameters

| Param | Effect |
|-------|--------|
| `?lang=zh` / `?lang=en` | Force language |
| `?theme=retro` / `night` / `paper` | Force theme |
| `?touch=1` | Show on-screen controls on desktop |
| `?autostart=1` | Start playing on load |
| `?demo=1` | Attract-mode autopilot (use together with `?autostart=1`) |
| `?paused=1` | Open paused (overlay testing) |
| `?level=14` | Start at a given level (1–14) |

## Error Messages

All data errors are bilingual (follows the UI language) and name the exact
offender:

| Situation | Behavior |
|-----------|----------|
| Page opened via `file://` | "Failed to load game data" + help text explaining the `python3 -m http.server` fix; **Retry** button re-runs the loader |
| Level references an unknown enemy | `Level "X" references unknown enemy "Y"` — load fails, retry offered |
| Enemy references an unknown sprite/movement/attack | Named in the message (`errSpriteRef` / `errMovement` / `errAttack`) |
| Malformed level file | `Level file "X" is malformed (needs numeric id + events array)` |
| Custom upload has a JSON syntax error | The browser's parse error is shown in the status line; nothing else breaks |
| JS runtime error | Surfaced in-page in the status area with file/line |
