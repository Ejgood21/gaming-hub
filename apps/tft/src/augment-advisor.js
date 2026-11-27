'use strict';

module.exports = function createAugmentAdvisor({Academy, CompFinder, Tracker, OfflineTracker, DATA}) {
  const stages = ['2-1', '3-2', '4-2'];
  // Reference only. Riot cycled AFK out in 18.1 and Manaflow I out in 15.1.
  const pastAugments = [
    {apiName:'reference:AFK',name:'A.F.K.',description:'You cannot take actions for three rounds. Then gain 17 gold.'},
    {apiName:'reference:Manaflow1',name:'Manaflow I',description:'Units starting combat in the back row gain 2 extra Mana per attack.'}
  ];
  const {augmentFit} = CompFinder;
  const verdictPrefixes = {take:'Take ', decent:'Decent: ', reroll:'Reroll: ', avoid:'Do not take '};
  const verdictPhrases = {
    take:'Fits your comp',
    decent:'Decent for your comp',
    reroll:'Reroll this one',
    avoid:"Doesn't fit your comp"
  };
  const completedTypes = new Set(['craftables','radiants','ornns','emblems']);

  function otherComp(augment, options, target) {
    const ids=options.find(option=>option.ids.includes(augment.apiName))?.ids||[augment.apiName];
    const endorsers=Academy.snapshot.guides.filter(guide=>ids.some(id=>augmentFit.recommendation(guide,id)));
    const titles=[...new Set(endorsers.map(guide=>guide.title).filter(Boolean))];
    if(titles.length!==1||endorsers.some(guide=>(target?.id&&target.id===guide.id)||target?.title===guide.title))return '';
    return titles[0];
  }

  function pluralItemName(name) {
    return name.replace(/(\w+)(?= of |$)/i, '$1s');
  }

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
    references(){
      const {augments,items}=Academy.snapshot;
      const names=new Set((augments||[]).map(a=>Academy.normalizeName(a.name)));
      const emblems=items.filter(item=>item.type==='emblems'&&item.description).map(item=>({
        apiName:'reference:'+item.apiName,name:item.name,description:item.description.trim(),item:item.apiName
      }));
      return [...pastAugments,...emblems].filter(entry=>!names.has(Academy.normalizeName(entry.name)));
    },
    referenceVerdict(entry,plan){
      if(!entry.item)return {verdict:'avoid',verdictLine:'Do not take '+entry.name,
        phrase:'Outside the current augment pool'};
      const guide=Academy.currentGuide(plan);
      const fits=guide?.mainItem?.apiName===entry.item||
        [...(guide?.finalComp||[]),...(guide?.altBuilds||[])].some(unit=>unit.items.includes(entry.item));
      return {verdict:fits?'take':'avoid',verdictLine:(fits?'Take ':'Do not take ')+entry.name,
        phrase:fits?'Emblem fits your comp':guide?'Emblem is outside your plan':'Emblem · choose a comp to check fit'};
    },
    searchNotice(query){
      const term=Academy.normalizeName(query);
      if(!term)return 'Type an augment name to search.';
      const matches=(Academy.snapshot.augments||[]).some(a=>Academy.normalizeName(a.name).includes(term));
      return matches?'No remaining matches for this offer.':'Limited evidence · No TFT Academy entry matches this name.';
    },
    context(plan){
      const guide=Academy.currentGuide(plan),ranked=CompFinder.ranked(plan);
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
      const options=CompFinder.augmentOptions(stages[round]);
      const selected=ctx.guide||plan.activeComp?.guide||plan.activeComp;
      const rows=offers.ids.flatMap((id,slot)=>{
        const augment=CompFinder.augment(id);
        if(!augment)return [];
        const onlyComp=otherComp(augment,options,selected||ctx.fitGuide);
        return [{...this.evaluate(augment,ctx,round),slot,onlyComp,otherSelectedComp:!!(selected&&onlyComp)}];
      });
      const valid=rows.filter(r=>!r.invalid&&!r.offRound).sort((a,b)=>
        Number(!!b.academy)-Number(!!a.academy)||b.score-a.score||a.slot-b.slot);
      const allEntered=offers.ids.every(Boolean)&&rows.length===offers.ids.length;
      const best=valid.find(row=>!row.otherSelectedComp),rerolls=[];
      let action='enter',message='Enter your three offers';
      if(best?.academy){
        action='take';
      }else if(allEntered&&valid.length){
        if(best&&valid.length===rows.length){
          const alternatives=this.available(plan,offers).filter(a=>this.eligible(a,round))
            .map(a=>this.evaluate(a,ctx,round)).filter(r=>r.academy);
          for(const row of valid.filter(r=>!r.contextual&&!r.otherSelectedComp)){
            const example=alternatives.find(r=>r.augment.tier===row.augment.tier);
            if(example)rerolls.push({slot:row.slot,reason:`No Academy match or item, economy or combat fit. Same-rarity Academy match in the catalog: ${example.augment.name}.`});
          }
        }
        if(rerolls.length){
          action='reroll';
          const names=rerolls.map(r=>rows.find(row=>row.slot===r.slot).augment.name);
          message=names.length===1?`Reroll ${names[0]} if available`:'Reroll a blue offer if available';
        }else if(best?.contextual&&best.score>0){
          action='lean';
        }else{
          action='unknown';
          message=rows.some(r=>r.offRound)?'Check the round on the marked offer':'No clear pick';
        }
      }else if(rows.length||offers.awaiting?.some(Boolean)){
        action='partial';
        message=offers.awaiting?.some(Boolean)?'Enter the replacement offer':
          rows.some(r=>r.offRound)?'Check the round on the marked offer':'Enter all three offers to compare';
      }
      for(const row of rows){
        const top=row===best&&(action==='take'||action==='lean');
        row.verdict=row.invalid||row.offRound||row.otherSelectedComp?'avoid':
          top?'take':
          rerolls.some(r=>r.slot===row.slot)?'reroll':
          row.academy||row.contextual?'decent':'avoid';
        row.verdictLine=verdictPrefixes[row.verdict]+row.augment.name;
        row.phrase=row.offRound?`Wrong round — Academy lists it for ${row.augment.stages.join(' and ')}`:
          row.invalid?'Already taken':
          row.onlyComp?`Only fits ${row.onlyComp}`:verdictPhrases[row.verdict];
      }
      if(action==='take'||action==='lean')message=best.verdictLine;
      const academyNotice=ctx.fitGuide&&!augmentFit.hasRecommendations(ctx.fitGuide) ?
        `Academy lists no recommended augment for this comp (${ctx.fitGuide.title}). Fit uses item, economy and combat rules.` : '';
      return {rows,best,action,message,rerolls,round,academyNotice};
    },
    itemGrants(augment){
      const catalog=Academy.snapshot.items.filter(item=>completedTypes.has(item.type)&&Academy.itemMap.has(item.apiName));
      return (augment?.description||'').split(/\bgain\s+/i).slice(1).flatMap(clause=>{
        const [rewards]=clause.split(/[.!?](?=\s|$)|[;\n]/,1);
        if(/\bor\b/i.test(rewards))return [];
        return rewards.split(/\s*,\s*|\s+and\s+/i).flatMap(reward=>{
          const grant=/^(?:an?|([1-9]\d?))\s+(.+)$/i.exec(reward.replace(/^and\s+/i,'').trim());
          if(!grant)return [];
          const count=Number(grant[1]||1);
          const name=Academy.normalizeName(grant[2].replace(/(?:\s+item)?(?:\s+now)?$/i,''));
          const item=catalog.find(item=>Academy.normalizeName(item.name)===name||
            count>1&&Academy.normalizeName(pluralItemName(item.name))===name);
          return item?[{id:Academy.itemMap.get(item.apiName),name:item.name,count}]:[];
        });
      });
    },
    record(plan,slot){
      const offers=this.ensure(plan),id=offers.ids[slot],a=CompFinder.augment(id);
      if(!a||this.held(plan).includes(id))return false;
      for(const grant of this.itemGrants(a)){
        for(let copy=0;copy<grant.count;copy++){
          let row=plan.queue.find(q=>!q.done&&q.item===grant.id&&Academy.canEquip(plan,q.champion,grant.id));
          if(!row){
            row={uid:crypto.randomUUID(),item:grant.id,champion:''};
            plan.queue.push(row);
          }
          OfflineTracker.receive(plan,row);
        }
      }
      const selected=this.slots(plan);selected[offers.round]=id;plan.chosenAugments=selected;plan.firstAugment=selected[0];
      plan.augmentOffers=this.newOffers(Math.min(2,offers.round+1));return true;
    }
  };
};
