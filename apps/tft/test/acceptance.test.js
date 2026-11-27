'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const createModel = require('../src/model');
const {refreshLiveData, readAcademyCache, decodeMetaSnapshot, loadSnapshots, ACADEMY_TTL_MS} = require('../src/snapshots');
const {exportBackup, reviewBackup, maxBackupBytes} = require('../src/backup');
const academy = require('../data/academy-18.3b.json');
const metaFile = require('../data/metatft-18.3b.json');
const meta = decodeMetaSnapshot(metaFile);
const core = require('../data/core-items.json');
const secondaryTiers = require('../data/academy-secondary-tiers-18.7.json');
const liveFixture = require('../test-support/live-fixture');
const {apFast9, mamawood, covenElise, solarEclipse, currentUnits, darkRitual} = require('../test-support/p16-comps');
const liveFit = require('../test-support/p19-live-fit');

const model = () => createModel({academy, meta, core});
const guide = title => academy.guides.find(g => g.title === title);
const plan = overrides => ({queue: [], owned: {}, pins: [], ...overrides});
const queue = (item, options) => ({uid: item, item, done: false, ...options});
const caitlyn = {apiName: 'DA_18_Caitlyn', stars: 2};

test('A1: the finder shows current tiers before any items, augments or champions are recorded', () => {
  const {CompFinder} = model();
  assert.deepEqual(Object.fromEntries(['S','A','B','C','X'].map(tier =>
    [tier, academy.guides.filter(g => g.tier === tier).length])), {S:0,A:9,B:18,C:11,X:7});
  const activeComp = {guide:guide('Ahri Morgana')};
  const input = plan({activeComp,queue:[queue('SpearOfShojin')]});
  const {rows,tierNotice,notice} = CompFinder.recommendations(input);
  const tiers = rows.filter(row=>!row.blocked).map(row=>row.guide.tier);
  assert.equal(tiers[0],'A');
  assert.ok(tiers.includes('B'));
  assert.deepEqual(tiers,tiers.slice().sort((a,b)=>CompFinder.tierRank(a)-CompFinder.tierRank(b)));
  assert.ok(rows.every(row=>row.unitScore===0&&row.executionPenalty===0));
  assert.equal(CompFinder.alternative(input),undefined);
  assert.equal(notice,'');
  assert.equal(tierNotice,'No S-tier comp in this snapshot — top band is A');
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
  assert.equal(row.unlocked, true);
  assert.equal(row.tierBonus, 12);
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

test('A8: the shortlist, carousel and anvil apply the same component priorities', () => {
  const {DecisionPlanner, OfflineTracker} = model();
  const sword='BFSword', gloves='SparringGloves';
  const input = OfflineTracker.cleanState(plan({
    queue:[queue('InfinityEdge'),queue('SpearOfShojin')],
    owned:{TearOfTheGoddess:1},
    lootHistory:{complete:true,counts:{[gloves]:2}},
    lootTieBreak:false
  }));
  const ranks = expected => {
    for(const rows of [OfflineTracker.shortlist(input),DecisionPlanner.carousel(input),DecisionPlanner.anvil(input,'components')]){
      assert.deepEqual(rows.filter(r=>r.count>0).map(r=>[r.id,r.count]),expected);
    }
  };
  ranks([[gloves,1],[sword,2]]);
  input.pins=[sword];
  ranks([[sword,2],[gloves,1]]);
  input.pins=[];
  input.queue.reverse();
  ranks([[sword,2],[gloves,1]]);
  input.queue.reverse();
  input.activeComp={itemPriority:[{id:sword,component:true}]};
  ranks([[sword,2],[gloves,1]]);
  input.activeComp=null;
  input.lootHistory.counts={[gloves]:7,[sword]:2};
  ranks([[sword,2],[gloves,1]]);
  input.lootHistory={complete:false,counts:{[gloves]:2}};
  ranks([[sword,2],[gloves,1]]);
  input.queue.pop();
  ranks([[sword,1],[gloves,1]]);
});

test('complete history does not affect special component priorities', () => {
  const {DecisionPlanner, OfflineTracker} = model();
  const input = plan({queue:[queue('TacticiansRing')],lootHistory:{complete:true,counts:{FryingPan:2}}});
  const order = ['Spatula','FryingPan'];
  assert.deepEqual(OfflineTracker.shortlist(input).map(r=>r.id),order);
  assert.deepEqual(DecisionPlanner.carousel(input).filter(r=>r.count>0).map(r=>r.id),order);
});

test('Ahri Morgana carousel points to the banner item ahead of larger shortages and honors pins', () => {
  const replay = require('../test-support/p113-live-rank.json');
  const {Academy, CompFinder, DecisionPlanner, Tracker, DATA, byId} = createModel({
    academy: {...academy, ...replay, patch: '18.7'}, meta, core
  });
  const input = plan();
  CompFinder.choose(input, Academy.snapshot.guides.find(g => g.title === 'Ahri Morgana').id);

  const expected = () => Tracker.allocate(input, DATA.items).next;
  const first = () => DecisionPlanner.carousel(input)[0];
  const agrees = () => {
    const next = expected(), pick = first();
    assert.ok(next.slots.some(slot => !slot.have && slot.id === pick.id));
    assert.equal(pick.targets[0].uid, next.uid);
    assert.equal(byId[pick.targets[0].item].name, byId[next.item].name);
  };

  assert.equal(expected().item, 'SpearOfShojin');
  assert.equal(Tracker.allocate(input, DATA.items).needs.GiantsBelt.count, 4);
  agrees();

  input.pins = ['GiantsBelt'];
  assert.equal(first().id, 'GiantsBelt');
  assert.notEqual(first().targets[0].uid, expected().uid);

  input.pins = [];
  input.owned = {BFSword: 1, TearOfTheGoddess: 1};
  assert.equal(input.queue[0].item, 'SpearOfShojin');
  assert.equal(expected().item, 'JeweledGauntlet');
  agrees();
});

test('A9: component anvil preserves priority and records the receipt as other', () => {
  const {DecisionPlanner} = model();
  const input = plan({queue: [queue('InfinityEdge'), queue('SpearOfShojin')]});
  const offers = DecisionPlanner.anvil(input, 'components').filter(r => ['BFSword','SparringGloves'].includes(r.id));
  assert.equal(offers[0].id, 'BFSword');
  assert.match(offers[0].reason, /2 still needed/);
  DecisionPlanner.receiveAnvil(input, offers[0]);
  assert.deepEqual(input.lootHistory.loose.BFSword, ['other']);
  assert.equal(input.lootHistory.counts.BFSword, undefined);
});

test('an active comp exposes a current alternative with positive fit and preserves inventory on switch', () => {
  const {Academy, CompFinder} = model();
  const activeComp = {id:guide('Ahri Morgana').id};
  const input = plan({activeComp,currentUnits:[caitlyn],owned:{RecurveBow:1},
    queue:[queue('GuinsoosRageblade',{done:true}),queue('BlueBuff')]});
  assert.equal(CompFinder.alternative(plan()), undefined);
  assert.equal(CompFinder.alternative(plan({activeComp})), undefined);
  const alternative = CompFinder.alternative(input);
  assert.ok(alternative && alternative.guide.id !== activeComp.id && !alternative.blocked);
  assert.ok(alternative.fitScore > 0);
  const unverified = createModel({academy, meta, core, requireLive:true});
  assert.equal(unverified.CompFinder.alternative(input), undefined);

  CompFinder.choose(input, alternative.guide.id);
  assert.equal(input.activeComp.id, alternative.guide.id);
  assert.equal(input.activeComp.patch, Academy.snapshot.patch);
  assert.deepEqual(input.owned, {RecurveBow:1});
  assert.deepEqual(input.queue.filter(q=>q.done).map(q=>q.item), ['GuinsoosRageblade']);
});

test('six one-star units have no better pivot on AP Fast 9 until a better fit is available', () => {
  const {Academy, CompFinder} = model();
  const equalFit = {...apFast9,id:'equal-fit',title:'Comparable AP comp'};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[apFast9,mamawood,covenElise,solarEclipse,equalFit]});
  const input = plan({currentUnits});
  const rows = CompFinder.ranked(input);
  assert.equal(rows[0].guide.title,'AP Fast 9');
  assert.ok(rows[0].fitScore>0);
  assert.equal(rows.find(row=>row.guide.id===equalFit.id)?.fitScore,rows[0].fitScore);
  CompFinder.choose(input,mamawood.id);
  assert.equal(CompFinder.alternative(input)?.guide.title,'AP Fast 9');
  CompFinder.choose(input,apFast9.id);
  assert.equal(CompFinder.alternative(input),undefined);
  input.firstAugment = darkRitual;
  assert.equal(CompFinder.alternative(input)?.guide.title,'Coven Elise');
});

test('pivoting Shojin to Adaptive Helm in AP Fast 9 flags a second Ivern copy', () => {
  const {Academy, CompFinder, DATA, PivotPlanner} = model();
  Academy.useSnapshot({...academy,patch:'18.7',guides:[apFast9]});
  const input = plan({currentUnits});
  CompFinder.choose(input,apFast9.id);
  const shojin=input.queue.find(q=>q.item==='SpearOfShojin'&&q.champion==='Ivern');
  const existing=input.queue.find(q=>q.item==='AdaptiveHelm'&&q.champion==='Ivern');
  assert.equal(input.queue.length,10);
  const next=structuredClone(input);
  assert.equal(PivotPlanner.replace(next,shojin.uid,'AdaptiveHelm',DATA.items),true);
  assert.equal(next.queue.length,10);
  const added=next.queue.find(q=>q.uid===shojin.uid);
  assert.deepEqual([added.item,added.champion],['AdaptiveHelm','Ivern']);
  assert.deepEqual(PivotPlanner.addedQueueCopies(input,next),[{item:'AdaptiveHelm',added:[added],existing:[existing]}]);
});

test('an unassigned pivot still reuses an existing unassigned target', () => {
  const {DATA, PivotPlanner} = model();
  const original = queue('BlueBuff');
  const existing = queue('IonicSpark',{recommendedOrder:2});
  const other = queue('IonicSpark',{uid:'tank-spark',champion:'Lux'});
  const input = plan({queue:[original,existing,other]});
  const before = structuredClone(input);
  assert.equal(PivotPlanner.replace(input,original.uid,existing.item,DATA.items), true);
  assert.deepEqual(input.queue, [existing,other]);
  assert.deepEqual(PivotPlanner.addedQueueCopies(before,input), []);
});

test('pivoting Ivern from Shojin to Blue Buff flags Alune’s existing copy', () => {
  const {DATA, PivotPlanner} = model();
  const input = plan({queue:[queue('SpearOfShojin',{champion:'Ivern'}),queue('BlueBuff',{champion:'Alune'})]});
  const next = structuredClone(input);
  assert.equal(PivotPlanner.replace(next,'SpearOfShojin','BlueBuff',DATA.items),true);
  assert.deepEqual(next.queue.map(q=>[q.item,q.champion]),[['BlueBuff','Ivern'],['BlueBuff','Alune']]);
  assert.deepEqual(PivotPlanner.addedQueueCopies(input,next),[
    {item:'BlueBuff',added:[next.queue[0]],existing:[next.queue[1]]}
  ]);
});

test('explicit crafting and Build instead still require the full recipe', () => {
  const {byId, DATA, Tracker, PivotPlanner} = model();
  const q = queue('InfinityEdge');
  const input = plan({queue:[q],owned:{BFSword:1}});
  const before = structuredClone(input);
  assert.equal(Tracker.complete(input,q,byId[q.item]), false);
  assert.deepEqual(input,before);

  assert.equal(PivotPlanner.replace(input,q.uid,'Deathblade',DATA.items,true), false);
  assert.deepEqual(input,before);
  input.owned.SparringGloves = 1;
  assert.equal(Tracker.complete(input,q,byId[q.item]), true);
  assert.equal(q.done, true);
  assert.deepEqual(q.used, {BFSword:1,SparringGloves:1});
  assert.deepEqual(input.owned, {BFSword:0,SparringGloves:0});
});

test('Mark made completes Crownguard with an empty, partial, or full bench', () => {
  const {Academy, CompFinder, DecisionPlanner, OfflineTracker, Tracker} = model();
  Academy.useSnapshot({...academy, patch:'18.7', guides:[apFast9]});
  for (const owned of [{}, {ChainVest:1}, {ChainVest:1, NeedlesslyLargeRod:1}]) {
    const input = plan({owned:{...owned}});
    CompFinder.choose(input,apFast9.id);
    const crownguard = input.queue.find(q=>q.item==='Crownguard');
    const before = CompFinder.evaluate(input,apFast9).fitScore;
    const carousel = () => DecisionPlanner.carousel(input,DecisionPlanner.groups(input));
    const shortages = () => carousel().filter(row=>['ChainVest','NeedlesslyLargeRod'].includes(row.id));
    assert.ok(shortages().some(row=>row.targets.some(target=>target.item==='Crownguard')));
    assert.equal(OfflineTracker.markMade(input,crownguard),true);
    assert.deepEqual(input.queue.filter(q=>q.done),[crownguard]);
    assert.ok(CompFinder.evaluate(input,apFast9).fitScore>before);
    const crafted = !!owned.NeedlesslyLargeRod;
    assert.equal(crownguard.received,!crafted);
    assert.deepEqual(crownguard.used,crafted?owned:{});
    assert.deepEqual(input.owned,crafted?{ChainVest:0,NeedlesslyLargeRod:0}:owned);
    assert.ok(shortages().every(row=>row.targets.every(target=>target.item!=='Crownguard')));
    assert.equal(OfflineTracker.markMade(input,crownguard),false);
    Tracker.restore(input,crownguard);
    assert.deepEqual(input.owned,owned);
  }
});

test('a reported Jeweled Lotus I is recordable even when Academy lists later rounds', () => {
  const {AugmentAdvisor,CompFinder} = model();
  const lotus='DA_JeweledLotus_I';
  const input=plan({augmentOffers:{round:0,ids:[lotus,'',''],seen:[]}});
  const comparison=AugmentAdvisor.compare(input);
  assert.equal(comparison.rows[0].offRound,true);
  assert.equal(comparison.best,undefined);
  assert.equal(AugmentAdvisor.record(input,0),true);
  assert.deepEqual(input.chosenAugments,[lotus,'','']);
  assert.ok(CompFinder.augments().some(a=>a.apiName===lotus));
  assert.match(AugmentAdvisor.searchNotice('Mana Flow'), /Limited evidence/);
  assert.equal(AugmentAdvisor.catalog(plan(),0).some(a=>a.name.startsWith('Jeweled Lotus')), false);
  assert.equal(AugmentAdvisor.catalog(plan(),1).filter(a=>a.name.startsWith('Jeweled Lotus')).length, 2);
});

test('Deadlier Caps at 3-2 explains the mismatch and offers 2-1', () => {
  const {AugmentAdvisor} = model();
  const id = 'DA_DeadlierCaps';
  const input = plan({augmentOffers:{round:1,ids:[id,'',''],seen:[]}});
  const wrong = AugmentAdvisor.compare(input);
  assert.equal(wrong.action,'partial');
  assert.equal(wrong.best,undefined);
  assert.match(wrong.rows[0].reasons[0].text,/Deadlier Caps is listed by Academy for 2-1, not 3-2/);
  assert.deepEqual(wrong.rows[0].rounds,[0]);
  input.augmentOffers.round = wrong.rows[0].rounds[0];
  assert.equal(AugmentAdvisor.compare(input).best.augment.apiName,id);
});

test('Rod and Vest with Woven Magic change the top-three fit scores and show the augment credit', () => {
  const {Academy, CompFinder} = model();
  Academy.useSnapshot({...academy,patch:'18.7',guides:[apFast9,mamawood,guide('Ahri Morgana')]});
  const input = plan({owned:{NeedlesslyLargeRod:1,ChainVest:1}});
  const topThree = () => CompFinder.ranked(input).slice(0,3);
  const results = rows => rows.map(r=>[r.guide.id,r.fitScore]);
  const before = topThree();
  assert.equal(before.length,3);
  input.firstAugment = 'DA_WovenMagic';
  const after = topThree();
  assert.notDeepEqual(results(after),results(before));
  const fast9 = after.find(r=>r.guide.id===apFast9.id);
  const credit = fast9.reasons.find(r=>r.text.startsWith('Augment: Woven Magic'));
  assert.ok(credit.points>0);
  assert.match(credit.text,/Rules-based fit.*Component generation/);
  assert.equal(fast9.fitScore,before.find(r=>r.guide.id===apFast9.id).fitScore+credit.points);
  assert.ok(fast9.augmentMatches[0].recommended);
  assert.ok(fast9.reasons.some(r=>r.text.includes('No Academy augment data for this comp')));
  assert.equal(fast9.reasons.reduce((sum,r)=>sum+r.points,0),fast9.fitScore);
  assert.deepEqual(input.owned,{NeedlesslyLargeRod:1,ChainVest:1});
});

test('a higher tier still wins close fit, but yields to a 12-point lead', () => {
  const {Academy, CompFinder} = model();
  const upper = {...mamawood,tier:'S'}, lower = {...apFast9,tier:'A'};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[upper,lower]});
  const input = plan({owned:{NeedlesslyLargeRod:1,ChainVest:1}});
  const [tierWinner,close] = CompFinder.ranked(input);
  assert.equal(tierWinner.guide.id,upper.id);
  assert.ok(close.fitScore>tierWinner.fitScore&&close.fitScore-tierWinner.fitScore<12);
  input.activeComp = {id:upper.id};
  assert.equal(CompFinder.alternative(input),undefined);
  input.queue.push(queue('BlueBuff',{done:true}));
  input.currentUnits = [{apiName:'DA_18_Alune',stars:2}];
  const [fitWinner,runnerUp] = CompFinder.ranked(input);
  assert.equal(fitWinner.guide.id,lower.id);
  assert.equal(runnerUp.guide.id,upper.id);
  assert.ok(fitWinner.fitScore-runnerUp.fitScore>=12);
  assert.equal(fitWinner.tierBonus,12);
  assert.equal(runnerUp.tierBonus,24);
  assert.ok(fitWinner.effectiveScore>=runnerUp.effectiveScore);
});

test('the 12-point threshold is inclusive for each tier step', () => {
  const {Academy, CompFinder} = model();
  const higher = {...mamawood,tier:'S'};
  CompFinder.evaluate = (input,guide) => ({
    guide,fitScore:guide===higher?7:input.lowerFit,selectable:true
  });
  for (const [tier, gap] of [['A',12],['B',24]]) {
    const lower = {...apFast9,tier};
    Academy.useSnapshot({...academy,patch:'18.7',guides:[higher,lower]});
    const rows = lowerFit => CompFinder.ranked(plan({lowerFit,owned:{ChainVest:1}}));
    assert.equal(rows(7+gap-.01)[0].guide,higher);
    const [winner, runnerUp] = rows(7+gap);
    assert.equal(winner.guide,lower);
    assert.equal(runnerUp.guide,higher);
    assert.equal(winner.effectiveScore,runnerUp.effectiveScore);
    assert.equal(rows(7+gap+.01)[0].guide,lower);
  }
});

test('three tiers with sub-12 adjacent fit gaps have one effective-score order', () => {
  const {Academy, CompFinder} = model();
  const higher = {...mamawood,tier:'S'};
  const middle = {...apFast9,tier:'A'};
  const lower = {...guide('Ahri Morgana'),tier:'B'};
  const fit = {S:7,A:18.5,B:30};
  CompFinder.evaluate = (input,guide) => ({guide,fitScore:fit[guide.tier],selectable:true});
  for (const guides of [[higher,middle,lower],[lower,higher,middle],[middle,lower,higher]]) {
    Academy.useSnapshot({...academy,patch:'18.7',guides});
    const rows = CompFinder.ranked(plan({owned:{ChainVest:1}}));
    assert.deepEqual(rows.map(row=>row.guide),[higher,middle,lower]);
    assert.deepEqual(rows.map(row=>row.effectiveScore),[31,30.5,30]);
  }
});

function liveFitModel() {
  const instance = model(), {Academy} = instance;
  const replace = (older, newer) => [...older.filter(entry=>!newer.some(row=>row.apiName===entry.apiName)), ...newer];
  Academy.useSnapshot({...academy, patch:'18.7', guides:liveFit.guides,
    items:replace(academy.items,liveFit.items), augments:replace(academy.augments,liveFit.augments)});
  return instance;
}

test('Patch 18.7 Rod + Vest: Woven Magic improves Defender Cassio by 24 fit points', () => {
  const {CompFinder} = liveFitModel();
  const input = plan({owned:{NeedlesslyLargeRod:1,ChainVest:1}});
  const top = () => CompFinder.ranked(input).slice(0,3);
  const scores = rows => rows.map(r=>[r.guide.title,r.fitScore,r.effectiveScore]);
  assert.deepEqual(scores(top()),[['Mamawood',7,31],['AP Fast 9',4.5,28.5],['10 Riftbeast',7.5,19.5]]);
  const [leader,,higherRawFit] = top();
  input.activeComp = {id:leader.guide.id};
  assert.equal(CompFinder.alternative(input),undefined);
  input.activeComp = {id:higherRawFit.guide.id};
  assert.equal(CompFinder.alternative(input)?.guide.id,leader.guide.id);
  input.firstAugment = 'DA_WovenMagic';
  const after = top();
  assert.deepEqual(scores(after),[['AP Fast 9',11.5,35.5],['Mamawood',11,35],['Defender Cassio',30.5,30.5]]);
  assert.deepEqual(after[2].augmentMatches.map(a=>[a.name,a.points,a.academy]),[['Woven Magic',24,'listed']]);
});

test('with no champions, a single component or chosen augment can change the top route', () => {
  const {Academy,CompFinder} = model();
  const alphabeticallyFirst = {...mamawood,title:'A route',tier:'S'};
  const componentFit = {...apFast9,title:'Z route'};
  const augmentFit = {...apFast9,id:'augment-fit',title:'Y route',tier:'A',mainAugment:{apiName:'DA_WovenMagic'}};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[alphabeticallyFirst,componentFit,augmentFit]});
  const input = plan({currentUnits:[],activeComp:{guide:alphabeticallyFirst}});
  assert.equal(CompFinder.recommendations(input).rows[0].guide.id,alphabeticallyFirst.id);
  input.owned.NeedlesslyLargeRod = 1;
  const [fromComponent] = CompFinder.ranked(input);
  assert.equal(fromComponent.guide.id,componentFit.id);
  assert.ok(fromComponent.componentScore>0);
  input.firstAugment = 'DA_WovenMagic';
  const [fromAugment] = CompFinder.ranked(input);
  assert.equal(fromAugment.guide.id,augmentFit.id);
  assert.equal(fromAugment.unitScore,0);
  assert.equal(fromAugment.executionPenalty,0);
  assert.equal(fromAugment.augmentMatches[0].academy,'featured');
  assert.deepEqual(input.currentUnits,[]);
});

test('Patch 18.7 Rod + Vest and Yi / Kog’Maw / Vi at 3★: Adaptor Reroll passes S', () => {
  const {CompFinder} = liveFitModel();
  const input = plan({owned:{NeedlesslyLargeRod:1,ChainVest:1},
    currentUnits:['DA_18_MasterYi_AD','DA_KogMaw18_AD','DA_Vi18'].map(apiName=>({apiName,stars:3}))});
  const rows = CompFinder.ranked(input).filter(r=>r.guide.tier==='S'||r.guide.title==='Adaptor Reroll');
  assert.deepEqual(rows.map(r=>[r.guide.title,r.fitScore]),[['Adaptor Reroll',51.5],['Mamawood',-2],['AP Fast 9',-9]]);
});

test('Patch 18.7 Fast 9 econ offers use Academy endorsements before economy rules', () => {
  const {CompFinder} = liveFitModel();
  const input = plan({owned:{NeedlesslyLargeRod:1,ChainVest:1}});
  for (const [id, apBonus, dravenBonus, reason] of [
    ['DA_LevelUp',7,24,/XP purchases.*level 9/],
    ['DA_PatientStudy',7,7,/Extra XP/],
    ['DA_TradeSector',4,4,/Extra gold/]
  ]) {
    input.firstAugment = id;
    const rows = CompFinder.ranked(input);
    const ap = rows.find(r=>r.guide.title==='AP Fast 9'), draven = rows.find(r=>r.guide.title==='Draven Dragon 9');
    assert.equal(ap.fitScore,4.5+apBonus);
    assert.equal(ap.augmentMatches[0].recommended,true);
    assert.match(ap.reasons.find(r=>r.text.startsWith('Augment:')).text,/Rules-based fit/);
    assert.match(ap.augmentMatches[0].text,reason);
    assert.equal(draven.fitScore,4+dravenBonus);
    assert.equal(draven.augmentMatches[0].academy,id==='DA_LevelUp'?'listed':undefined);
    if(id==='DA_LevelUp')assert.equal(rows[0],draven);
  }
});

test('the whole first-augment catalog has unique display names and retains variant IDs', () => {
  const {Academy, CompFinder} = liveFitModel();
  const alias = Academy.snapshot.augments.find(a=>a.apiName==='DA_18_RivalsAugmentPlus');
  alias.description = alias.description.replace(' with ', '  with ')+' ';
  const entries = CompFinder.augments();
  const labels = entries.map(a=>a.name.trim().replace(/\s+/g,' ').toLowerCase());
  assert.equal(new Set(labels).size,labels.length);
  assert.deepEqual(new Set(entries.flatMap(a=>a.ids)),new Set(Academy.snapshot.augments.map(a=>a.apiName)));
  const unrivaled = entries.find(a=>a.name==='Unrivaled');
  assert.equal(unrivaled.apiName,'DA_18_RivalsAugment');
  assert.deepEqual(unrivaled.ids,['DA_18_RivalsAugment','DA_18_RivalsAugmentPlus']);
  const beastWithin = entries.find(a=>a.name==='Beast Within');
  assert.deepEqual(beastWithin.ids,['DA_18_PrimalAugment_Nidalee','DA_18_PrimalAugment_Sivir']);
  assert.equal(CompFinder.augmentOptions('3-2').filter(a=>a.name==='Beast Within').length,2);
});

test('Lucky Gloves and Flowing Tears get the same contextual verdict for needed components', () => {
  const {Academy, AugmentAdvisor} = model();
  const liveGuide = {...apFast9,augments:[{apiName:'DA_UpwardMobility'}]};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[liveGuide]});
  const input = plan({activeComp:{guide:liveGuide},queue:[queue('JeweledGauntlet'),queue('BlueBuff')]});
  const choice = AugmentAdvisor.compare(input,{round:0,ids:['DA_LuckyGloves','DA_FlowingTears','DA_DeadlierCaps'],seen:[]});
  assert.equal(choice.action,'reroll');
  for (const row of choice.rows.slice(0,2)) {
    assert.equal(row.contextual,true);
    assert.match(row.reasons[0].text,/Offers a component your current targets need/);
    assert.ok(!choice.rerolls.some(r=>r.slot===row.slot));
  }
  assert.deepEqual(choice.rerolls.map(r=>r.slot),[2]);
  assert.match(choice.rerolls[0].reason,/No Academy match.*Upward Mobility/);
  const backed = AugmentAdvisor.compare(input,{round:0,ids:['DA_LuckyGloves','DA_FlowingTears','DA_UpwardMobility'],seen:[]});
  assert.equal(backed.action,'take');
  assert.equal(backed.best.augment.name,'Upward Mobility');
  assert.match(backed.best.reasons[0].text,/Academy recommends this augment for AP Fast 9/);
  const unannotated = AugmentAdvisor.compare(plan({activeComp:{guide:apFast9}}),{round:0,ids:['DA_FlowingTears','',''],seen:[]});
  assert.match(unannotated.academyNotice,/Academy lists no recommended augment for this comp/);
  assert.equal(unannotated.rows[0].contextual,true);
  assert.notEqual(unannotated.action,'take');
});

test('X guides get a dated secondary badge only from the same Academy guide and set', () => {
  const {Academy} = model();
  const elderwood = guide('Aphelios Elderwood');
  assert.equal(elderwood.tier, 'B');
  assert.equal(Academy.secondaryTier(elderwood), null);
  const x = {...elderwood,tier:'X'};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[x,guide('Inferno Fast 9')]});
  assert.deepEqual(Academy.secondaryTier(x), {tier:'B',patch:'18.3b'});
  assert.equal(Academy.secondaryTier(guide('Inferno Fast 9')), null);
  assert.equal(Academy.secondaryTier({...x,id:'different-guide'}), null);
  Academy.useSnapshot({...Academy.snapshot,set:19});
  assert.equal(Academy.secondaryTier(x), null);
});

test('Academy X-row badges are patch-scoped and take precedence over saved tiers', () => {
  const {Academy} = createModel({academy,meta,core,secondaryTiers});
  const veigar = {...guide('Elderwood Veigar'),tier:'X'};
  const noBadge = {...covenElise,id:'unknown-x-guide'};
  Academy.useSnapshot({...academy,patch:'18.7',guides:[covenElise,solarEclipse,veigar,noBadge]});
  assert.deepEqual(Academy.secondaryTier(covenElise),{tier:'B',patch:'18.7',fromXRow:true});
  assert.deepEqual(Academy.secondaryTier(solarEclipse),{tier:'A',patch:'18.7',fromXRow:true});
  assert.deepEqual(Academy.secondaryTier(veigar),{tier:'A',patch:'18.7',fromXRow:true});
  assert.equal(Academy.secondaryTier(noBadge),null);
  assert.equal(Academy.secondaryTier({...solarEclipse,tier:'A'}),null);
  Academy.useSnapshot({...Academy.snapshot,patch:'18.8'});
  assert.deepEqual(Academy.secondaryTier(veigar),{tier:'B',patch:'18.3b'});
  assert.equal(Academy.secondaryTier(covenElise),null);
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
  assert.equal(choice.best.academy,'featured');
  assert.ok(choice.rows.slice(1).every(row => !row.academy));
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
  const m = createModel({academy, meta, core, requireLive: true});
  const requests = [];
  const result = await refreshLiveData(m, {fetchJSON: async url => {
    requests.push(url);
    return {ok:true, json:async()=>({data:{tierlist:[]}})};
  }});
  assert.equal(result.updated, false);
  assert.match(result.notice, /changed its data format/);
  assert.equal(requests.length, 6);
  assert.ok(requests.includes('https://tftacademy.com/tierlist/comps/__data.json'));
  assert.equal(m.Academy.snapshot, academy);
  assert.ok(m.CompFinder.evaluate(plan(), guide('Caitlyn Hunters')).selectable);
  assert.deepEqual(m.CompFinder.recommendations(plan()).rows, []);
});

test('Academy cache requires both the current set and a fresh valid fetch timestamp', () => {
  const now = Date.parse('2026-11-22T15:00:00Z');
  const raw = (age, set) => JSON.stringify({...academy, set, fetchedAt:new Date(now-age).toISOString()});
  assert.equal(readAcademyCache(raw(3000,18),18,now).patch, '18.3b');
  assert.equal(readAcademyCache(raw(3000,17),18,now), null);
  assert.equal(readAcademyCache(raw(ACADEMY_TTL_MS,18),18,now), null);
  assert.equal(readAcademyCache(raw(-1000,18),18,now), null);
});

test('exact team-code ties favor an ordinary tier unless the X requirement is owned', () => {
  const {Academy, CompFinder, QuickImport, academyTier} = model();
  assert.ok(CompFinder.tierRank('X') > CompFinder.tierRank('B'));
  assert.equal(academyTier('X').label, 'Situational');
  const baseline = guide('Caitlyn Hunters');
  const hex = Academy.guideHex(baseline);
  const code = '02' + [...hex, ...Array(10-hex.length).fill('000')].join('') + 'TFTSet18';
  const situational = {...baseline, id:'situational', tier:'X', updated:'2026-10-01'};
  Academy.useSnapshot({...academy, guides:[baseline,situational]});
  const ordinary = plan({queue:[queue('GuinsoosRageblade',{done:true})]});
  assert.equal(QuickImport.choose(code, ordinary).guide.id, baseline.id);
  const radiant = Academy.itemMap.get('DA_GuinsoosRagebladeRadiant');
  assert.equal(QuickImport.choose(code, plan({queue:[queue(radiant,{done:true})]})).guide.id, situational.id);
});

const infernoId = 'lskq0yo5kvzfrfj';
const infernoItem = 'Academy_DA_18_EmblemInferno';
const infernoPlan = owned => plan({
  currentUnits:[{apiName:'DA_Lux18_Base',stars:1}],
  queue:[queue('GuinsoosRageblade',{done:true}), ...(owned?[queue(infernoItem,{done:true})]:[])]
});

test('X-tier Inferno Fast 9 leads with the completed Inferno Emblem and names the unlock', () => {
  const {CompFinder} = model();
  assert.deepEqual(guide('Inferno Fast 9').gatedBy, {type:'emblem',id:'DA_18_EmblemInferno'});
  const [top] = CompFinder.recommendations(infernoPlan(true)).rows;
  assert.equal(top.guide.id, infernoId);
  assert.equal(top.guide.tier, 'X');
  assert.equal(top.unlocked, true);
  assert.ok(top.reasons.some(reason => reason.text === 'Unlocked by Inferno Emblem'));
});

test('the same X-tier guide stays Situational outside the top three without the emblem', () => {
  const {CompFinder, academyTier} = model();
  const input = infernoPlan(false);
  input.queue.push(queue(infernoItem));
  const rows = CompFinder.recommendations(input).rows;
  const index = rows.findIndex(row => row.guide.id === infernoId);
  assert.ok(index >= 3);
  assert.equal(academyTier(rows[index].guide.tier).label, 'Situational');
  assert.equal(rows[index].unlocked, false);
  assert.equal(rows[index].blocked, true);
});

test('ordinary tiers rank as before without an X requirement', () => {
  const {CompFinder} = model();
  const input = plan({currentUnits:[caitlyn],queue:[queue('GuinsoosRageblade',{done:true})]});
  const rows = CompFinder.recommendations(input).rows;
  assert.equal(rows.find(row => row.guide.tier === 'B').guide.title, 'Caitlyn Hunters');
  assert.ok(rows.some(row => row.guide.tier === 'A' && !row.blocked));
  assert.ok(rows.every(row => ['S','A','B','X'].includes(row.guide.tier)));
});

test('an X guide can use a featured emblem outside its board or a held structured augment', () => {
  const {Academy, CompFinder} = model();
  const emblem = guide('Ravager Elise');
  assert.equal(emblem.gatedBy, null);
  assert.deepEqual(Academy.gate(emblem), {type:'emblem',id:'DA_18_EmblemSlayer'});
  const item = Academy.itemMap.get('DA_18_EmblemSlayer');
  assert.match(CompFinder.evaluate(plan({queue:[queue(item,{done:true})]}),emblem).unlockReason, /Ravager Emblem/);
  const rivals = guide('Unrivaled Reroll');
  assert.equal(CompFinder.evaluate(plan({queue:[queue('EdgeOfNight',{done:true})]}),rivals).blocked, true);
  assert.equal(CompFinder.evaluate(plan({chosenAugments:['','','DA_18_RivalsAugment']}),rivals).unlocked, true);
});

test('live success adopts a matching 18.3b source and current MetaTFT builds', async () => {
  const m = createModel({academy, meta, core, requireLive: true});
  const input = infernoPlan(true);
  assert.deepEqual(m.CompFinder.recommendations(input).rows, []);
  const result = await refreshLiveData(m, {set:18,fetchJSON:liveFixture()});
  assert.equal(result.updated, true, result.notice);
  assert.equal(m.Academy.live, true);
  assert.equal(m.Academy.snapshot.patch, '18.3b');
  assert.notEqual(m.Academy.snapshot, academy);
  assert.equal(m.MetaBuilds.dataFor({champion:'Ashe'}).builds[0].games, 63);
  assert.equal(m.CompFinder.recommendations(input).rows[0].guide.id, infernoId);
});

test('failed and mismatched refreshes leave stale comps and MetaTFT builds out of recommendations', async () => {
  const m = createModel({academy, meta, core, requireLive: true});
  const input = infernoPlan(true);
  assert.equal((await refreshLiveData(m,{fetchJSON:liveFixture()})).updated, true);
  const saved = m.Academy.snapshot;
  for (const options of [{fail:true},{timeout:true},{metaPatch:'18.3'},{metaSet:19}]) {
    const result = await refreshLiveData(m,{fetchJSON:liveFixture(options)});
    assert.equal(result.updated,false);
    if(options.timeout)assert.match(result.notice,/timed out/);
    assert.equal(m.Academy.live,false);
    assert.equal(m.Academy.snapshot,saved);
    const output = m.CompFinder.recommendations(input);
    assert.deepEqual(output.rows,[]);
    assert.match(output.notice,/Not enough current info/);
    assert.ok(output.guidance.length);
    assert.equal(m.MetaBuilds.dataFor({champion:'Ashe'}),undefined);
    assert.ok(m.MetaBuilds.find('Ashe',true)?.entry);
    assert.deepEqual(m.DecisionPlanner.builds(input,'Ashe'),[]);
    assert.throws(()=>m.CompFinder.choose(input,infernoId),/Refresh live data/);
  }
});

test('a superseded request cannot re-enable recommendations after a newer refresh fails', async () => {
  const m = createModel({academy, meta, core, requireLive: true});
  const wait = Promise.withResolvers();
  const fixture = liveFixture();
  const older = refreshLiveData(m,{fetchJSON:async url=>{
    if(url.endsWith('__data.json'))await wait.promise;
    return fixture(url);
  }});
  const newer = await refreshLiveData(m,{fetchJSON:liveFixture({fail:true})});
  assert.equal(newer.updated,false);
  wait.resolve();
  assert.deepEqual(await older,{updated:false,superseded:true});
  assert.equal(m.Academy.snapshot,academy);
  assert.deepEqual(m.CompFinder.recommendations(infernoPlan(true)).rows,[]);
});

test('metadata-free Academy guides must have been updated in a current-only MetaTFT patch day', async () => {
  const m = createModel({academy, meta, core, requireLive: true});
  const opts = {omitAcademyPatch:true};
  assert.equal((await refreshLiveData(m,{fetchJSON:liveFixture(opts)})).updated,true);
  const result = await refreshLiveData(m,{fetchJSON:liveFixture({...opts,staleGuideDates:true})});
  assert.equal(result.updated,false);
  assert.match(result.notice,/patches could not be matched/);
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
  const fallback = {academy,meta,core,secondaryTiers};
  const snapshots = await loadSnapshots(fallback, 'file:///Carousel.html', () => {
    assert.fail('file mode must not fetch sibling snapshot files');
  });
  assert.equal(snapshots, fallback);
});

test('the MetaTFT snapshot keeps all source rows with compact item references', () => {
  assert.equal(meta.units.flatMap(unit => unit.builds).length, 15_550);
  assert.ok(meta.units.every(unit => unit.builds.every(build => build.items.every(id => typeof id === 'string'))));
});
