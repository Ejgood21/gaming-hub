'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const createModel = require('../src/model');
const {refreshAcademy, readAcademyCache, decodeMetaSnapshot, loadSnapshots, ACADEMY_TTL_MS} = require('../src/snapshots');
const {exportBackup, reviewBackup, maxBackupBytes} = require('../src/backup');
const academy = require('../data/academy-18.3b.json');
const metaFile = require('../data/metatft-18.3b.json');
const meta = decodeMetaSnapshot(metaFile);
const core = require('../data/core-items.json');

const model = () => createModel({academy, meta, core});
const guide = title => academy.guides.find(g => g.title === title);
const plan = overrides => ({queue: [], owned: {}, pins: [], ...overrides});
const queue = (item, options) => ({uid: item, item, done: false, ...options});
const caitlyn = {apiName: 'DA_18_Caitlyn', stars: 2};

test('A1: empty, sparse and unsupported plans show opening guidance', () => {
  const {CompFinder} = model();
  assert.deepEqual(Object.fromEntries(['S','A','B','C','X'].map(tier =>
    [tier, academy.guides.filter(g => g.tier === tier).length])), {S:0,A:9,B:18,C:11,X:7});
  for (const entry of [
    plan(), plan({currentUnits: [caitlyn]}),
    plan({queue: [queue('ForceOfNature', {done: true}), queue('TacticiansScepter', {done: true})]})
  ]) {
    const result = CompFinder.recommendations(entry);
    assert.deepEqual(result.rows, []);
    assert.match(result.notice, /Not enough to recommend yet/);
    assert.ok(result.guidance.length >= 2);
    assert.equal(result.tierNotice, 'No S-tier comp in this snapshot — top band is A');
  }
});

test('A2: Rageblade and Caitlyn 2★ make Caitlyn Hunters the top B guide', () => {
  const {CompFinder} = model();
  const rows = CompFinder.ranked(plan({
    queue: [queue('GuinsoosRageblade', {done: true})], currentUnits: [caitlyn]
  }));
  const row = rows.find(r => r.guide.tier === 'B');
  assert.equal(row.guide.title, 'Caitlyn Hunters');
  assert.ok(row.reasons.some(reason => reason.points > 0 && reason.text.includes("Guinsoo's Rageblade")));
  assert.ok(row.reasons.some(reason => reason.points > 0 && reason.text.includes('Caitlyn 2★')));
  assert.equal(row.reasons.reduce((sum, reason) => sum + reason.points, 0), row.fitScore);
});

test('A3: Inferno Fast 9 requires its emblem even if the guide prose changes', () => {
  const {CompFinder} = model();
  const input = plan({currentUnits: [caitlyn], queue: [queue('GuinsoosRageblade', {done: true})]});
  const inferno = {...guide('Inferno Fast 9'), augmentsTip: 'Alternative wording.'};
  const row = CompFinder.evaluate(input, inferno);
  assert.equal(row.blocked, true);
  assert.equal(row.gateReason, 'Only play with Inferno emblem');
  assert.equal(CompFinder.evaluate(input, {...inferno, finalComp: []}).blocked, true);
  assert.ok(CompFinder.ranked(input).findIndex(r => r.guide.id === inferno.id) >= 3);
  assert.throws(() => CompFinder.choose(input, inferno.id), /Inferno emblem/);
});

test('A4: Inferno emblem and Lux 1★ unlock Inferno Fast 9', () => {
  const {CompFinder, Academy} = model();
  const inferno = guide('Inferno Fast 9');
  const item = Academy.itemMap.get(inferno.gatedBy.id);
  const input = plan({queue: [queue(item, {done: true})], currentUnits: [{apiName: 'DA_Lux18_Base', stars: 1}]});
  const row = CompFinder.ranked(input).find(r => r.guide.id === inferno.id);
  assert.ok(row);
  assert.equal(row.blocked, false);
  assert.deepEqual(row.missingEmblems, []);
});

test('A5: radiant Rageblade covers exactly one normal Rageblade target', () => {
  const {Academy, CompFinder} = model();
  const radiant = Academy.itemMap.get('DA_GuinsoosRagebladeRadiant');
  const row = CompFinder.evaluate(plan({queue: [queue(radiant, {done: true})]}), guide('Caitlyn Hunters'));
  assert.equal(Academy.baseItem(radiant), 'GuinsoosRageblade');
  assert.deepEqual(row.matched, [radiant]);
  assert.equal(row.placements.length, 1);
  assert.equal(row.specialMatches[0].base, 'GuinsoosRageblade');
  assert.equal(row.remaining.length, row.build.entries.length - 1);
  assert.ok(!row.remaining.some(e => e.item === 'GuinsoosRageblade'));
});

test('A6: exact equipped Diana S build remains visible, with no deviation', () => {
  const {MetaBuilds, PlanAdvisor} = model();
  const name = 'Diana';
  const items = ['UnstableConcoction', 'IonicSpark', 'JeweledGauntlet'];
  const builds = MetaBuilds.referenceBuilds(name).filter(b => MetaBuilds.fits(b.ids, items));
  assert.equal(builds.length, 1);
  assert.deepEqual(builds[0].ids, items);
  assert.equal(builds[0].tier, 'S');
  assert.equal(builds[0].games, 5260);
  assert.equal(builds[0].avg, 3.60);
  const activeComp = {guide: academy.guides.find(g => g.finalComp.some(u => u.apiName === 'DA_18_Diana'))};
  const input = plan({activeComp, queue: items.map(item => queue(item, {done: true, champion: name}))});
  assert.equal(PlanAdvisor.suggest(input, name), null);
});

test("A7: Thief's Gloves fill all slots for a holder", () => {
  const {Academy, CompFinder, DecisionPlanner, MetaBuilds, OfflineTracker, PlanAdvisor} = model();
  const activeComp = {guide: guide('Caitlyn Hunters')};
  const input = plan({
    activeComp, owned: {RecurveBow: 1, NeedlesslyLargeRod: 1},
    queue: [queue('ThiefsGloves', {done: true, champion: 'Caitlyn'}),
      queue('GuinsoosRageblade', {champion: 'Caitlyn'})]
  });
  const radiant = Academy.itemMap.get('DA_ThiefsGlovesRadiant');
  assert.equal(CompFinder.slotCost('ThiefsGloves'), 3);
  assert.equal(CompFinder.slotCost(radiant), 3);
  assert.equal(Academy.canEquip(input, 'Caitlyn', 'GuinsoosRageblade'), false);
  assert.equal(CompFinder.specialCarrier(input, activeComp.guide, radiant, new Map([['Caitlyn', 3]]))?.champion === 'Caitlyn', false);
  assert.ok(!CompFinder.evaluate(input, activeComp.guide).remaining.some(e => e.champion === 'Caitlyn'));
  const entry = {...meta.units.find(u => u.unit === 'DA_18_Caitlyn'), patch: academy.patch};
  MetaBuilds.cache(entry, 'test');
  assert.ok(MetaBuilds.dataFor({champion: 'Caitlyn'}));
  assert.deepEqual(DecisionPlanner.builds(input, 'Caitlyn'), []);
  assert.deepEqual(DecisionPlanner.solve(input).actions, []);
  assert.deepEqual(OfflineTracker.craftOptions(input), []);
  assert.equal(PlanAdvisor.suggest(input, 'Caitlyn').kind, 'full');
});

test('A8: carousel ranks a twice-needed Sword above a once-needed Bow', () => {
  const {DecisionPlanner} = model();
  const input = plan({queue: [queue('GuinsoosRageblade'), queue('InfinityEdge'), queue('SpearOfShojin')]});
  const rows = DecisionPlanner.carousel(input);
  const sword = rows.findIndex(r => r.id === 'BFSword'), bow = rows.findIndex(r => r.id === 'RecurveBow');
  assert.equal(rows[sword].count, 2);
  assert.equal(rows[bow].count, 1);
  assert.ok(sword < bow);
  assert.ok(rows[sword].gain >= rows[bow].gain);
});

test('A9: component anvil preserves priority and records the receipt as other', () => {
  const {DecisionPlanner} = model();
  const input = plan({queue: [queue('GuinsoosRageblade'), queue('InfinityEdge'), queue('SpearOfShojin')]});
  const offers = DecisionPlanner.anvil(input, 'components').filter(r => ['BFSword','NeedlesslyLargeRod'].includes(r.id));
  assert.equal(offers[0].id, 'BFSword');
  assert.match(offers[0].reason, /2 still needed/);
  DecisionPlanner.receiveAnvil(input, offers[0]);
  assert.deepEqual(input.lootHistory.loose.BFSword, ['other']);
  assert.equal(input.lootHistory.counts.BFSword, undefined);
});

test('A10: featured augment beats unlisted offers with positive Academy evidence', () => {
  const {AugmentAdvisor} = model();
  const comp = guide('Yi Rengar');
  const inputs = plan({activeComp: {guide: comp}});
  const endorsed = new Set([comp.mainAugment.apiName, ...comp.augments.map(a => a.apiName)]);
  const others = AugmentAdvisor.catalog(inputs,0).filter(a => !endorsed.has(a.apiName)).slice(0,2);
  const choice = AugmentAdvisor.compare(inputs, {round:0, ids:[comp.mainAugment.apiName,...others.map(a=>a.apiName)], seen:[]});
  assert.equal(choice.action, 'take');
  assert.equal(choice.best.augment.apiName, comp.mainAugment.apiName);
  assert.ok(choice.best.score >= 38 && choice.best.evidence >= 2);
  assert.ok(choice.rows.slice(1).every(row => row.evidence === 0 && row.score === 0));
});

test('A14: stale MetaTFT is available to the reference and excluded from pivots', () => {
  const {MetaBuilds, DecisionPlanner} = model();
  const diana = meta.units.find(u => u.unit === 'DA_18_Diana');
  assert.equal(meta.patch, '18.3');
  assert.equal(academy.patch, '18.3b');
  const input = plan({queue: [queue('WarmogsArmor', {champion: 'Diana'})]});
  assert.equal(MetaBuilds.dataFor({champion: 'Diana'}), undefined);
  assert.ok(MetaBuilds.referenceBuilds('Diana').every(b => b.stalePatch));
  assert.deepEqual(DecisionPlanner.builds(input, 'Diana'), []);
  assert.deepEqual(MetaBuilds.ranked(input, 'WarmogsArmor', diana), []);
  MetaBuilds.cache({...diana, patch: academy.patch}, 'test');
  assert.ok(DecisionPlanner.builds(input, 'Diana').length);
  assert.ok(MetaBuilds.referenceBuilds('Diana').every(b => !b.stalePatch));
});

test('A15: a backup made before refresh round-trips below the byte limit', () => {
  const m = model();
  const input = plan({
    queue: [queue(m.Academy.itemMap.get('DA_18_EmblemInferno'), {done:true, received:true})],
    owned:{RecurveBow:2}, currentUnits:[caitlyn]
  });
  const text = exportBackup(m, input, false);
  assert.ok(Buffer.byteLength(text) < maxBackupBytes);
  assert.ok(!text.includes('data:image'));
  const imported = reviewBackup(model(), text);
  assert.equal(imported.state.queue[0].item, input.queue[0].item);
  assert.equal(imported.state.queue[0].done, true);
  assert.equal(imported.state.owned.RecurveBow, 2);
  assert.deepEqual(imported.state.currentUnits, [caitlyn]);
  assert.equal(imported.shortcuts, false);
  assert.deepEqual(imported.academy.guides.find(g=>g.id===guide('Inferno Fast 9').id).gatedBy,
    guide('Inferno Fast 9').gatedBy);
});

test('A16: unexpected live Academy format leaves saved data and a notice', async () => {
  const {Academy, CompFinder} = model();
  let requests = 0;
  const result = await refreshAcademy(Academy, {bundledSet:academy.set, fetchJSON: async url => {
    requests++;
    assert.equal(url, 'https://tftacademy.com/tierlist/comps/__data.json');
    return {ok:true, json:async()=>({data:{tierlist:[]}})};
  }});
  assert.deepEqual(result, {updated:false, notice:'Refresh unavailable · using saved data'});
  assert.equal(requests, 1);
  assert.equal(Academy.snapshot, academy);
  assert.ok(CompFinder.evaluate(plan(), guide('Caitlyn Hunters')).selectable);
});

test('Academy cache requires both the current set and a fresh valid fetch timestamp', () => {
  const now = Date.parse('2026-11-22T15:00:00Z');
  const raw = (age, set) => JSON.stringify({...academy, set, fetchedAt:new Date(now-age).toISOString()});
  assert.equal(readAcademyCache(raw(3000,18),18,now).patch, '18.3b');
  assert.equal(readAcademyCache(raw(3000,17),18,now), null);
  assert.equal(readAcademyCache(raw(ACADEMY_TTL_MS,18),18,now), null);
  assert.equal(readAcademyCache(raw(-1000,18),18,now), null);
});

test('situational tiers share B rank for both Explore and exact team-code import', () => {
  const {Academy, CompFinder, QuickImport, academyTier} = model();
  assert.equal(CompFinder.tierRank('X'), CompFinder.tierRank('B'));
  assert.equal(academyTier('X').score, academyTier('B').score);
  assert.equal(academyTier('X').label, 'Situational');
  const baseline = guide('Caitlyn Hunters');
  const hex = Academy.guideHex(baseline);
  const code = '02' + [...hex, ...Array(10-hex.length).fill('000')].join('') + 'TFTSet18';
  const situational = {...baseline, id:'situational', tier:'X', updated:'2026-10-01'};
  Academy.useSnapshot({...academy, guides:[baseline,situational]});
  assert.equal(QuickImport.choose(code).guide.id, situational.id);
  const input = plan({queue:['GuinsoosRageblade','Leviathan','HextechGunblade'].map(item=>queue(item,{done:true})),
    currentUnits:[{...caitlyn,stars:3}]});
  const row = CompFinder.ranked(input).find(r=>r.guide.id===situational.id);
  assert.ok(row.strongFit);
  assert.equal(row.recommendationTierRank, row.baseTierRank);
});

test('pivot profiles use emblem traits, radiant base roles and artifact effects', () => {
  const {Academy, PivotPlanner, DATA} = model();
  const id = apiName => Academy.itemMap.get(apiName);
  assert.ok(PivotPlanner.profile(id('DA_18_EmblemInferno')).includes('trait:DA_18_Inferno'));
  assert.ok(PivotPlanner.profile(id('DA_GuinsoosRagebladeRadiant')).includes('attack-speed'));
  assert.ok(PivotPlanner.profile(id('DA_Artifact_MogulsMail')).includes('tank'));
  assert.ok(PivotPlanner.profile(id('DA_Artifact_MogulsMail')).includes('armor'));
  const source = queue('GuinsoosRageblade');
  const replacement = {id:'WarmogsArmor', name:"Warmog's Armor", recipe:['GiantsBelt','GiantsBelt']};
  const before = PivotPlanner.candidate(plan({queue:[source]}), source.uid, replacement, DATA.items);
  const after = PivotPlanner.candidate(plan({queue:[source, queue(replacement.id)]}), source.uid, replacement, DATA.items);
  assert.ok(after.score < before.score);
  assert.ok(after.reasons.some(r=>r.points<0&&r.text.includes('Loses key roles')));
  assert.ok(after.reasons.some(r=>r.points<0&&r.text.includes('already planned')));
});

test('file mode uses the embedded snapshots without a relative file fetch', async () => {
  const fallback = {academy,meta,core};
  const snapshots = await loadSnapshots(fallback, 'file:///Carousel.html', () => {
    assert.fail('file mode must not fetch sibling snapshot files');
  });
  assert.equal(snapshots, fallback);
});

test('the MetaTFT snapshot keeps all source rows with compact item references', () => {
  assert.equal(meta.units.flatMap(unit => unit.builds).length, 15_550);
  assert.ok(meta.units.every(unit => unit.builds.every(build => build.items.every(id => typeof id === 'string'))));
});
