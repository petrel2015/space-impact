# Deployment

The game is a fully static site: the repo root **is** the deployable
artifact — no build, no bundle, no environment variables. Chinese version:
[部署](../zh/deployment.md).

## Where It Runs

- Any static file host: GitHub Pages (the current home), Netlify, Cloudflare
  Pages, nginx/Apache, a USB stick behind `python3 -m http.server`.
- **Backend required: none.** The only network activity is the page fetching
  its own JSON packs and PNGs from the same origin.
- Requirement: must be served over HTTP(S) — `file://` breaks `fetch`
  (see [Troubleshooting](./troubleshooting.md)).

## GitHub Pages (current setup)

The live demo is <https://petrel2015.github.io/space-impact/> — i.e. Pages
serving the `main` branch from the repository root. To reproduce:

1. Fork or push this repo to GitHub.
2. Repository **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**; branch `main` (or `gh-pages` if you prefer), folder
   `/ (root)`.
3. Save. The site appears at `https://<user>.github.io/<repo>/` within a
   couple of minutes.

No GitHub Actions workflow is required for this mode (none exists in the
repo). If you switch to a custom Actions-based pipeline later, "upload
static artifact" is all it needs to do.

## Subpath Safety

The game is hosted at `/space-impact/` (a subpath, not a domain root) and
works there because **every reference is relative**:

- `index.html` loads `css/style.css`, `js/*.js` via relative URLs;
- `app.js` fetches `data/enemies.json`, `data/levels.json` and
  `data/levels/*.json` relative to the page;
- QR images under `donate/` are relative too;
- there is no `<base>`, no absolute `/…` path, and no hardcoded origin.

So any subpath (or domain root) works without configuration. Do not
introduce absolute paths in `index.html`/`js/` or subpath deploys will
break.

## Custom Domain

Not currently used. If you add one on GitHub Pages (Settings → Pages →
Custom domain + a `CNAME` file): nothing in the app needs to change — it
never references the `github.io` origin. Remember the `CNAME` file must
stay in the deployed branch, and enable HTTPS enforcement in the Pages
settings.

## Post-Deploy Verification Checklist

Run through this after each deployment (all of these were verified against
the live site during the docs build):

```bash
BASE="https://<your-host>/<path>/"
curl -sfo /dev/null -w "%{http_code}\n" "$BASE"                       # page
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/data/enemies.json"     # data pack
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/data/levels.json"      # level index
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/js/engine.js"          # script
```

Then in a browser: open the page (Start must enable once data loads), play
a few seconds, open Settings ⚙, toggle language/theme, and check the
browser console is clean (the docs screenshot run had zero errors).

## What Not to Worry About

- **No caching headers needed** — the page itself requests data packs with
  `cache: 'no-cache'` so content edits show up on reload; static assets are
  fingerprinted with `?v=` query strings when they change.
- **No CORS setup** — everything is same-origin.
- **No secrets** — there is literally nothing to configure.
