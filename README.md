# Personal Gaming Hub

A single, private static home for personal gaming tools. One repository, one Cloudflare Pages deployment, one shared theme. Built for one person and maybe a friend, with no app accounts, backend, database, analytics, advertising, or tracking. **This is separate from Weather To Wear**: no shared code, design, credentials, or hosting.

The v1 hub includes four seeded release cards, a WoW Spec Playstyle Compass **shell**, and two clearly marked coming-soon slots. The full WoW app is a separate task. The releases are the owner's supplied watchlist, not a live or independently verified news feed. In particular, the GTA PC window is explicitly unconfirmed.

## Local development

Use **Node.js 24 LTS** (`.node-version`). There are zero third-party npm dependencies and no credentials are required to build or browse.

```sh
npm run dev
```

This builds `dist/`, serves it on port **4173**, and rebuilds when HTML, app files, data, or assets change. Refresh your browser after edits. If you edit the build/server scripts, restart the command. To use another port: `PORT=4174 npm run dev`.

```sh
npm run build    # one-command static export to dist/
npm run preview  # rebuild once, then serve dist/ on port 4173
npm test         # build + six data, route, output, and HTTP checks
```

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
_headers                    Cloudflare Pages security headers
robots.txt                  Asks crawlers not to index (not access control)
.github/workflows/check.yml Build/test checks for PRs and main
```

The source folder `apps/wow/` exports to `dist/wow/`, **not** `/apps/wow/`. Each non-underscore app folder becomes a top-level sub-route. Only its `index.html` and optional public `assets/` folder are exported. Markdown, future pipeline scripts, and raw collector files are not exported. Keep public app assets free of sensitive content. The `data/` directory is public output too; store only public display data there.

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

Public app-specific JS/CSS/images go in `apps/your-tool/assets/`, referenced as `/your-tool/assets/file.js`. Do not use inline scripts or styles: the content security policy intentionally permits only local external scripts/styles. If desired, add a global nav item in the `header` function in `scripts/build.mjs`; the home card works without this.

## Cloudflare Pages: one free deployment

These are **owner dashboard steps**, not infrastructure configured by this repository. This PR does not create a Pages project or an Access application. No Cloudflare credential is required in GitHub Actions or Codex for the native Git integration.

1. Keep `Ejgood21/gaming-hub` **private** in GitHub settings. Create/sign in to a Cloudflare account on the free plan.
2. In Cloudflare, go to **Workers & Pages → Create application → Pages → Connect to Git** (some dashboard versions say **Import an existing Git repository**).
3. Connect GitHub. Grant the Cloudflare GitHub app access to **only this repository**, and select `Ejgood21/gaming-hub`.
4. Create a Pages project, for example `personal-gaming-hub`. Choose these build settings:

   | Setting                    | Value                              |
   | -------------------------- | ---------------------------------- |
   | Production branch          | `main`                             |
   | Framework preset           | `None`                             |
   | Root directory             | Repository root (leave blank)      |
   | Build command              | `npm run build`                    |
   | Build output directory     | `dist`                             |
   | Build environment variable | `NODE_VERSION` = `24` (non-secret) |

5. Save and deploy. There is no Pages Functions directory, Worker, database binding, paid service, or app secret to configure.
6. In project **Settings → Builds & deployments**, keep automatic production deployments enabled for `main`. The initial deployment follows setup; afterward, a push/merge to `main` triggers the single site build automatically. GitHub Actions only checks the code; it does not deploy a second site.
7. **Protect access using all the steps below before calling the site private.** The initial site is reachable until Access is enabled; it contains only public game data and summaries by design.
8. Optionally attach an existing domain/subdomain under **Custom domains → Set up a custom domain** and follow the Cloudflare DNS instructions. A custom domain is not required: the free `pages.dev` address is sufficient. Keep hosting entirely separate from Weather To Wear.

Stay on Pages and Zero Trust free plans; avoid paid add-ons. A custom domain purchase, if you choose one, is separate and unnecessary. For this tiny static site, there are no metered app API calls or server costs. Cloudflare Access is free for up to 50 users under the current plan; this project needs one or two.

## Cloudflare Access: the entire authentication system

Private GitHub source **does not** make a Pages website private. `robots.txt`, `noindex`, and an unlisted URL are not access control. Cloudflare Access gates requests before they reach the static site. There is no login code, account database, or assumed auth header in the app.

### Identity and allow policy

1. Open **Zero Trust** from the Cloudflare dashboard. Create your Zero Trust team on the **Free** plan.
2. Under **Settings → Authentication → Login methods**, enable **One-time PIN**. Use email PIN login; no app account or custom identity provider is necessary.
3. For **each Access application below**, restrict the allowed login method to One-time PIN and create a policy named `Owner and friend`, action **Allow**. Under **Include**, choose **Emails**, then enter only your exact email and, optionally, your friend's exact email. Do not use an email-domain rule, Everyone, Bypass, or a broad team/account-members rule.
4. Access denies users who do not match an Allow policy by default. This implements **deny everyone else**. Do not add a separate **Block Everyone** policy: block policies can override the intended allow rule. Remove any broader automatically created allow policies on these applications. Choose a reasonable session duration, such as 24 hours.

### Protect both production and preview `pages.dev` hostnames

Cloudflare's Pages **Enable access policy** button initially protects **preview deployments only**. It does not, by itself, protect the production hostname. Use Cloudflare's documented production procedure:

1. In **Workers & Pages → your Pages project → Settings → General**, select **Enable access policy**.
2. Select **Manage** beside that policy to open the generated application under **Zero Trust → Access controls → Applications** (older dashboards: **Access → Applications**).
3. Edit/configure that application's **Public hostname**. Remove the wildcard `*` from the **Subdomain** field so the application covers the **exact production hostname**, for example `personal-gaming-hub.pages.dev`, with **no path restriction**. Rename the application to `Gaming Hub — production` if necessary, apply the exact-email/One-time PIN policy above, and save.
4. Return to Pages **Settings → General** and select **Enable access policy** again to restore a separate application for `*.personal-gaming-hub.pages.dev`. This covers branch aliases and hash-based deployment URLs, including old links. Apply the **same exact-email policy and One-time PIN method** to this application; replace any broad default policy.
5. Confirm that there are **two** applications: the exact production hostname and the wildcard preview hostname. The wildcard alone does not cover the production hostname. Protect previews even if you disable future automatic preview builds, since existing deployment links may still exist.

### If you add a custom domain

1. Under **Zero Trust → Access controls → Applications → Add an application**, choose **Self-hosted** (some dashboards: **Self-hosted and private**).
2. Add the hub's exact custom public hostname, for example `games.your-domain.example`, with **no path restriction**, so `/`, `/wow/`, `/placeholder/`, and assets are all covered. Apply the same exact-email Allow policy and One-time PIN method. Save.
3. Retain protection for both `pages.dev` applications. Protecting a custom domain alone leaves the default Pages hostname and deployment links as alternate entrances. Add policies for any additional aliases too.

### Verify privacy before using it

In a fresh private/incognito browser, open the production hostname, an existing hash/branch preview URL, and any custom hostname. For each, test `/`, `/wow/`, `/placeholder/`, and `/data/releases.json`. Each must reach the Access sign-in gate **before showing content**. Verify your allowed email can sign in with a PIN and navigate all pages; test a non-allowed email is denied. Recheck if you add a domain or change a policy. Do not treat a successful local build as proof that Access is configured.

The app itself sets no cookies or storage and sends no tracking requests. **Cloudflare Access uses its own authentication/session cookies**; those belong to the identity gate, not analytics or an in-app account system. Do not enable Cloudflare Web Analytics, a browser beacon, ad scripts, or other tracking add-ons. If account-level script injection or performance features modify the page, disable them for this site; the restrictive CSP expects only the files in this repository.

Official references: [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Pages preview protection](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [protecting the production pages.dev hostname](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain), [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), and [One-time PIN](https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/). Dashboard labels may move; the required exact-host and wildcard-host coverage stays the same.

## Secrets and future WoW refreshes

The browsed site and its static build require **zero keys**. Do not add secrets to Cloudflare Pages build settings or GitHub Actions. This v1 shell does not read, validate, or use pipeline credentials.

For future collector tasks only, the owner expects `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET` in their **Codex Personal vault**, exposed as environment variables. Never hardcode, print, copy to setup scripts, write to a committed `.env`, or include their values in raw published files or generated profiles. Presence in one task does not guarantee API authorization; verify the documented collector when it exists. Credential **names** in these instructions are documentation, not credential values.

**No paid LLM provider, no Gemini Flash, no external LLM key requirement.** The Codex agent running on the owner's existing ChatGPT subscription performs the extraction inside a task: read collected public raw data, apply `pipeline/extract-playstyle.md`, and write profiles JSON. That rubric and the collectors belong to the separate full WoW implementation; they do not exist in this shell. A new task each patch uses [apps/wow/per-patch-prompt.md](apps/wow/per-patch-prompt.md). Builds must continue to work without any provider credentials.

Only public game data and playstyle summaries belong on the site: no personal data, passwords, payment information, or valuable secrets. Even before Access is configured or if a URL leaks, those should be the only exposed contents. The app has no analytics, third-party fonts, remote scripts, or browser API calls. `_headers` supplies a restrictive CSP, no-referrer policy, anti-framing, content-type protection, and no-store/noindex directives; the local server also serves these headers for testing. They complement Access and do not replace it.

No system is literally 100% secure. Having no backend, no database, no user data, and an identity gate in front minimizes risk in the right way for a personal, low-traffic site. Keep GitHub/Cloudflare accounts protected, use exact-email policies, and verify every hostname.

## Validation and scope

`npm test` exercises the actual generated HTML, all app routes and assets, status/date caveats, hand-edited data validation, security headers, deterministic rebuilds, a real 404, and exclusion of credentials and source files from the export. GitHub Actions runs these tests and the build on PRs and `main`.

Before release, also check desktop, iPad, and phone layouts; all three filters and reset; keyboard navigation; the placeholder anchor links; and all pages with JavaScript disabled. The initial shell was checked in Chromium at 1440, 820, 390, and 320px widths. Real Cloudflare deployment, Access policy verification, and the separate full WoW app are owner/follow-up steps; they are not claimed by local tests.
