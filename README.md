# Personal Gaming Hub · public

A single, public static home for personal gaming tools, intentionally approved for public hosting by the owner on **2026-10-27**. One public repository, one GitHub Pages deployment, one shared theme. It contains public game data only, with no personal data, secrets, app accounts, backend, database, analytics, advertising, or tracking. **This is separate from Weather To Wear**: no shared code, design, credentials, or hosting.

The v1 hub includes four seeded release cards, a WoW Spec Playstyle Compass **shell**, and two clearly marked coming-soon slots. The full WoW app is a separate task. The releases are the owner's supplied watchlist, not a live or independently verified news feed. In particular, the GTA PC window is explicitly unconfirmed.

## Local development

Use **Node.js 24 LTS** (`.node-version`). There are zero third-party npm dependencies and no credentials are required to build or browse.

```sh
npm run dev
```

This builds `dist/`, serves it on port **4173**, and rebuilds when HTML, app files, data, or assets change. Refresh your browser after edits. If you edit the build/server scripts, restart the command. To use another port: `PORT=4174 npm run dev`.

```sh
npm run build    # static export to dist/ for /gaming-hub/
npm run preview  # rebuild for /, then serve on port 4173
npm test         # data, route, output, and HTTP checks
```

`npm run build` defaults to the GitHub Pages base path **`/gaming-hub/`**. Set `BASE_PATH=/ npm run build` for a domain-root export. Local dev and preview default to `/`; to check the Pages layout locally, run `BASE_PATH=/gaming-hub/ npm run preview` and open `http://localhost:4173/gaming-hub/`.

`npm ci --ignore-scripts` is supported for CI or a clean checkout, but there are no packages to download. `package-lock.json` is committed. No framework CLI, bundler, Tailwind, API service, or environment file is needed.

All reading works **without JavaScript**. The build turns JSON into real HTML; browser JavaScript only adds the release-status filters. The script does not fetch data, save preferences, or contact another host. The theme uses local CSS, system fonts, and inline SVG artwork.

## Repository layout

```text
index.html                  Home page template
404.html                    Real static 404 (no SPA fallback)
apps/
  wow/                      /wow/ — shell; full app comes later
    index.html
    README.md
    per-patch-prompt.md      Future Codex refresh task prompt
  placeholder/              /placeholder/ — two coming-soon slots
  _template/                Copy-me app starter; not published
assets/                     Shared theme, filter JS, favicon
data/                       Editable public display data
  releases.json             Editable release watchlist
  apps.json                 Home tool cards and update dates
scripts/
  build.mjs                 Validates data and generates dist/
  serve.mjs                 Local static server and file watcher
tests/hub.test.mjs           Node's built-in test runner
_headers                    Legacy headers; ignored by GitHub Pages
robots.txt                  Asks crawlers not to index (not access control)
.github/workflows/check.yml Build/test checks for PRs and main
.github/workflows/deploy.yml GitHub Pages deployment on pushes to main only
```

The source folder `apps/wow/` exports to `dist/wow/`, served at `/gaming-hub/wow/` on Pages. Each non-underscore app folder becomes a route under the configured base path. Only its `index.html` and optional public `assets/` folder are exported. Markdown, future pipeline scripts, and raw collector files are not exported. Keep public app assets free of sensitive content. The `data/` directory is public output too; store only public display data there.

Do not edit or commit `dist/`; it is rebuilt from source. `.env`, `.env.*`, `.dev.vars`, dependency caches, and local build outputs are ignored.

## Update the releases

Edit `data/releases.json` in GitHub or a text editor, then run `npm test`. Commit the JSON change and merge/push to `main` to rebuild Pages. **Do not hand-edit the generated cards.** There is no scraper in v1.

Each entry has this shape:

```json
{
  "id": "fable-pc",
  "title": "Fable on PC",
  "platform": "PC · Day-one Game Pass",
  "status": "firm",
  "date": "2027-02-23",
  "window": "Tue, Feb 23, 2027",
  "note": "Back to Albion. Available on Game Pass from day one.",
  "art": "arch"
}
```

- `id`: unique lowercase words separated by hyphens.
- `status`: exactly `firm`, `tba`, or `unconfirmed`. The card always spells out the status; color is not the only signal.
- `date`: `YYYY-MM-DD` for an exact date, or `null` when unknown. A firm release requires a valid exact date.
- `window`: human-readable date/window. Keep this in sync with `date` when editing; for example `Expected 2026`, `Date TBA`, or `Q1 2027?`.
- `platform` and `note`: short, plain text. Put uncertainty in the note too. Text is HTML-escaped by the build.
- `art`: one of `moon`, `sunset`, `crystal`, or `arch`. These are decorative local illustrations, not official cover art.

The four starting cards are The Duskbloods (TBA, expected 2026, Switch 2 exclusive), GTA 6 on PC (unannounced; unconfirmed Q1 2027 report), Fellowship 1.0 (TBA; seasonal content ended after Season 3), and Fable on PC (firm Tue Feb 23, 2027; day-one Game Pass), as requested in the brief. Confirm new announcements before changing a status to firm.

## Add a new app

1. Copy `apps/_template/` to `apps/your-tool/`. Use lowercase words separated by hyphens, without a leading underscore.
2. Edit the new `index.html`: title, meta description, heading, and content. Keep `{{head}}`, `{{header}}`, `{{footer}}`, and `<main id="main" tabindex="-1">` for the shared nav, theme, and skip link.
3. In `data/apps.json`, add a card or replace one of the two placeholder cards:

   ```json
   {
     "id": "your-tool",
     "title": "Your tool",
     "description": "One sentence explaining what it does.",
     "href": "/your-tool/",
     "status": "coming-soon",
     "updated": "2026-10-26",
     "icon": "plus"
   }
   ```

4. Set `updated` to the date you changed the tool. Status is `coming-soon`, `shell`, or `ready`; icon is `plus` or `compass`.
5. Run `npm test` and `npm run build`, then open `/your-tool/` using the local server. Check a phone-sized viewport and disable JavaScript to check reading.
6. Commit and merge/push to `main`. The new folder is discovered automatically, and the card links to it in the **same site**. No new hosting project or router configuration is needed.

Public app-specific JS/CSS/images go in `apps/your-tool/assets/`. HTML `href` and `src` values such as `/your-tool/assets/file.js`, `/data/releases.json`, and `/wow/` are prefixed with the base path during the build; fragment links remain on the current page. Root-relative CSS `url(...)` references are prefixed too. The `{{basePath}}` token works in HTML and published CSS/JS, for example `{{basePath}}your-tool/assets/file.js` or `fetch("{{basePath}}data/releases.json")`. Arbitrary JavaScript URL strings are not rewritten; use the token for site-root fetches/imports. Keep scripts and styles in local files. If desired, add a global nav item in the `header` function in `scripts/build.mjs`; the home card works without this.

## GitHub Pages hosting

The public project-site URL will be **https://ejgood21.github.io/gaming-hub/**. The `/gaming-hub/` prefix is required; routes include `/gaming-hub/wow/`, `/gaming-hub/placeholder/`, and `/gaming-hub/data/releases.json`.

**GitHub Free requires a public repository for GitHub Pages.** The owner has approved that visibility change. These two settings are explicit **owner steps** and are not changed by this PR:

1. In the repository's **Settings → General → Danger Zone → Change repository visibility**, make `Ejgood21/gaming-hub` **Public**.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.

The PR must then be reviewed and merged into `main` by the owner or a maintainer. This branch is not deployed, and the site is not claimed live before the owner completes both settings and the first deployment succeeds. If those settings are completed after a failed initial deployment, rerun the failed workflow or push another commit to `main`.

| Setting | Value |
| --- | --- |
| Hosting | GitHub Pages project site |
| Repository visibility on GitHub Free | Public |
| Pages source | GitHub Actions |
| Deployment trigger | Push to `main`, including a merged PR |
| Node.js | 24 (`.node-version`) |
| Build command | `npm run build` |
| Build output | `dist/` |
| Build base path | `/gaming-hub/` |

`.github/workflows/deploy.yml` uses official GitHub actions to check out the source, set up Node, test and build the static export, upload the Pages artifact, and deploy it to the `github-pages` environment. Deployment uses GitHub's built-in workflow identity; there are no added secrets, service credentials, paid services, or npm dependencies. Every later push or merge to `main` redeploys. Pull requests retain `.github/workflows/check.yml` and never deploy a preview or production site.

Draft [PR #2](https://github.com/Ejgood21/gaming-hub/pull/2), `feat/wow-playstyle-compass`, is still separate. After this Pages change merges, that branch needs to **rebase onto `main` and integrate the base-path handling** before it merges. This change does not rewrite or merge the WoW branch.

## Public access and hosting limitations

Anyone can read the site without signing in. `robots.txt` and the HTML robots meta tag retain the request not to index the site; these are crawler hints, not access control. The app sets no cookies or storage and makes no requests beyond the site itself.

`_headers` is retained as a harmless legacy file. **GitHub Pages ignores this Cloudflare-format file** and does not let this repository configure those response headers. Its CSP, anti-framing, content-type, referrer, permissions, cache-control, and `X-Robots-Tag` directives therefore **do not apply on GitHub Pages**. The local root-mode server still uses them for existing checks; the `/gaming-hub/` preview omits them to reflect Pages behavior. No equivalent production header protections are claimed. The HTML robots meta tag and `robots.txt` remain part of the static output.

After the owner enables Pages and a deployment succeeds, verify the public URL, the WoW and placeholder routes, local assets and data links, and the custom 404. Check without JavaScript and confirm browser requests stay on the site. Local validation cannot establish that the owner has enabled Pages or that the production deployment succeeded.

## Secrets and future WoW refreshes

The browsed site and its static build require **zero keys**. Do not add secrets to GitHub Pages or GitHub Actions. This v1 shell does not read, validate, or use pipeline credentials.

For future collector tasks only, the owner expects `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET` in their **Codex Personal vault**, exposed as environment variables. Never hardcode, print, copy to setup scripts, write to a committed `.env`, or include their values in raw published files or generated profiles. Presence in one task does not guarantee API authorization; verify the documented collector when it exists. Credential **names** in these instructions are documentation, not credential values.

**No paid LLM provider, no Gemini Flash, no external LLM key requirement.** The Codex agent running on the owner's existing ChatGPT subscription performs the extraction inside a task: read collected public raw data, apply `pipeline/extract-playstyle.md`, and write profiles JSON. That rubric and the collectors belong to the separate full WoW implementation; they do not exist in this shell. A new task each patch uses [apps/wow/per-patch-prompt.md](apps/wow/per-patch-prompt.md). Builds must continue to work without any provider credentials.

Only public game data and playstyle summaries belong on the site: no personal data, passwords, payment information, or secrets. The app has no analytics, third-party fonts, remote scripts, or browser API calls. Keep the repository and all published files suitable for public viewing.

## Validation and scope

`npm test` exercises the actual generated HTML, all app routes and assets, status/date caveats, hand-edited data validation, local-only legacy headers, deterministic rebuilds, a real 404, and exclusion of credentials and source files from the export. It also checks the `/gaming-hub/` mount, public data URLs, CSS/JS base-path handling, redirects, absent root aliases, ignored Pages headers, and invalid base paths. GitHub Actions runs these tests and the build on PRs and `main`.

For this Pages switch, all eight automated tests and `npm run build` passed. Chromium checked home, WoW, placeholder, and the 404 page at 1440, 820, 390, and 320px, each with JavaScript enabled and disabled. Subpath links, assets, data, anchors, filters/reset, and keyboard skip navigation passed, with no page errors, layout overflow, failed requests, or external requests. A repository/output credential scan was clean. These are local checks of the Pages URL structure. Public repository settings, Pages enablement, production deployment verification, and the separate full WoW app remain owner/follow-up steps; the site is not claimed live.
