# Codex & Save Slots

Bestiary + item catalog with fog-of-war discovery, and three
browser-local save slots with continue-from-save. 中文版见
[图鉴与三档存档](../../zh/features/codex-and-save-slots.md).

## Codex (bestiary + item catalog)

Two tabs — **Enemies** (all 27 entries from `data/enemies.json`) and
**Items** (the 10 pickup types). Entries start as dim silhouettes with a
`???` name and a "first appears in level N" hint; an entry unlocks the
moment you actually meet it in play (an enemy counts when it appears on
the field; an item when you pick it up). Unlocked enemy cards show live
stats — HP, score, speed, movement, attack pattern, fire interval,
bullet speed — plus a bilingual one-line review; item cards show the
effect description and a review.

### Design decisions

- **Numbers are never duplicated.** The codex reads the *compiled*
  `enemies.json` defs at render time, so a data-pack change is reflected
  without touching codex content. `data/codex.json` holds only display
  content: `{en, zh}` names/reviews for enemies and names/descriptions/
  reviews for items. The attract-mode autopilot (`?demo`) does **not**
  fill the codex.
- **Attack/movement text is generated, not hand-written.** `attack +
  attackParams` (including `cycle` sub-attacks and `spawn` references,
  which resolve to the spawned enemy's localized name) run through i18n
  templates (`atkFan`, `mvDive`, …). This keeps 27 bilingual
  descriptions in sync with data automatically; a completeness test
  fails when a new attack type lacks a template.
- **"Attack power" is a footnote, not a stat.** All enemy bullets deal
  1 damage and ramming deals 2, globally — per-enemy damage numbers
  would be fiction. The dialog footnote also documents the per-loop
  scaling (HP ×1.4, speed ×1.12).
- **Discovery state** lives in `localStorage` (`si-codex-v1`), keyed by
  browser. `firstSeen` hints are computed from the built-in levels at
  load time, so uploading a custom level never rewrites them.
- Custom enemies added to `enemies.json` without codex entries degrade
  gracefully: the id is shown as the name, stats still render.

### Entry points

- Start screen: a **Codex** button next to **Start**.
- Pause menu (mobile and desktop alike): **Codex** opens the dialog over
  the paused game.

## Save slots (3)

A slot stores a **level-boundary snapshot** — the same carry shape
`advanceLevel()` hands to `startLevel()`:

```json
{ "v": 1, "levelId": 5, "loop": 1, "difficulty": "tight",
  "carry": { "score": 12345, "lives": 2, "weaponLevel": 3,
             "missiles": 8, "special": 2, "maxHp": 6 },
  "savedAt": 1700000000000 }
```

Resuming restores the difficulty preset and calls
`startLevel(idx, loop, carry)`; the finite-ammo stockpile is recomputed
for the level. Saving mid-level resumes from that level's start with
the saved stats (bullet-hell games gain little from intra-level
position saves).

- Keys: `si-save-1/2/3`. Slots with corrupt JSON or unknown versions
  read as empty; slots referencing custom (uploaded) level ids show
  "level data missing" and can be deleted.
- Pause menu → **Save progress** opens the 3-slot picker (click =
  overwrite, with the summary and timestamp refreshed in place).
- Start screen → **Continue** (only when a save exists) opens the same
  picker in load mode; every occupied slot has a delete button.

## Files

| File | Role |
|------|------|
| `data/codex.json` | bilingual display content (single source) |
| `js/codex.js` | discovery state, persistence, dialog rendering |
| `js/save.js` | slot storage + save/load picker dialog |
| `js/app.js` | data loading, `firstSeen` snapshot, discovery hooks, entry wiring |
| `test/codex-test.js` | content parity, template coverage, order, persistence |
| `test/save-test.js` | slot roundtrip, isolation, corruption tolerance |
| `test/codex-ui-test.js` | jsdom end-to-end: unlock, save, continue, delete |
