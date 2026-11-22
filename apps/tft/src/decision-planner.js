'use strict';

module.exports = function createDecisionPlanner({Academy, MetaBuilds, PlanAdvisor, CompFinder, OfflineTracker, Tracker, QueueOrder, LootTracker, DATA, byId, componentOrder}) {
  /* Bounded whole-bench search. Scores are local fit utilities, never win odds.
     Academy remains the baseline; only evidenced, compatible Meta S/A alternatives
     can change a named champion's remaining build. All writes are explicit. */
  return {
    same:(a,b)=>Academy.normalizeName(a||'')===Academy.normalizeName(b||''),
    copies:(ids,id)=>ids.filter(x=>x===id).length,
    pending(plan,name){return plan.queue.filter(q=>!q.done&&this.same(q.champion,name));},
    equipped(plan,name){return PlanAdvisor.equipped(plan,name).map(q=>q.item);},
    subtract(ids,owned){const out=[...ids];for(const id of owned){let at=out.indexOf(id);if(at<0)at=out.findIndex(x=>Academy.itemMatches(x,id));if(at<0)return null;out.splice(at,1);}return out;},
    commitments(plan,name){const pending=this.pending(plan,name).map(q=>q.item);return (plan.pivotIntents?.[Academy.normalizeName(name)]||[]).filter(id=>pending.includes(id));},
    missing(ids,pool){let n=0;pool={...pool};for(const id of ids)for(const c of byId[id].recipe){if(pool[c]>0)pool[c]--;else n++;}return n;},
    builds(plan,name,{item='',allowSpecial=false,keepIntents=true}={}){
      const data=MetaBuilds.dataFor({champion:name}),unit=MetaBuilds.champion(name);
      if(!unit||data?.unit!==unit.apiName||!MetaBuilds.isCompatible(data))return [];
      const equipped=this.equipped(plan,name),pending=this.pending(plan,name).map(q=>q.item),intents=keepIntents?this.commitments(plan,name):[];
      const seen=new Set(),result=[];
      for(const b of data.builds){
        if(!['S','A'].includes(b.tier)||b.games<100)continue;
        const ids=b.items.map(id=>Academy.itemMap.get(id));if(ids.some(id=>!byId[id]))continue;
        if(ids.reduce((n,id)=>n+CompFinder.slotCost(id),0)>3)continue;
        const rest=this.subtract(ids,equipped);if(!rest||!rest.length||!MetaBuilds.fits(rest,intents)||item&&!rest.includes(item))continue;
        if(rest.some(id=>byId[id].recipe.length!==2&&!(allowSpecial&&id===item)))continue;
        const key=[...ids].sort().join('|');if(seen.has(key))continue;seen.add(key);
        const pool=[...pending];let retained=0;for(const id of rest){const at=pool.indexOf(id);if(at>=0){pool.splice(at,1);retained++;}}
        result.push({...b,items:ids,remaining:rest,equipped,champion:name,source:'meta',updated:data.updated,retained,missing:this.missing(rest,plan.owned)});
      }
      // Keep evidence important without making every tiny statistical difference
      // more important than several missing components or an existing plan.
      const urgent=plan.tempo==='urgent';
      const utility=b=>({S:12,A:9}[b.tier])+Math.max(-1,Math.min(1,b.score))*4+b.retained*1.8-b.missing*(urgent?2.2:.65);
      return result.sort((a,b)=>utility(b)-utility(a)||b.games-a.games||a.items.join().localeCompare(b.items.join()));
    },
    pivot(plan,name,id){
      if(!byId[id])return null;
      // The newly selected item is an additional commitment beside equipment.
      // Existing unfinished intentions may be replaced by this explicit pivot.
      return this.builds(plan,name,{item:id,allowSpecial:true,keepIntents:false})[0]||null;
    },
    applyBuild(plan,choice){
      const pending=this.pending(plan,choice.champion),pool=[...pending],replacements=choice.remaining.map(id=>{
        const at=pool.findIndex(q=>q.item===id),old=at>=0?pool.splice(at,1)[0]:null;
        return old?{...old,planSource:choice.source==='academy'?'academy':'meta'}:{uid:crypto.randomUUID(),item:id,champion:choice.champion,done:false,used:{},usedSources:{},planSource:choice.source==='academy'?'academy':'meta',sourceComp:plan.activeComp?.title||''};
      });
      QueueOrder.inherit(plan,pending,replacements);
      const oldIds=new Set(pending.map(q=>q.uid)),at=plan.queue.findIndex(q=>oldIds.has(q.uid));
      plan.queue=plan.queue.filter(q=>!oldIds.has(q.uid));plan.queue.splice(at<0?plan.queue.length:at,0,...replacements);
    },
    applyPivot(plan,name,id,mode='plan'){
      const choice=this.pivot(plan,name,id);if(!choice)return false;
      if(mode==='craft'&&!OfflineTracker.canCraft(plan.owned,byId[id]))return false;
      const owned=mode==='owned'?plan.queue.find(q=>q.done&&q.item===id&&!q.champion):null;
      if(mode==='owned'&&!owned)return false;
      this.applyBuild(plan,choice);
      const q=this.pending(plan,name).find(q=>q.item===id);if(!q)return false;
      if(mode==='craft')Tracker.complete(plan,q,byId[id]);
      if(mode==='owned'){owned.champion=name;plan.queue=plan.queue.filter(x=>x.uid!==q.uid);}
      plan.pivotIntents||={};plan.pivotIntents[Academy.normalizeName(name)]=mode==='plan'?[id]:[];
      return true;
    },
    groups(plan){
      const pending=plan.queue.filter(q=>!q.done),names=[...new Set(pending.map(q=>q.champion).filter(Boolean))],groups=[];
      for(const name of names){
        const targets=this.pending(plan,name),equipped=this.equipped(plan,name),intents=this.commitments(plan,name);
        const remaining=targets.map(q=>q.item),baseline={champion:name,source:'academy',remaining,equipped,items:[...equipped,...remaining],score:0};
        const baseOptions=baseline.items.reduce((n,id)=>n+CompFinder.slotCost(id),0)<=3?[baseline]:[];
        const options=[...baseOptions,...this.builds(plan,name).slice(0,6)].filter(b=>MetaBuilds.fits(b.remaining,intents));
        const seen=new Set();groups.push({name,rank:pending.indexOf(targets[0]),targets,options:options.filter(b=>{const key=[...b.remaining].sort().join('|');if(seen.has(key))return false;seen.add(key);return true;})});
      }
      for(const q of pending.filter(q=>!q.champion))groups.push({name:'',rank:pending.indexOf(q),targets:[q],options:[{champion:'',uid:q.uid,source:'academy',remaining:[q.item],equipped:[],items:[q.item]}]});
      return groups.sort((a,b)=>a.rank-b.rank);
    },
    solve(plan,groups=this.groups(plan)){
      const urgent=plan.tempo==='urgent';let beam=[{pool:{...plan.owned},score:0,actions:[],count:0}];
      for(const group of groups){
        const variants=[];
        for(const b of group.options){
          // Only the first six targets are searched for malformed/oversized manual
          // champion plans. Normal champion builds contain at most three items.
          const ready=b.remaining.map((id,index)=>({id,index})).filter(x=>OfflineTracker.canCraft(plan.owned,byId[x.id])).slice(0,6);
          for(let mask=1;mask<(1<<ready.length);mask++){
            const crafts=ready.filter((x,n)=>mask&(1<<n)).map(x=>x.id),need={};for(const id of crafts)for(const c of byId[id].recipe)need[c]=(need[c]||0)+1;
            if(Object.entries(need).some(([c,n])=>n>(plan.owned[c]||0)))continue;
            const targetPool=group.targets.map(q=>q.item);let matching=0;
            for(const id of crafts){const at=targetPool.indexOf(id);if(at>=0){matching++;targetPool.splice(at,1);}}
            const score=crafts.length*(urgent?42:28)+crafts.length*Math.max(1,12-group.rank)+matching*4-(b.source==='meta'?(urgent?2:8):0)+Math.max(0,Math.min(2,(b.score||0)*2));
            variants.push({choice:b,crafts,need,score});
          }
        }
        const next=[...beam];for(const s of beam)for(const v of variants){
          if(Object.entries(v.need).some(([c,n])=>n>(s.pool[c]||0)))continue;
          const pool={...s.pool};for(const [c,n]of Object.entries(v.need))pool[c]-=n;
          next.push({pool,score:s.score+v.score,actions:[...s.actions,{choice:v.choice,crafts:v.crafts}],count:s.count+v.crafts.length});
        }
        const seen=new Set();beam=next.sort((a,b)=>b.score-a.score||b.count-a.count).filter(s=>{const key=componentOrder.map(c=>s.pool[c]||0).join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,64);
      }
      return beam[0];
    },
    execute(plan,result){
      // Validate the complete transaction against current inventory before writes.
      const copy=JSON.parse(JSON.stringify(plan));
      for(const action of result.actions){
        const b=action.choice;if(b.champion&&b.source==='meta')this.applyBuild(copy,b);
        for(const id of action.crafts){
          const q=copy.queue.find(q=>!q.done&&q.item===id&&(b.uid?q.uid===b.uid:this.same(q.champion,b.champion)));
          if(!q||!Academy.canEquip(copy,q.champion,id)||!OfflineTracker.canCraft(copy.owned,byId[id]))return false;
          Tracker.complete(copy,q,byId[id]);
        }
      }
      Object.assign(plan,copy);return true;
    },
    carouselTargets(plan){
      const allocation=Tracker.allocate(plan,DATA.items),planned={},pivots={};
      const add=(map,id,target)=>{(map[id]||=[]).push(target);};
      for(const q of allocation.rows){
        for(const id of new Set(q.slots.filter(s=>!s.have).map(s=>s.id)))
          add(planned,id,{item:q.item,champion:q.champion||'',uid:q.uid,source:'planned',rank:q.rank});
      }
      const names=[...new Set(allocation.rows.map(q=>q.champion).filter(Boolean))];
      for(const name of names){
        const pending=this.pending(plan,name).map(q=>q.item),candidates={};
        // Carousel discovery uses every eligible build, not the crafting beam's
        // six-option budget. Completed copies are subtracted by builds().
        for(const b of this.builds(plan,name)){
          const existing=[...pending],kept=[],changed=[];
          for(const item of b.remaining){const at=existing.indexOf(item);if(at>=0){existing.splice(at,1);kept.push(item);}else changed.push(item);}
          if(!changed.length)continue;
          const pool={...plan.owned};
          // Reserve components for retained targets before allocating alternatives.
          for(const item of kept)for(const id of byId[item].recipe)if(pool[id]>0)pool[id]--;
          const perBuild={};
          for(const item of changed){
            const missing=[];for(const id of byId[item].recipe){if(pool[id]>0)pool[id]--;else missing.push(id);}
            for(const id of new Set(missing)){
              const key=id+'|'+item;
              if(perBuild[key])perBuild[key].copies++;
              else perBuild[key]={id,item,champion:name,source:'pivot',tier:b.tier,score:b.score,games:b.games,missing:b.missing,build:b.items,copies:1};
            }
          }
          for(const target of Object.values(perBuild))add(candidates,target.id,target);
        }
        for(const [id,options] of Object.entries(candidates)){
          options.sort((a,b)=>'SA'.indexOf(a.tier)-'SA'.indexOf(b.tier)||b.score-a.score||a.missing-b.missing||b.games-a.games);
          const tier=options[0].tier,seen=new Set();
          // If this component can advance a compatible S build, do not present an
          // A build as the preferred route for the same champion.
          for(const target of options){if(target.tier!==tier||seen.has(target.item))continue;seen.add(target.item);add(pivots,id,target);}
        }
      }
      for(const options of Object.values(pivots))options.sort((a,b)=>'SA'.indexOf(a.tier)-'SA'.indexOf(b.tier)||b.score-a.score||a.missing-b.missing||b.games-a.games);
      return {allocation,planned,pivots};
    },
    carousel(plan,groups=this.groups(plan)){
      const {allocation,planned,pivots}=this.carouselTargets(plan),needs=allocation.needs;
      if(!allocation.rows.length)return this.discovery(plan);
      // Planned priorities must be scored exclusively against the current queue.
      // A craftable alternative must not boost a planned component's rank.
      const baselineGroups=groups.map(g=>({...g,options:g.options.filter(option=>option.source==='academy')}));
      const order=Academy.itemizationOrder(Academy.currentGuide(plan)),holderRanks=new Map(order.flatMap((names,n)=>names.map(name=>[Academy.normalizeName(name),n])));
      const rawRank=name=>order.length?(holderRanks.get(Academy.normalizeName(name||''))??order.length):0;
      // An explicit user reorder can promote another recipient group. Otherwise
      // the guide's stated carry/tank/support sequence outranks a ready craft.
      const pending=QueueOrder.pending(plan),recommended=QueueOrder.recommended(plan);
      const custom=pending.some((q,n)=>q.uid!==recommended[n]?.uid),groupRanks=new Map();
      if(order.length&&custom)for(const q of pending){const rank=rawRank(q.champion);if(!groupRanks.has(rank))groupRanks.set(rank,groupRanks.size);}
      const holderRank=name=>groupRanks.size?(groupRanks.get(rawRank(name))??groupRanks.size):rawRank(name);
      const evaluations=new Map();
      const baselineFor=rank=>{
        if(!evaluations.has(rank)){const eligible=order.length?baselineGroups.filter(g=>holderRank(g.name)<=rank):baselineGroups;evaluations.set(rank,{groups:eligible,base:this.solve(plan,eligible)});}
        return evaluations.get(rank);
      };
      return componentOrder.filter((id,n)=>n<8||needs[id]||pivots[id]?.length).map(id=>{
        const targets=(planned[id]||[]).slice().sort((a,b)=>holderRank(a.champion)-holderRank(b.champion)||a.rank-b.rank),alternatives=pivots[id]||[],baseline=needs[id],priority=Academy.componentPreference(plan,id);
        const carrierRank=targets.length?holderRank(targets[0].champion):Infinity;
        let gain=0,score=0,best={actions:[]};
        if(baseline){
          const after={...plan,owned:{...plan.owned,[id]:(plan.owned[id]||0)+1}};
          const context=baselineFor(carrierRank);
          best=this.solve(after,context.groups);gain=best.score-context.base.score;
          const reach=targets.reduce((sum,t)=>sum+3*Math.max(1,6-t.rank),0);
          score=gain+Math.min(20,reach)+3-(Number.isFinite(priority)?Math.min(priority,20)*.15:0);
        }else if(alternatives.length){
          const b=alternatives[0];score=(b.tier==='S'?20:10)+Math.max(0,Math.min(2,b.score))-Math.min(6,b.missing)*.1;
        }
        return {id,score,gain,best,carrierRank,pivot:!!alternatives.length,pivotTier:alternatives[0]?.tier||'',targets,pivotTargets:alternatives,count:baseline?.count||0,rank:baseline?.rank??99,items:baseline?.items||[],finishes:targets};
      }).sort((a,b)=>Number(b.count>0)-Number(a.count>0)||Number(plan.pins.includes(b.id))-Number(plan.pins.includes(a.id))||b.count-a.count||(a.count&&b.count?a.carrierRank-b.carrierRank:0)||b.score-a.score||LootTracker.compare(plan,a.id,b.id)||componentOrder.indexOf(a.id)-componentOrder.indexOf(b.id));
    },
    discovery(plan){
      const candidates=CompFinder.ranked(plan,{allowSparse:true}).filter(r=>!r.blocked).slice(0,8);
      return componentOrder.slice(0,8).map(id=>{
        let score=0;const items=new Set(),routes=[];
        for(const r of candidates){
          const pending=r.remaining||r.build.entries,pool={...plan.owned};let best=0;
          for(const e of pending.slice(0,6)){
            const recipe=byId[e.item]?.recipe||[];if(!recipe.includes(id))continue;
            const need=OfflineTracker.recipeCounts(byId[e.item]);if((need[id]||0)<=(pool[id]||0))continue;
            const after={...pool,[id]:(pool[id]||0)+1},ready=OfflineTracker.canCraft(after,byId[e.item]);
            const value=ready?6:1;best=Math.max(best,value);items.add(e.item);
          }
          if(best){score+=best*(1+Math.max(0,r.fitScore)/100);routes.push(r.guide.title);}
        }
        return {id,score,gain:0,count:0,rank:99,items:[],routes,discovery:true,targets:[...items].map(item=>({item,source:'discovery'})),pivotTargets:[],finishes:[...items].map(item=>({item})),best:{actions:[]}};
      }).sort((a,b)=>Number(plan.pins.includes(b.id))-Number(plan.pins.includes(a.id))||b.score-a.score||LootTracker.compare(plan,a.id,b.id)||componentOrder.indexOf(a.id)-componentOrder.indexOf(b.id));
    },
    anvil(plan,type='ornns'){
      if(type==='components')return this.carousel(plan).filter(r=>componentOrder.slice(0,8).includes(r.id)).map(r=>({...r,item:byId[r.id],component:true,champion:'',reason:r.count?r.count+' still needed for your queue':r.discovery?'Flexible component':r.pivot?'Pivot item':'Not needed'}));
      const guide=Academy.currentGuide(plan),ranked=guide?[]:CompFinder.ranked(plan,{allowSparse:true}).filter(r=>!r.blocked).slice(0,8);
      const guides=guide?[guide]:ranked.map(r=>r.guide),names=[...new Set(guides.flatMap(g=>g.finalComp.map(u=>Academy.snapshot.champions.find(c=>c.apiName===u.apiName)?.name)).filter(Boolean))];
      const bases=new Map(guides.map(g=>[g.id,Academy.build(g).entries]));
      return CompFinder.ownedCatalog().filter(i=>i.type===type).map(item=>{
        let best={score:0,champion:'',reason:'No supported match',guide:null};
        for(const g of guides){
          for(const u of g.finalComp){
            const name=Academy.snapshot.champions.find(c=>c.apiName===u.apiName)?.name;if(!name)continue;
            const eq=guide?this.equipped(plan,name):[];
            if(eq.reduce((n,id)=>n+CompFinder.slotCost(id),0)+CompFinder.slotCost(item.id)>3||item.unique&&eq.includes(item.id)||item.type==='emblems'&&item.trait&&(MetaBuilds.champion(name)?.traitKeys||[]).includes(item.trait))continue;
            const targets=bases.get(g.id).filter(e=>this.same(e.champion,name));
            const exact=targets.some(e=>Academy.itemMatches(e.item,item.id));
            const alt=(g.altBuilds||[]).some(a=>a.apiName===u.apiName&&a.items.some(api=>Academy.itemMatches(Academy.itemMap.get(api),item.id)));
            const endorsed=item.recommendedChampions?.includes(u.apiName);
            let score=exact?55:alt?47:endorsed?32:0,reason=exact?'Academy target':alt?'Academy alternate':endorsed?'Academy item guide':'No supported match';
            if(!score)continue;
            if(!guide){const fit=ranked.find(r=>r.guide.id===g.id);score+=Math.max(-15,Math.min(20,(fit?.fitScore||0)/4));}
            if(u.apiName===g.mainChampion?.apiName)score+=3;
            if(score>best.score)best={score,champion:name,reason,guide:g};
          }
        }
        if(guide)for(const name of names){const b=this.pivot(plan,name,item.id);if(b){const score=(b.tier==='S'?62:53)+Math.min(3,b.score)+b.retained; if(score>best.score)best={score,champion:name,reason:'MetaTFT '+b.tier+' combination',guide,build:b};}}
        return {item,...best};
      }).sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name));
    },
    receiveAnvil(plan,row){
      if(row.component&&componentOrder.slice(0,8).includes(row.item.id)){LootTracker.gain(plan,row.item.id,'other');return;}
      const id=row.item.id,name=row.champion||'';
      // Endorsements are suggestions for holders, not fabricated equipment.
      // Reuse an exact target when possible; otherwise leave the receipt unassigned.
      const target=plan.queue.find(q=>!q.done&&q.item===id&&(!name||this.same(q.champion,name))&&Academy.canEquip(plan,q.champion,id));
      if(target)OfflineTracker.receive(plan,target);
      else plan.queue.push({uid:crypto.randomUUID(),item:id,done:true,received:true,used:{},usedSources:{},champion:''});
    }
  };
};
