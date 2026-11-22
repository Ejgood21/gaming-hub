'use strict';

module.exports = function createLootTracker({componentOrder}) {
  /* Source history is independent of inventory. This is a conservative historical
     bag heuristic, not a verified current-set probability model. */
  return {
    clean(value, owned) {
      const sources=['loot','carousel','other'];
      const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(9999,Math.floor(Number(n)))):0;
      return {complete:value?.complete===true,counts:Object.fromEntries(componentOrder.map(id=>[id,count(value?.counts?.[id])])),loose:Object.fromEntries(componentOrder.map(id=>[id,Array.from({length:Math.min(9999,count(owned[id]))},(_,n)=>sources.includes(value?.loose?.[id]?.[n])?value.loose[id][n]:'other')]))};
    },
    ensure(plan) {
      if(!plan.lootHistory)plan.lootHistory={complete:!plan.queue.some(q=>q.done)&&!Object.values(plan.owned).some(n=>n>0),counts:{},loose:{}};
      for(const id of componentOrder){const n=plan.owned[id]||0,arr=plan.lootHistory.loose[id]||=[];while(arr.length<n)arr.push('other');if(arr.length>n)arr.length=n;}
      return plan.lootHistory;
    },
    gain(plan,id,source='loot') {
      if((plan.owned[id]||0)>=99)return;
      const h=this.ensure(plan);if(!componentOrder.slice(0,8).includes(id))source='other';
      h.loose[id].push(source);if(source==='loot')h.counts[id]=(h.counts[id]||0)+1;
      plan.owned[id]=(plan.owned[id]||0)+1;
    },
    remove(plan,id) {
      if(!(plan.owned[id]>0))return;
      const h=this.ensure(plan),source=h.loose[id].pop();
      if(source==='loot')h.counts[id]=Math.max(0,(h.counts[id]||0)-1);
      plan.owned[id]--;
    },
    take(plan,id) {return this.ensure(plan).loose[id].shift()||'other';},
    compare(plan,x,y) {
      const h=plan.lootHistory;if(!h?.complete||plan.lootTieBreak===false||!componentOrder.slice(0,8).includes(x)||!componentOrder.slice(0,8).includes(y))return 0;
      // More prior natural drops => prefer taking this equally urgent component
      // now. No percentages, stage refill assumptions, or promised future drops.
      return (h.counts[y]||0)-(h.counts[x]||0);
    }
  };
};
