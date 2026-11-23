'use strict';

const academyTier = require('./tiers');
const createAcademy = require('./academy');
const createLootTracker = require('./loot-tracker');
const createTracker = require('./tracker');
const createOfflineTracker = require('./offline-tracker');
const createQueueOrder = require('./queue-order');
const createPivotPlanner = require('./pivot-planner');
const createQuickImport = require('./quick-import');
const createMetaBuilds = require('./meta-builds');
const createPlanAdvisor = require('./plan-advisor');
const createCompFinder = require('./comp-finder');
const createDecisionPlanner = require('./decision-planner');
const createAugmentAdvisor = require('./augment-advisor');

const componentOrder = [
  'BFSword', 'RecurveBow', 'NeedlesslyLargeRod', 'TearOfTheGoddess', 'ChainVest',
  'NegatronCloak', 'GiantsBelt', 'SparringGloves', 'Spatula', 'FryingPan'
];

module.exports = function createModel({core, academy, meta, secondaryTiers, requireLive = false}) {
  const DATA = structuredClone(core);
  const byId = Object.fromEntries([...DATA.components, ...DATA.items].map(i => [i.id, i]));
  const model = {DATA, byId, componentOrder, academyTier, ACADEMY_BUNDLED: academy, requireLive};
  model.LootTracker = createLootTracker(model);
  model.Tracker = createTracker(model);
  model.PivotPlanner = createPivotPlanner(model);
  model.Academy = createAcademy({...model, secondaryTiers});
  model.QueueOrder = createQueueOrder(model);
  model.Academy.register(academy, byId);
  model.OfflineTracker = createOfflineTracker(model);
  model.QuickImport = createQuickImport(model);
  model.MetaBuilds = createMetaBuilds({...model, meta});
  model.PlanAdvisor = createPlanAdvisor(model);
  model.CompFinder = createCompFinder(model);
  model.DecisionPlanner = createDecisionPlanner(model);
  model.AugmentAdvisor = createAugmentAdvisor(model);
  return model;
};
