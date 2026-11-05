import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBundle} from '../pipeline/validate.mjs';
import {finalize} from '../pipeline/update-data.mjs';
import {readEvidenceJSON} from '../pipeline/evidence.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const dataRoot = path.join(appRoot, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(appRoot, 'config/specs.json'), 'utf8'));
const candidates = [...new Set([
  ...fs.globSync('*/candidate-profiles.json', {cwd: dataRoot}),
  ...fs.globSync('*/candidate-profiles.json.gz', {cwd: dataRoot})
].map(filename => filename.replace(/\.gz$/, '')))].map(filename =>
  fs.existsSync(path.join(dataRoot, `${filename}.gz`)) ? `${filename}.gz` : filename);
const documentURL = value => {
  const url = new URL(value);
  url.hash = '';
  return url.href;
};
const hasQuantitative = entry => ['archon', 'raiderio'].some(id => entry.sources[id]?.status === 'success');

if (!candidates.length) test('saved extraction candidate', {skip: 'No extraction candidate checked in'}, () => {});

for (const relative of candidates) {
  const candidatePath = path.join(dataRoot, relative);
  const candidate = await readEvidenceJSON(candidatePath);
  const refs = [...new Set(candidate.profiles.map(profile => profile.provenance.raw_bundle))];
  assert.equal(refs.length, 1, `${relative}: extraction must use one immutable run`);
  const rawRef = refs[0];
  assert.match(rawRef, /^data\/\d+\.\d+(?:\.\d+)?\/raw\/runs\/[^/]+\.json(?:\.gz(?:\.manifest\.json)?)?$/);
  const rawPath = path.join(appRoot, rawRef);
  const raw = await readEvidenceJSON(rawPath);
  const entries = new Map(raw.specs.map(entry => [`${entry.spec_id}:${entry.content_type}`, entry]));
  const missing = candidate.profiles.filter(profile => {
    const entry = entries.get(profile.id);
    return entry?.sources.wowhead?.status !== 'success' || !hasQuantitative(entry);
  });

  test(`${candidate.patch}: saved extraction agrees with its immutable source run`, () => {
    const validation = validateBundle(candidate, {catalog, requireComplete: true});
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.equal(raw.context.patch, candidate.patch);
    assert.ok(['.json', '.json.gz', '.json.gz.manifest.json'].some(suffix => rawRef.endsWith(`/${raw.run_id}${suffix}`)));

    for (const profile of candidate.profiles) {
      const entry = entries.get(profile.id);
      assert.ok(entry, `${profile.id}: missing raw profile`);
      for (const [id, source] of Object.entries(entry.sources)) {
        assert.equal(profile.provenance.sources.find(item => item.id === id)?.status,
          source.status, `${profile.id}: ${id} status differs from raw evidence`);
      }
      const sections = new Set((entry.sources.wowhead?.data?.sections || [])
        .filter(section => section.status === 'success').map(section => documentURL(section.url)));
      const fields = [...Object.values(profile.dimensions), ...profile.hero_talents.map(hero => hero.playstyle_delta)];
      for (const field of fields) for (const citation of field.sources) {
        if (citation.source_id === 'wowhead') assert.ok(sections.has(documentURL(citation.url)),
          `${profile.id}: Wowhead citation must reference a successfully collected guide section`);
      }

      const meta = profile.dimensions.meta_viability;
      const rio = entry.sources.raiderio;
      if (rio?.status === 'success') {
        assert.equal(meta.representation_percent, rio.data.representation_percent, `${profile.id}: roster percentage`);
        assert.equal(meta.sample_size, rio.data.total_role_roster_slots, `${profile.id}: role-slot denominator`);
        assert.deepEqual(meta.sources.filter(source => source.source_id === 'raiderio').map(source => source.url).sort(),
          [...rio.data.sample_urls].sort(), `${profile.id}: sampled Raider.IO pages`);
      }
      if (profile.content_type === 'raid' && !hasQuantitative(entry)) {
        assert.equal(meta.value, null, `${profile.id}: raid viability remains unknown`);
        assert.equal(meta.representation_percent, null);
        assert.equal(meta.sample_size, null);
        assert.ok(profile.provenance.coverage_gaps.length, `${profile.id}: quantitative gap needs provenance`);
      }
      // Raider.IO roster representation does not supply hero talent distributions.
      if (entry.sources.archon?.status !== 'success') for (const hero of profile.hero_talents) {
        assert.equal(hero.pick_rate, null, `${profile.id}: ${hero.name} has no quantitative pick-rate evidence`);
        assert.equal(hero.popular, null, `${profile.id}: ${hero.name} popularity remains unknown`);
      }
    }
  });

  test(`${candidate.patch}: strict finalization preserves published data while required sources are missing`,
    {skip: missing.length === 0 ? 'This candidate has complete required source coverage' : false}, async t => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-candidate-'));
      t.after(() => fs.rmSync(root, {recursive: true, force: true}));
      const frozenPath = path.join(root, rawRef);
      fs.mkdirSync(path.dirname(frozenPath), {recursive: true});
      fs.copyFileSync(rawPath, frozenPath);
      if (rawPath.endsWith('.json.gz.manifest.json')) {
        const manifest = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
        for (const part of manifest.parts) fs.copyFileSync(path.join(path.dirname(rawPath), part.path),
          path.join(path.dirname(frozenPath), part.path));
      }
      const isolatedCandidate = path.join(root, path.basename(candidatePath));
      fs.copyFileSync(candidatePath, isolatedCandidate);
      const published = ['latest.json', ...['profiles.json', 'changes.json', 'run.json'].map(name => `${candidate.patch}/${name}`)]
        .filter(name => fs.existsSync(path.join(dataRoot, name)));
      const before = new Map(published.map(name => [name, fs.readFileSync(path.join(dataRoot, name))]));
      for (const [name, bytes] of before) {
        const filename = path.join(root, 'data', name);
        fs.mkdirSync(path.dirname(filename), {recursive: true});
        fs.writeFileSync(filename, bytes);
      }
      assert.ok(before.has(`${candidate.patch}/profiles.json`), 'Exercise the existing published profile snapshot');
      await assert.rejects(finalize(isolatedCandidate, {}, catalog, {root}), error => {
        assert.ok(error.message.startsWith(`${missing.length} profiles lack the required Wowhead + quantitative source.`),
          `Expected the ${missing.length}-profile source gate, received: ${error.message}`);
        return true;
      });
      for (const [name, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(root, 'data', name)), bytes,
        `${name} changed despite the failed source gate`);
      assert.equal(fs.existsSync(path.join(root, 'data', candidate.patch, 'history')), false);
    });
}
