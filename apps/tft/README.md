# TFT Carousel Companion

In-game TFT helper, seeded 2026-11-22 from Evan's standalone HTML file
(`carousel-companion.html`, 7.8 MB, 2,335 lines, as-shipped — do not edit
the seed directly; Codex work splits/refactors it per the audit).

## What it does today

- Manual item tracker: queue / bench / craft / receive / undo / backup.
- Paste a TFT Academy team code to import a comp and track its items.
- "Explore builds" fit-ranker over 45 Academy guides (Set 18 / Patch 18.3b
  bundled snapshot, fetched 2026-10-01).
- MetaTFT per-champion 3-item builds as a supplement (bundled Patch 18.3).
- Augment suggestions (2-1 / 3-2 / 4-2) and item-anvil suggestions
  (component / full / artifact / radiant).
- Carousel priority (beam-search marginal utility + loot-history tie-break —
  **not** drop odds; there is no odds model in the file).

## Live data (runtime, direct fetch, no proxy/key)

- TFT Academy: `tftacademy.com/tierlist/comps/__data.json` +
  `/api/assets/champions|items|augments?set=N`
- MetaTFT: `api-hc.metatft.com/tft-stat-api/unit_detail_overall|items`
  (ranked, current patch, last 3 days, Platinum+)
- See `AUDIT-2026-11-21.md` §2 for exact endpoints, parsing, caching,
  and fallback behaviour.

## Known problems (audit, 2026-11-21)

- Bundled Academy snapshot has **zero S-tier guides** (A 9, B 18, C 11, X 7);
  MetaTFT S/A are per-champion builds, not comps.
- Empty input recommends alphabetical A-tier #1; tier dominates fit below
  the 60-point promotion gate; X-tier is inconsistent; emblem gating is a
  prose regex; pivot roles cover only the 39 core items.
- Three pivot engines can disagree; no comp-level pivot.
- Zero tests; 4.95 MB of the file is base64 Academy icons.
- Full findings + Codex work plan (P0–P3) + 16 acceptance tests (A1–A16):
  `AUDIT-2026-11-21.md`.

## Constraints for Codex work

- No LLM call, backend, accounts, or paid API at runtime. Guidance must
  work live in the browser via rules / precomputed snapshots.
- Do not scrape BunnyMuffins at runtime. Opener data is a curated
  per-patch snapshot (`openers/<patch>.json`) from
  https://bunnymuffins.lol/openers — see audit §8.
- Keep the tool working as a standalone page unless Evan approves a
  build step. New home is `apps/tft/`, mirroring `apps/wow/`.
- Codex model: GPT-6.2 Sol Extra High (GPT-6.1 Sol is no longer offered;
  Extra High = 4 of 6, not Ultra/max).
