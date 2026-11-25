'use strict';

module.exports = function createOfflineTracker({DATA, byId, Academy, Tracker, LootTracker, componentOrder}) {
  /* Manual tracker helpers. No network access or game connection. */
  return {
    cleanState(value) {
      if (!value || !Array.isArray(value.queue) || typeof value.owned !== 'object' || !value.owned) throw new Error('Choose a Carousel backup or tracker state.');
      if (value.queue.length > 1000) throw new Error('This backup contains too many items.');
      const valid = new Set(DATA.items.map(i => i.id));
      if (value.queue.some(q => !q || !valid.has(q.item))) throw new Error('This backup includes an item this version does not support.');
      const count = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(9999, Math.floor(Number(n)))) : 0;
      return {
        currentUnits:[...new Map((Array.isArray(value.currentUnits)?value.currentUnits:[]).filter(u=>u&&typeof u.apiName==='string'&&Academy.snapshot.champions.some(c=>c.apiName===u.apiName)).slice(0,28).map(u=>[u.apiName,{apiName:u.apiName,stars:Math.max(1,Math.min(3,Math.floor(Number(u.stars)||1)))}])).values()],
        chosenAugments:Array.from({length:3},(_,n)=>typeof value.chosenAugments?.[n]==='string'?value.chosenAugments[n].slice(0,120):''),
        augmentOffers:value.augmentOffers&&typeof value.augmentOffers==='object'?{
          round:Math.max(0,Math.min(2,Math.floor(Number(value.augmentOffers.round)||0))),
          ids:Array.from({length:3},(_,n)=>typeof value.augmentOffers.ids?.[n]==='string'?value.augmentOffers.ids[n].slice(0,120):''),
          seen:(Array.isArray(value.augmentOffers.seen)?value.augmentOffers.seen:[]).filter(id=>typeof id==='string').map(id=>id.slice(0,120)).slice(-60),
          awaiting:Array.from({length:3},(_,n)=>!value.augmentOffers.ids?.[n]&&value.augmentOffers.awaiting?.[n]===true)
        }:null,
        tempo:value.tempo==='urgent'?'urgent':'balanced',
        pivotIntents:Object.fromEntries(Object.entries(value.pivotIntents||{}).filter(([name,ids])=>name.length<120&&Array.isArray(ids)).map(([name,ids])=>[name,ids.filter(id=>valid.has(id)).slice(0,3)])),
        firstAugment:typeof value.firstAugment==='string'?value.firstAugment.slice(0,120):'',
        lootHistory:LootTracker.clean(value.lootHistory,value.owned),lootTieBreak:value.lootTieBreak!==false,
        activeComp:value.activeComp&&typeof value.activeComp.title==='string'?{guide:Academy.cleanGuide(value.activeComp.guide),title:value.activeComp.title.slice(0,120),id:String(value.activeComp.id||'').slice(0,100),code:String(value.activeComp.code||'').slice(0,100),patch:String(value.activeComp.patch||'').slice(0,16),itemPriority:Array.isArray(value.activeComp.itemPriority)?value.activeComp.itemPriority.filter(p=>p&&typeof p.id==='string'&&(p.component?componentOrder.includes(p.id):valid.has(p.id))).slice(0,30).map(p=>({id:p.id,component:!!p.component})):[]}:null,
        queue:value.queue.map(q=>({uid:crypto.randomUUID(),recommendedOrder:Number.isFinite(q.recommendedOrder)&&q.recommendedOrder>=0?q.recommendedOrder:undefined,item:q.item,academyItem:valid.has(q.academyItem)?q.academyItem:'',planSource:['academy','meta','manual'].includes(q.planSource)?q.planSource:'',done:!!q.done,received:!!q.received,champion:typeof q.champion==='string'?q.champion.slice(0,100):'',earlyChampion:typeof q.earlyChampion==='string'?q.earlyChampion.slice(0,100):'',sourceComp:typeof q.sourceComp==='string'?q.sourceComp.slice(0,120):'',sourceURL:typeof q.sourceURL==='string'&&q.sourceURL.startsWith('https://tftacademy.com/tierlist/comps/')?q.sourceURL:'',usedSources:Object.fromEntries(componentOrder.map(id=>[id,(Array.isArray(q.usedSources?.[id])?q.usedSources[id]:[]).slice(0,Math.min(2,count(q.used?.[id]))).map(s=>['loot','carousel','other'].includes(s)?s:'other')])),used:Object.fromEntries(componentOrder.map(id=>[id,Math.min(2,count(q.used?.[id]))]))})),
        owned:Object.fromEntries(componentOrder.map(id=>[id,count(value.owned[id])])),
        pins:[...new Set((Array.isArray(value.pins)?value.pins:[]).filter(id=>componentOrder.includes(id)))]
      };
    },
    recipeCounts:Tracker.recipeCounts,
    canCraft:Tracker.canCraft,
    craftOptions(plan) {
      const allocated=Tracker.allocate(plan,DATA.items);
      const options=allocated.rows.filter(q=>this.canCraft(plan.owned,byId[q.item])&&Academy.canEquip(plan,q.champion,q.item));
      return options.map(q=>({
        ...q,
        reserved:q.slots.filter(s=>!s.have).map(s=>s.id),
        conflicts:options.filter(other=>{
          if(other.uid===q.uid)return false;
          const both=this.recipeCounts({recipe:[...byId[q.item].recipe,...byId[other.item].recipe]});
          return Object.entries(both).some(([id,n])=>n>(plan.owned[id]||0));
        }).map(other=>({uid:other.uid,item:other.item,rank:other.rank}))
      }));
    },
    shortlist(plan) {
      const a=Tracker.allocate(plan,DATA.items);
      return Object.entries(a.needs).sort(([x,v],[y,w])=>(Number(plan.pins.includes(y))-Number(plan.pins.includes(x)))||v.rank-w.rank||Academy.componentPreference(plan,x)-Academy.componentPreference(plan,y)||w.count-v.count||LootTracker.compare(plan,x,y)||componentOrder.indexOf(x)-componentOrder.indexOf(y)).map(([id,need])=>{
        const after=Tracker.allocate({...plan,owned:{...plan.owned,[id]:(plan.owned[id]||0)+1}},DATA.items);
        const finishes=after.rows.filter((q,n)=>q.slots.every(s=>s.have)&&!a.rows[n].slots.every(s=>s.have));
        return {id,...need,finishes};
      });
    },
    receive(plan,q) {q.done=true;q.received=true;q.used={};q.usedSources={};},
    markMade(plan,q) {
      if(q.done)return false;
      if(!Tracker.complete(plan,q,byId[q.item]))this.receive(plan,q);
      return true;
    },
    newGame(plan,keep) {
      return {queue:keep?plan.queue.map(q=>({...q,done:false,received:false,used:{}})):[],owned:{},pins:keep?[...plan.pins]:[]};
    }
  };
};
