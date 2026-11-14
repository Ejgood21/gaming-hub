import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f\d]{64}$/i.test(value);
const byteCount = value => Number.isSafeInteger(value) && value > 0;
const verify = (bytes, size, hash, label) => {
  if (bytes.length !== size || sha256(bytes) !== hash.toLowerCase()) {
    throw new Error(`${label} byte count or SHA-256 differs from its evidence manifest.`);
  }
};

/** Read plain/gzipped JSON or a lossless, integrity-checked multipart archive. */
export async function readEvidenceJSON(file) {
  const filename = file instanceof URL ? fileURLToPath(file) : String(file);
  const bytes = await readFile(filename);
  if (!filename.endsWith('.json.gz.manifest.json')) {
    return JSON.parse((filename.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
  }
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.format !== 'wow-evidence-gzip-parts-v1' ||
      typeof manifest.run_id !== 'string' || !manifest.run_id ||
      !byteCount(manifest.compressed_bytes) || !digest(manifest.compressed_sha256) ||
      !byteCount(manifest.raw_bytes) || !digest(manifest.raw_sha256) ||
      !Array.isArray(manifest.parts) || !manifest.parts.length) {
    throw new Error('Invalid multipart evidence manifest.');
  }
  const names = new Set();
  const parts = [];
  for (const part of manifest.parts) {
    if (!part || typeof part.path !== 'string' || !part.path ||
        /[\\/]/.test(part.path) || ['.', '..'].includes(part.path) ||
        path.isAbsolute(part.path) || path.basename(part.path) !== part.path ||
        names.has(part.path) || !byteCount(part.bytes) || !digest(part.sha256)) {
      throw new Error('Multipart evidence parts must have unique relative basenames, byte counts, and SHA-256 hashes.');
    }
    names.add(part.path);
    const content = await readFile(path.join(path.dirname(filename), part.path));
    verify(content, part.bytes, part.sha256, `Evidence part ${part.path}`);
    parts.push(content);
  }
  const compressed = Buffer.concat(parts);
  verify(compressed, manifest.compressed_bytes, manifest.compressed_sha256, 'Compressed evidence');
  const raw = gunzipSync(compressed, {maxOutputLength: manifest.raw_bytes});
  verify(raw, manifest.raw_bytes, manifest.raw_sha256, 'Uncompressed evidence');
  const bundle = JSON.parse(raw.toString('utf8'));
  if (bundle.run_id !== manifest.run_id) throw new Error('Multipart evidence run_id differs from its manifest.');
  return bundle;
}
