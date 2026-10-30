# Extract a WoW playstyle profile

This is the editable extraction contract for the Codex agent. The checked-in JSON schema is authoritative for field names and allowed values. Change this prompt and the schema together; update `apps/wow/per-patch-prompt.md` whenever that workflow or schema changes.

## Your role

You, the Codex agent running the owner's patch-refresh task, are the LLM extraction step. Read the automatically collected evidence and write the candidate JSON yourself. Do not call an external LLM API, introduce an API key, substitute another model, or build a runtime recommendation service. A command cannot invoke the owner's ChatGPT subscription; scraping and agent extraction are deliberately separate stages of one Codex task.

Your audience is a busy retail player choosing a spec for Mythic+ and raids. Explain what the player actually does and what can feel good or frustrating. Strength and popularity provide context; they are not the playstyle recommendation.

## Inputs

Read all of these before extracting:

- `apps/wow/config/specs.json`: the spec registry, including class, role, and hero talents.
- `apps/wow/pipeline/profile.schema.json`: the exact output contract.
- The current run's `data/<patch>/raw/bundle.json`, its source documents, and its run/coverage report.
- `apps/wow/taste.yaml`: preference tags, not instructions to make the evidence fit a desired result.
- The previous patch's `profiles.json`, when present, for comparison only. Previous values are not current evidence.

Use the detected expansion, patch, season, and collection dates from the bundle. If detection failed, state that limitation and require a documented config override before labeling data as current. Never silently use the example patch in a README or this prompt.

## Evidence comes before labels

Every dimension must be an object containing `value`, `explanation`, `key_abilities`, and `sources`. Never emit a bare number or label. Write one or two plain-language sentences naming the abilities, talents, hero talents, resources, or cooldowns that explain the value. List those names in `key_abilities`.

An explanation should say what the player does and why it leads to the value. "This spec has hard ramp" is insufficient. Explain the preparation, trigger, and consequence in the current build. Do not copy example mechanics from the kickoff brief: examples may describe an older patch.

Attach a source reference to every supported explanation. Each reference identifies the provenance source, its actual URL, and the relevant guide section. Include a YouTube timestamp only when a transcript segment supports the claim; never invent a timestamp. Preserve the distinction between a full successfully scraped document, an indexed search excerpt, and a source that was blocked. A link is not proof that the linked page was successfully scraped.

When evidence is absent, stale, contradictory, or too narrow to support a value, use `null` where the schema allows it, explain what is unknown, leave unsupported abilities and source arrays empty, and record the gap. Do not infer missing hero pick rates, representation, current cooldown lengths, or source success. An unknown field cannot justify a filter tag.

Record qualitative and quantitative evidence separately. A creator opinion may explain playstyle; it does not establish population representation. A popular build is not automatically easy, comfortable, or mandatory.

## Separate content profiles

Produce exactly one `raid` and one `mythic_plus` profile for every registered spec. Never merge them or copy raid assumptions into Mythic+. Shared facts may be repeated only when supported for both uses. Healer ramp, cooldown planning, talent choice, and hero preferences commonly differ by content. Explain those differences directly.

For a spec with incomplete coverage, still emit the two schema-valid profiles with explicit unknown dimensions and low coverage. Do not silently omit it. A complete registry is not a claim of complete extraction.

## DPS dimensions

- `rotation_stability`: 1–5, measuring the similarity of single-target and AoE gameplay. 1 means substantially different priorities; 5 means the same core loop. Name the buttons or priority changes that justify the score. Do not confuse this with rotational difficulty or target count scaling.
- `aoe_setup`: `automatic`, `manual`, or `none`. Name the current enabling ability and how it activates. A manually pressed cleave-enabling ability is manual even if it is easy to maintain.
- `resource_model`: choose the dominant supported model: `builder-spender`, `cooldown-driven`, `proc-driven`, or `maintenance-dot`. Explain meaningful secondary mechanics in prose.
- `cooldown_flexibility`: `flexible` or `committed`. Explain charges, recharge time, encounter timing, and the cost of delaying/mistiming. Name signature cooldowns and give durations only when verified in this patch, in the required `cooldowns` entries when the flexibility label is known. Short cooldowns alone do not prove "always send."
- `movement`: `turret`, `mobile`, or `mixed`. Name casts, channels, movement tools, or restrictions that drive the judgment.
- `damage_profile`: `burst-windows` or `sustained`, with the relevant cooldowns or ongoing damage loop.
- `complexity`: 1–5, based on interacting decisions, maintenance, and planning, with concrete examples. Do not turn popularity into a difficulty rating.
- `apm`: `low`, `medium`, or `high`, with evidence for the pace. Do not manufacture measured APM from a qualitative guide.

## Healer dimensions

- `ramp`: `none`, `soft`, or `hard`. Evaluate raid and Mythic+ independently. Describe preparation, lead time, payoff, and what happens when damage is unexpected.
- `healing_model`: `setup-payoff` or `direct`. Name the setup/trigger sequence or the direct healing button. A large cooldown does not necessarily make the whole spec direct.
- `proactive_vs_reactive`: `blanketer` or `spot-healer`, explaining the dominant healing decisions and important mixed behavior.
- `cooldown_style`: use `one-button-raid-savers` or `rotation-of-smaller-cds`. Name the key buttons and describe their dependencies.
- `healer_dps_expectation`: required for Mythic+ only; `low`, `moderate`, or `high`. Explain expected offensive contribution and how complex its damage loop is. Treat this as sourced group-play guidance, not a mandate inferred from a leaderboard.

## Tank dimensions

- `mitigation_style`: `proactive-maintenance` or `reactive`. Name the mitigation loop, resource planning, and reaction windows.
- `pull_profile`: `weak-on-pull-ramps-up`, `stable`, or `strong-on-pull`. Describe the opening seconds of a pull, the resources/buffs that are initially missing, and which buttons stabilize it. This is a specific survivability claim: do not reuse a historical stereotype without current evidence.
- `self_sustain`: `self-sufficient` or `healer-dependent`, with the actual recovery/mitigation mechanism and its limits.
- `defensive_toolkit`: use `many-small-defensives` or `few-big-ones`. Name the relevant abilities.
- `mobility_style`: `kiter` or `face-tanker`, explaining practical movement and tanking behavior. Mobility tools alone do not establish that kiting is the preferred mitigation plan.

## Every profile

- Give each hero talent option a sourced playstyle delta: what changes in the loop, setup, movement, or timing? Explicitly call out an option that removes an annoyance only when evidence supports it. Never invent a numeric "2→4" delta. Keep unavailable pick rates and popular-choice markers `null`; include percentage scope, content, and collection time when available.
- `tier_set_impact` uses `none`, `tweaks`, or `transforms-the-rotation` with named bonuses and the effect on decisions. Lack of data means unknown, not `none`.
- `meta_viability` describes representation in this content from quantitative evidence. Explain the sample and limitations. Low representation does not prove that a spec is unplayable; do not equate popularity with strength.
- `feel_summary`: two or three clear sentences describing the experience, tradeoffs, and content-specific rhythm. Reflect uncertainty when coverage is low.
- `play_this_if` and `avoid_if`: one plain-language sentence each, grounded in the dimensions. Avoid unsourced value judgments.
- `tags`: use only machine-readable flags justified by dimension explanations. For every tag, provide its supporting dimension path in `tag_evidence`. Do not attach `no-ramp` to an unexamined DPS/tank profile merely to improve the taste score. Absence of a healer ramp field is not evidence of no preparation.
- `provenance`: retain actual successful/failed/missing/stale sources, collection and update times, patch, video metadata, and coverage gaps. YouTube selection metadata includes title, channel, view count, and upload date. Distinguish no suitable guide, no transcript, quota failure, missing key, and blocked access.
- `confidence`: derive coverage using the checked-in derivation code. Account for source count, freshness, and quantitative/pick-rate availability. Never hand-raise coverage to make a card seem certain.
- `changes`: derive changes against the prior patch using checked-in code. A first extraction is a baseline, not an invented change. A known value becoming unknown is a coverage regression, not a gameplay change.

## Creator notes and source disagreements

Read the selected video's transcript. Summarize relevant segments in your own words as creator notes, preserving timestamped evidence. Treat them as one weighted input alongside guide text and quantitative data. Do not turn a creator tie-break preference into a whitelist or make the most-viewed video authoritative when its patch is wrong.

When sources disagree, prefer current patch, matching content, explicit mechanics, and a directly supported passage over a vague claim. Record a consequential disagreement in coverage gaps and lower certainty. Do not average incompatible labels or hide uncertainty.

## Finish and validate

Write the candidate to the run's candidate path; do not replace validated published data by hand. Run the validator, fix schema and evidence errors, derive confidence/tags/diffs, then use the finalization command to publish the versioned JSON. Verify all registry specs have both content profiles, all known labels have traceable evidence, all tags resolve to dimensions, and unavailable rates remain unknown.

Report coverage counts and unmet collection requirements plainly. If Wowhead plus a quantitative source did not succeed for every spec, the first acceptance criterion is not met, even if the pipeline completed without crashing. Preserve usable previous data and keep the new raw run for audit.
