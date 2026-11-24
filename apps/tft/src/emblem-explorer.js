'use strict';

const minimumSamples = 100;

module.exports = function createEmblemExplorer({Academy, academyTier}) {
  const guideOrder = (a,b) => academyTier(a.tier).rank-academyTier(b.tier).rank || a.title.localeCompare(b.title);
  const holderOrder = ['final', 'alternate', 'flex'];
  return {
    minimumSamples,
    catalog() {
      const groups = new Map();
      const emblems = Academy.snapshot.items.filter(item=>item.type==='emblems' && Academy.itemMap.has(item.apiName))
        .sort((a,b)=>a.name.localeCompare(b.name) || a.apiName.localeCompare(b.apiName));
      for (const item of emblems) {
        // The augment version of Flora Fatalis grants the same trait.
        const id = item.trait || item.apiName;
        if (!groups.has(id)) groups.set(id, {...item, apiNames:new Set()});
        groups.get(id).apiNames.add(item.apiName);
      }
      return [...groups.values()];
    },
    academyRoutes(emblem) {
      if (!Academy.isCurrent()) return [];
      const catalog = this.catalog();
      const aliases = catalog.find(item=>item.apiNames.has(emblem))?.apiNames || new Set([emblem]);
      const otherEmblems = new Set(catalog.flatMap(item=>[...item.apiNames]).filter(id=>!aliases.has(id)));
      const names = new Map(Academy.snapshot.champions.map(unit=>[unit.apiName, unit.name]));
      return Academy.snapshot.guides.flatMap(guide=>{
        const byUnit = new Map();
        for (const alias of aliases) {
          for (const holder of Academy.emblemHolders(guide, alias, otherEmblems)) {
            const prior = byUnit.get(holder.apiName);
            if (!prior || holderOrder.indexOf(holder.use)<holderOrder.indexOf(prior.use)) {
              byUnit.set(holder.apiName, holder);
            }
          }
        }
        const holders = [...byUnit.values()].map(holder=>({...holder, name:names.get(holder.apiName) || holder.apiName}));
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
