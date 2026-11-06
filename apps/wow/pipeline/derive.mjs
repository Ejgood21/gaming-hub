/** Pure profile derivation, shared by the static dashboard and patch pipeline. */
export const ROLE_DIMENSIONS = {
  dps: ['rotation_stability', 'aoe_setup', 'resource_model', 'cooldown_flexibility', 'movement', 'damage_profile', 'complexity', 'apm'],
  healer: ['ramp', 'healing_model', 'proactive_vs_reactive', 'cooldown_style', 'healer_dps_expectation'],
  tank: ['mitigation_style', 'pull_profile', 'self_sustain', 'defensive_toolkit', 'mobility_style'],
};
export const CROSS_DIMENSIONS = ['tier_set_impact', 'meta_viability'];
export const DIMENSION_LABELS = {
  rotation_stability: 'ST → AoE stability', aoe_setup: 'AoE setup', resource_model: 'Resource rhythm',
  cooldown_flexibility: 'Cooldown flexibility', movement: 'Movement', damage_profile: 'Damage profile',
  complexity: 'Complexity', apm: 'Actions per minute', ramp: 'Healing ramp', healing_model: 'Healing model',
  proactive_vs_reactive: 'Healing focus', cooldown_style: 'Healing cooldowns', healer_dps_expectation: 'M+ damage expectation',
  mitigation_style: 'Mitigation', pull_profile: 'First seconds of a pull', self_sustain: 'Self sustain',
  defensive_toolkit: 'Defensive toolkit', mobility_style: 'Mobility style', tier_set_impact: 'Tier set impact', meta_viability: 'Representation',
};
export const TAG_RULES = {
  'stable-rotation': {dimension: 'rotation_stability', test: value => value >= 4},
  'always-send-cds': {dimension: 'cooldown_flexibility', test: value => value === 'flexible'},
  'no-ramp': {dimension: 'ramp', test: value => value === 'none'},
  'weak-on-pull': {dimension: 'pull_profile', test: value => value === 'weak-on-pull-ramps-up'},
  'strong-on-pull': {dimension: 'pull_profile', test: value => value === 'strong-on-pull'},
  'no-aoe-setup': {dimension: 'aoe_setup', test: value => ['automatic', 'none'].includes(value)},
  'manual-aoe-setup': {dimension: 'aoe_setup', test: value => value === 'manual'},
  'direct-healing': {dimension: 'healing_model', test: value => value === 'direct'},
  'setup-healing': {dimension: 'healing_model', test: value => value === 'setup-payoff'},
  'high-movement': {dimension: 'movement', test: value => value === 'mobile'},
  'low-complexity': {dimension: 'complexity', test: value => value <= 2},
  'high-apm': {dimension: 'apm', test: value => value === 'high'},
  'self-sufficient': {dimension: 'self_sustain', test: value => value === 'self-sufficient'},
  'proactive-mitigation': {dimension: 'mitigation_style', test: value => value === 'proactive-maintenance'},
  'sustained-damage': {dimension: 'damage_profile', test: value => value === 'sustained'},
  'burst-windows': {dimension: 'damage_profile', test: value => value === 'burst-windows'},
  'hard-ramp': {dimension: 'ramp', test: value => value === 'hard'},
  'committed-cooldowns': {dimension: 'cooldown_flexibility', test: value => value === 'committed'},
  'high-complexity': {dimension: 'complexity', test: value => value >= 4},
};
const known = dimension => dimension && dimension.value !== null && dimension.value !== undefined && dimension.sources?.length > 0;
export function deriveTags(profile) {
  const tags = [], tag_evidence = {};
  for (const [tag, rule] of Object.entries(TAG_RULES)) {
    const dimension = profile.dimensions[rule.dimension];
    if (known(dimension) && rule.test(dimension.value)) {
      tags.push(tag);
      tag_evidence[tag] = [rule.dimension];
    }
  }
  return {tags, tag_evidence};
}

/** Coverage confidence is not an opinion about how strong a specialization is. */
export function deriveConfidence(profile, now = new Date()) {
  const sources = profile.provenance.sources;
  const successful = sources.filter(source => source.status === 'success');
  const qualitative = successful.some(source => source.kind === 'qualitative');
  const quantitative = successful.some(source => source.kind === 'quantitative');
  const video = successful.find(source => source.kind === 'video');
  const dimensions = [...ROLE_DIMENSIONS[profile.role], ...CROSS_DIMENSIONS];
  const verifiedCount = dimensions.filter(key => known(profile.dimensions[key])).length;
  const verifiedRatio = verifiedCount / dimensions.length;
  const pickRates = profile.hero_talents.some(option => typeof option.pick_rate === 'number' && option.pick_rate_sources?.some(ref =>
    successful.some(source => source.id === ref.source_id && source.kind === 'quantitative')));
  const recent = successful.filter(source => {
    const date = source.video?.uploaded_at || source.updated_at;
    const age = date ? (new Date(now) - new Date(date)) / 86400000 : Infinity;
    return age >= 0 && age <= 90;
  });
  const recentGuide = recent.some(source => source.kind === 'qualitative');
  const recentVideo = recent.some(source => source.kind === 'video' && source.video);
  let score = (qualitative ? 25 : 0) + (quantitative ? 20 : 0) + (video ? 15 : 0) + (pickRates ? 10 : 0) + (recent.length ? 10 : 0) + Math.round(verifiedRatio * 20);
  // A downloaded guide alone must not turn an unextracted profile into a confident one.
  if (verifiedRatio < 0.5) score = Math.min(score, 34);
  if (!qualitative || !quantitative) score = Math.min(score, 49);
  if (!recentGuide || !recentVideo || !pickRates || verifiedRatio < 0.8) score = Math.min(score, 79);
  const reasons = [
    `${successful.length}/${sources.length} sources succeeded.`,
    `${verifiedCount}/${dimensions.length} dimensions have linked evidence.`,
    pickRates ? 'Hero talent pick rates are available.' : 'Hero talent pick rates are missing.',
    recent.length ? 'At least one source has a verified update/upload within 90 days.' : 'No source has a verified update/upload within 90 days.',
  ];
  if (!qualitative) reasons.push('No successful qualitative guide source.');
  if (!quantitative) reasons.push('No successful quantitative source.');
  if (!recentVideo) reasons.push('No recent video transcript with complete video metadata.');
  return {level: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low', score, reasons};
}

export function deriveChanges(current, previous) {
  if (!previous) return [];
  const changes = [];
  for (const [dimension, item] of Object.entries(current.dimensions)) {
    const old = previous.dimensions[dimension];
    if (JSON.stringify(old?.value ?? null) !== JSON.stringify(item.value)) {
      changes.push({dimension, previous: old?.value ?? null, current: item.value,
        explanation: `${DIMENSION_LABELS[dimension] || dimension}: ${old?.value ?? 'unverified'} → ${item.value ?? 'unverified'}. ${item.explanation}`,
        kind: old && (old.value === null || item.value === null) ? 'coverage' : old ? 'value' : 'added'});
    } else if (old && (old.explanation !== item.explanation || JSON.stringify(old.key_abilities) !== JSON.stringify(item.key_abilities) ||
      JSON.stringify(old.cooldowns || []) !== JSON.stringify(item.cooldowns || []) ||
      old.representation_percent !== item.representation_percent || old.sample_size !== item.sample_size)) {
      changes.push({dimension, previous: old.value, current: item.value,
        explanation: `Evidence changed for ${DIMENSION_LABELS[dimension] || dimension}. ${item.explanation}`, kind: 'evidence'});
    }
  }
  for (const [dimension, old] of Object.entries(previous.dimensions)) {
    if (!(dimension in current.dimensions)) changes.push({dimension, previous: old.value, current: null,
      explanation: `${DIMENSION_LABELS[dimension] || dimension} is no longer included in the current schema.`, kind: 'removed'});
  }
  for (const option of current.hero_talents) {
    const old = previous.hero_talents.find(item => item.name === option.name);
    if (!old || old.playstyle_delta.value !== option.playstyle_delta.value || old.playstyle_delta.explanation !== option.playstyle_delta.explanation ||
      JSON.stringify(old.playstyle_delta.key_abilities) !== JSON.stringify(option.playstyle_delta.key_abilities)) {
      changes.push({dimension: `hero_talents.${option.name}`, previous: old?.playstyle_delta.value ?? null,
        current: option.playstyle_delta.value, explanation: `${option.name}: ${option.playstyle_delta.explanation}`, kind: 'hero-talent'});
    }
    if (old && (old.pick_rate !== option.pick_rate || old.popular !== option.popular)) {
      changes.push({dimension: `hero_talents.${option.name}`, previous: old.pick_rate, current: option.pick_rate,
        explanation: `${option.name} pick rate: ${old.pick_rate === null ? 'unavailable' : `${old.pick_rate}%`} → ${option.pick_rate === null ? 'unavailable' : `${option.pick_rate}%`}. Popular choice ${option.popular === null ? 'is unverified' : option.popular ? 'is confirmed' : 'is not confirmed'}.`,
        kind: old.pick_rate === null || option.pick_rate === null ? 'coverage' : 'hero-talent'});
    }
  }
  for (const option of previous.hero_talents) if (!current.hero_talents.some(item => item.name === option.name)) {
    changes.push({dimension: `hero_talents.${option.name}`, previous: option.playstyle_delta.value, current: null,
      explanation: `${option.name} is absent from the current hero talent options.`, kind: 'removed'});
  }
  return changes;
}

export function tasteMatch(profile, taste = {must: [], avoid: []}) {
  const roleDimensions = new Set([...ROLE_DIMENSIONS[profile.role], ...CROSS_DIMENSIONS]);
  const details = (taste.must || taste.must_haves || []).map(tag => {
    // Known role-specific preferences use the dimensions evaluated for that role.
    // Unknown custom tags remain applicable/unconfirmed instead of being discarded.
    const rule = TAG_RULES[tag];
    const applicable = !rule || roleDimensions.has(rule.dimension);
    return {tag, applicable, matched: applicable && profile.tags.includes(tag),
      evidence: (profile.tag_evidence[tag] || []).map(dimension => ({dimension, ...profile.dimensions[dimension]}))};
  });
  const warnings = (taste.avoid || []).filter(tag => profile.tags.includes(tag));
  const applicable = details.filter(detail => detail.applicable);
  const non_applicable = details.filter(detail => !detail.applicable).map(detail => detail.tag);
  const matched = details.filter(detail => detail.matched).length;
  const explanation = applicable.length ? `${matched}/${applicable.length} applicable must-haves confirmed${applicable.some(detail => !detail.matched) ? '; other applicable preferences are unconfirmed or do not match' : ''}.${non_applicable.length ? ` ${non_applicable.length} preference${non_applicable.length === 1 ? ' does' : 's do'} not apply to ${profile.role}.` : ''}` :
    'No role-applicable must-haves configured; warnings still apply.';
  return {matched, total: applicable.length, configured_total: details.length, non_applicable,
    score: applicable.length ? matched / applicable.length : 0, details, warnings, explanation};
}
export const scoreTaste = tasteMatch;
export function similarProfiles(profile, profiles, limit = 3) {
  const relevant = ['rotation_stability', 'cooldown_flexibility', 'ramp'];
  return profiles.filter(other => other.spec_id !== profile.spec_id && other.content_type === profile.content_type && other.role === profile.role)
    .map(other => {
      const shared_tags = other.tags.filter(tag => profile.tags.includes(tag));
      const matching_dimensions = relevant.filter(key => known(profile.dimensions[key]) && known(other.dimensions[key]) && profile.dimensions[key].value === other.dimensions[key].value);
      return {profile: other, score: shared_tags.length + matching_dimensions.length * 2, shared_tags, matching_dimensions};
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id)).slice(0, limit);
}

export function unknownDimension(label = 'this dimension') {
  return {value: null, explanation: `Current-patch evidence for ${label} has not been extracted. This label remains unverified until a Codex refresh can read supporting sources.`, key_abilities: [], sources: []};
}
const SOURCE_KIND = {wowhead: 'qualitative', archon: 'quantitative', raiderio: 'quantitative', youtube: 'video', warcraftlogs: 'quantitative'};
function provenanceFromRaw(raw, patch, generatedAt) {
  const rawSources = {...Object.fromEntries(Object.keys(SOURCE_KIND).map(id => [id, {
    status: 'missing', fetched_at: generatedAt, error: 'No collection record was available for this profile and source.',
  }])), ...raw?.sources};
  const sources = Object.entries(rawSources).map(([id, source]) => {
    const state = source.status === 'ok' ? 'success' : source.status;
    const status = ['success', 'missing', 'failed', 'stale'].includes(state) ? state : 'missing';
    const record = {id, status, url: source.url || null, scraped_at: source.fetched_at || generatedAt,
      updated_at: source.data?.updated_at || null, reason: status === 'success' ? null : source.error || 'Source is unavailable.', kind: SOURCE_KIND[id] || 'qualitative'};
    const video = source.data?.video || source.data?.selected;
    const viewCount = video?.view_count ?? video?.views;
    if (id === 'youtube' && video?.title && video?.channel && Number.isInteger(viewCount) && video.uploaded_at) record.video = {
      title: video.title, channel: video.channel, view_count: viewCount, uploaded_at: video.uploaded_at,
    };
    return record;
  });
  const coverage_gaps = [...new Set([
    ...sources.filter(source => source.status !== 'success').map(source => `${source.id}: ${source.reason || source.status}`),
    ...Object.entries(rawSources).flatMap(([id, source]) => [...(source.coverage_gaps || []), ...(source.data?.coverage_gaps || [])].map(gap => `${id}: ${gap}`)),
  ])];
  coverage_gaps.push('Playstyle extraction is pending; no labels are inferred from source availability.');
  return {patch, scraped_at: generatedAt, sources, coverage_gaps, extraction_method: 'pending', raw_bundle: `data/${patch}/raw/bundle.json`, extracted_at: null};
}

/** Build honest coverage placeholders, never automatic playstyle classifications. */
export function makeUnknownProfiles(rawBundle, catalog) {
  const context = rawBundle.context || {};
  const patch = context.patch || rawBundle.patch || 'unverified';
  const generatedAt = rawBundle.generated_at || new Date().toISOString();
  const rawProfiles = rawBundle.specs || [];
  return catalog.flatMap(spec => ['raid', 'mythic_plus'].map(content_type => {
    const raw = rawProfiles.find(item => item.spec_id === spec.id && item.content_type === content_type);
    const dimensions = Object.fromEntries([...ROLE_DIMENSIONS[spec.role], ...CROSS_DIMENSIONS].map(key => [key, unknownDimension(DIMENSION_LABELS[key])]));
    const profile = {id: `${spec.id}:${content_type}`, spec_id: spec.id, spec_name: spec.name || spec.spec, class_name: spec.class_name || spec.class,
      role: spec.role, content_type, dimensions,
      hero_talents: (spec.hero_talents || ['Option 1 — unverified', 'Option 2 — unverified']).map(name => ({name, playstyle_delta: unknownDimension(`${name}'s playstyle changes`), pick_rate: null, popular: null})),
      feel_summary: 'This profile is awaiting current-patch evidence. Browse the processing view to see which guides and statistics are available; no playstyle recommendation has been inferred.',
      play_this_if: 'Check back after a verified refresh to see whether this playstyle fits you.',
      avoid_if: 'Avoid choosing from this profile alone while its playstyle evidence is unverified.',
      tags: [], tag_evidence: {}, provenance: provenanceFromRaw(raw, patch, generatedAt), confidence: {level: 'low', score: 0, reasons: ['Current-patch playstyle evidence has not been extracted.']}, changes: []};
    profile.confidence = deriveConfidence(profile, generatedAt);
    return profile;
  }));
}
export function makeUnknownBundle(rawBundle, catalog) {
  const context = rawBundle.context || {};
  const detected = context.season || {};
  return {schema_version: '1.0.0', patch: context.patch || rawBundle.patch || 'unverified', generated_at: rawBundle.generated_at || new Date().toISOString(),
    season: {expansion: context.expansion || detected.expansion || null, name: detected.name || context.season_name || null,
      slug: detected.slug || context.season_slug || null, number: detected.number || context.season_number || null,
      detected_at: context.detected_at || rawBundle.generated_at || new Date().toISOString(), source: context.source || detected.source || 'unverified',
      coverage_gaps: context.coverage_gaps || detected.coverage_gaps || []}, profiles: makeUnknownProfiles(rawBundle, catalog)};
}
export function deriveBundle(bundle, previous = null) {
  return {...bundle, previous_patch: previous?.patch || null, profiles: bundle.profiles.map(profile => ({...profile, ...deriveTags(profile),
    confidence: deriveConfidence(profile, bundle.generated_at), changes: deriveChanges(profile, previous?.profiles.find(item => item.id === profile.id))}))};
}
