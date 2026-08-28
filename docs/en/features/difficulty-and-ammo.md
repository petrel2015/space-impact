# Difficulty & Ammo

## Summary

Four difficulty tiers scale lives, HP, enemy strength and — from Standard
up — switch bullets from unlimited to a finite stockpile that is sized by
level length and partially recouped by kills.

## Background

Early in development the game had a single difficulty (fixed lives, HP,
unlimited bullets, as in the original 3310 feel). Hold-to-spray with free
ammo dominated every encounter: the aim tracer, bullet-cancel and weapon
modes had no reason to exist.

## Problem

- One fixed difficulty was either boring for shmup players or brutal for
  casual ones; nothing in between.
- Free ammo reduced combat to "hold fire and dodge": no shot discipline,
  no value in pickups that don't shoot harder.
- A naive ammo system (flat magazine, no recovery) punishes exactly the
  players who need help and stalls runs on long levels.

## Goals

- One setting covering casual → hardcore without hidden knobs.
- Ammo scarcity that creates decisions (aim vs spray, when to use
  missiles/special) without soft-locking a run.
- Stockpile math that adapts to each level's length automatically.
- Full determinism preserved: ammo is plain engine state, testable in
  node.

## Non-Goals

- Not a dynamic/Director-style difficulty that reacts to the player.
- No per-enemy ammo drops as pickups (recoup is automatic on kill).
- No difficulty switching mid-run (changing the tier applies to the next
  run/level, not the live one).
- Casual tier deliberately keeps unlimited ammo — a "zen" mode is a
  feature, not a failure.

## Solution Overview

A single tier table in `app.js` (`DIFF_PRESETS`) feeds three channels:

1. **Direct player stats** — `lives`, `maxHp` at runtime creation.
2. **Ammo policy** — tiers with `ammoPerSec > 0` compute the starting
   stockpile as `ammoBase + ammoPerSec × level.duration` (duration comes
   from the compiled level), and grant `ammoGain` rounds per kill.
3. **Enemy strength** — the tier multiplier (0.8/1.0/1.15/1.3) folds into
   the engine's difficulty number, which scales enemy HP (+40%/step),
   speed (+12%) and fire rate (10% faster).

Tier selection persists in `localStorage` (`si-difficulty`).

## Detailed Behavior

| Tier | Lives | Max HP | Multiplier | Ammo base | Ammo/sec of level length | Kill recoup |
|------|-------|--------|-----------|-----------|--------------------------|-------------|
| Casual | 4 | 10 | ×0.8 | ∞ (unlimited) | — | — |
| Standard (default) | 3 | 8 | ×1.0 | 60 | 1.6 | 2 |
| Tight | 3 | 6 | ×1.15 | 40 | 1.0 | 1 |
| Hardcore | 2 | 4 | ×1.3 | 30 | 0.6 | 1 |

- A **volley costs exactly 1 round** no matter how many barrels fire
  (weapon level 3's three barrels still cost one).
- At 0 rounds the trigger is dry (no error sound — the HUD number is the
  signal). Firing resumes the moment rounds exist again.
- **Missiles bypass the stockpile entirely**: while you have missiles,
  FIRE launches them (their own pool), so a dry magazine doesn't waste a
  missile pickup.
- Each level transition grants a **fresh stockpile** sized for the
  upcoming level; score/weapon/missiles/special carry over.
- Losing a life resets weapon level and missiles but **not** the ammo
  pool.
- The HUD shows remaining rounds (finite tiers only); on Casual the ammo
  readout is absent.
- Difficulty change in Settings applies from the next run (the popover
  auto-pauses the current one).

## User Experience

Settings ⚙ popover → Difficulty segmented control (Casual / Standard /
Tight / Hardcore), remembered per browser. During play the finite-ammo
tiers show the round count beside HP/lives; the aim-tracer item (◎ drop)
and point-shot fire (default) exist to make every round count — flipping
on Auto-fire on finite tiers is a deliberate handicap.

## Compatibility and Historical Impact

The Casual tier preserves the original unlimited-ammo behavior; the
default tier changed from "unlimited" to "Standard (finite)" when this
system shipped — existing players see the HUD ammo counter and the
documented recoup rules. Save data is unaffected (no run persistence
exists beyond hiscore/settings).

## Data and Privacy Impact

One new `localStorage` key: `si-difficulty` (tier name). No network or
personal data involvement (see [Privacy](../privacy.md)).

## Performance Impact

Negligible: an integer decrement per volley and an increment per kill;
stockpile computation is one multiply/add per level start.

## Current Limitations

- No in-game indicator when the trigger is dry beyond the HUD counter (no
  click/empty-magazine sound).
- Ammo policy is fixed per tier; there is no per-level override in the
  level JSON.
- Campaign-loop scaling and tier multiplier compose into one engine
  number, so their effects aren't independently separable in the HUD.

## Release Information

Introduced: v1.0.0 · Status: Stable

## Related Documentation

- [Usage — Difficulty tiers & ammo rules](../usage.md#difficulty-tiers)
- [Usage — Power-ups](../usage.md#power-ups) (missile ammo pool)
- [Architecture — difficulty composition](../architecture.md#difficulty--scaling)
- [Development — engine test #9 (finite ammo)](../development.md)

## Feature Changelog

### v1.0.0
- Initial four-tier system: lives/HP/multiplier table, length-scaled
  finite stockpiles from Standard up, kill recoup, missile pool isolation,
  point-shot default fire.
