# Raid source retry audit — November 6, 2026

**0/40 raid gaps closed; 40/40 still gapped. Required coverage remains 40/80.** The existing 80-profile extraction candidate is preserved. It has not been promoted, and no partial finalization was used.

Continue draft PR #2 on `feat/wow-playstyle-compass`, parent `00a986e8af89a30e337ea77ef73502201d6d6cd7`, base main `8d6db77015200299b0158d47a85bed317fa53e26`.

## Retry evidence

[Exact errors and timestamps](raw/agent-evidence/2026-11-06-raid-source-retries.json) record 33 actual curl endpoint attempts, two separately recorded enabled-adapter checks, public web rechecks, retry counts, and backoff. Each endpoint received an initial attempt and two retries after 2 and 4 seconds. These are shared endpoint probes, **not 40 independent spec scrapes**. The 40-row [CSV](raid-retry-coverage.csv) and JSON profile rows retain each remaining gap and its source failures.

The direct probe window was 2026-11-06T18:09:56.479Z through 2026-11-06T18:13:46.868Z; the final enabled-config adapter check was 2026-11-06T18:14:12.603Z. Timestamps in the machine evidence use UTC. All direct requests used the inherited proxy and CA trust with no redirects. The runtime reported enforced restricted networking and ready `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET` variables; actual calls still failed. No credential values were read out, saved or posted.

Every direct endpoint attempt failed with curl exit 7 and no origin HTTP response:

> curl: (7) Failed to connect to proxy port 8080 after 0 ms: Could not connect to server

| Requested order / source | Retry result | Raid quantitative result |
| --- | --- | --- |
| 1. YouTube / googleapis | Keyed current-patch search and public search each failed at the proxy three times. Three public web opens returned `Online fetch throttled`. | No video, transcript, creator notes or raid rates collected. The Oct 27 origin 429 cannot be said to have cleared or persisted from these transport errors. Video view counts alone would not establish spec representation. |
| 2. Archon | Raid overview failed at the proxy three times. Three public web opens returned `(403) Forbidden`. | Access still returns HTTP 403 through the web tool. This recheck did not expose the Cloudflare document title/body; the historical Cloudflare finding remains historical. No challenge bypass attempted. |
| 3. WarcraftLogs | Adapter enabled in checked-in config; existing runtime credentials used for three OAuth POST attempts, plus enabled-adapter checks. All failed at the proxy. Public API docs returned HTTP 403 on three web opens. | No token, authenticated GraphQL data, raid zone or counts verified. Credentials cannot be judged invalid from a connection failure. Current adapter is metadata-only; metadata would not close a raid gap even if reachable. |
| 4. Raider.IO | API docs, raid static data, raid rankings and raid-comps requests retried. Direct transport failed; live web requests were inaccessible. Public Swagger was readable. | A documented raid roster endpoint was found (below), but no actual current-patch roster sample or denominator returned. No Mythic+ data or guild ranks substituted. |
| 4. battle.net | `us.version.battle.net/wow/versions` failed at the proxy three times and was inaccessible on three web opens. | No raid representation endpoint verified. Version metadata alone would not establish representation. This does not prove that all Blizzard APIs lack such data. |
| 5. Other existing allowlisted source: Wowhead | Existing guide URL failed at the proxy three times and was inaccessible on public web opens. Restricted discovery yielded no suitable current-patch spec count dataset. | Preserved historical Wowhead coverage stays 80/80; it does not supply the missing raid denominator. No new domain was added. |

## Verified collection lead and limitations

The public [Raider.IO API specification](https://raider.io/swagger.json), version 0.62.5, documents `/api/v1/live-tracking/guild/raid-comps` and `/api/v1/live-tracking/guild/raid-pulls`. Composition responses describe a single pull's specialization roster from Desktop App uploads. They require verified guild/pull selectors and are not aggregate popularity statistics. The adapter's blanket “no endpoint” message has been corrected.

The advertised `the-unbinding-of-kithix` raid selector and exploratory `us/illidan/Liquid` selector were connectivity probes only. No assertion is made that either identifies the candidate's raid/season sample. A usable collection still needs verified raid/date identity, sampling rules, privacy/access eligibility and role-slot denominators. A zero count must come from a valid sample, never from a failed request.

WCL is enabled with `zone_id: null` because no zone could be verified. Its existing collector queries expansion metadata only. A future quantitative implementation must collect real raid counts and add validated WCL eligibility/provenance to the strict gate; currently the gate accepts Archon or Raider.IO successes only. Merely adding `warcraftlogs` to the success-name list would incorrectly count metadata and must not be used to pass finalization.

## Preserved data and validation

- Candidate remains at 409 supported / 313 unknown dimension labels and 99 supported / 61 unknown hero comparisons. All hero pick rates/popular-choice flags stay unknown.
- All 40 Mythic+ representation metrics match the original immutable role-slot samples. All 40 raid representation values and sample sizes remain null.
- Independent Python JSON Schema validation passed. All 20 source archive parts, combined gzip and decoded byte counts/SHA-256 passed. All 80 profile source statuses agree with the immutable source run.
- Baseline Git blob/SHA-256 checks confirm the compressed candidate, published profiles, changes, latest pointer, run report, mutable raw cache and immutable manifest are unchanged. No raw run was replaced.
- Local `npm test` could not load Ajv/Vite; four test-file processes failed to load. The three dependency-free test-file processes passed again after the message change. This is not a full-suite pass.
- Local `/gaming-hub/` build could not load Vite. Offline dependency installation returned `ENOTCACHED`; no new registry domain was added.
- Strict finalization was attempted without the partial flag, but could not load Ajv before the source gate. No published files or history snapshots changed. The existing CI candidate tests independently exercise rejection of all 40 missing-source profiles once dependencies are installed.
- Current-head GitHub Actions validation will be linked in PR #2. Historical `ce510aa` CI passed 65 tests plus the mounted build; historical results are not claimed for this new head.

## Remaining raid profiles

Every row below still lacks a verified quantitative raid source. Shared source failures are detailed above and repeated per profile in the CSV/JSON.

| Profile | Wowhead | Raid representation | Gap closed |
| --- | --- | --- | --- |
| `blood-death-knight:raid` | success (preserved run) | null | no |
| `frost-death-knight:raid` | success (preserved run) | null | no |
| `unholy-death-knight:raid` | success (preserved run) | null | no |
| `havoc-demon-hunter:raid` | success (preserved run) | null | no |
| `vengeance-demon-hunter:raid` | success (preserved run) | null | no |
| `devourer-demon-hunter:raid` | success (preserved run) | null | no |
| `balance-druid:raid` | success (preserved run) | null | no |
| `feral-druid:raid` | success (preserved run) | null | no |
| `guardian-druid:raid` | success (preserved run) | null | no |
| `restoration-druid:raid` | success (preserved run) | null | no |
| `devastation-evoker:raid` | success (preserved run) | null | no |
| `preservation-evoker:raid` | success (preserved run) | null | no |
| `augmentation-evoker:raid` | success (preserved run) | null | no |
| `beast-mastery-hunter:raid` | success (preserved run) | null | no |
| `marksmanship-hunter:raid` | success (preserved run) | null | no |
| `survival-hunter:raid` | success (preserved run) | null | no |
| `arcane-mage:raid` | success (preserved run) | null | no |
| `fire-mage:raid` | success (preserved run) | null | no |
| `frost-mage:raid` | success (preserved run) | null | no |
| `brewmaster-monk:raid` | success (preserved run) | null | no |
| `mistweaver-monk:raid` | success (preserved run) | null | no |
| `windwalker-monk:raid` | success (preserved run) | null | no |
| `holy-paladin:raid` | success (preserved run) | null | no |
| `protection-paladin:raid` | success (preserved run) | null | no |
| `retribution-paladin:raid` | success (preserved run) | null | no |
| `discipline-priest:raid` | success (preserved run) | null | no |
| `holy-priest:raid` | success (preserved run) | null | no |
| `shadow-priest:raid` | success (preserved run) | null | no |
| `assassination-rogue:raid` | success (preserved run) | null | no |
| `outlaw-rogue:raid` | success (preserved run) | null | no |
| `subtlety-rogue:raid` | success (preserved run) | null | no |
| `elemental-shaman:raid` | success (preserved run) | null | no |
| `enhancement-shaman:raid` | success (preserved run) | null | no |
| `restoration-shaman:raid` | success (preserved run) | null | no |
| `affliction-warlock:raid` | success (preserved run) | null | no |
| `demonology-warlock:raid` | success (preserved run) | null | no |
| `destruction-warlock:raid` | success (preserved run) | null | no |
| `arms-warrior:raid` | success (preserved run) | null | no |
| `fury-warrior:raid` | success (preserved run) | null | no |
| `protection-warrior:raid` | success (preserved run) | null | no |

## Spot checks for the next attempt

Restore the configured environment proxy, then verify WCL OAuth and raid-zone/patch identity without printing tokens. Check Raider.IO raid-comps against public current-raid pulls, including repeat-player handling and denominator coverage. Confirm every newly supported raid value traces to an actual returned sample, hero rates remain unknown unless separately sourced, the original 40 Mythic+ profiles stay unchanged, and strict finalization refuses any remaining gap. Review the `/gaming-hub/wow/` source-coverage screen after any eventual promotion. PR #2 remains draft and unmerged.
