# Synthetic transport fixtures

These fixtures model source response structures for offline parser regression
checks. They are **not scraped evidence**, game recommendations, or measurements.
The invented counts and text must never enter `data/<patch>/profiles.json`.

- Wowhead: schema.org JSON-LD Article containing script-only guide prose.
- Archon: Next.js `__NEXT_DATA__` plus labelled combined spec/hero popularity.
- Raider.IO: documented `rankings[].run.roster[]` with nested spec identifiers.
- YouTube responses are constructed inside the tests from the Data API's
  `search.list` and `videos.list` response fields.
