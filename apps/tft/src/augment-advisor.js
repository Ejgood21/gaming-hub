'use strict';

module.exports = function createAugmentAdvisor({Academy, CompFinder, Tracker, DATA}) {
  /* Evidence-led offer comparison. Academy endorsements are the strongest signal.
     Description-based adjustments are explicitly local heuristics. Neither these
     scores nor the candidate catalog represent win rates or a reroll distribution. */
  return {
    stages:['2-1','3-2','4-2'],
    held(plan){return CompFinder.heldAugments(plan);},
    slots(plan){return [plan.firstAugment||plan.chosenAugments?.[0]||'',plan.chosenAugments?.[1]||'',plan.chosenAugments?.[2]||''];},
    ensure(plan){
      if(!plan.augmentOffers||!Array.isArray(plan.augmentOffers.ids))plan.augmentOffers={round:Math.max(0,this.slots(plan).findIndex(id=>!id)),ids:['','',''],seen:[]};
      return plan.augmentOffers;
    },
    eligible(a,round){return !a.stages?.length||a.stages.includes(this.stages[round]);},
    catalog(plan,round){const held=new Set(this.held(plan));return (Academy.snapshot.augments||[]).filter(a=>!held.has(a.apiName)&&this.eligible(a,round)).sort((a,b)=>a.name.localeCompare(b.name));},
    context(plan){
      const guide=Academy.guide(plan),ranked=CompFinder.ranked(plan,{allowSparse:true}),routes=ranked.filter(r=>!r.blocked).slice(0,8);
      const units=CompFinder.units(plan),pending=plan.queue.filter(q=>!q.done),done=plan.queue.filter(q=>q.done),needs=Tracker.allocate(plan,DATA.items).needs;
      return {plan,guide,ranked,routes,units,pending,done,needs,urgent:plan.tempo==='urgent',held:this.held(plan)};
    },
    evaluate(a,ctx,round){
      const {plan,guide,units,pending,done,needs,urgent,held}=ctx,reasons=[],links=[];let score=0,evidence=0,conflict=false;
      const add=(points,text)=>{score+=points;reasons.push({points,text});};
      if(held.includes(a.apiName))return {augment:a,score:-999,evidence:0,reasons:[{text:'Already selected'}],invalid:true};
      if(!this.eligible(a,round))return {augment:a,score:-999,evidence:0,reasons:[{text:'Not listed for this augment round'}],invalid:true};
      const endorses=g=>(g.augments||[]).some(x=>x.apiName===a.apiName)||g.mainAugment?.apiName===a.apiName;
      if(guide&&endorses(guide)){
        add(guide.mainAugment?.apiName===a.apiName?58:42,guide.mainAugment?.apiName===a.apiName?'Academy featured augment for your comp':'Academy recommends this for your comp');evidence=3;
      }else if(!guide){
        // Keep item/board fit dominant. An augment can also open a specifically
        // gated Academy route, without pretending any promised items are owned.
        const options=ctx.ranked.filter(r=>endorses(r.guide)&&(!r.blocked||r.missingAugment===a.apiName&&r.missingEmblems.length===0)).map(r=>({...r,adjusted:r.fitScore+(r.missingAugment===a.apiName?40:0)})).sort((a,b)=>b.adjusted-a.adjusted);
        if(options.length){
          const best=options[0],nearBest=ctx.routes[0]?.fitScore||0,closeness=Math.max(0,1-Math.max(0,nearBest-best.adjusted)/50);
          add(14+closeness*20,'Academy match: '+best.guide.title);evidence=2;links.push(best.guide);
          if(best.keepers.length||best.matched.length||best.specialMatches.length){add(Math.min(9,best.unitScore/6+best.itemScore/12),'That route fits your recorded units or completed items');}
        }
      }
      const text=a.description||'',lower=text.toLowerCase(),normal=Academy.normalizeName(text),style=(guide?.style||ctx.routes[0]?.guide.style||'').toLowerCase();
      // Explicit item names provide a narrow, auditable connection. No inferred
      // inventory grants; an offer and even a chosen augment are not receipts.
      const referenced=DATA.items.filter(i=>i.name.length>5&&normal.includes(Academy.normalizeName(i.name)));
      const ownedRefs=referenced.filter(i=>done.some(q=>Academy.itemMatches(i.id,q.item))),targetRefs=referenced.filter(i=>pending.some(q=>q.item===i.id));
      const reward=/\bgain\b|choose .*items?|item anvil/i.test(text),itemBuff=/grant|always give|permanently gain|holders|your .*gain/i.test(text);
      if(ownedRefs.length&&itemBuff){add(12,'Works with an item you already own');evidence=Math.max(evidence,1);}
      else if(targetRefs.length&&reward){add(9,'Mentions an item in your build queue');evidence=Math.max(evidence,1);}
      const componentAliases={BFSword:['bfsword'],RecurveBow:['recurvebow'],NeedlesslyLargeRod:['needlesslylargerod'],TearOfTheGoddess:['tearofthegoddess'],ChainVest:['chainvest'],NegatronCloak:['negatroncloak'],GiantsBelt:['giantsbelt'],SparringGloves:['sparringgloves']};
      const parts=Object.entries(componentAliases).filter(([id,aliases])=>needs[id]&&aliases.some(n=>normal.includes(n))).map(([id])=>id);
      if(parts.length&&reward){add(Math.min(10,parts.reduce((s,id)=>s+Math.min(3,needs[id].count)*3,0)),'Offers a component your current targets need');evidence=Math.max(evidence,1);}
      const reroll=/reroll/.test(style),leveling=/fast\s*[89]|fast\s*10/.test(style),shop=/shop (?:reroll|refresh)|free reroll/.test(lower),xp=/\bxp\b|level up/.test(lower);
      if(reroll&&shop){add(8,'Shop rerolls support your reroll route');evidence=Math.max(evidence,1);}
      if(leveling&&xp){add(8,'XP supports your leveling route');evidence=Math.max(evidence,1);}
      const unfinishedStars=units.some(u=>u.stars<3&&(guide?.finalComp||[]).some(c=>c.apiName===u.apiName&&c.stars===3));
      if(unfinishedStars&&/duplicator|shop reroll|free reroll/.test(lower)){add(5,'Helps pursue an unfinished star upgrade');evidence=Math.max(evidence,1);}
      const delayed=/after (?:\d+|every)|next \d+ rounds|every \d+ player|hatches in/.test(lower),immediateCombat=/^(?:your team|your units|allies|combat start|when an enemy dies)/i.test(text)&&/damage|attack speed|armor|magic resist|omnivamp|healed|shield|mana/.test(lower);
      if(urgent&&delayed&&!/\bnow\b/.test(lower)){add(-12,'Delayed payoff while you need strength now');conflict=true;evidence=Math.max(evidence,1);}
      if(urgent&&immediateCombat){add(7,'Combat effect supports strength now');evidence=Math.max(evidence,1);}
      // Broad repeated effects are noted, not treated as worthless duplicates.
      const prior=held.map(id=>CompFinder.augment(id)?.description||'').join(' ').toLowerCase();
      if(/omnivamp/.test(lower)&&/omnivamp/.test(prior)){add(-3,'Already have an Omnivamp augment; additional value may be smaller');}
      if(/after losing your combat/.test(lower)&&urgent){add(-8,'Rewards losses rather than immediate board strength');conflict=true;evidence=Math.max(evidence,1);}
      if(/cannot choose your carousel/.test(lower)&&Object.values(needs).reduce((s,n)=>s+n.count,0)>0){add(-8,'Gives up choosing the carousel components you need');conflict=true;evidence=Math.max(evidence,1);}
      if(/permanently transform/.test(lower)&&units.some(u=>u.stars>=2)){add(-10,'Transforms your recorded upgraded units');conflict=true;evidence=Math.max(evidence,1);}
      if(!reasons.length)reasons.push({points:0,text:'No specific match in the available data'});
      reasons.sort((a,b)=>Math.abs(b.points||0)-Math.abs(a.points||0));
      return {augment:a,score,evidence,conflict,reasons,links,items:[...new Set([...ownedRefs,...targetRefs].map(i=>i.id))],components:parts,invalid:false};
    },
    compare(plan,offers=this.ensure(plan)){
      const ctx=this.context(plan),round=offers.round,rows=offers.ids.map((id,slot)=>({a:CompFinder.augment(id),slot})).filter(x=>x.a).map(({a,slot})=>({...this.evaluate(a,ctx,round),slot})).sort((a,b)=>b.score-a.score||a.slot-b.slot);
      const valid=rows.filter(r=>!r.invalid),best=valid[0],seen=new Set([...offers.ids,...offers.seen,...ctx.held]);
      let action='enter',message='Enter your three offered augments.',reroll=null;
      if(best){
        const complete=offers.ids.every(Boolean)&&valid.length===3;
        const alternatives=this.catalog(plan,round).filter(a=>!seen.has(a.apiName)).map(a=>this.evaluate(a,ctx,round));
        // A same-rarity, same-stage fit comparison is not a claim the replacement
        // will appear. Missing annotations alone never justify a reroll.
        const weakest=[...valid].reverse().find(r=>r.evidence>0&&(r.conflict||r.score<20));
        const better=weakest&&alternatives.filter(r=>r.augment.tier===weakest.augment.tier&&r.evidence>=2&&r.score>=best.score+16&&r.score>=32).sort((a,b)=>b.score-a.score)[0];
        if(!complete){action='partial';message='Add all three offers to compare. Current best fit shown below.';}
        else if(best.score>=38&&best.evidence>=2){action='take';message='Take '+best.augment.name+' — strongest supported fit.';}
        else if(better&&weakest){action='reroll';reroll={slot:weakest.slot,example:better};message='Consider rerolling '+weakest.augment.name+' if available. Keep '+best.augment.name+' as your fallback.';}
        else if(best.evidence>0&&best.score>=8){action='lean';message='Lean '+best.augment.name+'. No strong reason to spend a reroll from the available data.';}
        else{action='unknown';message='No clear pick or reroll edge. Missing matches do not mean these augments are bad.';}
      }
      return {rows,best,action,message,reroll,round};
    },
    record(plan,slot){
      const offers=this.ensure(plan),id=offers.ids[slot],a=CompFinder.augment(id);
      if(!a||!this.eligible(a,offers.round)||this.held(plan).includes(id))return false;
      const selected=this.slots(plan);selected[offers.round]=id;plan.chosenAugments=selected;plan.firstAugment=selected[0];
      plan.augmentOffers={round:Math.min(2,offers.round+1),ids:['','',''],seen:[]};return true;
    }
  };
};
