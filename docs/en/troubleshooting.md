# Troubleshooting

Real failure modes, in rough order of how often they happen. Chinese
version: [故障排查](../zh/troubleshooting.md). If nothing here helps,
[open an issue](https://github.com/petrel2015/space-impact/issues) with:
browser + version, the URL (including parameters), what you did, and what
the status line said (screenshot of the start screen helps).

## Start screen says "Failed to load game data" / 游戏数据加载失败

| Symptom | Cause | Fix |
|---------|-------|-----|
| Opened `index.html` by double-click (URL starts with `file://`) | Browsers block `fetch` of local JSON from `file://` pages | Serve the folder: `python3 -m http.server 8000` inside the repo, open `http://localhost:8000/` — the error message itself explains this |
| Served over HTTP but still failing | A data pack is unreachable (404/500) or the server mangles JSON (wrong MIME is fine, truncated body is not) | Check the browser Network tab for a red request; the status line names the failing file and HTTP status |
| Broke the JSON while editing content | Syntax error or a reference typo | `node test/data-test.js` prints the exact offending entry; fix or revert |

The **Retry** button re-runs the loader — no page reload needed.

## Start button stays disabled / grey

The button enables only after `data/enemies.json` + `data/levels.json` +
all level files have loaded and compiled. On the first visit this is a few
requests; if it never enables, the load failed — see the status line under
the button (it will show the error) and the section above. This is a guard,
not a bug: the game cannot start without its content.

## No sound

- Browsers require a user gesture before audio may play. Sound unlocks on
  your first click/keypress/tap; if you started via `?autostart=1` without
  ever interacting, interact once.
- Check Settings ⚙ → Sound is ON (persisted in `si-sound`).
- OS-level mute / silent-mode switch on iOS devices mutes WebAudio.

## Touch controls don't appear

They show when: the device has a coarse pointer (real touch), **or** the
window is ≤ 560 px wide, **or** you have touched the screen at least once,
**or** `?touch=1` is in the URL. A narrow desktop window alone (pointer is
fine) is deliberately not enough. Add `?touch=1` to force them.

## Custom level upload rejected

| Status line says | Meaning | Fix |
|------------------|---------|-----|
| `Level file "…" is malformed (needs numeric id + events array)` | Missing/non-numeric `id` or no `events[]` | Give it `"id": 91` and an `"events": [...]` array |
| `Level "…" references unknown enemy "…"` | Typo'd enemy id in an event | Use ids from `data/enemies.json` |
| `Level "…" uses unknown formation "…"` | Bad `formation` value | One of single / lineV / lineH / stagger / scatter |
| `Unexpected token …` (browser JSON error) | File isn't valid JSON (trailing comma, comments, smart quotes) | Validate at a JSON linter; the template's `_help` shows the shape |
| Upload succeeds but no boss appears | Level without a `boss` event still plays, but can never be cleared | Add a final `{ "t": …, "boss": "boss1" }` event |

## Game feels wrong

| Symptom | Cause | Fix |
|--------|-------|-----|
| Fire only shoots once per press | Default point-shot behavior | Settings ⚙ → Auto-fire ON for hold-to-spray |
| Can't fire at all on Standard+ | Ammo pool empty (HUD shows 0) — the trigger is dry | Kills recoup rounds; next level grants a fresh stockpile; or switch to Casual (unlimited) |
| The dashed aim line is annoying/missing | Aim tracer toggled | Press `L` or Settings ⚙ → Aim line |
| Game pauses by itself | Opening Settings mid-game, or the tab was hidden | Auto-pause by design; Resume continues exactly where you stopped |
| Graphics look blurry | Non-integer scaling / browser zoom | The canvas snaps to integer pixel scale on resize; reset browser zoom (Cmd/Ctrl+0) |
| High score reset to 0 | localStorage cleared/blocked (private mode, "clear site data") | The game silently continues without storage; nothing else breaks |

## Keyboard doesn't respond

- Click the page once so it has focus (especially right after load).
- Arrow keys/space scroll the page instead: the game calls
  `preventDefault()` only while playing — make sure the game is actually
  running (mode: play), not sitting on the start screen.
- Input method editors (IME) in composition mode can swallow keys — switch
  the IME to plain English input.

## Reporting bugs

[Open an issue](https://github.com/petrel2015/space-impact/issues) with:
browser + version, OS, the URL and its parameters, steps to reproduce, and
expected vs actual. For data errors, paste the exact status-line message —
it names the file and offender.
