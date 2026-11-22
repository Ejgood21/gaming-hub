'use strict';

module.exports = function createQuickImport({Academy, academyTier}) {
  return {
    choose(text) {
      const result=Academy.match(text);
      if(!result.exact)throw new Error('No exact TFT Academy comp matches this code. Your current queue is unchanged.');
      const candidates=[...result.matches].sort((a,b)=>academyTier(a.guide.tier).rank-academyTier(b.guide.tier).rank||String(b.guide.updated).localeCompare(String(a.guide.updated))||a.guide.title.localeCompare(b.guide.title));
      const guide=candidates[0].guide,plan=Academy.build(guide);
      if(plan.missing.length)throw new Error('Some items in this guide are not recognized yet. Your current queue is unchanged.');
      if(!plan.entries.length)throw new Error('This guide has no recommended items. Your current queue is unchanged.');
      return {guide,entries:plan.entries,priorities:plan.priorities,variants:candidates.length};
    },
    replace(plan,choice,code) {
      const completed=plan.queue.filter(q=>q.done),available=[...completed];
      const holders=Academy.equipment({...plan,activeComp:{id:choice.guide.id}});
      const pending=[];let covered=0;
      for(const entry of choice.entries){
        const at=available.findIndex(q=>Academy.itemMatches(entry.item,q.item)&&holders.get(q.uid)===entry.champion);
        if(at>=0){available.splice(at,1);covered++;}
        else pending.push({...entry,academyItem:entry.item,planSource:'academy',uid:crypto.randomUUID(),recommendedOrder:pending.length,done:false,used:{}});
      }
      // Preserve physical inventory exactly, including completed items no longer
      // recommended by the new comp. Each owned copy covers only one target.
      plan.queue=[...completed,...pending];plan.pivotIntents={};
      plan.activeComp={guide:Academy.cleanGuide(choice.guide),id:choice.guide.id,title:choice.guide.title,code,itemPriority:choice.priorities||Academy.priorities(choice.guide)};
      return {pending:pending.length,covered};
    }
  };
};
