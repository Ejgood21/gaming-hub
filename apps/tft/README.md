# TFT Carousel Companion

Carousel is a manual TFT item tracker and build planner. Record items, board
units, and augments, or paste a TFT Academy team code to load a guide. The app
runs in the browser and stores progress locally. Backups let you move progress
between browsers.

## Run locally

Open `carousel-companion.html` directly in a browser. This version includes the
Set 18 Academy guides, item recipes, thumbnails, and S/A MetaTFT builds in a
compressed fallback. When the
page is served over HTTP(S), it can also read the full snapshots next to it in
`data/`. The Gaming Hub build publishes the page and snapshots under `/tft/`.

Run the build and tests from this directory with Node 24.

```sh
node build.js
node --test
```

Edit `src/` and `data/` and rebuild the distributable. The build and tests require
zero dependencies. The HTML build is checked in so it can be downloaded and
opened directly. The original 8,133,298-byte seed was verified against SHA-256
`ef2e68040fa27d38dab3425d3f0d71399ded3072becd8329b0999358ad2a1fd8`.

## Data and recommendations

- Academy's 18.3b snapshot has 45 guides (9 A, 18 B, 11 C, 7 Situational).
  Explore builds needs at least two relevant inputs with positive fit. The
  fit score lists the contributions behind each result. Guide requirements
  are stored as `gatedBy` and item priority comes from the guide's structured
  carousel list.
- MetaTFT's saved statistics are from patch 18.3. They remain visible as stale
  reference data. Automatic suggestions and pivots require the same set and
  patch as Academy. The S/A labels are relative to each champion. The hosted
  snapshot retains all 15,550 rows. Each row follows `buildColumns` and uses
  indices into the snapshot's `itemIds` list.
- The app tries Academy's live tierlist and asset endpoints. The browser cache
  requires the bundled set and expires 24 hours after fetching. If the refresh
  cannot be read, the app shows a saved-data notice and keeps working.
- Live MetaTFT requests use the assigned champion, ranked queue, current patch,
  last three days, and Platinum+ ranks. Each request goes directly to its source.
- Carousel priority uses queue shortages, crafting value, and the loot-history
  tie-break. It estimates crafting value without assuming measured drop odds.

The original audit and acceptance criteria are in [AUDIT-2026-11-21.md](AUDIT-2026-11-21.md).
