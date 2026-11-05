# Collection and extraction coverage — 12.1.5

Run: `2026-10-27T05-00-41-763Z-360b0d78-6c4c-4a7d-8dc5-eb17e20d0f81`. Immutable raw: `apps/wow/data/12.1.5/raw/runs/2026-10-27T05-00-41-763Z-360b0d78-6c4c-4a7d-8dc5-eb17e20d0f81.json.gz.manifest.json`. Candidate: `apps/wow/data/12.1.5/candidate-profiles.json.gz`.

Collection: `2026-10-27T05:00:41.763Z`. Codex-agent extraction completed: `2026-11-04T14:31:11.160Z`. Workspace access has recovered. The completed compressed candidate and integrity-checked multipart lossless immutable archive are included in this commit; published `profiles.json`, `latest.json`, and `changes.json` are preserved.

**Required source coverage: 40/80 profiles.** Finalization: Strict publication blocked by 40 raid required quantitative-source gaps; published data preserved; no --allow-partial used.

Required coverage means successful Wowhead plus successful Archon or Raider.IO in the selected raw run. Known labels, numeric observations, and registry completeness are counted separately.

Counts are profile observations, not unique HTTP requests. Caching and host-denial suppression may share results across profiles.

| Source | Success | Failed | Missing | Stale |
| --- | ---: | ---: | ---: | ---: |
| wowhead | 80 | 0 | 0 | 0 |
| archon | 0 | 80 | 0 | 0 |
| raiderio | 40 | 0 | 40 | 0 |
| youtube | 0 | 80 | 0 | 0 |
| warcraftlogs | 0 | 0 | 80 | 0 |

Source gaps:

- archon: HTTP 403 (80 profiles).
- raiderio: The documented public Raider.IO raid ranking endpoints rank guild progression, not specialization representation. Raid quantitative coverage comes from Archon; guild rank is not a spec pick rate. (40 profiles).
- youtube: HTTP 429 (80 profiles).
- warcraftlogs: disabled (80 profiles).

Wowhead supplied all 240 rotation, talent, and gear sections. Raider.IO supplied all 40 Mythic+ samples from 60 top runs. Archon failed all 80 profile observations with HTTP 403; the origin Cloudflare block leaves all 40 raid quantitative observations unknown. Public Raider.IO raid guild progression is not specialization representation. YouTube failed all 80 observations with HTTP 429; WarcraftLogs was disabled.

Archon access recheck `2026-11-04T14:30:14Z`: proxy CONNECT 200, origin HTTP 403, title `Attention Required! | Cloudflare`. This recheck is separate from the October 27 collection and supplies no quantitative evidence.

Candidate extraction: **80/80 profiles extracted**, with 409 known and 313 unknown dimension labels; 40 numeric representation observations; 99 known and 61 unknown hero playstyle options; 0 numeric hero pick rates. All hero popularity flags are unknown.

A null categorical representation label may accompany a sourced numeric sample; that sample does not establish population coverage, spec strength, or playstyle.

Validation: Python JSON Schema and semantic/provenance audits passed with 678 source references and zero errors. Final candidate Ajv validation, multipart archive integrity tests, and isolated strict-finalization rejection checks are pending GitHub Actions; the historical 57-test and /gaming-hub/ build result is listed separately.

| Profile | Wowhead | Archon | Raider.IO | YouTube | Required | Known labels / total | Unknown hero options |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| blood-death-knight:raid | success | failed | missing | failed | missing | 3/7 | 0 |
| blood-death-knight:mythic_plus | success | failed | success | failed | pass | 3/7 | 0 |
| frost-death-knight:raid | success | failed | missing | failed | missing | 6/10 | 1 |
| frost-death-knight:mythic_plus | success | failed | success | failed | pass | 6/10 | 1 |
| unholy-death-knight:raid | success | failed | missing | failed | missing | 6/10 | 2 |
| unholy-death-knight:mythic_plus | success | failed | success | failed | pass | 6/10 | 2 |
| havoc-demon-hunter:raid | success | failed | missing | failed | missing | 7/10 | 0 |
| havoc-demon-hunter:mythic_plus | success | failed | success | failed | pass | 7/10 | 0 |
| vengeance-demon-hunter:raid | success | failed | missing | failed | missing | 3/7 | 0 |
| vengeance-demon-hunter:mythic_plus | success | failed | success | failed | pass | 3/7 | 0 |
| devourer-demon-hunter:raid | success | failed | missing | failed | missing | 6/10 | 0 |
| devourer-demon-hunter:mythic_plus | success | failed | success | failed | pass | 6/10 | 0 |
| balance-druid:raid | success | failed | missing | failed | missing | 6/10 | 0 |
| balance-druid:mythic_plus | success | failed | success | failed | pass | 6/10 | 0 |
| feral-druid:raid | success | failed | missing | failed | missing | 6/10 | 1 |
| feral-druid:mythic_plus | success | failed | success | failed | pass | 6/10 | 1 |
| guardian-druid:raid | success | failed | missing | failed | missing | 2/7 | 2 |
| guardian-druid:mythic_plus | success | failed | success | failed | pass | 2/7 | 1 |
| restoration-druid:raid | success | failed | missing | failed | missing | 4/7 | 0 |
| restoration-druid:mythic_plus | success | failed | success | failed | pass | 5/7 | 0 |
| devastation-evoker:raid | success | failed | missing | failed | missing | 5/10 | 0 |
| devastation-evoker:mythic_plus | success | failed | success | failed | pass | 5/10 | 0 |
| preservation-evoker:raid | success | failed | missing | failed | missing | 5/7 | 0 |
| preservation-evoker:mythic_plus | success | failed | success | failed | pass | 6/7 | 0 |
| augmentation-evoker:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| augmentation-evoker:mythic_plus | success | failed | success | failed | pass | 4/10 | 2 |
| beast-mastery-hunter:raid | success | failed | missing | failed | missing | 5/10 | 2 |
| beast-mastery-hunter:mythic_plus | success | failed | success | failed | pass | 5/10 | 2 |
| marksmanship-hunter:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| marksmanship-hunter:mythic_plus | success | failed | success | failed | pass | 5/10 | 2 |
| survival-hunter:raid | success | failed | missing | failed | missing | 7/10 | 0 |
| survival-hunter:mythic_plus | success | failed | success | failed | pass | 7/10 | 0 |
| arcane-mage:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| arcane-mage:mythic_plus | success | failed | success | failed | pass | 4/10 | 2 |
| fire-mage:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| fire-mage:mythic_plus | success | failed | success | failed | pass | 4/10 | 2 |
| frost-mage:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| frost-mage:mythic_plus | success | failed | success | failed | pass | 4/10 | 2 |
| brewmaster-monk:raid | success | failed | missing | failed | missing | 4/7 | 0 |
| brewmaster-monk:mythic_plus | success | failed | success | failed | pass | 4/7 | 0 |
| mistweaver-monk:raid | success | failed | missing | failed | missing | 5/7 | 0 |
| mistweaver-monk:mythic_plus | success | failed | success | failed | pass | 6/7 | 0 |
| windwalker-monk:raid | success | failed | missing | failed | missing | 3/10 | 2 |
| windwalker-monk:mythic_plus | success | failed | success | failed | pass | 3/10 | 2 |
| holy-paladin:raid | success | failed | missing | failed | missing | 5/7 | 1 |
| holy-paladin:mythic_plus | success | failed | success | failed | pass | 6/7 | 1 |
| protection-paladin:raid | success | failed | missing | failed | missing | 2/7 | 0 |
| protection-paladin:mythic_plus | success | failed | success | failed | pass | 2/7 | 0 |
| retribution-paladin:raid | success | failed | missing | failed | missing | 6/10 | 2 |
| retribution-paladin:mythic_plus | success | failed | success | failed | pass | 6/10 | 2 |
| discipline-priest:raid | success | failed | missing | failed | missing | 5/7 | 0 |
| discipline-priest:mythic_plus | success | failed | success | failed | pass | 6/7 | 0 |
| holy-priest:raid | success | failed | missing | failed | missing | 5/7 | 0 |
| holy-priest:mythic_plus | success | failed | success | failed | pass | 6/7 | 0 |
| shadow-priest:raid | success | failed | missing | failed | missing | 5/10 | 2 |
| shadow-priest:mythic_plus | success | failed | success | failed | pass | 5/10 | 2 |
| assassination-rogue:raid | success | failed | missing | failed | missing | 8/10 | 0 |
| assassination-rogue:mythic_plus | success | failed | success | failed | pass | 8/10 | 0 |
| outlaw-rogue:raid | success | failed | missing | failed | missing | 8/10 | 2 |
| outlaw-rogue:mythic_plus | success | failed | success | failed | pass | 8/10 | 2 |
| subtlety-rogue:raid | success | failed | missing | failed | missing | 7/10 | 0 |
| subtlety-rogue:mythic_plus | success | failed | success | failed | pass | 7/10 | 0 |
| elemental-shaman:raid | success | failed | missing | failed | missing | 5/10 | 2 |
| elemental-shaman:mythic_plus | success | failed | success | failed | pass | 5/10 | 2 |
| enhancement-shaman:raid | success | failed | missing | failed | missing | 6/10 | 0 |
| enhancement-shaman:mythic_plus | success | failed | success | failed | pass | 6/10 | 0 |
| restoration-shaman:raid | success | failed | missing | failed | missing | 5/7 | 0 |
| restoration-shaman:mythic_plus | success | failed | success | failed | pass | 5/7 | 0 |
| affliction-warlock:raid | success | failed | missing | failed | missing | 4/10 | 0 |
| affliction-warlock:mythic_plus | success | failed | success | failed | pass | 4/10 | 0 |
| demonology-warlock:raid | success | failed | missing | failed | missing | 4/10 | 2 |
| demonology-warlock:mythic_plus | success | failed | success | failed | pass | 4/10 | 2 |
| destruction-warlock:raid | success | failed | missing | failed | missing | 5/10 | 0 |
| destruction-warlock:mythic_plus | success | failed | success | failed | pass | 5/10 | 0 |
| arms-warrior:raid | success | failed | missing | failed | missing | 7/10 | 0 |
| arms-warrior:mythic_plus | success | failed | success | failed | pass | 7/10 | 0 |
| fury-warrior:raid | success | failed | missing | failed | missing | 8/10 | 0 |
| fury-warrior:mythic_plus | success | failed | success | failed | pass | 8/10 | 0 |
| protection-warrior:raid | success | failed | missing | failed | missing | 3/7 | 0 |
| protection-warrior:mythic_plus | success | failed | success | failed | pass | 3/7 | 0 |

The CSV and compact JSON preserve all 80 profile rows, source and Wowhead section URLs, each unknown dimension, exact source failure, numeric sample, confidence, and immutable-run provenance. Full per-profile coverage gaps, representation notes, and cited passages remain in the compressed candidate linked above. Published-profile counts refer to the existing dashboard dataset and are reported separately from this candidate.

Raw archive integrity: 1,270,784 archive bytes; 6,711,798 decompressed bytes; decompressed SHA-256 `80be666da901970037465014a6696f7807084ef49fb7cea067a84249464c6b54`.
