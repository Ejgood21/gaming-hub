'use strict';

const createAugmentFit = require('./augment-fit');
const tierFitGap = 12;

module.exports = function createCompFinder(model) {
  const {Academy, DATA, byId, MetaBuilds, OfflineTracker, componentOrder, academyTier} = model;
  const augmentFit = createAugmentFit(model);
  /* Personal fit is a transparent heuristic, not a performance tier or win rate.
     Academy owns the comp tier, item order and recommended augment lists. */
  return {
    augmentFit,
    tierFitGap,
    heldAugments(plan){return [...new Set([plan.firstAugment||plan.chosenAugments?.[0],...(plan.chosenAugments||[]).slice(1,3)].filter(Boolean))];},
    augmentOptions(round){
      const order = a => a.stages?.includes(round) ? 0 : a.stages?.length ? 1 : 2;
      const displayText = text => text.replace(/\s+/g,' ').trim();
      const variants = new Map();
      for (const augment of Academy.snapshot.augments || []) {
        const key = JSON.stringify([
          displayText(augment.name), augment.tier, displayText(augment.description)
        ]);
        const choices = variants.get(key) || [];
        choices.push(augment);
        variants.set(key, choices);
      }
      return [...variants.values()].map(choices => {
        choices.sort((a,b) => order(a) - order(b));
        return {...choices[0], ids: choices.map(a => a.apiName)};
      }).sort((a,b) => a.name.localeCompare(b.name));
    },
    augments(){return this.augmentOptions('2-1');},
    augment(id){return (Academy.snapshot.augments||[]).find(a=>a.apiName===id);},
    units(plan){
      const byUnit=new Map();for(const u of plan.currentUnits||[]){const c=Academy.snapshot.champions.find(c=>c.apiName===u.apiName);if(!c)continue;const stars=Math.max(1,Math.min(3,Number(u.stars)||1));if(stars>(byUnit.get(u.apiName)?.stars||0))byUnit.set(u.apiName,{...c,stars});}return [...byUnit.values()];
    },
    champions(){return Academy.snapshot.champions.filter(c=>c.cost>0&&c.traits.length).sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name));},
    addUnit(plan,apiName){if(!this.champions().some(c=>c.apiName===apiName))return;plan.currentUnits||=[];if(!plan.currentUnits.some(u=>u.apiName===apiName)&&plan.currentUnits.length<28)plan.currentUnits.push({apiName,stars:1});},
    boardFit(plan,guide){
      const units=this.units(plan),keepers=[],early=[],bridges=[];let unitScore=0,earlyScore=0,traitScore=0;
      const finalTraits=new Set(guide.finalComp.flatMap(u=>Academy.snapshot.champions.find(c=>c.apiName===u.apiName)?.traits||[]));
      for(const unit of units){
        const target=guide.finalComp.find(u=>u.apiName===unit.apiName);
        if(target){
          const core=target.apiName===guide.mainChampion?.apiName||target.items.length>=2;
          const points=[0,2,7,15][unit.stars]*(core?1.5:1)+(core&&target.stars===3&&unit.stars===3?8:0);
          unitScore+=points;keepers.push({...unit,targetStars:target.stars||1,core});
        }else if((guide.earlyComp||[]).some(u=>u.apiName===unit.apiName)){
          earlyScore+=[0,.5,2,4][unit.stars];early.push(unit);
        }else if(unit.traits.filter(t=>finalTraits.has(t)).length>=2){
          traitScore+=unit.stars===1?.5:1;bridges.push(unit);
        }
      }
      return {keepers,early,bridges,unitScore:Math.min(44,unitScore)+Math.min(8,earlyScore)+Math.min(3,traitScore)};
    },
    ownedCatalog(){return DATA.items.map(i=>({...Academy.itemInfo(i.id),id:i.id,name:i.name,type:Academy.itemInfo(i.id)?.type||'others'})).sort((a,b)=>a.name.localeCompare(b.name));},
    slotCost(id){return Academy.slotCost(id);},
    specialCarrier(plan,guide,item,slots,placements=[]){
      const info=Academy.itemInfo(item);if(!info)return null;
      const unitStars=new Map(this.units(plan).map(u=>[u.apiName,u.stars]));
      const choices=guide.finalComp.flatMap(unit=>{
        const champ=Academy.snapshot.champions.find(c=>c.apiName===unit.apiName);
        if(!champ||(slots.get(champ.name)||0)+this.slotCost(item)>3)return [];
        if(info.unique&&placements.some(p=>p.champion===champ.name&&p.item===item))return [];
        if(info.type==='emblems'&&info.trait&&(champ.traitKeys||[]).includes(info.trait))return [];
        const alternate=(guide.altBuilds||[]).some(a=>a.apiName===unit.apiName&&a.items.some(id=>Academy.itemMatches(Academy.itemMap.get(id),item)));
        let source=alternate?'Academy alternate':(info.recommendedChampions||[]).includes(unit.apiName)?'Academy item guide':'';
        if(!source){
          const data=MetaBuilds.dataFor({champion:champ.name}),owned=plan.queue.filter(q=>q.done).map(q=>q.item);
          if(data?.unit===unit.apiName&&MetaBuilds.isCompatible(data)&&data.builds.some(b=>{
            if(!['S','A'].includes(b.tier)||b.games<100||!b.items.includes(info.apiName))return false;
            const ids=b.items.map(id=>Academy.itemMap.get(id));if(ids.some(id=>!byId[id]))return false;
            const placed=placements.filter(p=>p.champion===champ.name).map(p=>p.item);
            return MetaBuilds.fits(ids,[...placed,item])&&MetaBuilds.fits(owned,ids.filter(id=>byId[id].recipe.length!==2));
          }))source='MetaTFT S/A item build';
        }
        if(!source)return [];
        const core=unit.apiName===guide.mainChampion?.apiName||unit.items.length>=2;
        const special=['radiants','ornns','emblems'].includes(info.type);
        const points=alternate?(info.type==='emblems'?32:special?28:18):special?(core?22:12):(core?8:5);
        return [{champion:champ.name,apiName:unit.apiName,source,points:points+(unitStars.get(unit.apiName)||0),alternate}];
      }).sort((a,b)=>b.points-a.points||a.champion.localeCompare(b.champion));
      return choices[0]||null;
    },
    requirements(plan,guide){
      const bank=plan.queue.filter(q=>q.done).map(q=>q.item),pool={...plan.owned},missing=[],craftable=[];
      const groups=guide.finalComp.flatMap(u=>u.items.flatMap(api=>{
        const item=Academy.itemMap.get(api);if(Academy.itemInfo(item)?.type!=='emblems')return [];
        const alternatives=[item,...(guide.altBuilds||[]).filter(a=>a.apiName===u.apiName).flatMap(a=>a.items.map(api=>Academy.itemMap.get(api))).filter(id=>Academy.itemInfo(id)?.type==='emblems')];
        return [{item,alternatives:[...new Set(alternatives)]}];
      }));
      const gate=Academy.gate(guide),required=gate?.type==='emblem'?Academy.itemMap.get(gate.id):null;
      const validItem=gate?.type==='item'||gate?.type==='emblem';
      const gatedItem=validItem&&Academy.itemMap.get(gate.id);
      const ownedItem=!!gatedItem&&bank.includes(gatedItem);
      const missingGate=validItem&&!ownedItem;
      if(required&&!groups.some(g=>g.item===required))groups.unshift({item:required,alternatives:[required]});
      for(const group of groups){
        const at=bank.findIndex(id=>group.alternatives.includes(id));if(at>=0){bank.splice(at,1);continue;}
        const can=group.alternatives.find(id=>byId[id]?.recipe.length===2&&OfflineTracker.canCraft(pool,byId[id]));
        if(can){for(const c of byId[can].recipe)pool[c]--;craftable.push(can);}else missing.push(group.item);
      }
      const augment=gate?.type==='augment'&&!this.heldAugments(plan).includes(gate.id)?gate.id:'';
      const gateName=gate?.type==='augment'?this.augment(gate.id)?.name||gate.id:
        Academy.snapshot.items.find(i=>i.apiName===gate?.id)?.name||gate?.id;
      const conditional=academyTier(guide.tier).conditional;
      const unlocked=conditional&&!!gate&&!missingGate&&!augment;
      const gateReason=missingGate&&gate.type==='emblem'?'Only play with '+gateName.replace(/ Emblem$/,' emblem'):
        missingGate||augment?'Requires '+gateName:conditional&&!gate?'Situational · requirement unavailable':'';
      return {missingEmblems:missing,craftableEmblems:craftable,missingAugment:augment,gateReason,
        unlockReason:unlocked?'Unlocked by '+gateName:'',unlocked,
        blocked:!!augment||missingGate||!!conditional&&!gate,requirementPenalty:Math.min(60,missing.length*24)+(augment?40:0)};
    },
    execution(plan,guide){
      const owned=new Map(this.units(plan).map(u=>[u.apiName,u.stars]));
      const core=guide.finalComp.filter(u=>u.apiName===guide.mainChampion?.apiName||u.items.length>=2).sort((a,b)=>Number(b.apiName===guide.mainChampion?.apiName)-Number(a.apiName===guide.mainChampion?.apiName)).slice(0,3);
      const missingCore=[];let executionPenalty=0;
      for(const target of core){
        const c=Academy.snapshot.champions.find(c=>c.apiName===target.apiName);if(!c)continue;
        const stars=owned.get(c.apiName)||0,targetStars=target.stars||1;
        if(stars>=targetStars)continue;
        missingCore.push({...c,stars,targetStars});
        executionPenalty+=stars===0?(c.cost>=5?8:c.cost===4?5:targetStars===3?4:1):targetStars===3?(stars===2?1.5:3):1;
      }
      // Sparse item entry does not establish that the whole future board is missing.
      const boardCoverage=Math.min(1,owned.size/4);
      return {missingCore,executionPenalty:Math.round(Math.min(18,executionPenalty)*boardCoverage*100)/100};
    },
    evaluate(plan,guide){
      const build=Academy.build(guide),remaining=build.entries.map((e,n)=>({...e,priority:n}));
      const matched=[],unmatched=[],specialMatches=[],unknownSpecial=[],placements=[],slots=new Map(),earlyMatches=[];let itemScore=0;
      const completed=plan.queue.filter(q=>q.done),unplaced=[];
      // An explicitly equipped pair of gloves fills the holder before any
      // suggested destination is chosen, even if the guide wants other items.
      const gloves=completed.filter(q=>q.champion&&this.slotCost(q.item)===3);
      const full=new Set(gloves.map(q=>q.champion));
      for(const q of [...gloves,...completed.filter(q=>!gloves.includes(q))]){
        const fixed=gloves.includes(q)?q.champion:'';
        const hasRoom=e=>fixed?e.champion===fixed:!full.has(e.champion);

        const info=Academy.itemInfo(q.item),at=remaining.findIndex(e=>hasRoom(e)&&Academy.itemMatches(e.item,q.item)&&(slots.get(e.champion)||0)+this.slotCost(q.item)<=3&&(!info?.unique||!placements.some(p=>p.champion===e.champion&&p.item===q.item)));
        if(at<0){if(!fixed)unplaced.push(q);else unknownSpecial.push(q.item);continue;}
        const e=remaining.splice(at,1)[0];matched.push(q.item);
        const points=info?.type==='emblems'?40:e.priority<3?24:18;itemScore+=points;
        placements.push({uid:q.uid,champion:e.champion,item:q.item});slots.set(e.champion,(slots.get(e.champion)||0)+this.slotCost(q.item));
        if(q.item!==e.item){itemScore+=6;specialMatches.push({item:q.item,champion:e.champion,source:'Radiant upgrade',base:e.item});}
      }
      for(const name of full)slots.set(name,3);
      for(let n=remaining.length-1;n>=0;n--)if((slots.get(remaining[n].champion)||0)>=3)remaining.splice(n,1);
      const earlyPool=(guide.earlyComp||[]).flatMap(u=>u.items.map(api=>({item:Academy.itemMap.get(api),apiName:u.apiName})));
      for(const q of unplaced){
        const info=Academy.itemInfo(q.item),carrier=this.specialCarrier(plan,guide,q.item,slots,placements);
        if(carrier){
          itemScore+=carrier.points;slots.set(carrier.champion,(slots.get(carrier.champion)||0)+this.slotCost(q.item));placements.push({uid:q.uid,champion:carrier.champion,item:q.item});specialMatches.push({item:q.item,...carrier});
          // Keep the fit estimate within three item slots. An alternate occupies
          // a lower-priority slot; it is not a fourth item on top of the baseline.
          for(let n=0;n<this.slotCost(q.item);n++){const at=remaining.map(e=>e.champion).lastIndexOf(carrier.champion);if(at>=0)remaining.splice(at,1);}
          continue;
        }
        const at=earlyPool.findIndex(e=>Academy.itemMatches(e.item,q.item)&&!guide.finalComp.some(u=>u.apiName===e.apiName));
        if(at>=0){const e=earlyPool.splice(at,1)[0],champion=Academy.snapshot.champions.find(c=>c.apiName===e.apiName)?.name;earlyMatches.push({item:q.item,champion});itemScore+=10;continue;}
        if(!info||info.type==='craftables')unmatched.push(q.item);else unknownSpecial.push(q.item);
      }
      const featured=Academy.itemMap.get(guide.mainItem?.apiName),featuredOwned=featured&&completed.some(q=>Academy.itemMatches(featured,q.item));
      // This is a comp-specific Academy endorsement, not a generic trait guess.
      if(featuredOwned)itemScore+=12;
      // Carry an evidenced full combination into both scoring and selection.
      const {DecisionPlanner}=model;
      if(DecisionPlanner)for(const name of new Set(placements.map(p=>p.champion))){
        const equipped=placements.filter(p=>p.champion===name).map(p=>p.item),targets=remaining.filter(e=>e.champion===name);
        const base=build.entries.filter(e=>e.champion===name).map(e=>e.item);
        if(DecisionPlanner.subtract(base,equipped)!==null)continue;
        const virtual={...plan,activeComp:{id:guide.id,guide},queue:[...placements.filter(p=>p.champion===name).map(p=>({...p,done:true})),...targets.map(e=>({...e,done:false}))]};
        const choice=DecisionPlanner.builds(virtual,name)[0];if(!choice)continue;
        const at=remaining.findIndex(e=>e.champion===name),rest=remaining.filter(e=>e.champion!==name);
        rest.splice(at<0?rest.length:at,0,...choice.remaining.map(item=>({item,champion:name,planSource:'meta',sourceComp:guide.title})));
        remaining.splice(0,remaining.length,...rest);
      }
      const componentFit=this.componentFit(plan,remaining),{used,ready}=componentFit,componentScore=componentFit.score;
      const heldAugments=this.heldAugments(plan);
      const heldContext=heldAugments.length&&augmentFit.context(plan,guide,remaining,[...placements,...earlyMatches].map(p=>p.item));
      const augmentMatches=heldAugments.map(id=>{
        const augment=this.augment(id);
        const match=augmentFit.score(augment||{apiName:id},guide,heldContext);
        // A held Academy recommendation is a stronger commitment signal than an offer.
        if(match.academy)match.points+=10;
        return {id,name:augment?.name||id,...match};
      });
      const requirements=this.requirements(plan,guide);
      const tierScore=academyTier(requirements.unlocked?'A':guide.tier).score,board=this.boardFit(plan,guide),execution=this.execution(plan,guide);
      const names=ids=>[...new Set(ids.map(id=>byId[id]?.name||id))].join(', ');
      const unitNames=[...board.keepers,...board.early,...board.bridges].map(u=>`${u.name} ${u.stars}★`).join(', ');
      const itemNames=names([...matched,...specialMatches.map(m=>m.item),...earlyMatches.map(m=>m.item),...(featuredOwned?[featured]:[])]);
      const ownedReasons=[
        {points:Math.min(96,itemScore),text:'Completed items'+(itemNames?' · '+itemNames:'')},
        {points:board.unitScore,text:'Champions owned'+(unitNames?' · '+unitNames:'')},
        {points:Math.min(36,componentScore),text:'Loose components'+(used.length?' · '+names(used):'')},
        ...augmentMatches.map(a=>({points:a.points,text:`Augment: ${a.name} — ${a.academy?'':'Rules-based fit · '}${a.text}${a.detail?' · '+a.detail:''}`}))
      ];
      const reasons=[...ownedReasons,...[
        {points:-Math.min(18,unmatched.length*6),text:'Off-plan items: '+names(unmatched)},
        {points:-requirements.requirementPenalty,text:[requirements.gateReason,requirements.missingEmblems.length?'Missing emblems: '+names(requirements.missingEmblems):''].filter(Boolean).join(' · ')},
        {points:-execution.executionPenalty,text:'Missing core units or upgrades: '+execution.missingCore.map(u=>u.name).join(', ')}
      ].filter(reason=>reason.points)];
      if(heldAugments.length&&!augmentFit.hasRecommendations(guide))reasons.push({points:0,text:'No Academy augment data for this comp — scored from item, economy and combat rules.'});
      if(requirements.unlockReason)reasons.push({points:0,text:requirements.unlockReason});
      const fitScore=Number(reasons.reduce((sum,reason)=>sum+reason.points,0).toFixed(2));
      return {guide,build,remaining,placements,matched,unmatched,used,ready,augmentMatches,specialMatches,unknownSpecial,earlyMatches,featuredOwned:featuredOwned?featured:null,...board,...requirements,...execution,
        score:tierScore+fitScore,fitScore,tierScore,componentScore,itemScore,reasons,selectable:!!build.entries.length&&!build.missing.length};
    },
    tierRank(tier){return academyTier(tier).rank;},
    signalCount(plan){
      return this.units(plan).length+plan.queue.filter(q=>q.done&&byId[q.item]).length+
        this.heldAugments(plan).filter(id=>this.augment(id)).length+
        componentOrder.reduce((sum,id)=>sum+Math.max(0,Number(plan.owned[id])||0),0);
    },
    alternative(plan){
      const activeId=plan.activeComp?.id||plan.activeComp?.guide?.id;
      if(!activeId)return;
      const rows=this.ranked(plan);
      const active=rows.find(row=>row.guide.id===activeId);
      return rows.find(row=>row.guide.id!==activeId&&!row.blocked&&(row.unlocked||row.fitScore>0)&&
        (!active||active.blocked||row.fitScore>active.fitScore));
    },
    recommendations(plan){
      const rows=this.ranked(plan);
      const highest=Academy.isCurrent()?Academy.snapshot.guides.map(g=>g.tier).filter(tier=>['S','A','B'].includes(tier)).sort((a,b)=>this.tierRank(a)-this.tierRank(b))[0]:null;
      const tierNotice=highest&&highest!=='S'?`No S-tier comp in this snapshot — top band is ${academyTier(highest).label}`:'';
      return {rows,tierNotice,notice:rows.length?'':Academy.isCurrent()?'Not enough to recommend yet — add units/items/augment':'Not enough current info to recommend a comp.',
        guidance:rows.length?[]:[
          'Start with upgraded units and a frontline that can protect your carry.',
          'Record completed items and loose components to see which builds can use them.',
          'Add your first augment after choosing it to check for a more specific direction.'
        ]};
    },
    ranked(plan,{allowSparse=false}={}){
      if(!Academy.isCurrent())return [];
      const rows=Academy.snapshot.guides.filter(g=>['S','A','B','X'].includes(g.tier))
        .map(g=>this.evaluate(plan,g)).filter(r=>r.selectable);
      if(!allowSparse&&!rows.some(r=>r.unlocked||!r.blocked&&r.augmentMatches.some(a=>a.academy||a.recommended))&&
        (this.signalCount(plan)<2||!rows.some(r=>!r.blocked&&r.fitScore>0)))return [];
      const tierRank = row => this.tierRank(row.unlocked?'A':row.guide.tier);
      const rankable=rows.filter(r=>!r.blocked).length;
      const initial=rows.filter(r=>r.guide.tier!=='X'||!r.blocked||rankable>=3)
        .sort((a,b)=>Number(a.blocked)-Number(b.blocked)||tierRank(a)-tierRank(b)||b.fitScore-a.fitScore||a.guide.title.localeCompare(b.guide.title));
      const ranked=[];
      for(const row of initial){
        // Insert before the first higher-tier row this comp clears. A pairwise
        // sort can cycle when two close gaps add up to one qualifying gap.
        const index=row.blocked||row.missingEmblems.length?-1:ranked.findIndex(other=>
          tierRank(other)<tierRank(row)&&Math.round((row.fitScore-other.fitScore)*100)>=tierFitGap*100);
        if(index<0)ranked.push(row);
        else{
          row.passedTier=ranked[index];
          ranked.splice(index,0,row);
        }
      }
      return ranked;
    },
    componentFit(plan,entries){
      let beam=[{pool:{...plan.owned},score:0,used:[],ready:[]}];
      for(const [n,e] of entries.entries()){
        const recipe=byId[e.item]?.recipe||[];if(recipe.length!==2)continue;
        const next=[];for(const s of beam)for(let mask=0;mask<4;mask++){
          const pool={...s.pool},used=[],weight=Math.max(1,4-n*.5);let valid=true;
          for(let k=0;k<2;k++)if(mask&(1<<k)){const c=recipe[k];if(!(pool[c]>0)){valid=false;break;}pool[c]--;used.push(c);}
          if(valid)next.push({pool,score:s.score+weight*used.length+(used.length===2?2:0),used:[...s.used,...used],ready:used.length===2?[...s.ready,e.item]:s.ready});
        }
        const seen=new Set();beam=next.sort((a,b)=>b.score-a.score||b.used.length-a.used.length||b.ready.length-a.ready.length).filter(s=>{const key=componentOrder.map(c=>s.pool[c]||0).join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,40);
      }return beam[0];
    },
    choose(plan,id){
      if(!Academy.isCurrent())throw new Error('Refresh live data to choose a current comp.');
      const guide=Academy.snapshot.guides.find(g=>g.id===id);if(!guide)throw new Error('This comp is no longer available.');
      const fit=this.evaluate(plan,guide);if(!fit.selectable)throw new Error('This guide’s items are not available yet.');
      if(fit.blocked)throw new Error(fit.gateReason);
      // Preserve every physical item, and import the remaining variant scored in
      // discovery. Empty holder fields adopt the suggested destination.
      for(const p of fit.placements){const q=plan.queue.find(q=>q.uid===p.uid);if(q&&!q.champion)q.champion=p.champion;}
      const completed=plan.queue.filter(q=>q.done);
      plan.queue=[...completed,...fit.remaining.map((e,n)=>({...e,uid:crypto.randomUUID(),recommendedOrder:n,done:false,used:{},usedSources:{},academyItem:e.item,planSource:e.planSource||'academy'}))];
      plan.pivotIntents={};plan.activeComp={guide:Academy.cleanGuide(guide),id:guide.id,title:guide.title,code:'',patch:Academy.snapshot.patch,itemPriority:Academy.priorities(guide)};
      return {pending:fit.remaining.length,covered:fit.placements.length};
    }
  };
};
