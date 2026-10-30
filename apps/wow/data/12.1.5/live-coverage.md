# Midnight Season 2 / 12.1.5 live coverage

Collected October 27, 2026 at 1:00 a.m. EDT. Run: `2026-10-27T05-00-41-763Z-360b0d78-6c4c-4a7d-8dc5-eb17e20d0f81`.

Required source coverage is **40/80**. All 40 Mythic+ profiles have Wowhead plus Raider.io evidence. All 40 raid profiles lack quantitative evidence and retain an explicit unknown representation value. This is not full coverage and has not been finalized.

| Source | Successful profile evidence | Remaining limitation |
| --- | ---: | --- |
| Wowhead | 80/80; 240/240 sections | No remaining guide-access gap in the final run. |
| Raider.io | 40/40 Mythic+ | 60-run leaderboard sample with role roster-slot denominators; repeated runs/players may occur. No raid specialization representation endpoint. |
| Archon | 0/80 | Origin HTTP 403, `Attention Required! &#124; Cloudflare`, after proxy CONNECT 200. No quantitative data captured. |
| YouTube | 0 transcript profiles | Search/metadata worked; no returned candidate met current-patch guide rules. No creator notes inferred. |
| WarcraftLogs | 0 | Optional adapter remains disabled; no spec event corpus. |

[Every spec/content profile in CSV](live-coverage.csv) · [Machine-readable audit](live-coverage.json).

## Collection fixes

The existing Wowhead adapter incorrectly interpreted the newsletter's passive `recaptchaSiteKey` as a blocked page. The ordinary HTTP 200 response contained author guide prose in a `noscript` fallback, which the adapter also missed. The update reads that returned author prose without executing scripts, excludes user comments, retains actual challenge rejection, and uses the guide's canonical `/bis-gear` URL.

The final run returned all 240 guide sections successfully with update dates and patch 12.1.5 evidence. Ten sections also mention older patches as historical author context. Blizzard's version table returned 12.1.5.70575; Raider.io returned active `season-mn-2` / `MN Season 2`. The explicit Midnight label follows the requested context. The patch release date remains unverified, so video selection requires the exact patch.

## Extraction and publication status

Agent extraction was interrupted. The workspace is currently unavailable during recovery; the new raw archive and incomplete extraction candidate have not been pushed. This report preserves the collection outcomes already observed in the completed run; it does not claim that the extraction is complete.

Raid quantitative values remain unknown. No hero pick rates, representation percentages, creator notes, or timestamps have been invented. A source's successful download alone does not establish every playstyle dimension.

Strict finalization was attempted **without** `--allow-partial`. It failed before validation because the Ajv dependency was unavailable; the independently checked source requirement is also unmet for all 40 raid profiles. The previously validated dashboard `profiles.json`, changes, and latest pointer are preserved.

## Validation limits

The collector's source-fixture checks passed before workspace recovery, and the recovered parsing logic passed isolated synthetic checks for passive CAPTCHA configuration, real challenges, author prose, patch badges, and comment rejection. Full npm validation/build could not complete in the local collector workspace: `registry.npmjs.org` and PyPI package downloads returned proxy CONNECT 403, and no usable offline dependencies were available. Python JSON Schema validation passed for the interim unknown candidate; that is not validation of a completed final extraction.

GitHub Actions subsequently installed the existing lockfile dependencies and passed **all 53 tests and the static build** for collector-fix commit `3400e887`. [Verified workflow run](https://github.com/Ejgood21/gaming-hub/actions/runs/40556637229). These checks validate the committed code and preserved dashboard data; they do not establish a completed new extraction.

CSV/JSON rows retain the attempted source URLs as provenance for each profile.

No environment settings were changed. The PR remains a draft and has not been merged.

## Profile source coverage

| Profile | Wowhead sections | Quantitative source | Required coverage | Raid representation |
| --- | ---: | --- | --- | --- |
| blood-death-knight:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| blood-death-knight:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| frost-death-knight:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| frost-death-knight:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| unholy-death-knight:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| unholy-death-knight:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| havoc-demon-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| havoc-demon-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| vengeance-demon-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| vengeance-demon-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| devourer-demon-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| devourer-demon-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| balance-druid:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| balance-druid:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| feral-druid:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| feral-druid:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| guardian-druid:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| guardian-druid:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| restoration-druid:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| restoration-druid:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| devastation-evoker:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| devastation-evoker:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| preservation-evoker:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| preservation-evoker:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| augmentation-evoker:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| augmentation-evoker:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| beast-mastery-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| beast-mastery-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| marksmanship-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| marksmanship-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| survival-hunter:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| survival-hunter:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| arcane-mage:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| arcane-mage:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| fire-mage:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| fire-mage:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| frost-mage:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| frost-mage:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| brewmaster-monk:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| brewmaster-monk:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| mistweaver-monk:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| mistweaver-monk:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| windwalker-monk:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| windwalker-monk:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| holy-paladin:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| holy-paladin:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| protection-paladin:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| protection-paladin:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| retribution-paladin:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| retribution-paladin:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| discipline-priest:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| discipline-priest:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| holy-priest:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| holy-priest:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| shadow-priest:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| shadow-priest:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| assassination-rogue:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| assassination-rogue:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| outlaw-rogue:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| outlaw-rogue:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| subtlety-rogue:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| subtlety-rogue:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| elemental-shaman:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| elemental-shaman:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| enhancement-shaman:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| enhancement-shaman:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| restoration-shaman:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| restoration-shaman:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| affliction-warlock:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| affliction-warlock:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| demonology-warlock:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| demonology-warlock:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| destruction-warlock:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| destruction-warlock:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| arms-warrior:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| arms-warrior:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| fury-warrior:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| fury-warrior:mythic_plus | 3/3 | Raider.io | passed | not applicable |
| protection-warrior:raid | 3/3 | Missing: Archon Cloudflare 403 | failed | unknown |
| protection-warrior:mythic_plus | 3/3 | Raider.io | passed | not applicable |
