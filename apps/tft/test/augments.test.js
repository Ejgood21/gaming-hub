'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {runInNewContext} = require('node:vm');
const createModel = require('../src/model');
const academy = require('../data/academy-18.3b.json');
const meta = require('../data/metatft-18.3b.json');
const core = require('../data/core-items.json');
const {apFast9} = require('../test-support/p16-comps');
const rankReplay = require('../test-support/p113-live-rank.json');

const caps = 'DA_DeadlierCaps';
const tears = 'DA_FlowingTears';
const kingslayer = 'DA_Kingslayer';
const mobility = 'DA_UpwardMobility';

function setup(ids) {
  const guide = {...apFast9, augments:[{apiName:mobility}]};
  const model = createModel({academy:{...academy, patch:'18.7', guides:[guide]}, meta, core});
  const plan = {queue:[{uid:'blue', item:'BlueBuff'}], owned:{}, pins:[], activeComp:{guide},
    augmentOffers:{...model.AugmentAdvisor.newOffers(0), ids:[...ids]}};
  return {plan, ...model};
}

const verdicts = result => result.rows.map(row=>row.verdict);

function renderedOffers({plan, Academy, AugmentAdvisor, CompFinder}) {
  const node = () => ({dataset:{},addEventListener(){}});
  const children = new Map();
  const get = id => {
    if(!children.has(id))children.set(id,node());
    return children.get(id);
  };
  const dialog = {open:true,setAttribute(){},querySelector:get};
  const document = {
    createElement: tag=>tag==='dialog'?dialog:node(),
    querySelector: ()=>({append(){},after(){},insertAdjacentHTML(){}}),
    body:{append(){}},getElementById:get,addEventListener(){}
  };
  const source = readFileSync(join(__dirname,'../src/ui/augment.js'),'utf8');
  runInNewContext(`${source}\nAugmentUI.refresh();`, {
    document,state:plan,Academy,AugmentAdvisor,CompFinder,render(){},augmentIcon:()=>'',
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  });
  const banner = get('augment-verdict').textContent;
  const offers = get('augment-offers').innerHTML;
  assert.doesNotMatch(offers, /augment-fit-label|augment-rarity|<details[^>]*\bopen\b/);
  const cards = [...offers.matchAll(/data-verdict="(\w+)"[^>]*>\s*<div class="augment-offer-heading">.*?<strong class="augment-verdict-line">([^<]+)<\/strong><\/div>\s*<p class="augment-phrase">([^<]+)<\/p>/g)]
    .map(([,verdict,line,phrase])=>[verdict,line,phrase]);
  return {banner,cards};
}

test('the reported 2-1 offers show named verdicts on the cards and a named pick in the banner', () => {
  const model = createModel({academy:{...academy,...rankReplay},meta,core});
  const {AugmentAdvisor,CompFinder} = model;
  const plan = {queue:[{uid:'crownguard',item:'Crownguard',done:true}],owned:{TearOfTheGoddess:1},pins:[],
    augmentOffers:AugmentAdvisor.newOffers(0)};
  CompFinder.choose(plan, rankReplay.guides.find(guide=>guide.title==='Yi Rengar').id);
  for(const [slot,id] of ['DA_BuriedTreasuresIII','DA_JeweledLotus_I','DA_PandorasItemsI'].entries()) {
    assert.equal(AugmentAdvisor.enter(plan,slot,id),true);
  }
  assert.equal(AugmentAdvisor.compare(plan).rows[1].offRound,true);
  assert.deepEqual(renderedOffers({plan,...model}), {
    banner:'Take Buried Treasures III',
    cards:[
      ['take','Take Buried Treasures III','Fits your comp'],
      ['avoid','Do not take Jeweled Lotus I','Wrong round — Academy lists it for 3-2 and 4-2'],
      ['decent',"Decent: Pandora's Items",'Decent for your comp']
    ]
  });
});

test('a same-rarity Academy alternative produces a named blue reroll card', () => {
  assert.deepEqual(renderedOffers(setup([caps,tears,kingslayer])), {
    banner:'Reroll Deadlier Caps if available',
    cards:[
      ['reroll','Reroll: Deadlier Caps','Reroll this one'],
      ['decent','Decent: Flowing Tears','Decent for your comp'],
      ['avoid','Do not take Kingslayer',"Doesn't fit your comp"]
    ]
  });
});

test('augment verdicts distinguish the pick, decent fit, eligible rerolls and unsupported offers', () => {
  const {plan, AugmentAdvisor} = setup([caps,tears,kingslayer]);
  const before = AugmentAdvisor.compare(plan);
  assert.deepEqual(verdicts(before), ['reroll','decent','avoid']);
  assert.equal(before.message, 'Reroll Deadlier Caps if available');
  assert.match(before.rerolls[0].reason, /Same-rarity Academy match.*Upward Mobility/);

  plan.augmentOffers.ids[0] = mobility;
  const after = AugmentAdvisor.compare(plan);
  assert.deepEqual(verdicts(after), ['take','decent','avoid']);
  assert.equal(after.message, 'Take Upward Mobility');

  plan.augmentOffers.round = 1;
  plan.augmentOffers.ids[0] = caps;
  const invalid = AugmentAdvisor.compare(plan).rows[0];
  assert.equal(invalid.verdict, 'avoid');
  assert.equal(invalid.phrase, 'Wrong round — Academy lists it for 2-1');
});

test('a different selected comp overrides a contextual take for an exclusive Academy offer', () => {
  const {Academy, plan, AugmentAdvisor} = setup([mobility,tears,kingslayer]);
  const [endorsing] = Academy.snapshot.guides;
  const selected = {...endorsing,id:'other',title:'Other Fast 9',augments:[]};
  plan.activeComp = {id:selected.id,guide:selected};
  Academy.useSnapshot({...Academy.snapshot,guides:[endorsing,selected]});

  const comparison = AugmentAdvisor.compare(plan);
  assert.equal(comparison.rows[0].contextual,true);
  assert.equal(comparison.rows[0].phrase,'Only fits AP Fast 9');
  assert.deepEqual(verdicts(comparison),['avoid','take','avoid']);
  assert.equal(comparison.message,'Take Flowing Tears');

  const another = {...endorsing,id:'third',title:'Another Comp'};
  Academy.useSnapshot({...Academy.snapshot,guides:[endorsing,selected,another]});
  assert.deepEqual(verdicts(AugmentAdvisor.compare(plan)),['take','decent','avoid']);
});

test('taking a named grant receives an outstanding target without spending components', () => {
  const {AugmentAdvisor, plan} = setup(['DA_SoloPlate','','']);
  plan.queue = [{uid:'planned',item:'GargoyleStoneplate',champion:'Karma'}];
  plan.owned = {ChainVest:1,NegatronCloak:1};

  assert.equal(AugmentAdvisor.record(plan,0),true);
  assert.deepEqual(plan.queue,[{
    uid:'planned',item:'GargoyleStoneplate',champion:'Karma',done:true,received:true,used:{},usedSources:{}
  }]);
  assert.deepEqual(plan.owned,{ChainVest:1,NegatronCloak:1});
  assert.equal(plan.chosenAugments[0],'DA_SoloPlate');
  assert.equal(AugmentAdvisor.record(plan,0),false);
  assert.equal(plan.queue.length,1);
});

test('named grants recognize artifact and multi-item grants while skipping manual rewards', () => {
  const {AugmentAdvisor,CompFinder} = setup(['','','']);
  const grants = id=>AugmentAdvisor.itemGrants(CompFinder.augment(id)).map(({name,count})=>[name,count]);
  assert.deepEqual(grants('DA_SpeedyDoubleKill'),[["Guinsoo's Rageblade",1]]);
  assert.deepEqual(AugmentAdvisor.itemGrants(CompFinder.augment('DA_ShimmerscaleEssence')).map(({id,count})=>[id,count]),[
    ['Academy_DA_Artifact_MogulsMail',1],['Academy_DA_Artifact_GamblersBlade',1]
  ]);
  assert.deepEqual(grants('DA_TacticiansKitchen'),[["Tactician's Cape",1]]);
  assert.deepEqual(grants('DA_OneBuffTwoBuff'),[['Red Buff',1],['Blue Buff',1]]);
  for (const description of [
    'Gain a random Emblem.',
    'Gain 2 item components.',
    'Gain a Radiant Lucky Item Chest.',
    'Gain a component anvil.',
    'Gain a Tear of the Goddess.',
    'Champions holding Gargoyle Stoneplate gain Armor.'
  ]) assert.deepEqual(AugmentAdvisor.itemGrants({description}),[]);
});

test('reroll clears only its slot, persists across reload and records the replacement', () => {
  const {plan, AugmentAdvisor, OfflineTracker} = setup([caps,tears,kingslayer]);
  assert.equal(AugmentAdvisor.replace(plan,0), true);
  assert.deepEqual(plan.augmentOffers.ids, ['',tears,kingslayer]);
  assert.deepEqual(plan.augmentOffers.seen, [caps]);
  assert.deepEqual(plan.augmentOffers.awaiting, [true,false,false]);
  assert.equal(AugmentAdvisor.compare(plan).message, 'Enter the replacement offer');

  const saved = OfflineTracker.cleanState(plan);
  assert.deepEqual(saved.augmentOffers, plan.augmentOffers);
  assert.equal(AugmentAdvisor.available(saved).some(a=>a.ids.includes(caps)), false);
  assert.equal(AugmentAdvisor.enter(saved,0,caps), false);
  assert.equal(AugmentAdvisor.enter(saved,0,mobility), true);
  assert.deepEqual(saved.augmentOffers.awaiting, [false,false,false]);
  assert.equal(AugmentAdvisor.compare(saved).best.augment.apiName, mobility);
  assert.equal(AugmentAdvisor.record(saved,0), true);
  assert.equal(saved.chosenAugments[0], mobility);
  assert.deepEqual(saved.augmentOffers, AugmentAdvisor.newOffers(1));
});

test('a worse reroll excludes the old Academy choice from both search and reroll evidence', () => {
  const {plan, Academy, AugmentAdvisor} = setup([mobility,tears,kingslayer]);
  const original = Academy.snapshot.augments.find(a=>a.apiName===mobility);
  const alias = {...original, apiName:mobility+'Alias'};
  Academy.useSnapshot({...Academy.snapshot,augments:[...Academy.snapshot.augments,alias]});
  assert.deepEqual(verdicts(AugmentAdvisor.compare(plan)), ['take','decent','avoid']);

  AugmentAdvisor.replace(plan,0);
  assert.equal(AugmentAdvisor.enter(plan,0,alias.apiName), false);
  assert.equal(AugmentAdvisor.enter(plan,0,caps), true);
  const result = AugmentAdvisor.compare(plan);
  assert.deepEqual(verdicts(result), ['avoid','take','avoid']);
  assert.equal(result.message, 'Take Flowing Tears');
  assert.deepEqual(result.rerolls, []);
  assert.equal(AugmentAdvisor.record(plan,0), true);
  assert.equal(plan.chosenAugments[0], caps);
});
