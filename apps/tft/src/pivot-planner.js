'use strict';

module.exports = function createPivotPlanner(model) {
  const {Tracker}=model;
  /* Local role/recipe heuristics; not a tier list or a champion-specific item guide. */
  const roles={
    AdaptiveHelm:['mana','tank','AP','AD'],ArchangelsStaff:['AP','scaling'],Bloodthirster:['sustain','AD','AP','fighter'],BlueBuff:['mana','AP','AD'],BrambleVest:['tank','armor'],Crownguard:['AP','tank'],Deathblade:['AD'],DragonsClaw:['tank','magic-defense'],GuardianAngel:['AD','survival'],SpectralGauntlet:['sunder','tank'],GargoyleStoneplate:['tank','armor','magic-defense'],MadredsBloodrazor:['AD','AP','anti-tank'],GuinsoosRageblade:['attack-speed','scaling'],UnstableConcoction:['sustain','AD','AP','crit'],HextechGunblade:['sustain','AP','AD','team-heal'],InfinityEdge:['AD','crit'],IonicSpark:['shred','tank','AP'],JeweledGauntlet:['AP','crit'],RunaansHurricane:['AD','attack-speed','scaling'],LastWhisper:['sunder','AD'],Morellonomicon:['anti-heal','AP'],Leviathan:['mana','AP','attack-speed'],FrozenHeart:['tank','mana'],PowerGauntlet:['crit','AD','AP'],Quicksilver:['attack-speed','survival'],RabadonsDeathcap:['AP'],RapidFireCannon:['anti-heal','attack-speed'],SpearOfShojin:['mana','AP','AD'],Redemption:['tank','sustain'],NightHarvester:['tank','survival'],SteraksGage:['fighter','AD','survival'],RedBuff:['anti-heal','tank'],ForceOfNature:['team-size'],TacticiansRing:['team-size'],TacticiansScepter:['team-size'],ThiefsGloves:['flex'],TitansResolve:['fighter','AD','AP','scaling'],StatikkShiv:['shred','AP'],WarmogsArmor:['tank']
  };
  const labels={AD:'AD damage',AP:'AP damage',tank:'Tank',mana:'Mana',sustain:'Healing / sustain',crit:'Critical strikes',fighter:'Fighter','attack-speed':'Attack speed',scaling:'Scaling',armor:'Armor','magic-defense':'Magic defense',survival:'Survivability',sunder:'Armor reduction',shred:'Magic-resist reduction','anti-heal':'Anti-heal','anti-tank':'Anti-tank','team-heal':'Ally healing','team-size':'Team size',flex:'Flexible'};
  const important=new Set(['sunder','shred','anti-heal','mana','sustain','team-size','attack-speed','fighter']);
  const profiles=new Map();
  const profile=id=>profiles.get(id)||roles[id]||['flex'];
  const damageTags={ad:'AD',ap:'AP',tank:'tank'};
  const descriptionTags={
    mana:/\bmana\b/i, sustain:/\b(?:heal(?:s|ing)?|omnivamp)\b/i,
    'attack-speed':/\battack speed\b/i, crit:/\bcrit(?:ical)?\b/i,
    armor:/\barmor\b/i, 'magic-defense':/\bmagic resist\b/i,
    survival:/\b(?:shield|non-lethal|immunity)\b/i,
    sunder:/\bsunder\b/i, shred:/\bshred\b/i, 'anti-heal':/\bwound\b/i,
    scaling:/\bstack(?:s|ing)?\b/i
  };
  function register(id,item,base,champions){
    const tags=[];
    if(item.type==='emblems'&&item.trait)tags.push('trait:'+item.trait);
    if(item.type==='radiants'&&base!==id)tags.push(...profile(base));
    tags.push(...item.filterType.map(tag=>damageTags[tag]).filter(Boolean));
    if(item.type==='ornns'){
      for(const name of item.recommendedChampions){
        const role=champions.get(name)?.role||'';
        if(role.endsWith('Tank'))tags.push('tank');
        else if(role.startsWith('Magic'))tags.push('AP');
        else if(role.startsWith('Attack'))tags.push('AD');
        if(role.endsWith('Fighter'))tags.push('fighter');
      }
    }
    for(const [tag,pattern] of Object.entries(descriptionTags)){
      if(pattern.test(item.description))tags.push(tag);
    }
    profiles.set(id,tags.length?[...new Set(tags)]:['flex']);
  }
  function counts(recipe){const n={};for(const id of recipe)n[id]=(n[id]||0)+1;return n;}
  function available(plan,uid,items){
    const pool={...plan.owned};
    for(const q of plan.queue){if(q.uid===uid)break;if(q.done)continue;const item=items.find(i=>i.id===q.item);for(const c of item.recipe)pool[c]=Math.max(0,(pool[c]||0)-1);}
    return pool;
  }
  function candidate(plan,uid,item,items,options={}){
    const target=plan.queue.find(q=>q.uid===uid);if(!target||target.done||target.item===item.id)return null;
    const original=items.find(i=>i.id===target.item),pool=available(plan,uid,items),need=counts(item.recipe);
    const missing=[],blocked=[];let covered=0;
    for(const [id,n]of Object.entries(need)){covered+=Math.min(n,pool[id]||0);for(let k=0;k<Math.max(0,n-(pool[id]||0));k++)missing.push(id);if((options.avoid||[]).includes(id)&&n>(pool[id]||0))blocked.push(id);}
    if(blocked.length)return null; // Avoid only additional copies; owned copies remain useful.
    const sourceRoles=profile(original.id),candidateRoles=profile(item.id),shared=sourceRoles.filter(r=>candidateRoles.includes(r));
    const originCounts=counts(original.recipe);let overlap=0;for(const [id,n]of Object.entries(need))overlap+=Math.min(n,originCounts[id]||0);
    let fit=shared.reduce((n,r)=>n+(important.has(r)?5:3),0);
    if(candidateRoles.includes(sourceRoles[0]))fit+=5;
    const missingRole=sourceRoles.filter(r=>(important.has(r)||r.startsWith('trait:'))&&!candidateRoles.includes(r));
    const alreadyPlanned=plan.queue.filter(q=>q.uid!==uid&&!q.done&&q.item===item.id).length;
    const reasons=[
      {points:fit*10,text:'Shared item roles'},
      {points:covered*18,text:'Available recipe components'},
      {points:overlap*4,text:'Components shared with the original item'}
    ];
    if(missingRole.length)reasons.push({points:-10*missingRole.length,text:'Loses key roles: '+missingRole.map(r=>labels[r]||r.replace('trait:','')).join(', ')});
    if(alreadyPlanned)reasons.push({points:-8*alreadyPlanned,text:'Copies of this item already planned'});
    const score=reasons.reduce((sum,reason)=>sum+reason.points,0);
    return {item,covered,missing,shared,overlap,fit,missingRole,alreadyPlanned,pool,score,reasons};
  }
  function suggest(plan,uid,items,options={}){
    const results=items.map(i=>candidate(plan,uid,i,items,options)).filter(Boolean);
    const role=options.role||'similar';
    return results.filter(r=>role==='all'||(role==='similar'?r.shared.length>0:profile(r.item.id).includes(role)))
      .sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name));
  }
  function addedQueueCopies(before,after){
    const pending=after.queue.filter(q=>!q.done);
    const previous=new Map(before.queue.filter(q=>!q.done).map(q=>[q.uid,q.item]));
    const copies=[];
    for(const id of new Set(pending.map(q=>q.item))){
      const rows=pending.filter(q=>q.item===id);
      if(rows.length<2)continue;
      const added=rows.filter(q=>previous.get(q.uid)!==id);
      if(added.length)copies.push({item:id,added,existing:rows.filter(q=>previous.get(q.uid)===id)});
    }
    return copies;
  }
  function replace(state,uid,id,items,built=false){
    const q=state.queue.find(q=>q.uid===uid),item=items.find(i=>i.id===id);
    if(!q||q.done||!item||q.item===id)return false;
    if(built&&!Tracker.canCraft(state.owned,item))return false;
    const holder=model.Academy.normalizeName(q.champion||'');
    const existing=state.queue.find(row=>!row.done&&row.item===id&&
      model.Academy.normalizeName(row.champion||'')===holder);
    if(existing){
      state.queue=state.queue.filter(row=>row!==q);
      if(built)Tracker.complete(state,existing,item);
      return true;
    }
    q.academyItem||=q.item;q.planSource='manual';q.pivotFrom=q.item;q.item=id;delete q.earlyChampion;q.used={};q.done=false;
    if(built)Tracker.complete(state,q,item);
    return true;
  }
  return {roles,labels,profile,register,available,candidate,suggest,addedQueueCopies,replace};
};
