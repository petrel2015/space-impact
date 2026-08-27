# Data-Driven Content

## Summary

All game content — enemies and levels — is plain JSON, validated and
compiled by the engine at load, so adding content requires no engine code
changes.

## Background

Classic approach: game content (enemy types, level layouts) is implemented
as code — new enemy classes, new level scripts, retesting the binary. That
makes content authoring a programming task, couples content bugs to engine
bugs, and prevents non-programmers from contributing.

## Problem

- Adding one enemy required touching engine code and re-verifying the
  whole simulation.
- Level design needed a programmer as a middleman; typos in ids surfaced
  as crashes at runtime, not as authoring feedback.
- Node-side tests couldn't exercise "the real game" because content lived
  in code paths tied to the browser.

## Goals

- Define a new enemy or level by writing JSON only.
- Every cross-reference (enemy ↔ sprite ↔ movement ↔ attack ↔ formation)
  validated the moment data loads, with bilingual, offender-naming errors.
- The same data packs drive the browser game and node tests unchanged.
- Custom levels playable without a server or repo: download template →
  edit → upload.

## Non-Goals

- Not a general-purpose game engine or level editor GUI — one game, one
  vocabulary.
- No visual level editor; the template JSON's `_help` field is the
  authoring guide.
- No hot-reload/file-watching; content loads once per page load (with a
  Retry button on failure).
- No external content packs at runtime (no fetching levels from URLs);
  uploads are local files chosen by the user.

## Solution Overview

Two compile passes at load (`js/engine.js`):

- `compileEnemies(raw)` — validates every enemy against the registries in
  `behaviors.js` (movements/attacks) and `sprites.js`, normalizes numbers
  and defaults, produces defs keyed by enemy id.
- `compileLevel(raw, defs)` — validates the event timeline, expands
  formation offsets at compile time (fixed seed → stable layouts), sorts
  the queue by `t`, clamps `difficulty` to [0.5, 3], records `duration`.

A content vocabulary replaces code: enemies are
(movement primitive × attack primitive × numeric tuning × sprite × drop
table) tuples; levels are `{t, enemy|boss, count, interval, formation, y}`
timelines. `js/behaviors.js` is the single source of truth — the compiler
whitelists read the same registries the runtime dispatches through, so a
new primitive becomes available to JSON automatically once its function
exists.

## Detailed Behavior

- **Defaults:** missing `movement` → `straight`; missing `attack` →
  `none`; `bulletSpeed` defaults to 24; `fireRate` defaults to 0 (never
  fires).
- **Validation errors** throw `DataError` carrying an i18n key + params
  (`errEnemyRef`, `errSpriteRef`, `errMovement`, `errAttack`, `errCycle`,
  `errFormation`, `errField`, `errLevelShape`); the UI renders them
  bilingually and offers Retry.
- **Cycle attacks** may inline `{id, params}` overrides per sub-attack;
  `spawn` attacks must name an existing enemy (checked recursively).
- **Level rules:** numeric `id`; `events` sorted by `t`; `y` is a 0–1
  fraction of the playfield height; at least one `boss` event — killing
  that enemy is the only way a level clears; `miniboss: true` + `boss:
  true` gives the HP bar and guaranteed drops without ending the level.
- **Upload path:** `id` defaults to 90 if missing; same-id uploads replace
  the earlier one; uploads live only in the current page session.
- **Portrait remap:** levels are compiled against the 80-row field; if the
  runtime uses the 144×128 portrait field, spawn rows are remapped
  proportionally at `createRuntime`, and bosses recenter vertically.

## User Experience

- Start screen buttons: **Download level template** (a playable sample
  whose `_help` array documents every field) and **Upload level JSON**
  (file picker → validate → compile → launch straight into the level).
- Success shows a friendly status line and starts the level; failure shows
  the exact bilingual error naming the offender.
- Developers editing the repo's packs run `node test/data-test.js` for the
  same validation, plus `node test/engine-test.js` which plays every level
  to completion.

## Compatibility and Historical Impact

No historical behavior is affected: this is the content system since the
first public release. Data shape is additive — unrecognized fields in
enemy definitions are ignored by the compiler, and `_help` in level files
is explicitly skipped.

## Data and Privacy Impact

Content JSON is game data only; it contains no user data and is not
executed (no `eval`/`new Function`). Uploaded custom levels are read
locally in the browser and never transmitted (see
[Privacy](../privacy.md)). No new storage keys introduced by this feature.

## Performance Impact

Compile is one pass over ~30 KB of JSON at load; measured cost is
negligible (the whole data set compiles in well under a frame). Formation
expansion at compile time removes per-spawn work during play.

## Current Limitations

- Level events must be authored sorted by `t` (the validator rejects
  unsorted files rather than sorting them).
- `count` is capped at 20 per event, `interval` at 5 s (validator bounds).
- No weapon/event types beyond enemy spawns and the boss flag (no
  mid-level dialogues, scripted camera, or environment events).
- New movement/attack primitives still need one engine-side function — by
  design (see Non-Goals).

## Release Information

Introduced: v1.0.0 · Status: Stable

## Related Documentation

- [Usage — Custom Levels](../usage.md#custom-levels) · [Usage — error table](../usage.md#error-messages)
- [Development — what the tests check](../development.md)
- [Architecture — the compile step](../architecture.md)
- README: [Extending the Game](../../../README.md#extending-the-game)

## Feature Changelog

### v1.0.0
- Initial data-driven content system: JSON enemies/levels, compile-time
  validation with bilingual errors, 9 movement / 10 attack primitives,
  5 formations, template download + upload flow.
