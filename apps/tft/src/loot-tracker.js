'use strict';

module.exports = function createLootTracker({componentOrder}) {
  const basicComponents=componentOrder.slice(0,8);
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
      const h=this.ensure(plan);if(!basicComponents.includes(id))source='other';
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
    scarcity(plan,id) {
      const history=plan.lootHistory;
      if(history?.complete!==true||!basicComponents.includes(id))return 0;
      // Historical item bags suggest that components drawn more often may be
      // less likely to arrive from orbs. Cap this heuristic for the current set.
      return Math.min(2,history.counts[id]||0);
    }
  };
};
