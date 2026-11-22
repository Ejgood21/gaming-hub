'use strict';

const {decodeMetaSnapshot} = require('./snapshots');

module.exports = function createMetaBuilds({DATA, byId, Academy, OfflineTracker, PivotPlanner, meta}) {
  const cache=new Map();
  const freshness=15*60000;
  const key=entry=>JSON.stringify([entry.unit,entry.set,entry.patch]);
  const remember=(entry,source)=>{
    const id=key(entry),prior=cache.get(id);
    if(!prior||source==='live'||entry.updated>=prior.entry.updated)cache.set(id,{entry,source});
  };
  for(const entry of decodeMetaSnapshot(meta).units)remember(entry,'bundled');

  /* Champion build rankings from MetaTFT's public unit statistics.
     Snapshot filters: current patch, ranked, Platinum+, last 3 days, three equipped items.
     Confidence, frequency and tier normalization follow the unit page's model. */
  return {
    freshness,
    compact(overall, detail, verifiedPatch) {
      if(!overall||!detail||overall.unit!==detail.unit||overall.tft_set!==detail.tft_set||!Array.isArray(overall.levels)||!Array.isArray(detail.builds)||!Array.isArray(detail.items))throw Error('Unrecognized MetaTFT data');
      const sum=a=>a.reduce((s,n)=>s+n,0), total=p=>sum(p.map((n,i)=>n*(i+1)));
      const levels=overall.levels.filter(r=>Number(r.lvl_items[0])<=4&&Number(r.lvl_items[1])===3);
      const count=sum(levels.map(r=>sum(r.places))), mean=sum(levels.map(r=>total(r.places)))/count;
      const popular=Math.max(...detail.items.map(r=>sum(r.places)));
      if(!count||!popular||!Number.isFinite(mean))throw Error('Empty MetaTFT data');
      const builds=detail.builds.flatMap(r=>{
        if(!Array.isArray(r.places)||r.places.length!==8||r.places.some(n=>!Number.isFinite(n)||n<0)||typeof r.buildNames!=='string')return [];
        const games=sum(r.places),items=r.buildNames.split('|');
        if(!games||games>=count)return [];
        const avg=total(r.places)/games, variance=sum(r.places.map((n,i)=>n*(i+1-avg)**2))/games;
        const confidenceAvg=avg+1.282*Math.sqrt(variance/games);
        const comparison=(mean*count-avg*games)/(count-games);
        const popularity=Math.min(1,Math.sqrt(games/count/.01))*(items.length/3)**2/(r.buildNames.includes('ThiefsGloves')?30:1);
        const score=(.5-(confidenceAvg-comparison))*.7*popularity*(games/popular)**.1;
        return [{items,games,avg,score}];
      }).sort((a,b)=>b.score-a.score);
      const third=builds[Math.min(2,builds.length-1)]?.score;
      const scale=third>0&&third<.35?.35/third:1;
      for(const b of builds){b.score*=scale;b.tier=b.score>=.35?'S':b.score>=.25?'A':b.score>=.15?'B':b.score>=.05?'C':'D';b.score=+b.score.toFixed(5);b.avg=+b.avg.toFixed(3);}
      return {unit:detail.unit,set:detail.tft_set,patch:verifiedPatch||String(detail.build_games?.[0]?.patch||''),rankFilter:detail.filter_adjustment?.rank_filter||'ALL',updated:Math.min(Number(overall.updated)||0,Number(detail.updated)||0),builds:builds.filter(b=>b.items.length===3&&b.games>=30)};
    },
    isCurrentSet(data){return data?.set==='TFTSet'+Academy.snapshot.set;},
    isCompatible(data){
      return Academy.isCurrent()&&this.isCurrentSet(data)&&!!data.patch&&data.patch===Academy.snapshot.patch&&
        (!Academy.requireLive||data.revision===Academy.revision&&Date.now()-data.fetchedAt<freshness);
    },
    cache(entry,source){
      if(typeof entry?.unit!=='string'||typeof entry.set!=='string'||typeof entry.patch!=='string'||
          !Number.isFinite(entry.updated)||!Array.isArray(entry.builds)||!entry.builds.every(b=>
            Array.isArray(b.items)&&b.items.length===3&&b.items.every(i=>typeof i==='string')&&
            Number.isFinite(b.score)&&Number.isFinite(b.avg)&&Number.isFinite(b.games)&&/^[SABCD]$/.test(b.tier)))return;
      const revision=source==='live'?Academy.revision:undefined;
      remember({...entry,revision},source);
    },
    cached(){return [...cache.values()].filter(r=>r.source!=='bundled'&&this.isCurrentSet(r.entry)).map(r=>r.entry);},
    invalidate(unit){
      const entry=cache.get(key({unit,set:'TFTSet'+Academy.snapshot.set,patch:Academy.snapshot.patch}));
      if(entry?.source==='live'){
        entry.entry={...entry.entry,revision:undefined};
        entry.source='saved';
      }
    },
    find(champion,allowStale=false){
      const unit=this.champion(champion)?.apiName;
      const set='TFTSet'+Academy.snapshot.set,patch=Academy.snapshot.patch;
      const matching=cache.get(key({unit,set,patch}));
      if(this.isCompatible(matching?.entry))return matching;
      if(!allowStale)return;
      return [...cache.values()].filter(r=>r.entry.unit===unit&&this.isCurrentSet(r.entry))
        .sort((a,b)=>b.entry.updated-a.entry.updated)[0];
    },
    dataFor({champion}){return this.find(champion)?.entry;},
    referenceBuilds(name,data=this.find(name,true)?.entry){
      if(!this.isCurrentSet(data)||data.unit!==this.champion(name)?.apiName)return [];
      const seen=new Set();
      return data.builds.filter(b=>['S','A'].includes(b.tier))
        .sort((a,b)=>'SA'.indexOf(a.tier)-'SA'.indexOf(b.tier)||b.score-a.score||b.games-a.games)
        .flatMap(b=>{
          const ids=b.items.map(id=>Academy.itemMap.get(id));
          if(ids.some(id=>!byId[id]))return [];
          const signature=[...ids].sort().join('|');
          if(seen.has(signature))return [];
          seen.add(signature);
          return [{...b,ids,stalePatch:!this.isCompatible(data)}];
        });
    },
    champion(name){return name&&Academy.snapshot.champions.find(c=>Academy.normalizeName(c.name)===Academy.normalizeName(name));},
    equipment(plan){return Academy.equipment(plan);},
    fits(build,items){const remaining=[...build];for(const id of items){const at=remaining.indexOf(id);if(at<0)return false;remaining.splice(at,1);}return true;},
    ranked(plan,uid,snapshot,{craftableOnly=false,strongOnly=false}={}){
      const target=plan.queue.find(q=>q.uid===uid&&!q.done),original=target&&byId[target.item];
      const unit=target&&this.champion(target.champion||'');
      if(!original||original.special||original.academyOnly||!unit||snapshot?.unit!==unit.apiName||!this.isCompatible(snapshot))return [];
      const same=(a,b)=>Academy.normalizeName(a)===Academy.normalizeName(b),holders=this.equipment(plan);
      // Only equipped/completed items are commitments. Pending targets are plans,
      // never fabricated equipment and never a reason to fall back to role tags.
      const equipped=plan.queue.filter(q=>q.done&&same(holders.get(q.uid),target.champion)).map(q=>q.item);
      const planned=plan.queue.filter(q=>!q.done&&q.uid!==uid&&same(q.champion,target.champion)).map(q=>q.item);
      if(equipped.reduce((slots,id)=>slots+Academy.slotCost(id),0)>=3)return [];
      const count=(list,id)=>list.filter(x=>x===id).length;
      const candidates=DATA.items.filter(i=>!i.academyOnly&&i.id!==original.id&&i.recipe.length===2&&(!craftableOnly||OfflineTracker.canCraft(plan.owned,i)));
      const best=new Map();
      for(const build of snapshot.builds){
        if(strongOnly&&(!['S','A'].includes(build.tier)||build.games<100))continue;
        const mapped=build.items.map(id=>Academy.itemMap.get(id));
        if(mapped.some(id=>!id)||mapped.reduce((slots,id)=>slots+Academy.slotCost(id),0)>3||!this.fits(mapped,equipped))continue;
        // A replacement build must actually replace this copy of the target.
        if(count(mapped,original.id)>count([...equipped,...planned],original.id))continue;
        // Do not recommend a route whose strength depends on an unowned artifact,
        // radiant item or other item that cannot be crafted from components.
        if(mapped.some(id=>byId[id].recipe.length!==2&&count(mapped,id)>count(equipped,id)))continue;
        for(const item of candidates){
          if(!this.fits(mapped,[...equipped,item.id]))continue;
          // Don't duplicate a future target unless the ranked build supports it.
          if(count(mapped,item.id)<count([...equipped,...planned],item.id)+1)continue;
          const remaining=[...mapped];for(const id of [...equipped,item.id])remaining.splice(remaining.indexOf(id),1);
          let plannedMatches=0;for(const id of planned){const at=remaining.indexOf(id);if(at>=0){plannedMatches++;remaining.splice(at,1);}}
          const choice={item,source:'meta',tier:build.tier,score:build.score,games:build.games,build:mapped,equipped,plannedMatches,updated:snapshot.updated,rankFilter:snapshot.rankFilter,unit:unit.apiName};
          const prior=best.get(item.id);if(!prior||this.compare(choice,prior)<0)best.set(item.id,choice);
        }
      }
      return [...best.values()].sort((a,b)=>this.compare(a,b));
    },
    compare(a,b){const tier={S:0,A:1,B:2,C:3,D:4};return tier[a.tier]-tier[b.tier]||b.score-a.score||b.plannedMatches-a.plannedMatches||b.games-a.games||a.item.name.localeCompare(b.item.name);},
    suggest(plan,uid,snapshot){
      const target=plan.queue.find(q=>q.uid===uid&&!q.done),original=target&&byId[target.item];
      if(!original||original.special||original.academyOnly||OfflineTracker.canCraft(plan.owned,original))return null;
      if(target.champion){
        // No generic fallback for a named champion, including offline/no-match.
        return this.ranked(plan,uid,snapshot,{craftableOnly:true,strongOnly:true})[0]||null;
      }
      const roles=PivotPlanner.profile(original.id).filter(r=>r!=='flex');
      const candidates=PivotPlanner.suggest(plan,uid,DATA.items,{role:'all'}).filter(r=>!r.item.academyOnly&&OfflineTracker.canCraft(plan.owned,r.item)&&PivotPlanner.profile(r.item.id).some(role=>roles.includes(role)));
      return candidates.length?{item:candidates[0].item,source:'similar'}:null;
    }
  };
};
