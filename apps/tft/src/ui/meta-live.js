(() => {
  const key='carousel-metatft-v2',attempted=new Map(),waiting=[],pending=new Map(),connections=new Map();let active=0;
  const {freshness}=MetaBuilds;
  const report=()=>document.dispatchEvent(new Event('carousel-meta-updated'));
  const mark=(id,fields)=>connections.set(id,{...(connections.get(id)||{}),...fields});
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'[]');
    if(Array.isArray(saved))for(const entry of saved)MetaBuilds.cache(entry,'browser cache');
  }catch{}
  const status=document.createElement('span');status.id='meta-status';status.className='meta-status';document.querySelector('.academy-bar').append(status);
  const statusLink='<a href="https://www.metatft.com/units" target="_blank" rel="noopener noreferrer">MetaTFT supplement</a>';
  function connection(unit){
    const info=connections.get(unit),cached=MetaBuilds.find(Academy.snapshot.champions.find(c=>c.apiName===unit)?.name,true);
    const live=MetaBuilds.isCompatible(cached?.entry);
    return {...info,unit,source:cached?.source==='live'&&!live?'saved':cached?.source||'unavailable'};
  }
  MetaBuilds.connection=name=>connection(MetaBuilds.champion(name)?.apiName);
  MetaBuilds.pivotNotice=name=>{
    if(!name||MetaBuilds.dataFor({champion:name}))return '';
    const {revision,phase}=MetaBuilds.connection(name);
    return Academy.live&&revision===Academy.revision&&phase!=='idle'
      ?'Academy baseline — checking MetaTFT champion data'
      :'Academy baseline — MetaTFT champion data unavailable';
  };
  MetaBuilds.request= name=>{const unit=MetaBuilds.champion(name);if(unit)request(unit);};
  function draw(){
    for(const card of document.querySelectorAll('#queue .qcard')){
      card.querySelector('.inline-pivot')?.remove();
      const uid=card.querySelector('[data-action="remove"]')?.dataset.id,q=state.queue.find(q=>q.uid===uid&&!q.done);if(!q)continue;
      const data=MetaBuilds.dataFor(q);
      const choice=MetaBuilds.suggest(state,uid,data);if(!choice)continue;
      const el=document.createElement('div');el.className='inline-pivot';
      const context=choice.source==='meta'?'<span class="pivot-build-context" aria-label="Ranked build: '+esc(choice.build.map(id=>byId[id].name).join(', '))+'">'+choice.build.map(id=>icon(id)).join('')+'</span>':'';
      const source=choice.source==='meta'?`<a href="https://www.metatft.com/units/${encodeURIComponent(q.champion)}" target="_blank" rel="noopener noreferrer">MetaTFT <b>${choice.tier}</b> build${choice.rankFilter==='ALL'?' · all ranks':''}</a>`:'<span>Similar item</span>';
      el.innerHTML=`<div class="inline-pivot-label">Build instead <span class="pivot-source">${source}${context}</span></div><button class="inline-pivot-build" data-ready-pivot="${esc(choice.item.id)}" data-queue-uid="${esc(uid)}" aria-label="Build ${esc(choice.item.name)} instead of ${esc(byId[q.item].name)}${q.champion?' for '+esc(q.champion):''}">${icon(choice.item.id)}<strong>${esc(choice.item.name)}</strong><span class="inline-pivot-recipe">${choice.item.recipe.map(id=>icon(id)).join('<span>+</span>')}</span><span class="inline-build-label">Build</span></button>`;
      card.append(el);
    }
    if(AcademyUI.isChecking()||[...pending.values()].includes(Academy.revision)){
      status.innerHTML=statusLink+' · checking…';
      return;
    }
    const names=[...new Set(state.queue.map(q=>q.champion).filter(Boolean))];
    const info=names.map(n=>MetaBuilds.connection(n));
    const errors=info.map(s=>s.revision===Academy.revision?s.error:'');
    const failed=!Academy.live||errors.some(Boolean);
    const relevant=names.flatMap((name,i)=>{
      const data=MetaBuilds.find(name,true)?.entry;
      return data&&(MetaBuilds.isCompatible(data)||!Academy.live||errors[i])?[data]:[];
    });
    const currentProbe=MetaBuilds.dataFor({champion:Academy.snapshot.champions.find(c=>c.apiName===Academy.liveMetaUnit)?.name});
    const reported=relevant.length?relevant:currentProbe?[currentProbe]:failed?[META_BUNDLED]:[];
    const sources=new Map();
    for(const data of reported){
      const updated=new Date(data.sourceUpdated||data.updated);
      const date=Number.isNaN(updated.getTime())?'unknown date':updated.toISOString().slice(0,10);
      const stale=!MetaBuilds.isCompatible(data);
      const source=`Patch ${data.patch||'unknown'} · ${date}${stale?' · saved data':''}`;
      sources.set(source,stale);
    }
    const statusText=failed?'refresh unavailable':'';
    const labels=[...sources].map(([label,stale])=>`<span class="${stale?'source-notice':''}">${esc(label)}</span>`).join(' / ');
    status.innerHTML=[statusLink,labels,statusText].filter(Boolean).join(' · ');
  }

  function request(unit){
    if(!Academy.live)return;
    const id=unit.apiName,now=Date.now(),info=connections.get(id)||{};
    const {set,patch}=Academy.snapshot,revision=Academy.revision,requestKey=JSON.stringify([id,revision]);
    if(pending.has(requestKey)||now-(attempted.get(requestKey)||0)<(info.error?5*60000:freshness))return;
    const cached=MetaBuilds.dataFor({champion:unit.name});
    if(cached&&now-Number(cached.fetchedAt||0)<freshness){
      if(info.revision!==revision)mark(id,{revision,phase:'idle',error:''});
      return;
    }
    attempted.set(requestKey,now);mark(id,{revision,error:'',phase:'queued'});
    pending.set(requestKey,revision);waiting.push({id,set,patch,revision,requestKey});pump();
  }

  async function pump(){
    if(active>=3||!waiting.length)return;
    const {id,set,patch,revision,requestKey}=waiting.shift();
    if(revision!==Academy.revision){pending.delete(requestKey);pump();return;}
    active++;mark(id,{phase:'checking'});draw();report();
    try{
      const result=await fetchMetaTFT(id,{fetchJSON:fetch});
      if(revision!==Academy.revision)return;
      const data=MetaBuilds.compact(result.overall,result.items,result.patch);
      if(data.set!=='TFTSet'+set||!data.builds.length)throw Error('Stats unavailable for this set');
      if(data.patch!==patch)throw Error(`Stale patch ${data.patch} (Academy ${patch})`);
      data.fetchedAt=Date.now();MetaBuilds.cache(data,'live');mark(id,{error:''});
      try{localStorage.setItem(key,JSON.stringify(MetaBuilds.cached()));}catch{}
    }catch(e){
      if(revision===Academy.revision){
        MetaBuilds.invalidate(id);
        mark(id,{error:e.name==='TimeoutError'?'Timed out':e.message||'Network / CORS unavailable'});
      }
    }finally{
      active--;pending.delete(requestKey);
      if(revision===Academy.revision)mark(id,{phase:'idle'});
      draw();report();pump();
    }
  }
  function checkActive(){for(const q of state.queue.filter(q=>q.champion))MetaBuilds.request(q.champion);}
  if(window.addEventListener){window.addEventListener('online',()=>{attempted.clear();checkActive();});window.addEventListener('focus',checkActive);}
  if(typeof setInterval==='function')setInterval(()=>{if(!document.hidden)checkActive();},60000);
  const oldRender=render;render=function(){oldRender();checkActive();draw();};
  document.addEventListener('carousel-new-game',()=>{attempted.clear();for(const task of waiting.splice(0))pending.delete(task.requestKey);});
  document.getElementById('queue').addEventListener('click',e=>{
    const b=e.target.closest('[data-ready-pivot]');if(!b)return;
    const q=state.queue.find(q=>q.uid===b.dataset.queueUid&&!q.done);if(!q)return;
    const choice=MetaBuilds.suggest(state,q.uid,MetaBuilds.dataFor(q));
    if(!choice||choice.item.id!==b.dataset.readyPivot||!OfflineTracker.canCraft(state.owned,choice.item)){draw();return;}
    const name=byId[q.item].name;
    applyItemPivot(next=>PivotPlanner.replace(next,q.uid,choice.item.id,DATA.items,true),`${choice.item.name} built instead of ${name}.`);
  });
  render();
})();
