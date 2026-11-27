'use strict';

module.exports = function createTracker({LootTracker}) {
  const recipeCounts=item=>item.recipe.reduce((counts,id)=>(counts[id]=(counts[id]||0)+1,counts),{});
  const canCraft=(owned,item)=>item.recipe.length===2&&
    Object.entries(recipeCounts(item)).every(([id,count])=>(owned[id]||0)>=count);
  return {
    recipeCounts,
    canCraft,
    allocate(state, items) {
      const remaining = {...state.owned};
      const needs = {};
      const rows = state.queue.filter(q => !q.done).map((q, rank) => {
        const item = items.find(i => i.id === q.item);
        const slots = item.recipe.map(id => {
          const have = (remaining[id] || 0) > 0;
          if (have) remaining[id]--;
          else { needs[id] ||= {count:0, rank, items:[]}; needs[id].count++; if (!needs[id].items.includes(item.name)) needs[id].items.push(item.name); }
          return {id, have};
        });
        return {...q, rank, slots};
      });
      const next = rows.find(row => row.slots.some(slot => !slot.have)) || rows[0];
      return {rows, needs, remaining, next};
    },
    complete(state, q, item) {
      if(q.done||!canCraft(state.owned,item))return false;
      q.used = {}; q.usedSources={}; q.received = false;
      for (const id of item.recipe) { (q.usedSources[id]||=[]).push(LootTracker.take(state,id)); state.owned[id]--; q.used[id] = (q.used[id] || 0) + 1; }
      q.done = true;
      return true;
    },
    restore(state, q) {
      const h=LootTracker.ensure(state);
      for (const [id, n] of Object.entries(q.used || {})) {for(let k=0;k<n;k++)h.loose[id].push(q.usedSources?.[id]?.[k]||'other');state.owned[id] = (state.owned[id] || 0) + n;}
      q.done = false; q.used = {}; q.usedSources={}; q.received = false;
    }
  };
};
