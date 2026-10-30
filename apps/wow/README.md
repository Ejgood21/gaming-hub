# WoW Spec Playstyle Compass

A read-only dashboard answering **"How does this spec feel, and does that match what I like?"** It keeps raid and Mythic+ profiles separate, explains every supported label, and shows source coverage instead of hiding missing evidence. The app belongs to the gaming hub's one build and `/wow/` route. Its scraper, pipeline, configuration, and data stay independent under this directory.

## Browse and personalize

Use Node.js 24 LTS. From the repository root, run `npm ci` and `npm run dev` (port 4173 by default). Use the role, content, search, and feel-tag controls to narrow the spec grid. Comparison preserves raid and Mythic+ as separate profiles. Open a spec for dimensions, source links, hero options, patch changes, and similar specs. The processing screen exposes collection times, source failures, and coverage gaps. The static build renders all 80 raid/Mythic+ profiles for reading without JavaScript; filters, comparison controls, preferences, and the copy action require JavaScript. Taste and shortlist changes stay in browser-local storage; editing `taste.yaml` changes the repository defaults across devices after a rebuild.

Edit `taste.yaml` to change must-have and warning tags, then rebuild. The seed preferences are `stable-rotation`, `always-send-cds`, and `no-ramp`; `weak-on-pull` is a warning, never a hidden hard ban. Matches must have evidence. Inapplicable or unknown dimensions cannot count as a match: for example, a DPS profile does not receive `no-ramp` merely because it has no healer-ramp dimension. Taste scores use only role-applicable must-haves in the denominator, while unverified applicable preferences remain unmatched. The dashboard names skipped preferences; a tank with none applicable is unranked until you add tank preferences.

## Refresh one patch in Codex

On any device, open **New patch? Refresh data** in the header and copy the full prompt into a new Codex task in the gaming-hub cloud environment, using Extra High. The displayed text imports `per-patch-prompt.md`; there is no second UI copy to maintain.

The refresh has three deliberate stages:

1. **Collect automatically.** `npm run update-data` detects the retail context and collects every spec for both content types. It writes `data/<patch>/raw/bundle.json`, an immutable `raw/runs/<run_id>.json`, and `run.json`, preserving successes and isolated source failures. If no candidate exists, it also creates an unknown-value `candidate-profiles.json` template; the agent must replace unknowns only when evidence supports them. The run waits for agent extraction; it does not pretend to invoke an LLM from npm.
2. **Extract with Codex.** The agent reads the raw documents and `pipeline/extract-playstyle.md`, then writes `data/<patch>/candidate-profiles.json`. It uses the checked-in schema and real source passages. Unknown facts remain `null`, with explanations and coverage gaps. There is no external LLM API or runtime extraction.
3. **Validate and finalize.** Validate the candidate and finalize it using the commands below. The pipeline derives coverage confidence and patch changes, writes `profiles.json`, `changes.json`, and the data `latest.json` pointer, then the task runs checks, commits, and opens a PR into `main`. Previous patch directories remain available for comparison. Do not merge automatically.

From the repository root:

```sh
npm run update-data
node apps/wow/pipeline/validate.mjs apps/wow/data/<patch>/candidate-profiles.json
npm run update-data -- --finalize apps/wow/data/<patch>/candidate-profiles.json
npm test
npm run validate
npm run build
```

Replace `<patch>` with the detected version. The candidate is written by the Codex agent after it reads the raw evidence. Running the collection command alone does not complete extraction or overwrite usable published profiles.

Finalization normally requires Wowhead plus a quantitative source for every profile. If collection is blocked and a deliberately partial audit baseline is useful, the agent may explicitly use:

```sh
npm run update-data -- --finalize apps/wow/data/<patch>/candidate-profiles.json --allow-partial
```

This preserves unknowns and coverage gaps; it **does not satisfy** the all-spec collection acceptance criterion. Do not use this flag to present incomplete data as a successful full refresh. Scrape failures remain available in the raw run for investigation. Finalization pins each profile to its immutable raw run. To select a specific earlier collection, add `--raw-bundle apps/wow/data/<patch>/raw/runs/<run_id>.json` rather than silently using a later scrape.

## Season and patch detection

The pipeline attempts live discovery through its configured Raider.io/Blizzard strategy. It does not use a patch number embedded in the dashboard code. When live discovery is unavailable, `config/sources.json` contains an explicit `season_override` fallback with a reference URL and context. Every refresh must verify or update that fallback; a fallback is not an automatically detected season.

For a deliberate, documented override:

```sh
npm run update-data -- --patch <version> --season <season-slug> --expansion <name> --season-number <N> --patch-start <ISO-date>
```

The patch start bounds YouTube freshness. Never label an old guide current solely because it was the newest search result. The run report records detection gaps and override use.

## Source configuration and credentials

Edit `config/sources.json` for region, request limits, source URLs, collection samples, YouTube age rules, and preferred creators. `preferred_creators` is a list of channel-name hints. It breaks equal view-count ties between suitable recent videos; it is neither a whitelist nor a reason to choose an outdated or less-viewed result. The configured maximum age bounds freshness in addition to patch eligibility.

Source adapters live in `scraper/`:

| Source | Purpose | Credentials and limitations |
| --- | --- | --- |
| Wowhead | Rotation, talents, tier/gear qualitative evidence | No key; bot challenges and changed markup become gaps. |
| Archon | Build/hero popularity and content-specific quantitative context | No configured key; blocked requests or missing structured rates stay unknown. |
| Raider.io | Season context and representation from the returned public sample | Public API, no key. A top-run sample is not the full player population or a direct strength tier. |
| YouTube | Current guide selection, creator notes, timestamped evidence | Free-quota YouTube Data API key; transcript availability varies. |
| WarcraftLogs | Optional public cooldown-use evidence | Free OAuth client credentials; disabled unless configured. The current adapter only checks available metadata, explicitly records the missing cooldown corpus, and does not count that as playstyle evidence. Absence never blocks the run. |

Copy `.env.example` only for trusted local collection if needed. In Codex Cloud, configure `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET` as environment secrets. No values belong in the repository, static bundle, screenshots, logs, or PR. A paid subscription is not needed for the listed public collection APIs. Free API quota and a suitable current guide/transcript are still prerequisites.

YouTube metadata and search use the Data API; transcript retrieval uses the Python transcript adapter (`scraper/transcript.py`, based on `youtube-transcript-api`). Metadata and transcripts are separate outcomes. A selected video without a transcript does not supply creator notes. For transcript collection, install its Python dependency in the collection environment with `python3 -m pip install -r apps/wow/scraper/requirements.txt`; the dashboard build itself needs only Node. Check the adapter and run report for exact failures.

Never bypass a source's access control or the environment's network policy. Fix source access in the cloud environment configuration and rerun; retries cannot grant a blocked domain. The current collector needs `us.version.battle.net`, `raider.io`, `www.wowhead.com`, `www.archon.gg`, `www.googleapis.com`, `youtube.com`, and `www.youtube.com` allowed. Optional WarcraftLogs needs `www.warcraftlogs.com`. Add supporting guide hosts only when intentionally collecting that fallback source. Preserve real failures in provenance.

## Evidence and profile data

`pipeline/profile.schema.json` requires every dimension to contain `value`, a meaningful `explanation`, `key_abilities`, and `sources`. Known labels need actual evidence. Source references include the provenance source ID, section URL, and a timestamp when a transcript supports it. Unknowns use `null` and state what is missing. Unknown is different from `none`.

Each registry spec has two profile entries. Hero options store a sourced playstyle delta; unavailable pick-rate percentages and popular-choice flags stay `null`. Representation uses quantitative data and describes its sample. Feel summaries and **Play this if / Avoid if** statements must reflect evidence and uncertainty. Tags trace through `tag_evidence` to dimensions; the semantic validator rejects orphan or contradictory tags.

Confidence is derived from coverage, freshness, and quantitative availability. It is not a measure of spec strength or the agent's rhetorical certainty. Similar-spec suggestions use shared supported playstyle tags. Patch diffs compare the new profile with the previous patch; the first baseline does not claim invented changes, and losing evidence is not proof that gameplay changed.

`data/<patch>/raw/` is audit input; `profiles.json` is validated dashboard data. Do not edit values manually as a substitute for new evidence. Agent extraction of automatically collected material is the supported authoring path. Keep raw evidence bounded; prefer supporting passages or summaries and links over redistributing complete guides or videos.

## First-build status and acceptance

The first all-spec run attempted 80 separate content profiles. Direct requests were denied with HTTP 403 by the environment proxy's destination policy. Configured API keys do not grant network access, and the build does not claim API authorization from secret presence alone. Any separately collected web evidence must be labeled as such; an indexed excerpt does not count as a successful full-guide scrape. Empty or partial profiles are intentional evidence gaps rather than fictional current-patch advice.

The all-spec collection acceptance criterion is met only when every spec/content profile has successful Wowhead evidence plus a quantitative source. A robust run can finish while that criterion is unmet. Use the processing view, raw `run.json`, and profile provenance to audit the difference. The source code and validation workflow can pass while live collection remains blocked.

The first build passed Chromium interaction checks at 1440, 820, 390, and 320px widths, including filters, two-profile detail, comparison, preference persistence, processing, exact prompt copying and blocked-clipboard fallback. A JavaScript-disabled pass read all 80 content profiles. No browser requests went to external hosts.

Browser verification depends on the available environment tooling. Static build and schema checks do not prove every interaction has been exercised on a physical phone or iPad. Check the final task report for the actual tests performed and any remaining deployment/collection limits.

## Hosting and standalone use

Run the hub's `npm run build` and deploy `dist/` through its existing Cloudflare Pages project. There is one project and no WoW-specific hosting setup. The hub retains its original static builder; `apps/wow/build.mjs` uses an isolated Vite/React render and hydration build inside the shared light theme, header, and footer. The dashboard uses build-time data and the single prompt file; it makes no browser data-fetch or source-API calls. It can run from a static HTTP server without collection credentials; module browsers require HTTP rather than opening source files directly with `file://`.

To use this app in another static shell, retain `scraper/`, `pipeline/`, `config/`, `data/`, `taste.yaml`, and `per-patch-prompt.md` together and mount the dashboard at its configured base route. Do not make the scraper part of the public browsing runtime.
