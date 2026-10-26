# WoW Spec Playstyle Compass

The route `/wow/` currently contains only the shared shell and an honest coming-soon state. It does **not** contain spec profiles, recommendations, rankings, or scraped data. The full WoW brief has not been added to this repository yet; implement it in a separate task when supplied.

- Entry point: `apps/wow/index.html`
- Shared theme and navigation: `assets/site.css` and `scripts/build.mjs`
- Future app-specific public assets: `apps/wow/assets/`, published at `/wow/assets/`
- Home card: the `wow` entry in `data/apps.json`

Reading must work with JavaScript disabled. Filters may enhance the static content. Do not add app accounts, a backend, a database, analytics, or live browser API calls.

## Future data refresh contract

This shell deliberately ships no scraper or extraction pipeline. In the separate full WoW build, add `pipeline/extract-playstyle.md` for the extraction rubric and use `apps/wow/per-patch-prompt.md` as the reusable task prompt.

The Codex agent is the extraction step: read collected public raw material, apply that rubric, and write reviewed profiles JSON. The owner runs a new Codex task for each patch on their existing ChatGPT subscription. Do not introduce paid LLM API calls, a Flash-class extraction model, or a required external LLM key.

Pipeline credentials may be available through the owner's Codex Personal vault as `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET`. Future collectors should use the environment only. Never print credentials, copy them into files, include them in generated profiles, or send them to the static browser build. This shell does not use them and builds without any credentials.
