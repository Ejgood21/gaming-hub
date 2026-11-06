import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import {readEvidenceJSON} from '../pipeline/evidence.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function archive(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wow-evidence-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const bundle = {run_id: 'test-run', context: {patch: '12.1.5'}, specs: [{note: 'Exact evidence \u2603'}]};
  const raw = Buffer.from(JSON.stringify(bundle));
  const compressed = gzipSync(raw);
  const parts = [compressed.subarray(0, 31), compressed.subarray(31)];
  const manifest = {
    format: 'wow-evidence-gzip-parts-v1', run_id: bundle.run_id,
    compressed_bytes: compressed.length, compressed_sha256: hash(compressed),
    raw_bytes: raw.length, raw_sha256: hash(raw),
    parts: parts.map((bytes, index) => ({path: `test-run.json.gz.part-${index}`, bytes: bytes.length, sha256: hash(bytes)}))
  };
  const filename = path.join(root, 'test-run.json.gz.manifest.json');
  for (const [index, bytes] of parts.entries()) await writeFile(path.join(root, manifest.parts[index].path), bytes);
  const save = () => writeFile(filename, JSON.stringify(manifest));
  await save();
  return {root, filename, bundle, raw, compressed, manifest, save};
}

test('plain, gzip, and multipart evidence rehydrate the same exact JSON', async t => {
  const fixture = await archive(t);
  for (const [name, bytes] of [['bundle.json', fixture.raw], ['bundle.json.gz', fixture.compressed]]) {
    const filename = path.join(fixture.root, name);
    await writeFile(filename, bytes);
    assert.deepEqual(await readEvidenceJSON(filename), fixture.bundle);
  }
  assert.deepEqual(await readEvidenceJSON(fixture.filename), fixture.bundle);
});

test('multipart evidence rejects a corrupted part before decompression', async t => {
  const fixture = await archive(t);
  await writeFile(path.join(fixture.root, fixture.manifest.parts[0].path), Buffer.alloc(31));
  await assert.rejects(readEvidenceJSON(fixture.filename), /Evidence part .* byte count or SHA-256/);
});

test('multipart part references must be unique local basenames', async t => {
  const fixture = await archive(t);
  for (const name of ['../outside', '/tmp/outside', '..\\outside', '..', '.']) {
    fixture.manifest.parts[0].path = name;
    await fixture.save();
    await assert.rejects(readEvidenceJSON(fixture.filename), /unique relative basenames/);
  }
  fixture.manifest.parts[0].path = fixture.manifest.parts[1].path;
  fixture.manifest.parts[0].bytes = fixture.manifest.parts[1].bytes;
  fixture.manifest.parts[0].sha256 = fixture.manifest.parts[1].sha256;
  await fixture.save();
  await assert.rejects(readEvidenceJSON(fixture.filename), /unique relative basenames/);
});

test('multipart evidence verifies aggregate bytes, hashes, and run identity', async t => {
  const fixture = await archive(t);
  for (const [field, replacement, message] of [
    ['compressed_bytes', fixture.compressed.length + 1, /Compressed evidence/],
    ['compressed_sha256', '0'.repeat(64), /Compressed evidence/],
    ['raw_bytes', fixture.raw.length + 1, /Uncompressed evidence/],
    ['raw_sha256', '0'.repeat(64), /Uncompressed evidence/],
    ['run_id', 'different-run', /run_id differs/]
  ]) {
    const original = fixture.manifest[field];
    fixture.manifest[field] = replacement;
    await fixture.save();
    await assert.rejects(readEvidenceJSON(fixture.filename), message);
    fixture.manifest[field] = original;
  }
});
