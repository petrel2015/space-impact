# FAQ

Chinese version: [常见问题](../zh/faq.md). For breakage, see
[Troubleshooting](./troubleshooting.md) first — this page is about scope
and design choices.

## Is this the original Nokia game or an emulator?

Neither. It is an original remake: all sprites are hand-authored string
grids, all sounds are synthesized square waves, and all code was written
for this project. It contains no Nokia ROM, firmware, or assets — it's a
tribute to the 3310 classic's feel.

## Why 144×80 when the Nokia 3310 screen was 84×48?

A literal 84×48 field is very cramped for 27 enemy types and boss bullet
patterns. 144×80 keeps the monochrome LCD character (and chunky integer
pixels) while giving designs room to breathe. On touch phones in portrait
the field is even taller: 144×128.

## Can I play offline / install it as an app?

Not as a feature. There is no service worker or PWA manifest, and the page
fetches its data packs on every load, so you need the server reachable
when you (re)load. Within an already-loaded tab, gameplay continues
without network.

## Can I add levels or enemies without writing code?

Yes — that's the point. Enemies and levels are JSON. Two paths:

- **No repo needed:** start screen → *Download level template* → edit →
  *Upload level JSON* → play immediately ([how](./usage.md#custom-levels)).
- **Permanent additions:** edit `data/enemies.json` /
  `data/levels/*.json` in a fork and run `node test/data-test.js`
  ([how](../../README.md#extending-the-game)).

Brand-new movement styles do need a small engine-side primitive (one
function in `js/behaviors.js`) — everything else is data.

## Why is my ammo limited?

Finite ammo is part of the difficulty design from Standard upward: it
makes the aim tracer and bullet-cancel mechanics matter. Casual tier has
unlimited ammo; kills recoup rounds on every tier that has a limit. See
the [difficulty & ammo design note](./features/difficulty-and-ammo.md).

## Why did the game pause by itself?

Two deliberate cases: you opened the header Settings popover mid-game
(changing difficulty mid-run would be unfair), or the tab was hidden
(visibilitychange). Both resume exactly where you stopped.

## What happens after level 14?

The campaign loops back to level 1 with everything scaled up — enemy HP
+40%, speed +12%, faster fire per loop — while your score, weapon level,
missiles and special charges carry over. It's an endless score chase.

## Where is my high score stored?

In your browser's `localStorage` (key `si-hiscore`), per site. It is never
sent anywhere; clearing site data resets it. Full storage table:
[Privacy](./privacy.md).

## Does it support gamepads?

No — keyboard and touch only. There is no Gamepad API usage in the
codebase.

## Which browsers are supported?

Any modern browser (Chrome/Edge/Firefox/Safari class) — the game uses
Canvas 2D, WebAudio, `fetch`, `localStorage`, Pointer Events and
`matchMedia`. It is verified in Chromium-based browsers; legacy IE is not
supported.

## Is the game free? Can I reuse the code?

Playable for free at the [demo](https://petrel2015.github.io/space-impact/).
The code has **no license yet**, which means all rights are reserved by
default — talk to the maintainer (open an issue) before reusing it.

## What is `?demo=1`?

Attract mode: an autopilot flies the ship through the same input pipeline
a human uses (same input object shape, same engine steps). It's how the
game can run itself in a shop-window loop — and a nice sanity check that
the input path is uniform. Combine with `?autostart=1`.
