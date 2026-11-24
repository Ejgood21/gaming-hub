'use strict';

const minimumSamples = 100;

module.exports = function createEmblemExplorer({Academy, academyTier}) {
  const guideOrder = (a,b) => academyTier(a.tier).rank-academyTier(b.tier).rank || a.title.localeCompare(b.title);
  return {
    minimumSamples,
    catalog() {
      return Academy.snapshot.items.filter(item=>item.type==='emblems' && Academy.itemMap.has(item.apiName))
        .sort((a,b)=>a.name.localeCompare(b.name));
    },
    academyRoutes(emblem) {
      if (!Academy.isCurrent()) return [];
      const emblems = new Set(this.catalog().map(item=>item.apiName));
      const names = new Map(Academy.snapshot.champions.map(unit=>[unit.apiName, unit.name]));
      return Academy.snapshot.guides.flatMap(guide=>{
        const holders = Academy.emblemHolders(guide, emblem, emblems)
          .map(holder=>({...holder, name:names.get(holder.apiName) || holder.apiName}));
        if (!holders.length) return [];
        return [{guide, holders, primary:holders.some(holder=>holder.use!=='flex')}];
      }).sort((a,b)=>academyTier(a.guide.tier).rank-academyTier(b.guide.tier).rank ||
        Number(b.primary)-Number(a.primary) || a.guide.title.localeCompare(b.guide.title));
    },
    metaHolders(emblem, data) {
      if (!Academy.isCurrent() || data.patch!==Academy.snapshot.patch) return [];
      const champions = new Map(Academy.snapshot.champions.map(unit=>[unit.apiName, unit.name]));
      const guides = Academy.snapshot.guides.slice().sort(guideOrder);
      const holders = new Map();
      for (const row of data.rows) {
        // The API filters games containing the emblem. Other equipped items in
        // those games also appear, so require an exact unit and emblem pair.
        if (typeof row?.unit_items!=='string') continue;
        const [id, item, extra] = row.unit_items.split('&');
        const name = champions.get(id), counts = row.placement_count;
        if (!name || item!==emblem || extra!==undefined || !Array.isArray(counts) ||
            counts.length!==8 || counts.some(count=>!Number.isSafeInteger(count) || count<0)) continue;
        const samples = counts.reduce((sum,count)=>sum+count, 0);
        if (samples<minimumSamples || (holders.get(id)?.samples || 0)>=samples) continue;
        const avg = counts.reduce((sum,count,place)=>sum+count*(place+1), 0)/samples;
        const comps = guides.filter(guide=>guide.finalComp.some(unit=>unit.apiName===id));
        holders.set(id, {id, name, samples, avg, comps});
      }
      return [...holders.values()].sort((a,b)=>a.avg-b.avg || b.samples-a.samples || a.name.localeCompare(b.name));
    }
  };
};
