# Privacy

What the game stores and whom it talks to — written by reading the source,
not by policy template. Chinese version: [隐私](../zh/privacy.md).

## Summary

Space Impact runs entirely in your browser. It makes **no analytics, no
telemetry, and no third-party requests**. The only network traffic is the
page loading its own game data. Everything it remembers about you lives in
your browser's `localStorage` and consists of settings and your high score.

## Local Storage (localStorage)

The game writes exactly these 7 keys, all under the page's origin:

| Key | Value | Purpose | Lifetime |
|-----|-------|---------|----------|
| `si-lang` | `en` / `zh` | UI language choice | Until you clear site data |
| `si-theme` | `retro` / `night` / `paper` | Theme choice | Until you clear site data |
| `si-sound` | `1` / `0` | Sound on/off | Until you clear site data |
| `si-hiscore` | number | Best score ever | Until you clear site data |
| `si-autofire-v2` | `1` / `0` | Auto-fire toggle | Until you clear site data |
| `si-aimline` | `1` / `0` | Aim tracer toggle | Until you clear site data |
| `si-difficulty` | `casual` / `standard` / `tight` / `hardcore` | Difficulty tier | Until you clear site data |

No personal data, no identifiers, no gameplay telemetry is stored or
transmitted. If `localStorage` is unavailable (private mode, blocked), the
game silently continues with defaults — nothing breaks, nothing is
remembered.

## Network Behavior

Verified against the source, the complete list of runtime network activity:

1. **Same-origin data fetches at load:** `data/enemies.json`,
   `data/levels.json` and the 14 `data/levels/level*.json` files (sent with
   `cache: 'no-cache'`).
2. **Same-origin static assets:** the CSS/JS/images the page loads,
   including the two donate QR PNGs (`donate/alipay-qr.png`,
   `donate/wechat-qr.png`), which are preloaded so the donate modal opens
   instantly.
3. **Alipay app scheme (mobile only, tap only):** if you tap the Alipay
   donate button on a phone, the page attempts to open the Alipay app via
   the `alipays://` URL scheme; if nothing happens within 1.5 s it falls
   back to showing the QR-code modal. This is the only outbound URL in the
   codebase and it only happens on your explicit tap.

There is **no** analytics/tracking script, no font/CDN embed, no ad SDK,
no fetch to any API, and no cookies. The game works the same offline once
loaded for the current tab (see the FAQ for the offline caveat).

## Custom Levels

Level JSON you upload is read locally by the browser (`File.text()`) and
compiled in memory. It is **never uploaded anywhere** and disappears when
you close the tab.

## Sounds

All sound effects are synthesized in-browser with WebAudio (square waves).
No audio files are downloaded; nothing is recorded — microphone access is
never requested. The game requests no permissions at all (no camera,
location, notifications, or clipboard).

## Hosting Note

If you play the official demo on GitHub Pages, GitHub (the host) can see
HTTP requests in its server logs and your browser sends standard headers
(IP address, user agent). That is ordinary web hosting behavior and outside
this project's control — the game itself sends nothing beyond fetching its
own files. Self-hosting the folder gives you full control.
