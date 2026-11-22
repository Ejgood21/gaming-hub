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

- Carousel checks TFT Academy and MetaTFT on launch, new game, team-code
  paste, and **Refresh live data**. It matches the Academy set to the MetaTFT
  current queue and validates the patch. Academy's guide API can omit the
  patch ID. In that case the tier list must have been updated within
  MetaTFT's current-patch window, following the last day with mixed patches.
- The bundled Academy fallback is Set 18, Patch 18.3b, fetched October 1,
  2026. Saved tier lists carry a stale label and stay available for reference.
  During a failed or mismatched refresh, the tracker keeps your items and
  queue and Explore shows opening guidance. Current recommendations resume
  after a verified refresh.
- Explore uses Academy's S, A and B tiers. An X-tier guide can move ahead when
  you have its structured required item, emblem or augment. The guide names
  that requirement. X guides with an unmet requirement remain Situational.
  The Academy tier list also shows the source's other tiers for reference.
- MetaTFT builds use ranked queue, current patch, the last three days and
  Platinum+ ranks. Recommendations and pivots use builds fetched for the
  verified set and patch. The saved MetaTFT snapshot is from patch 18.3 and
  stays available as reference. S/A labels are relative to each champion.
  The hosted file preserves all 15,550 rows, encoded by its `buildColumns`
  and `itemIds` fields.
- Carousel priority uses queue shortages, crafting value, and the loot-history
  tie-break. It estimates crafting value without assuming measured drop odds.

The original audit and acceptance criteria are in [AUDIT-2026-11-21.md](AUDIT-2026-11-21.md).
