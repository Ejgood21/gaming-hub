import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import icons from './config/icons.json' with {type:'json'};
import catalog from './config/specs.json' with {type:'json'};

export async function validateIcons({mapping = icons, directory = new URL('./assets/icons/',import.meta.url)} = {}) {
  assert.equal(Object.keys(mapping.specs).length, catalog.length, 'Missing spec icon mapping');
  for (const spec of catalog) {
    assert.ok(mapping.specs[spec.id], `Missing spec icon: ${spec.id}`);
    assert.ok(mapping.classes[spec.class], `Missing class icon: ${spec.class}`);
    assert.ok(mapping.roles[spec.role], `Missing role icon: ${spec.role}`);
  }
  for (const kind of ['specs','classes','roles']) for (const [name, item] of Object.entries(mapping[kind])) {
    assert.match(item.icon, /^[a-z0-9_]+$/, `Unsafe icon: ${name}`);
    let bytes;
    try { bytes = await readFile(new URL(`${item.icon}.jpg`,directory)); }
    catch { throw new Error(`Missing cached Blizzard icon: ${name} (${item.icon})`); }
    assert.ok(bytes.length > 500 && bytes[0] === 0xff && bytes[1] === 0xd8, `Invalid icon JPEG: ${name}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, `Icon checksum mismatch: ${name}`);
  }
}
