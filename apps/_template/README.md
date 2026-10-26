# Copy-me app starter

1. Copy this folder to `apps/your-tool/` (lowercase words separated by hyphens; no leading underscore).
2. Edit its `index.html`: title, description, heading, and content. Keep `{{head}}`, `{{header}}`, `{{footer}}`, and the `main` element with `id="main"` for the shared shell and skip link.
3. Add one entry to `data/apps.json` with a unique `id`, title, description, `href: "/your-tool/"`, status (`coming-soon`, `shell`, or `ready`), `updated: "YYYY-MM-DD"`, and icon (`plus` or `compass`). You can replace a placeholder card instead of adding another.
4. Run `npm test` and `npm run build`. The build discovers every non-underscore app folder automatically. Your page will be `/your-tool/`, in the same Pages deployment.

Optional public app assets go in `apps/your-tool/assets/`; reference them as `/your-tool/assets/file.js` or `/your-tool/assets/file.css`. Only `index.html` and that public `assets/` folder are exported from an app. Documentation, scripts, raw pipeline data, and files outside `assets/` are not published. Never put credentials or private files in `assets/`.

Use `assets/site.css` classes to keep the shared theme. Keep content readable without JavaScript; add JS only for interactions. A new link in the global header is optional: edit the `header` function in `scripts/build.mjs` if desired. A home card is enough to make a tool discoverable.
