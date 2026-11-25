'use strict';

module.exports = function createAugmentAdvisor({Academy, CompFinder, Tracker, DATA}) {
  const stages = ['2-1', '3-2', '4-2'];
  const {augmentFit} = CompFinder;

  return {
    stages,
    held(plan){return CompFinder.heldAugments(plan);},
    slots(plan){return [plan.firstAugment||plan.chosenAugments?.[0]||'',plan.chosenAugments?.[1]||'',plan.chosenAugments?.[2]||''];},
    newOffers(round){return {round,ids:['','',''],seen:[],awaiting:[false,false,false]};},
    ensure(plan){
      if(!plan.augmentOffers||!Array.isArray(plan.augmentOffers.ids))plan.augmentOffers=this.newOffers(Math.max(0,this.slots(plan).findIndex(id=>!id)));
      return plan.augmentOffers;
    },
    available(plan,offers=this.ensure(plan)){
      const excluded=new Set([...offers.ids,...(offers.seen||[]),...this.held(plan)]);
      return CompFinder.augmentOptions(stages[offers.round]).filter(a=>!a.ids.some(id=>excluded.has(id)));
    },
    replace(plan,slot){
      const offers=this.ensure(plan),id=offers.ids[slot];
      if(!id)return false;
      offers.seen=[...new Set([...(offers.seen||[]),id])].slice(-60);
      offers.ids[slot]='';
      offers.awaiting||=[false,false,false];
      offers.awaiting[slot]=true;
      return true;
    },
    enter(plan,slot,id){
      const offers=this.ensure(plan);
      if(!Number.isInteger(slot)||slot<0||slot>=offers.ids.length||!this.available(plan,offers).some(a=>a.ids.includes(id)))return false;
      offers.ids[slot]=id;
      if(offers.awaiting)offers.awaiting[slot]=false;
      return true;
    },
    eligible(augment,round){return !augment.stages?.length||augment.stages.includes(stages[round]);},
    catalog(plan,round){
      const held=this.held(plan);
      return CompFinder.augmentOptions(stages[round]).filter(a=>this.eligible(a,round)&&!a.ids.some(id=>held.includes(id)));
    },
    roundNotice(augment,round){
      return `${augment.name} is listed by Academy for ${augment.stages.join(' and ')}, not ${stages[round]}.`;
    },
    searchNotice(query){
      const term=Academy.normalizeName(query);
      if(!term)return 'Type an augment name to search.';
      const matches=(Academy.snapshot.augments||[]).some(a=>Academy.normalizeName(a.name).includes(term));
      return matches?'No remaining matches for this offer.':'Limited evidence · No TFT Academy entry matches this name.';
    },
    context(plan){
      const guide=Academy.currentGuide(plan),ranked=CompFinder.ranked(plan,{allowSparse:true});
      const routes=ranked.filter(r=>!r.blocked).slice(0,8);
      const primary=guide?ranked.find(r=>r.guide.id===guide.id):routes[0];
      const targets=guide&&plan.queue.length?plan.queue.filter(q=>!q.done):primary?.remaining||[];
      const placed=guide?plan.queue.filter(q=>q.done).map(q=>q.item):primary?.placements.map(p=>p.item)||[];
      const fitGuide=guide||primary?.guide;
      return {guide,fitGuide,routes,ranked,held:this.held(plan),urgent:plan.tempo==='urgent',
        fit:augmentFit.context(plan,fitGuide,targets,placed),
        needs:Tracker.allocate(plan,DATA.items).needs};
    },
    evaluate(augment,ctx,round){
      const {guide,fitGuide,routes,ranked,held,urgent,fit,needs}=ctx;
      if(held.includes(augment.apiName))return {augment,reasons:[{text:'Already selected'}],invalid:true};
      if(!this.eligible(augment,round))return {
        augment,reasons:[{text:this.roundNotice(augment,round)}],offRound:true,
        rounds:augment.stages.map(stage=>stages.indexOf(stage)).filter(index=>index>=0)
      };

      const {apiName:id,description:text}=augment;
      const endorses=g=>augmentFit.recommendation(g,id);
      const route=guide?null:routes.find(row=>endorses(row.guide))||
        ranked.find(row=>row.missingAugment===id&&!row.missingEmblems.length&&endorses(row.guide));
      const match=augmentFit.score(augment,route?.guide||fitGuide,fit);
      const reasons=[{text:match.academy ?
        `${match.text} for ${route?.guide.title||fitGuide.title}` :
        match.points?`Rules-based fit · ${match.text}${match.detail?' · '+match.detail:''}`:match.text}];
      let score=match.points;
      if(urgent&&/after (?:\d+|every)|next \d+ rounds|every \d+ player|hatches in/i.test(text)&&!/\bnow\b/i.test(text)){
        score-=3;reasons.push({text:'Delayed payoff while you need strength now'});
      }
      if(/cannot choose your carousel/i.test(text)&&Object.values(needs).some(n=>n.count>0)){
        score-=3;reasons.push({text:'Gives up choosing the carousel components you need'});
      }
      const prior=held.map(id=>CompFinder.augment(id)?.description||'').join(' ');
      if(/omnivamp/i.test(text)&&/omnivamp/i.test(prior)){
        score-=1;reasons.push({text:'Already have an Omnivamp augment'});
      }
      return {augment,score,academy:match.academy,contextual:!match.academy&&match.points>0,reasons};
    },
    compare(plan,offers=this.ensure(plan)){
      const ctx=this.context(plan),round=offers.round;
      const rows=offers.ids.flatMap((id,slot)=>{
        const augment=CompFinder.augment(id);
        return augment?[{...this.evaluate(augment,ctx,round),slot}]:[];
      });
      const valid=rows.filter(r=>!r.invalid&&!r.offRound).sort((a,b)=>
        Number(!!b.academy)-Number(!!a.academy)||b.score-a.score||a.slot-b.slot);
      const complete=offers.ids.every(Boolean)&&valid.length===3;
      const best=valid[0],rerolls=[];
      let action='enter',message='Enter your three offers';
      if(best?.academy){
        action='take';
        message=`Take ${best.augment.name}`;
      }else if(complete){
        const alternatives=this.available(plan,offers).filter(a=>this.eligible(a,round))
          .map(a=>this.evaluate(a,ctx,round)).filter(r=>r.academy);
        for(const row of valid.filter(r=>!r.contextual)){
          const example=alternatives.find(r=>r.augment.tier===row.augment.tier);
          if(example)rerolls.push({slot:row.slot,reason:`No Academy match or item, economy or combat fit. Same-rarity Academy match in the catalog: ${example.augment.name}.`});
        }
        if(rerolls.length){
          action='reroll';
          const names=rerolls.map(r=>rows.find(row=>row.slot===r.slot).augment.name);
          message=names.length===1?`Reroll ${names[0]} if available`:'Reroll a blue offer if available';
        }else if(best.contextual&&best.score>0){
          action='lean';
          message=`Take ${best.augment.name}`;
        }else{
          action='unknown';
          message='No clear pick';
        }
      }else if(rows.length||offers.awaiting?.some(Boolean)){
        action='partial';
        message=offers.awaiting?.some(Boolean)?'Enter the replacement offer':
          rows.some(r=>r.offRound)?'Check the round on the marked offer':'Enter all three offers to compare';
      }
      for(const row of rows){
        const top=row===best&&(action==='take'||action==='lean');
        [row.verdict,row.label]=row.invalid||row.offRound?['avoid','Check offer']:
          top?['take','Take this']:
          rerolls.some(r=>r.slot===row.slot)?['reroll','Reroll if available']:
          row.academy?['decent','Academy match']:
          row.contextual?['decent','Contextual fit']:['avoid','Limited evidence'];
      }
      const academyNotice=ctx.fitGuide&&!augmentFit.hasRecommendations(ctx.fitGuide) ?
        `Academy lists no recommended augment for this comp (${ctx.fitGuide.title}). Fit uses item, economy and combat rules.` : '';
      return {rows,best,action,message,rerolls,round,academyNotice};
    },
    record(plan,slot){
      const offers=this.ensure(plan),id=offers.ids[slot],a=CompFinder.augment(id);
      if(!a||this.held(plan).includes(id))return false;
      const selected=this.slots(plan);selected[offers.round]=id;plan.chosenAugments=selected;plan.firstAugment=selected[0];
      plan.augmentOffers=this.newOffers(Math.min(2,offers.round+1));return true;
    }
  };
};
