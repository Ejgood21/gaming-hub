'use strict';

module.exports = function createTracker({LootTracker}) {
  return {
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
      return {rows, needs, remaining};
    },
    complete(state, q, item) {
      q.used = {}; q.usedSources={}; q.received = false;
      for (const id of item.recipe) if ((state.owned[id] || 0) > 0) { (q.usedSources[id]||=[]).push(LootTracker.take(state,id)); state.owned[id]--; q.used[id] = (q.used[id] || 0) + 1; }
      q.done = true;
    },
    restore(state, q) {
      const h=LootTracker.ensure(state);
      for (const [id, n] of Object.entries(q.used || {})) {for(let k=0;k<n;k++)h.loose[id].push(q.usedSources?.[id]?.[k]||'other');state.owned[id] = (state.owned[id] || 0) + n;}
      q.done = false; q.used = {}; q.usedSources={}; q.received = false;
    }
  };
};
