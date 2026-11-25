'use strict';

const rules = require('./opener-rules');

module.exports = function createOpenerGuidance({Academy, CompFinder, AugmentAdvisor, Tracker, byId}) {
  return {
    label: 'Opener guide Patch ' + rules.patch,
    patch: rules.patch,
    source: rules.source,
    forPlan(plan) {
      const live = Academy.snapshot;
      if (!Academy.live || live.set !== rules.set || plan.activeComp) return [];

      const unitList = CompFinder.units(plan);
      const units = new Map(unitList.map(unit => [unit.apiName, unit]));
      const completed = plan.queue.filter(item => item.done);
      const items = new Map(live.items.map(item => [item.apiName, item]));
      const allowed = (api, type) => items.get(api)?.type === type;
      const owned = api => {
        const id = Academy.itemMap.get(api);
        return id && completed.some(item => Academy.itemMatches(id, item.item));
      };
      const slam = api => {
        if (!allowed(api, 'craftables')) return false;
        const item = byId[Academy.itemMap.get(api)];
        return item && (owned(api) || Tracker.canCraft(plan.owned, item));
      };
      const component = api => allowed(api, 'components') && plan.owned[api.slice('DA_Component_'.length)] > 0;
      const guides = new Map(live.guides.filter(guide => /^[SABC]$/.test(guide.tier))
        .map(guide => [guide.compSlug, guide]));
      const held = CompFinder.heldAugments(plan);
      const stages = AugmentAdvisor.slots(plan);
      const result = [];
      const usedComps = new Set();

      function add(rule) {
        // A historic route needs a current tier. Any named requirement must
        // resolve in the live catalog, even if it is present in a saved plan.
        const guide = rule.comp && guides.get(rule.comp);
        if (rule.comp && (!guide || usedComps.has(rule.comp))) return;
        if (rule.compUnits?.some(id => !guide.finalComp.some(unit => unit.apiName === id))) return;
        const gate = guide && Academy.gate(guide);
        if (gate?.type === 'emblem' && (!allowed(gate.id, 'emblems') || !owned(gate.id))) return;
        if (gate?.type === 'augment' && (!CompFinder.augment(gate.id) || !held.includes(gate.id))) return;
        if (gate?.type === 'item' && (!items.has(gate.id) || !owned(gate.id))) return;
        if (rule.emblem && (!allowed(rule.emblem, 'emblems') || !owned(rule.emblem))) return;
        if (rule.augment && (!CompFinder.augment(rule.augment) || !held.includes(rule.augment))) return;
        if (rule.unit && !(units.get(rule.unit)?.stars >= (rule.stars || 1))) return;
        if (rule.slam && !guide?.finalComp.find(unit => unit.apiName === rule.unit)?.items.some(slam)) return;
        if (rule.item && !slam(rule.item)) return;
        if (rule.component && !component(rule.component)) return;
        if (rule.artifact && !rules.apArtifacts.some(api => allowed(api, 'ornns') && owned(api))) return;
        if (rule.secondTrait && !unitList.some(unit => unit.apiName !== rule.unit && unit.traitKeys?.includes(rule.secondTrait))) return;

        result.push(rule.text);
        if (rule.comp) usedComps.add(rule.comp);
      }

      for (const rule of [...rules.emblems, ...rules.rerolls, ...rules.augmentRoutes]) add(rule);
      if (rules.econAugments.includes(stages[0]) && CompFinder.augment(stages[0])?.stages?.includes('2-1')) {
        if (!stages[1] && !stages[2]) result.push(rules.directional);
        if (!stages[2]) {
          const before = result.length;
          for (const rule of rules.stageFour) {
            add(rule);
            if (result.length > before) break;
          }
        }
      }
      for (const rule of rules.hardForce) add({...rule, slam: !!rule.unit});
      for (const rule of rules.slams) add(rule);

      // Academy reports the unit and cost, but does not publish hold tiers.
      // Only offer a hold when that unit still occupies the guide's cost slot.
      const holds = Object.entries(rules.holds).flatMap(([cost, tiers]) =>
        [...tiers.priority.map(id => units.get(id)), ...tiers.flexible.map(id => units.get(id)).filter(unit => unit?.stars >= 2)]
          .filter(unit => unit?.cost === Number(cost)));
      if (holds.length) {
        result.push('Hold ' + holds.slice(0, 4).map(unit => unit.name).join(', ') + ' for early tempo.');
      }
      const components = rules.components.filter(api => allowed(api, 'components'));
      const inHand = components.filter(component);
      if (inHand.length) {
        result.push('Use your ' + inHand.map(api => items.get(api).name).join(' / ') + ' for a strong early slam.');
      }
      if (components.length) {
        result.push('Prioritize ' + components.map(api => items.get(api).name).join(' / ') + ' on early carousel.');
      }
      result.push(rules.tempo);
      if (!stages[0] && !stages[1] && !stages[2]) result.push(rules.itemAugment);
      return result.slice(0, 3);
    }
  };
};
