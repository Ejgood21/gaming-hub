'use strict';

module.exports = function createQueueOrder({Academy}) {
  /* Recommended positions belong to item copies; drag only changes presentation order. */
  return {
    ensure(plan){
      // One-time upgrade: recover Academy's order for older files that did not
      // store recommended positions. Preserve every current target, including pivots.
      if(plan.queue.length&&!plan.queue.some(q=>Number.isFinite(q.recommendedOrder))){
        const guide=Academy.guide(plan),entries=guide?Academy.build(guide).entries.map((e,rank)=>({...e,rank})):[];
        if(entries.length){
          const remaining=[...entries],unmatched=[];
          const same=(a,b)=>Academy.normalizeName(a||'')===Academy.normalizeName(b||'');
          for(const q of [...plan.queue.filter(q=>q.done),...plan.queue.filter(q=>!q.done)]){
            const at=remaining.findIndex(e=>same(e.champion,q.champion)&&Academy.itemMatches(e.item,q.academyItem||q.item));
            if(at>=0)q.recommendedOrder=remaining.splice(at,1)[0].rank;else unmatched.push(q);
          }
          let tail=entries.length;
          for(const q of unmatched){const at=q.champion?remaining.findIndex(e=>same(e.champion,q.champion)):-1;q.recommendedOrder=at>=0?remaining.splice(at,1)[0].rank:tail++;}
        }
      }
      let next=plan.queue.reduce((n,q)=>Number.isFinite(q.recommendedOrder)?Math.max(n,q.recommendedOrder+1):n,0);
      for(const q of plan.queue)if(!Number.isFinite(q.recommendedOrder))q.recommendedOrder=next++;
    },
    pending(plan){return plan.queue.filter(q=>!q.done);},
    recommended(plan){this.ensure(plan);return this.pending(plan).slice().sort((a,b)=>a.recommendedOrder-b.recommendedOrder);},
    apply(plan,ids){
      const pending=this.pending(plan),byUid=new Map(pending.map(q=>[q.uid,q]));
      if(ids.length!==pending.length||new Set(ids).size!==pending.length||ids.some(id=>!byUid.has(id)))return false;
      if(pending.every((q,n)=>q.uid===ids[n]))return false;
      let n=0;plan.queue=plan.queue.map(q=>q.done?q:byUid.get(ids[n++]));return true;
    },
    reset(plan){return this.apply(plan,this.recommended(plan).map(q=>q.uid));},
    inherit(plan,previous,replacements){
      this.ensure(plan);
      const slots=previous.map(q=>q.recommendedOrder).sort((a,b)=>a-b);
      const tail=plan.queue.reduce((n,q)=>Math.max(n,q.recommendedOrder+1),0);
      replacements.forEach((q,n)=>q.recommendedOrder=slots[n]??tail+n);
    }
  };
};
