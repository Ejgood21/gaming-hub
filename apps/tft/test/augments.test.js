'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const createModel = require('../src/model');
const academy = require('../data/academy-18.3b.json');
const meta = require('../data/metatft-18.3b.json');
const core = require('../data/core-items.json');
const {apFast9} = require('../test-support/p16-comps');

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
  assert.equal(invalid.label, 'Check offer');
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
