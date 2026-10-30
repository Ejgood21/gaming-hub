import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {ROLE_DIMENSIONS, CROSS_DIMENSIONS, TAG_RULES} from './derive.mjs';
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(fs.readFileSync(new URL('./profile.schema.json', import.meta.url), 'utf8'));
const defaultCatalog = JSON.parse(fs.readFileSync(path.join(appRoot, 'config/specs.json'), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: false});
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const normalizeName = value => value.normalize('NFKC').toLowerCase().replaceAll(/[’‘]/g, "'").replaceAll(/[-–—]/g, ' ');

// A successful source ID is insufficient if a claim links to a different page.
// Root guide URLs may cover their own section pages; arbitrary sibling specs do not.
function sameDocumentOrSection(referenceURL, sourceURL) {
  if (!sourceURL) return false;
  try {
    const reference = new URL(referenceURL), source = new URL(sourceURL);
    if (reference.origin !== source.origin) return false;
    const sourcePath = source.pathname.replace(/\/$/, '');
    if (reference.pathname !== source.pathname && !reference.pathname.startsWith(`${sourcePath}/`)) return false;
    for (const [key, value] of source.searchParams) if (key !== 't' && reference.searchParams.get(key) !== value) return false;
    return true;
  } catch { return false; }
}

/** Schema plus cross-field checks that JSON Schema cannot express clearly. */
export function validateBundle(bundle, {catalog = defaultCatalog, requireComplete = true} = {}) {
  const errors = [];
  if (!validateSchema(bundle)) {
    errors.push(...validateSchema.errors.map(error => `${error.instancePath || '/'} ${error.message}${error.params.missingProperty ? `: ${error.params.missingProperty}` : ''}`));
    return {valid: false, errors};
  }
  const ids = new Set(), catalogById = new Map(catalog.map(spec => [spec.id, spec]));
  for (const profile of bundle.profiles) {
    const prefix = profile.id;
    if (ids.has(prefix)) errors.push(`${prefix}: duplicate profile id`);
    ids.add(prefix);
    const spec = catalogById.get(profile.spec_id);
    if (!spec) errors.push(`${prefix}: spec_id is absent from catalog`);
    else if (profile.role !== spec.role || profile.spec_name !== (spec.name || spec.spec) || profile.class_name !== (spec.class_name || spec.class)) errors.push(`${prefix}: identity/role does not match catalog`);
    if (prefix !== `${profile.spec_id}:${profile.content_type}`) errors.push(`${prefix}: id must be spec_id:content_type`);
    if (profile.provenance.patch !== bundle.patch) errors.push(`${prefix}: provenance.patch differs from bundle.patch`);
    const sourceSuccess = ref => profile.provenance.sources.some(source => source.id === ref.source_id && source.status === 'success' && sameDocumentOrSection(ref.url, source.url));
    const checkSources = (item, where, quantitativeOnly = false) => {
      for (const ref of item.sources || []) {
        if (!sourceSuccess(ref)) errors.push(`${prefix}: ${where} references unsuccessful or absent source/document ${ref.source_id}`);
        if (quantitativeOnly && !profile.provenance.sources.some(source => source.id === ref.source_id && source.status === 'success' && source.kind === 'quantitative' && sameDocumentOrSection(ref.url, source.url))) errors.push(`${prefix}: ${where} requires quantitative source evidence`);
        if (ref.timestamp_seconds !== undefined && !profile.provenance.sources.some(source => source.id === ref.source_id && source.kind === 'video')) errors.push(`${prefix}: ${where} timestamp must reference a video source`);
      }
    };
    for (const [key, dimension] of Object.entries(profile.dimensions)) {
      checkSources(dimension, key, key === 'meta_viability');
      if (dimension.value !== null && dimension.key_abilities.length && !dimension.key_abilities.some(ability => normalizeName(dimension.explanation).includes(normalizeName(ability)))) errors.push(`${prefix}: ${key} explanation must name a listed key ability or resource`);
      if (dimension.value === null && profile.tags.some(tag => profile.tag_evidence[tag]?.includes(key))) errors.push(`${prefix}: null dimension ${key} cannot justify a tag`);
    }
    if (profile.role === 'healer' && profile.content_type === 'raid' && profile.dimensions.healer_dps_expectation.value !== null) errors.push(`${prefix}: healer_dps_expectation is specific to Mythic+; keep raid value null`);
    const relevant = new Set([...ROLE_DIMENSIONS[profile.role], ...CROSS_DIMENSIONS]);
    for (const key of Object.keys(profile.dimensions)) if (!relevant.has(key)) errors.push(`${prefix}: ${key} is not applicable to ${profile.role}`);
    for (const option of profile.hero_talents) {
      checkSources(option.playstyle_delta, `hero_talents.${option.name}`);
      if (option.playstyle_delta.value !== null && !option.playstyle_delta.key_abilities.some(ability => normalizeName(option.playstyle_delta.explanation).includes(normalizeName(ability)))) errors.push(`${prefix}: ${option.name} explanation must name a listed key ability or resource`);
      if (option.pick_rate !== null) checkSources({sources: option.pick_rate_sources || []}, `hero_talents.${option.name}.pick_rate`, true);
      if (option.popular !== null && option.pick_rate === null) errors.push(`${prefix}: ${option.name} popularity cannot be known without pick-rate data`);
    }
    const heroNames = profile.hero_talents.map(option => option.name);
    if (new Set(heroNames).size !== heroNames.length) errors.push(`${prefix}: duplicate hero talent option`);
    if (spec?.hero_talents && (spec.hero_talents.some(name => !heroNames.includes(name)) || heroNames.some(name => !spec.hero_talents.includes(name)))) errors.push(`${prefix}: hero talent options do not match the current catalog`);
    const knownRates = profile.hero_talents.filter(option => option.pick_rate !== null);
    if (knownRates.length > 1 && knownRates.reduce((sum, option) => sum + option.pick_rate, 0) > 100.5) errors.push(`${prefix}: hero talent pick rates total above 100%`);
    for (const option of knownRates) if (option.popular === true && knownRates.some(other => other.pick_rate > option.pick_rate)) errors.push(`${prefix}: popular hero talent has a lower pick rate than another option`);
    for (const tag of profile.tags) {
      const evidence = profile.tag_evidence[tag];
      if (!evidence?.length) errors.push(`${prefix}: orphan tag ${tag}`);
      for (const key of evidence || []) {
        const dimension = profile.dimensions[key];
        if (!dimension || dimension.value === null || dimension.sources.length === 0) errors.push(`${prefix}: ${tag} requires a known dimension with evidence: ${key}`);
      }
      const rule = TAG_RULES[tag];
      if (rule && (!evidence?.includes(rule.dimension) || !profile.dimensions[rule.dimension] || profile.dimensions[rule.dimension].value === null || !rule.test(profile.dimensions[rule.dimension].value))) errors.push(`${prefix}: ${tag} does not satisfy its dimension rule`);
    }
    for (const tag of Object.keys(profile.tag_evidence)) if (!profile.tags.includes(tag)) errors.push(`${prefix}: tag_evidence contains unlisted tag ${tag}`);
    if (profile.confidence.level === 'high' && profile.confidence.score < 80) errors.push(`${prefix}: high coverage requires score >= 80`);
    if (profile.confidence.level === 'medium' && (profile.confidence.score < 50 || profile.confidence.score >= 80)) errors.push(`${prefix}: medium coverage requires score 50–79`);
    if (profile.confidence.level === 'low' && profile.confidence.score >= 50) errors.push(`${prefix}: low coverage requires score < 50`);
  }
  if (requireComplete) for (const spec of catalog) for (const type of ['raid', 'mythic_plus']) if (!ids.has(`${spec.id}:${type}`)) errors.push(`Missing ${spec.id}:${type}`);
  return {valid: errors.length === 0, errors};
}
export function assertValidBundle(bundle, options) {
  const result = validateBundle(bundle, options);
  if (!result.valid) throw new Error(`Profiles failed validation:\n${result.errors.join('\n')}`);
  return bundle;
}
export const validateProfiles = validateBundle;
export function resolveLatestProfiles() {
  const latestFile = path.join(appRoot, 'data/latest.json');
  if (fs.existsSync(latestFile)) {
    const latest = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    return path.join(appRoot, 'data', latest.profiles || latest.path || `${latest.patch}/profiles.json`);
  }
  const data = path.join(appRoot, 'data');
  const patches = fs.existsSync(data) ? fs.readdirSync(data).filter(patch => fs.existsSync(path.join(data, patch, 'profiles.json'))) : [];
  patches.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  if (!patches.length) throw new Error('No extracted profiles exist. Run npm run update-data, then follow the Codex extraction prompt.');
  return path.join(data, patches.at(-1), 'profiles.json');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const filename = process.argv[2] ? path.resolve(process.argv[2]) : resolveLatestProfiles();
    const bundle = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const result = validateBundle(bundle);
    if (!result.valid) {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    } else console.log(`Validated ${bundle.profiles.length} profiles for patch ${bundle.patch}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
