'use strict';

module.exports = function createPlanAdvisor(model) {
  const {Academy, MetaBuilds, QuickImport} = model;
  /* Academy defines the plan. MetaTFT can propose an explicit, reversible
     adjustment around items the player has actually equipped. */
  return {
    same(a,b){return Academy.normalizeName(a)===Academy.normalizeName(b);},
    equipped(plan,name){const holders=Academy.equipment(plan);return plan.queue.filter(q=>q.done&&this.same(holders.get(q.uid)||'',name));},
    suggest(plan,name){
      const {DecisionPlanner, CompFinder}=model;
      const guide=Academy.currentGuide(plan),equipped=DecisionPlanner.equipped(plan,name),targets=DecisionPlanner.pending(plan,name);
      if(!guide||!equipped.length||!targets.length)return null;
      if(equipped.reduce((n,id)=>n+CompFinder.slotCost(id),0)>=3)return {champion:name,equipped,remaining:[],kind:'full'};
      const baseline=Academy.build(guide).entries.filter(q=>DecisionPlanner.same(q.champion,name)).map(q=>q.item);
      if(DecisionPlanner.subtract(baseline,equipped)!==null)return null;
      const options=DecisionPlanner.builds(plan,name),best=options[0];if(!best)return null;
      const ids=targets.map(q=>q.item),current=options.find(b=>b.remaining.length===ids.length&&MetaBuilds.fits(b.remaining,ids));
      if(current&&(current===best||best.missing>=current.missing-2))return null;
      return best;
    },
    apply(plan,choice){model.DecisionPlanner.applyBuild(plan,choice);return true;},
    restoreAcademy(plan){
      const guide=Academy.currentGuide(plan);if(!guide)return;
      QuickImport.replace(plan,{guide,entries:Academy.build(guide).entries,priorities:Academy.priorities(guide)},plan.activeComp.code);
    }
  };
};
