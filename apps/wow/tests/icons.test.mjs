import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import map from '../config/icons.json' with { type: 'json' };
import catalog from '../config/specs.json' with { type: 'json' };
import { validateIcons } from '../validate-icons.mjs';

// Independent game-ID → texture snapshot checked against the Wowhead Spec Basics
// guides on 2026-11-14. In particular 1480 is Devourer, not the DH class icon.
const expected = {
  250:'spell_deathknight_bloodpresence',251:'spell_deathknight_frostpresence',252:'spell_deathknight_unholypresence',
  577:'ability_demonhunter_specdps',581:'ability_demonhunter_spectank',1480:'classicon_demonhunter_void',
  102:'spell_nature_starfall',103:'ability_druid_catform',104:'ability_racial_bearform',105:'spell_nature_healingtouch',
  1467:'classicon_evoker_devastation',1468:'classicon_evoker_preservation',1473:'classicon_evoker_augmentation',
  253:'ability_hunter_bestialdiscipline',254:'ability_hunter_focusedaim',255:'ability_hunter_camouflage',
  62:'spell_holy_magicalsentry',63:'spell_fire_firebolt02',64:'spell_frost_frostbolt02',
  268:'spell_monk_brewmaster_spec',270:'spell_monk_mistweaver_spec',269:'spell_monk_windwalker_spec',
  65:'spell_holy_holybolt',66:'ability_paladin_shieldofthetemplar',70:'spell_holy_auraoflight',
  256:'spell_holy_powerwordshield',257:'spell_holy_guardianspirit',258:'spell_shadow_shadowwordpain',
  259:'ability_rogue_deadlybrew',260:'ability_rogue_waylay',261:'ability_stealth',
  262:'spell_nature_lightning',263:'spell_shaman_improvedstormstrike',264:'spell_nature_magicimmunity',
  265:'spell_shadow_deathcoil',266:'spell_shadow_metamorphosis',267:'spell_shadow_rainoffire',
  71:'ability_warrior_savageblow',72:'ability_warrior_innerrage',73:'ability_warrior_defensivestance',
};
test('all 40 specialization identities match independently verified Blizzard textures', () => {
  assert.equal(catalog.length, 40);
  assert.equal(Object.keys(map.specs).length, 40);
  for (const spec of catalog) {
    const item = map.specs[spec.id];
    assert.equal(item.game_id, spec.game_id, spec.id);
    assert.equal(item.icon, expected[spec.game_id], spec.id);
    assert.ok(item.source.startsWith(`https://www.wowhead.com/guide/classes/${spec.wowhead_slug}/`));
  }
  assert.equal(new Set(Object.values(map.specs).map(x => x.icon)).size, 40);
});
test('all 13 class and 3 role mappings identify distinct Blizzard art', () => {
  const classes = [...new Set(catalog.map(s => s.class))];
  assert.deepEqual(Object.keys(map.classes).sort(), classes.sort());
  for (const name of classes) assert.equal(map.classes[name].icon, `classicon_${name.toLowerCase().replaceAll(' ', '')}`);
  assert.deepEqual(Object.fromEntries(Object.entries(map.roles).map(([key, value]) => [key, value.icon])), {
    tank:'inv_shield_06', healer:'spell_holy_flashheal', dps:'inv_sword_04',
  });
  const names = ['specs', 'classes', 'roles'].flatMap(kind => Object.values(map[kind]).map(item => item.icon));
  assert.equal(new Set(names).size, 56);
});
test('every cached icon is a unique JPEG with its recorded CDN checksum', async () => {
  await validateIcons();
  const hashes = [];
  for (const kind of ['specs','classes','roles']) for (const item of Object.values(map[kind])) {
    const bytes = await readFile(new URL(`../assets/icons/${item.icon}.jpg`, import.meta.url));
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(new Set(hashes).size,56,'Duplicate artwork under different names');
});
test('an absent or replaced cache file fails validation', async () => {
  await assert.rejects(validateIcons({directory:new URL('./missing-icons/',import.meta.url)}), /icon/i);
  const broken = structuredClone(map);
  broken.specs['devourer-demon-hunter'].sha256 = '0'.repeat(64);
  await assert.rejects(validateIcons({mapping:broken}), /checksum/i);
});
