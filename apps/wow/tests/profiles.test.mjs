import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBundle} from '../pipeline/validate.mjs';
import {makeUnknownBundle, deriveTags, deriveConfidence, deriveChanges, tasteMatch, similarProfiles} from '../pipeline/derive.mjs';
const fullCatalog = JSON.parse(fs.readFileSync(new URL('../config/specs.json', import.meta.url)));
const catalog = [fullCatalog.find(spec => spec.id === 'windwalker-monk')];
const now = '2026-10-26T17:00:00.000Z';
const raw = {context: {patch: '12.1.5', expansion: 'Midnight', season: {name: 'Season 2', slug: 'season-mn-2', number: 2}, source: 'fixture'}, generated_at: now,
  specs: ['raid', 'mythic_plus'].map(content_type => ({spec_id: catalog[0].id, content_type, sources: {
    wowhead: {status: 'failed', url: 'https://www.wowhead.com/guide/classes/monk/windwalker/rotation-cooldowns-pve-dps', fetched_at: now, error: 'HTTP 403'},
    archon: {status: 'missing', url: 'https://www.archon.gg/wow/builds/windwalker/monk/mythic-plus/overview', fetched_at: now, error: 'HTTP 403'},
  }}))};
function bundle() { return makeUnknownBundle(structuredClone(raw), catalog); }
function linked(value, extras = {}) {
  return {value, explanation: 'Tiger Palm builds Chi for Rising Sun Kick, so the priority follows the same resource rhythm.', key_abilities: ['Tiger Palm', 'Rising Sun Kick'], sources: [{source_id: 'wowhead', url: 'https://www.wowhead.com/guide/classes/monk/windwalker/rotation-cooldowns-pve-dps', section: 'rotation'}], ...extras};
}
function withSource(profile, kind = 'qualitative') {
  profile.provenance.sources = [{id: 'wowhead', status: 'success', url: 'https://www.wowhead.com/guide/classes/monk/windwalker/rotation-cooldowns-pve-dps', scraped_at: now, updated_at: now, reason: null, kind}];
  return profile;
}

test('catalog includes all 40 retail specs and separate role identities', () => {
  assert.equal(fullCatalog.length, 40);
  assert.equal(new Set(fullCatalog.map(spec => spec.id)).size, 40);
  assert.ok(fullCatalog.some(spec => spec.id === 'devourer-demon-hunter'));
  assert.equal(fullCatalog.filter(spec => spec.role === 'tank').length, 6);
  assert.equal(fullCatalog.filter(spec => spec.role === 'healer').length, 7);
});

test('blocked source placeholders remain valid, independent raid/M+ profiles with no invented tags', () => {
  const data = bundle();
  assert.deepEqual(validateBundle(data, {catalog}), {valid: true, errors: []});
  assert.equal(data.profiles.length, 2);
  assert.notEqual(data.profiles[0].dimensions, data.profiles[1].dimensions);
  for (const profile of data.profiles) {
    assert.equal(profile.confidence.level, 'low');
    assert.deepEqual(profile.tags, []);
    assert.ok(profile.provenance.coverage_gaps.some(gap => gap.includes('HTTP 403')));
    assert.ok(Object.values(profile.dimensions).every(dimension => dimension.value === null));
  }
});

test('partial successful scrapes retain top-level and nested coverage limitations', () => {
  const partialRaw = structuredClone(raw);
  Object.assign(partialRaw.specs[0].sources.wowhead, {
    status: 'success', error: undefined,
    coverage_gaps: ['Tier-set section failed; rotation section was collected.'],
    data: {updated_at: now, coverage_gaps: ['Guide freshness is unavailable for the talent section.']},
  });
  partialRaw.specs[0].sources.raiderio = {status: 'success', url: 'https://raider.io/api', fetched_at: now,
    coverage_gaps: ['Top-run roster slots may repeat players; this is not population representation.']};
  partialRaw.specs[0].sources.youtube = {status: 'success', url: 'https://www.youtube.com/watch?v=fixture', fetched_at: now,
    data: {coverage_gaps: ['Codex creator-note extraction pending.'], selected: {
      title: 'Synthetic current-patch fixture', channel: 'Test fixture', views: 12, uploaded_at: now,
    }}};
  const profile = makeUnknownBundle(partialRaw, catalog).profiles[0];
  for (const text of ['wowhead: Tier-set section failed', 'wowhead: Guide freshness', 'raiderio: Top-run roster slots', 'youtube: Codex creator-note extraction pending']) {
    assert.ok(profile.provenance.coverage_gaps.some(gap => gap.startsWith(text)), text);
  }
  assert.equal(profile.provenance.sources.find(source => source.id === 'youtube').video.view_count, 12);
  assert.equal(profile.provenance.sources.find(source => source.id === 'wowhead').status, 'success');
  assert.equal(profile.confidence.level, 'low');
});

test('all role dimensions reject bare labels and missing evidence', () => {
  const data = bundle();
  data.profiles[0].dimensions.rotation_stability = 5;
  assert.equal(validateBundle(data, {catalog}).valid, false);
  data.profiles[0].dimensions.rotation_stability = {...linked(5), sources: []};
  assert.equal(validateBundle(data, {catalog}).valid, false);
});

test('a linked label cannot cite a failed or absent source', () => {
  const data = bundle();
  data.profiles[0].dimensions.rotation_stability = linked(5);
  const result = validateBundle(data, {catalog});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('unsuccessful or absent source')));
});

test('tags require correct known dimensions and cannot be orphaned', () => {
  const data = bundle();
  const profile = withSource(data.profiles[0]);
  profile.dimensions.rotation_stability = linked(4);
  Object.assign(profile, deriveTags(profile));
  assert.ok(profile.tags.includes('stable-rotation'));
  assert.equal(validateBundle(data, {catalog}).valid, true);
  profile.tag_evidence['stable-rotation'] = ['aoe_setup'];
  assert.equal(validateBundle(data, {catalog}).valid, false);
  profile.tag_evidence['stable-rotation'] = ['rotation_stability'];
  profile.dimensions.rotation_stability.value = 2;
  assert.equal(validateBundle(data, {catalog}).valid, false);
});

test('flexible cooldowns require named durations in addition to source evidence', () => {
  const data = bundle();
  const profile = withSource(data.profiles[0]);
  profile.dimensions.cooldown_flexibility = linked('flexible');
  assert.equal(validateBundle(data, {catalog}).valid, false);
  profile.dimensions.cooldown_flexibility.cooldowns = [{name: 'Zenith', duration_seconds: 90, charges: 2}];
  assert.equal(validateBundle(data, {catalog}).valid, true);
});

test('hero talent pick rates require quantitative links; unknown popularity stays null', () => {
  const data = bundle();
  const profile = withSource(data.profiles[0]);
  const hero = profile.hero_talents[0];
  hero.pick_rate = 60;
  hero.popular = true;
  assert.equal(validateBundle(data, {catalog}).valid, false);
  hero.pick_rate_sources = [{source_id: 'archon', url: 'https://www.archon.gg/wow/builds/windwalker/monk/mythic-plus/overview', section: 'hero-talents'}];
  profile.provenance.sources.push({id: 'archon', status: 'success', url: 'https://www.archon.gg/wow/builds/windwalker/monk/mythic-plus/overview', scraped_at: now, updated_at: now, reason: null, kind: 'quantitative'});
  assert.equal(validateBundle(data, {catalog}).valid, true);
});

test('complete validation requires both content types, rejects duplicates and patch mismatch', () => {
  const data = bundle();
  data.profiles.pop();
  assert.equal(validateBundle(data, {catalog}).valid, false);
  assert.equal(validateBundle(data, {catalog, requireComplete: false}).valid, true);
  data.profiles.push(structuredClone(data.profiles[0]));
  assert.ok(validateBundle(data, {catalog}).errors.some(error => error.includes('duplicate')));
  data.profiles[0].provenance.patch = 'old-patch';
  assert.ok(validateBundle(data, {catalog}).errors.some(error => error.includes('provenance.patch')));
});

test('successful downloads alone never confer high confidence', () => {
  const profile = withSource(bundle().profiles[0]);
  profile.provenance.sources.push({id: 'archon', status: 'success', url: 'https://www.archon.gg', scraped_at: now, updated_at: now, reason: null, kind: 'quantitative'});
  const result = deriveConfidence(profile, now);
  assert.equal(result.level, 'low');
  assert.ok(result.score <= 34);
});

test('taste matching explains only confirmed tags and avoids are warnings', () => {
  const profile = withSource(bundle().profiles[0]);
  profile.dimensions.rotation_stability = linked(4);
  Object.assign(profile, deriveTags(profile));
  const match = tasteMatch(profile, {must: ['stable-rotation', 'always-send-cds', 'no-ramp'], avoid: ['stable-rotation']});
  assert.equal(match.matched, 1);
  assert.equal(match.total, 2);
  assert.equal(match.configured_total, 3);
  assert.deepEqual(match.non_applicable, ['no-ramp']);
  assert.equal(match.details[0].evidence[0].dimension, 'rotation_stability');
  assert.deepEqual(match.warnings, ['stable-rotation']);
  assert.equal(profile.tags.includes('no-ramp'), false);
});

test('unverified applicable tastes remain in the denominator; inapplicable healer tastes do not penalize tanks', () => {
  const tank = makeUnknownBundle(raw, fullCatalog).profiles.find(profile => profile.role === 'tank');
  const match = tasteMatch(tank, {must: ['stable-rotation', 'always-send-cds', 'no-ramp'], avoid: ['weak-on-pull']});
  assert.equal(match.total, 0);
  assert.equal(match.score, 0);
  assert.equal(match.configured_total, 3);
  assert.ok(match.details.every(detail => detail.applicable === false));
  const dpsMatch = tasteMatch(bundle().profiles[0], {must: ['stable-rotation', 'always-send-cds', 'custom-preference']});
  assert.equal(dpsMatch.total, 3);
  assert.equal(dpsMatch.matched, 0);
});

test('the full unknown registry validates as 80 distinct profiles', () => {
  const full = makeUnknownBundle(raw, fullCatalog);
  assert.equal(full.profiles.length, 80);
  const uncollected = full.profiles.find(profile => profile.spec_id === 'devourer-demon-hunter');
  assert.equal(uncollected.provenance.sources.length, 5);
  assert.ok(uncollected.provenance.sources.every(source => source.status === 'missing'));
  assert.deepEqual(validateBundle(full), {valid: true, errors: []});
});

test('a successful source cannot lend its identity to a different spec document', () => {
  const data = bundle();
  const profile = withSource(data.profiles[0]);
  profile.dimensions.rotation_stability = linked(4);
  profile.dimensions.rotation_stability.sources[0].url = 'https://www.wowhead.com/guide/classes/monk/mistweaver/rotation-cooldowns-pve-healer';
  assert.equal(validateBundle(data, {catalog}).valid, false);
  profile.dimensions.rotation_stability.sources[0].url = `${profile.provenance.sources[0].url}#aoe`;
  assert.equal(validateBundle(data, {catalog}).valid, true);
});

test('a known label cannot use generic prose that names none of its supporting abilities', () => {
  const data = bundle();
  const profile = withSource(data.profiles[0]);
  profile.dimensions.rotation_stability = linked(4, {explanation: 'The rotation stays roughly the same in both modes, so it should feel comfortable.'});
  assert.ok(validateBundle(data, {catalog}).errors.some(error => error.includes('must name a listed key ability')));
});

test('semantic cooldown changes, hero pick-rate changes and lost coverage produce separate patch badges', () => {
  const old = withSource(bundle().profiles[0]);
  old.dimensions.rotation_stability = linked(4);
  old.dimensions.cooldown_flexibility = linked('flexible', {cooldowns: [{name: 'Zenith', duration_seconds: 120}]});
  old.hero_talents[0].pick_rate = 20;
  const current = structuredClone(old);
  current.dimensions.rotation_stability.value = null;
  current.dimensions.cooldown_flexibility.cooldowns[0].duration_seconds = 90;
  current.hero_talents[0].pick_rate = 80;
  const changes = deriveChanges(current, old);
  assert.ok(changes.some(change => change.dimension === 'rotation_stability' && change.kind === 'coverage'));
  assert.ok(changes.some(change => change.dimension === 'cooldown_flexibility'));
  assert.ok(changes.some(change => change.dimension.startsWith('hero_talents.') && change.previous === 20 && change.current === 80));
});

test('high confidence requires current guide/video evidence and quantitative coverage', () => {
  const profile = withSource(bundle().profiles[0]);
  for (const key of Object.keys(profile.dimensions)) profile.dimensions[key] = linked(profile.dimensions[key].value || 'fixture');
  profile.provenance.sources.push({id: 'archon', status: 'success', url: 'https://www.archon.gg', scraped_at: now, updated_at: now, reason: null, kind: 'quantitative'});
  profile.hero_talents[0].pick_rate = 60;
  profile.hero_talents[0].pick_rate_sources = [{source_id: 'archon', url: 'https://www.archon.gg', section: 'hero talents'}];
  assert.notEqual(deriveConfidence(profile, now).level, 'high');
  profile.provenance.sources.push({id: 'youtube', status: 'success', url: 'https://www.youtube.com/watch?v=fixture', scraped_at: now, updated_at: null, reason: null, kind: 'video',
    video: {title: 'Synthetic transcript fixture', channel: 'Test fixture', view_count: 10, uploaded_at: now}});
  assert.equal(deriveConfidence(profile, now).level, 'high');
  profile.provenance.sources.find(source => source.id === 'youtube').video.uploaded_at = '2025-01-01T00:00:00Z';
  assert.notEqual(deriveConfidence(profile, now).level, 'high');
  profile.provenance.sources = profile.provenance.sources.filter(source => source.kind !== 'quantitative');
  assert.equal(deriveConfidence(profile, now).level, 'low');
});

test('patch diffs describe changed values and evidence, while an initial patch has no invented history', () => {
  const previous = withSource(bundle().profiles[0]);
  previous.dimensions.rotation_stability = linked(2);
  const current = structuredClone(previous);
  current.dimensions.rotation_stability = linked(4);
  const changes = deriveChanges(current, previous);
  assert.ok(changes.some(change => change.dimension === 'rotation_stability' && change.previous === 2 && change.current === 4));
  assert.deepEqual(deriveChanges(current, null), []);
});

test('similar specs exclude profiles without shared verified evidence', () => {
  const profile = withSource(bundle().profiles[0]);
  const other = structuredClone(profile);
  other.spec_id = 'retribution-paladin'; other.id = `${other.spec_id}:raid`;
  assert.deepEqual(similarProfiles(profile, [other]), []);
  profile.dimensions.rotation_stability = linked(4);
  other.dimensions.rotation_stability = linked(4);
  Object.assign(profile, deriveTags(profile)); Object.assign(other, deriveTags(other));
  assert.equal(similarProfiles(profile, [other])[0].profile.spec_id, 'retribution-paladin');
});
