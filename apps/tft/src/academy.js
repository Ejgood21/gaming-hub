'use strict';

const {academySource, validAcademy} = require('./snapshots');

module.exports = function createAcademy({DATA, ACADEMY_BUNDLED, byId, PivotPlanner}) {
  const coreRecipes=new Map(DATA.items.filter(i=>!i.academyOnly).map(i=>[i.id,[...i.recipe]]));
  /* Public TFT Academy data. Team codes contain champions, never item builds. */
  return {
    cacheKey:'carousel-academy-v7', snapshot:ACADEMY_BUNDLED, itemMap:new Map(),
    normalizeName(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,'');},
    decodeCode(text){
      const code=String(text).trim();
      const m=/^(01|02)([0-9a-f]+)TFTSet(\d+)(?:_(Act2|Stage2_Revival))?$/i.exec(code);
      if(!m)throw new Error('Paste the full in-game team code, starting with 01 or 02 and ending with TFTSet…');
      const width=m[1]==='01'?2:3;
      if(m[2].length!==10*width)throw new Error('That team code has the wrong length. Copy it again from TFT Academy.');
      const hex=m[2].toUpperCase().match(new RegExp('.{'+width+'}','g')).filter(v=>parseInt(v,16)!==0);
      if(!hex.length)throw new Error('This team code has no champions.');
      return {set:Number(m[3]),width,hex,signature:[...hex].sort().join('-')};
    },
    unpack(payload){
      if(!payload||!Array.isArray(payload.nodes))throw new Error('TFT Academy changed its data format. Your saved snapshot is still available.');
      return payload.nodes.filter(n=>n&&Array.isArray(n.data)).map(node=>{
        const values=node.data,seen=new Map();let reads=0;
        const read=index=>{
          if(!Number.isInteger(index)||index>=values.length||++reads>100000)throw new Error('Unexpected TFT Academy data.');
          if(index<0)return null;
          if(seen.has(index))return seen.get(index);
          const v=values[index];
          if(v===null||typeof v!=='object')return v;
          const out=Array.isArray(v)?[]:{};seen.set(index,out);
          if(Array.isArray(v))v.forEach(ref=>out.push(read(ref)));
          else for(const [key,ref] of Object.entries(v)){if(!['__proto__','constructor','prototype'].includes(key))out[key]=read(ref);}
          return out;
        };return read(0);
      });
    },
    guide(plan){return plan.activeComp?.guide||this.snapshot.guides.find(g=>g.id===plan.activeComp?.id);},
    itemInfo(id){return this.snapshot.items.find(i=>this.itemMap.get(i.apiName)===id);},
    baseItem(id, snapshot=this.snapshot){
      const src=snapshot.items.find(i=>this.itemMap.get(i.apiName)===id);
      if(src?.type!=='radiants')return id;
      const name=this.normalizeName(src.name.replace(/^Radiant\s+/i,''));
      const base=snapshot.items.find(i=>i.type==='craftables'&&this.normalizeName(i.name)===name);
      return base?this.itemMap.get(base.apiName)||id:id;
    },
    itemMatches(wanted,owned){return wanted===owned||this.baseItem(owned)===wanted;},
    slotCost(id){return this.baseItem(id)==='ThiefsGloves'?3:1;},
    canEquip(plan,name,id,excludedUid){
      if(!name)return true;
      const holders=this.equipment(plan);
      const used=plan.queue.filter(q=>q.done&&q.uid!==excludedUid&&holders.get(q.uid)===name)
        .reduce((total,q)=>total+this.slotCost(q.item),0);
      return used+this.slotCost(id)<=3;
    },
    cleanGuide(g, items=this.snapshot.items){
      if(!g||!Array.isArray(g.finalComp))return null;
      const text=v=>String(v||'').slice(0,4000);
      const unit=c=>({apiName:text(c.apiName),items:(c.items||[]).filter(i=>typeof i==='string').slice(0,6),boardIndex:Number.isInteger(c.boardIndex)&&c.boardIndex>=0&&c.boardIndex<28?c.boardIndex:null,stars:Math.max(1,Math.min(3,Number(c.stars)||1))});
      // Academy can supply an explicit gate. For situational live guides, use
      // a featured augment or a featured emblem on the final board.
      const featured=g.mainItem?.apiName;
      const inferred=g.tier!=='X'?null:g.mainAugment?.apiName&&!g.mainAugment.disabled
        ? {type:'augment',id:g.mainAugment.apiName}
        : items.some(i=>i.apiName===featured&&i.type==='emblems')&&g.finalComp.some(u=>u.items?.includes(featured))
          ? {type:'emblem',id:featured} : null;
      const gate=Object.hasOwn(g,'gatedBy')?g.gatedBy:inferred;
      const gatedBy=['emblem','augment'].includes(gate?.type)&&typeof gate.id==='string'&&/^\w+$/.test(gate.id)
        ? {type:gate.type,id:gate.id} : null;
      return {gatedBy,id:text(g.id),title:text(g.title),compSlug:text(g.compSlug),tier:text(g.tier),set:Number(g.set),updated:text(g.updated),mainChampion:{apiName:text(g.mainChampion?.apiName)},mainItem:g.mainItem?.apiName?{apiName:text(g.mainItem.apiName)}:null,mainAugment:g.mainAugment?.apiName&&!g.mainAugment.disabled?{apiName:text(g.mainAugment.apiName)}:null,style:text(g.style),difficulty:text(g.difficulty),altBuilds:(g.altBuilds||[]).slice(0,40).map(unit),carousel:(g.carousel||[]).slice(0,30).map(p=>({apiName:text(p.apiName)})),earlyComp:(g.earlyComp||[]).slice(0,28).map(unit),finalComp:g.finalComp.slice(0,28).map(unit),augments:(g.augments||[]).filter(a=>a&&!a.disabled&&typeof a.apiName==='string').slice(0,60).map(a=>({apiName:text(a.apiName)})),augmentsTip:text(g.augmentsTip),tips:(g.tips||[]).slice(0,12).map(t=>({stage:text(t.stage),tip:text(t.tip)}))};
    },
    normalize(nodes,championData,itemData,augmentData){
      const guides=nodes.find(n=>Array.isArray(n?.guides))?.guides;
      if(!guides?.length||!Array.isArray(championData?.champions)||!Array.isArray(itemData?.items))throw new Error('The live tierlist could not be read. Your saved snapshot is still available.');
      const set=Math.max(...guides.map(g=>Number(g.set)||0));
      const sourceUpdated=String(nodes.find(n=>n?.lastUpdated)?.lastUpdated||'').replace(' ','T');
      const snapshot=this.cleanSnapshot({
        patch:String(nodes.find(n=>n?.patch)?.patch||''),set,source:academySource,sourceUpdated,
        curatedAt:null,schemaVersion:1,fetchedAt:new Date().toISOString(),
        guides:guides.filter(g=>g.isPublic&&g.set===set&&Array.isArray(g.finalComp)),
        champions:championData.champions,items:itemData.items,augments:augmentData?.augments
      });
      return snapshot;
    },
    cleanSnapshot(snapshot){
      if(!validAcademy(snapshot))throw new Error('Unexpected or empty tierlist data.');
      const champions=snapshot.champions.map(c=>({
        apiName:String(c.apiName),name:String(c.name),hexIndex:String(c.hexIndex||''),
        traits:Array.isArray(c.traits)?c.traits:[],
        traitKeys:Array.isArray(c.traitKeys)?c.traitKeys:Object.keys(c.traitContributions||{}),
        role:String(c.role||''),cost:Number(c.cost)||0
      }));
      const championIds=new Map(snapshot.champions.flatMap(c=>[[c.id,c.apiName],[c.apiName,c.apiName]]));
      const items=snapshot.items.map(i=>({
        apiName:String(i.apiName),name:String(i.name),type:String(i.type),unique:!!i.unique,
        trait:String(i.trait||i.targetRules?.grantsTrait||''),composition:Array.isArray(i.composition)?i.composition:[],
        recommendedChampions:(i.recommendedChampions||[]).map(id=>championIds.get(id)).filter(Boolean),
        filterType:(i.filterType||[]).filter(t=>typeof t==='string'),description:String(i.description||'').slice(0,2000)
      }));
      const guides=snapshot.guides.map(g=>this.cleanGuide(g,items)).filter(Boolean);
      if(!guides.length)throw new Error('Unexpected or empty tierlist data.');
      return {patch:snapshot.patch,set:snapshot.set,source:academySource,sourceUpdated:String(snapshot.sourceUpdated||snapshot.updated||''),
        curatedAt:snapshot.curatedAt||null,schemaVersion:1,fetchedAt:snapshot.fetchedAt,
        guides,champions,items,augments:this.cleanAugments(snapshot.augments)};
    },
    useSnapshot(snapshot){
      this.register(snapshot,byId);
      this.snapshot=snapshot;
    },
    cleanAugments(list){
      return (Array.isArray(list)?list:[]).filter(a=>a&&!a.disabled&&typeof a.apiName==='string'&&typeof a.name==='string').slice(0,1000).map(a=>({apiName:a.apiName.slice(0,120),name:a.name.slice(0,120),description:String(a.description||'').slice(0,2000),stages:(a.stages||[]).filter(s=>typeof s==='string'),tier:Number(a.tier)||0}));
    },
    register(snapshot,index){
      const core=DATA.items.filter(i=>!i.academyOnly),components=new Set(DATA.components.map(c=>c.id));
      for(const item of core)item.recipe=[...coreRecipes.get(item.id)];
      const embedded=new Map(ACADEMY_BUNDLED.items.map(i=>[i.apiName,i.icon]));
      for(const src of snapshot.items){
        if(src.type==='components'||!/^\w+$/.test(src.apiName))continue;
        const match=core.find(i=>this.normalizeName(i.name)===this.normalizeName(src.name));
        if(match){const recipe=src.composition.map(c=>String(c).replace(/^DA_Component_|^TFT_Item_/,''));if(recipe.length===2&&recipe.every(c=>components.has(c)))match.recipe=recipe;this.itemMap.set(src.apiName,match.id);continue;}
        const recipe=src.composition.map(c=>String(c).replace(/^DA_Component_|^TFT_Item_/,''));
        const craftable=recipe.length===2&&recipe.every(c=>components.has(c));
        const id='Academy_'+src.apiName;
        const item={id,name:src.name,recipe:craftable?recipe:[],special:!craftable,academyOnly:true,icon:embedded.get(src.apiName)||'https://assets.tftacademy.com/items/'+encodeURIComponent(src.apiName)+'.webp'};
        const existing=DATA.items.find(i=>i.id===id);
        if(existing)Object.assign(existing,item);else DATA.items.push(item);
        if(index)index[id]=existing||item;
        this.itemMap.set(src.apiName,id);
      }
      const champions=new Map(snapshot.champions.map(c=>[c.apiName,c]));
      for(const item of snapshot.items){
        const id=this.itemMap.get(item.apiName);
        if(id&&byId[id]?.academyOnly)PivotPlanner.register(id,item,this.baseItem(id,snapshot),champions);
      }
    },
    guideHex(guide,width=3){
      const champs=new Map(this.snapshot.champions.map(c=>[c.apiName,c]));
      return guide.finalComp.map(c=>champs.get(c.apiName)).filter(c=>c?.hexIndex&&c.traits.length&&c.apiName!=='TFT16_AnnieTibbers').slice(0,10).map(c=>c.hexIndex.toUpperCase().padStart(width,'0').slice(0,width));
    },
    match(text){
      const code=this.decodeCode(text);
      if(code.set!==this.snapshot.set)throw new Error(`This code is Set ${code.set}; the loaded tierlist is Set ${this.snapshot.set}. Refresh the tierlist for Set ${code.set} to match it.`);
      const known=new Map(this.snapshot.champions.filter(c=>c.hexIndex).map(c=>[c.hexIndex.toUpperCase().padStart(code.width,'0').slice(0,code.width),c.name]));
      const unknown=code.hex.filter(h=>!known.has(h));
      if(unknown.length)throw new Error('This code contains unrecognized champions. Refresh the tierlist, or check that you copied a current team code.');
      const matches=this.snapshot.guides.map(g=>{
        const hex=this.guideHex(g,code.width),pool=[...hex];let shared=0;
        for(const id of code.hex){const at=pool.indexOf(id);if(at>=0){shared++;pool.splice(at,1);}}
        return {guide:g,exact:[...hex].sort().join('-')===code.signature,shared,total:hex.length,score:2*shared/(hex.length+code.hex.length)};
      }).filter(m=>m.shared>=Math.max(2,Math.ceil(code.hex.length*.6))).sort((a,b)=>Number(b.exact)-Number(a.exact)||b.score-a.score);
      const exact=matches.filter(m=>m.exact);
      return {code,names:code.hex.map(h=>known.get(h)),matches:exact.length?exact:matches.slice(0,5),exact:exact.length>0};
    },
    build(guide){
      const names=new Map(this.snapshot.champions.map(c=>[c.apiName,c.name]));
      const units=[...guide.finalComp].sort((a,b)=>Number(b.apiName===guide.mainChampion.apiName)-Number(a.apiName===guide.mainChampion.apiName));
      const entries=[],missing=[];
      for(const unit of units)for(const apiName of unit.items){
        const item=this.itemMap.get(apiName),champion=names.get(unit.apiName)||unit.apiName;
        if(item)entries.push({item,champion,sourceComp:guide.title,sourceURL:'https://tftacademy.com/tierlist/comps/'+encodeURIComponent(guide.compSlug)});
        else missing.push({name:this.snapshot.items.find(i=>i.apiName===apiName)?.name||apiName,champion});
      }
      // The displayed Item Priority list lives in `carousel`, independently of
      // board slot order. Promote one copy per listed item, never every duplicate.
      const priorities=this.priorities(guide),available=[...entries],chosen=new Map();
      priorities.forEach((p,n)=>{
        if(p.component)return;
        const at=available.findIndex(e=>e.item===p.id);
        if(at>=0)chosen.set(n,available.splice(at,1)[0]);
      });
      const ordered=[];
      // A component wishlist does not define a finished-item build order. Use
      // the guide's explicit early-board builds before inferring from recipes.
      if(priorities.every(p=>p.component)){
        for(const unit of guide.earlyComp||[])for(const apiName of unit.items||[]){
          const item=this.itemMap.get(apiName);if(!item)continue;
          const at=available.findIndex(e=>e.item===item);
          if(at>=0){const entry=available.splice(at,1)[0];ordered.push({...entry,earlyChampion:names.get(unit.apiName)||unit.apiName});}
        }
      }
      priorities.forEach((p,n)=>{
        if(chosen.has(n)){ordered.push(chosen.get(n));return;}
        if(!p.component)return;
        // A component preference advances an existing recipe. It does not add
        // another item or reserve a phantom extra component from the bench.
        const at=available.findIndex(e=>DATA.items.find(i=>i.id===e.item)?.recipe.includes(p.id));
        if(at>=0)ordered.push(available.splice(at,1)[0]);
      });
      return {entries:[...ordered,...available],missing,priorities};
    },
    itemizationOrder(guide){
      if(!guide||!this.priorities(guide).length)return [];
      const holders=this.build(guide).entries.map(entry=>entry.champion);
      return [...new Set(holders)].map(name=>[name]);
    },
    equipment(plan){
      const done=plan.queue.filter(q=>q.done),holders=new Map(done.map(q=>[q.uid,q.champion||'']));
      const guide=this.guide(plan);
      if(!guide)return holders;
      const names=new Set(guide.finalComp.map(c=>this.snapshot.champions.find(x=>x.apiName===c.apiName)?.name));
      const entries=[...this.build(guide).entries],pool=[],slots=new Map();
      const reserve=(name,id)=>slots.set(name,(slots.get(name)||0)+this.slotCost(id));
      for(const q of done){
        if(q.champion&&names.has(q.champion)){
          reserve(q.champion,q.item);
          // Keep the actual holder, even when this item was an off-guide pivot.
          const at=entries.findIndex(e=>this.itemMatches(e.item,q.item)&&e.champion===q.champion);
          if(at>=0)entries.splice(at,1);
        }else pool.push(q);
      }
      for(const q of pool){
        const at=entries.findIndex(e=>this.itemMatches(e.item,q.item)&&(slots.get(e.champion)||0)+this.slotCost(q.item)<=3);
        if(at<0)continue;
        const [{champion}]=entries.splice(at,1);
        holders.set(q.uid,champion);reserve(champion,q.item);
      }
      return holders;
    },
    priorities(guide){
      return (guide.carousel||[]).flatMap(p=>{
        const component=String(p.apiName||'').replace(/^DA_Component_|^TFT_Item_/,'');
        if(DATA.components.some(c=>c.id===component))return [{id:component,component:true}];
        const id=this.itemMap.get(p.apiName);return id?[{id,component:false}]:[];
      });
    },
    componentPreference(plan,id){
      const ordered=plan.activeComp?.itemPriority||[];
      const at=ordered.findIndex(p=>p.component&&p.id===id);return at<0?999:at;
    }
  };
};
