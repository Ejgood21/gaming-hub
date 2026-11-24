'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const createModel = require('../src/model');
const academy = require('../data/academy-18.3b.json');
const core = require('../data/core-items.json');
const meta = require('../data/metatft-18.3b.json');

function setup() {
  const model = createModel({academy, core, meta, requireLive:true});
  const {Academy} = model;
  const snapshot = {...academy, patch:'18.7'};
  Academy.useSnapshot(snapshot);
  Academy.live = true;
  return {...model, snapshot};
}

test('each opener needs its own live comp tier and owned, current emblem', () => {
  const {Academy, OpenerGuidance, snapshot} = setup();
  const emblem = 'DA_18_EmblemInvoker';
  const plan = {queue:[], owned:{BFSword:1, TearOfTheGoddess:1}};
  const texts = () => OpenerGuidance.forPlan(plan).join(' ');
  assert.doesNotMatch(texts(), /Invoker Ahri Morgana/);
  plan.queue.push({done:true, item:Academy.itemMap.get(emblem)});
  assert.match(texts(), /Invoker Emblem → Invoker Ahri Morgana/);
  assert.match(texts(), /Spear of Shojin/);

  const guides = snapshot.guides.map(guide => guide.compSlug === 'set-18-ahri-morgana' ? {...guide, tier:'C'} : guide);
  Academy.useSnapshot({...snapshot, guides});
  assert.match(texts(), /Invoker Emblem → Invoker Ahri Morgana/);
  Academy.useSnapshot({...snapshot, guides:guides.filter(guide => guide.compSlug !== 'set-18-ahri-morgana')});
  assert.doesNotMatch(texts(), /Invoker Ahri Morgana/);
  assert.match(texts(), /Spear of Shojin/);
  Academy.useSnapshot({...snapshot, items:snapshot.items.filter(item => item.apiName !== emblem)});
  assert.doesNotMatch(texts(), /Invoker Ahri Morgana/);
  Academy.live = false;
  assert.deepEqual(OpenerGuidance.forPlan(plan), []);
});

test('a saved augment contributes guidance only while its catalog entry is live', () => {
  const {Academy, OpenerGuidance, snapshot} = setup();
  const id = 'DA_PrismaticTicket';
  const plan = {queue:[], owned:{}, firstAugment:id};
  assert.match(OpenerGuidance.forPlan(plan).join(' '), /Prismatic Ticket/);
  Academy.useSnapshot({...snapshot, augments:snapshot.augments.filter(augment => augment.apiName !== id)});
  const result = OpenerGuidance.forPlan(plan);
  assert.ok(result.length >= 2);
  assert.doesNotMatch(result.join(' '), /Prismatic Ticket/);
  assert.doesNotMatch(OpenerGuidance.forPlan({...plan, firstAugment:'DA_ManaFlow'}).join(' '), /Mana Flow/);
  assert.deepEqual(OpenerGuidance.forPlan({...plan, activeComp:{}}), []);
  Academy.useSnapshot({...snapshot, set:19});
  assert.deepEqual(OpenerGuidance.forPlan(plan), []);
});

test('opener holds use live costs and slams use live recipes', () => {
  const {Academy, OpenerGuidance, snapshot} = setup();
  const unit = 'DA_18_Camille';
  const plan = {queue:[], owned:{ChainVest:1, NegatronCloak:1}, currentUnits:[{apiName:unit, stars:1}]};
  assert.match(OpenerGuidance.forPlan(plan).join(' '), /Gargoyle Stoneplate.*Hold Camille/);
  Academy.useSnapshot({...snapshot,
    items:snapshot.items.filter(item => item.apiName !== 'DA_GargoyleStoneplate'),
    champions:snapshot.champions.map(champion => champion.apiName === unit ? {...champion, cost:2} : champion)});
  const result = OpenerGuidance.forPlan(plan);
  assert.ok(result.length >= 2);
  assert.doesNotMatch(result.join(' '), /Gargoyle Stoneplate|Hold Camille/);
});
