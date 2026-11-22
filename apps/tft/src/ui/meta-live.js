(() => {
  const key='carousel-metatft-v2',attempted=new Map(),waiting=[],pending=new Set(),connections=new Map();let active=0;
  const freshness=15*60000;
  const report=()=>document.dispatchEvent(new Event('carousel-meta-updated'));
  const mark=(id,fields)=>connections.set(id,{...(connections.get(id)||{}),...fields});
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'[]');
    if(Array.isArray(saved))for(const entry of saved)MetaBuilds.cache(entry,'browser cache');
  }catch{}
  const status=document.createElement('span');status.id='meta-status';status.className='meta-status';document.querySelector('.academy-bar').append(status);
  MetaBuilds.connection=name=>{
    const cached=MetaBuilds.find(name,true);
    return {...connections.get(MetaBuilds.champion(name)?.apiName),source:cached?.source||'none'};
  };
  MetaBuilds.connections=()=>[...connections.entries()].filter(([id,s])=>s.checked).map(([id,s])=>({unit:id,...s}));
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
    const names=[...new Set(state.queue.map(q=>q.champion).filter(Boolean))];
    const info=names.map(n=>MetaBuilds.connection(n)),errors=info.filter(s=>s.error).length;
    const staleLive=info.some(s=>s.error?.startsWith('Stale patch'));
    const live=info.filter(s=>s.source==='live').length;
    const relevant=names.map(name=>MetaBuilds.find(name,true)?.entry).filter(Boolean);
    const reported=relevant.length?relevant:[META_BUNDLED];
    const sources=new Map();
    for(const data of reported){
      const updated=new Date(data.sourceUpdated||data.updated);
      const date=Number.isNaN(updated.getTime())?'unknown date':updated.toISOString().slice(0,10);
      const stale=data.patch!==Academy.snapshot.patch;
      const source=`Patch ${data.patch||'unknown'} · ${date}${stale?' · stale patch':''}`;
      sources.set(source,stale);
    }
    const statusText=active?'checking…':!names.length?'awaiting champion':errors?'refresh unavailable':live===names.length?'live stats':live?'live + cached stats':'saved stats';
    status.innerHTML='<a href="https://www.metatft.com/units" target="_blank" rel="noopener noreferrer">MetaTFT supplement</a> · '+
      [...sources].map(([label,stale])=>`<span class="${stale?'source-notice':''}">${esc(label)}</span>`).join(' / ')+' · '+statusText+(staleLive?' · live returned a stale patch':'');
    status.title='Requests go to api-hc.metatft.com. Data & keys shows last checks and errors. Academy remains the baseline.';
  }

  function request(unit){
    const id=unit.apiName,now=Date.now(),info=connections.get(id)||{};
    const {set,patch}=Academy.snapshot,requestKey=JSON.stringify([id,set,patch]);
    if(pending.has(requestKey)||now-(attempted.get(requestKey)||0)<(info.error?5*60000:freshness))return;
    const cached=MetaBuilds.dataFor({champion:unit.name});
    if(cached&&now-Number(cached.fetchedAt||0)<freshness)return;
    attempted.set(requestKey,now);mark(id,{checked:now,error:'',phase:'queued'});
    pending.add(requestKey);waiting.push({id,set,patch,requestKey});pump();
  }

  async function pump(){
    if(active>=3||!waiting.length)return;const {id,set,patch,requestKey}=waiting.shift();active++;mark(id,{phase:'checking'});draw();report();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const base='https://api-hc.metatft.com/tft-stat-api/unit_detail_';
      const fetchData=async kind=>{const r=await fetch(base+kind+'?unit='+encodeURIComponent(id)+'&queue=1100&patch=current&days=3&rank=CHALLENGER,DIAMOND,EMERALD,GRANDMASTER,MASTER,PLATINUM&permit_filter_adjustment=true'+(kind==='items'?'&num_items=3':''),{credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
      const [overall,items]=await Promise.all([fetchData('overall'),fetchData('items')]);
      const data=MetaBuilds.compact(overall,items);if(data.unit!==id||data.set!=='TFTSet'+set||!data.builds.length)throw Error('Stats unavailable for this set');
      if(data.patch!==patch)throw Error(`Stale patch ${data.patch||'unknown'} (Academy ${patch})`);
      if(!MetaBuilds.isCompatible(data))return;
      data.fetchedAt=Date.now();MetaBuilds.cache(data,'live');mark(id,{success:Date.now(),error:''});
      try{localStorage.setItem(key,JSON.stringify(MetaBuilds.cached()));}catch{}
    }catch(e){mark(id,{error:e.name==='AbortError'?'Timed out':e.message||'Network / CORS unavailable'});}
    finally{clearTimeout(timer);active--;pending.delete(requestKey);mark(id,{phase:'idle'});draw();document.dispatchEvent(new Event('carousel-meta-updated'));pump();}
  }
  function checkActive(){for(const q of state.queue.filter(q=>q.champion))MetaBuilds.request(q.champion);}
  if(window.addEventListener){window.addEventListener('online',()=>{attempted.clear();checkActive();});window.addEventListener('focus',checkActive);}
  if(typeof setInterval==='function')setInterval(()=>{if(!document.hidden)checkActive();},60000);
  const oldRender=render;render=function(){oldRender();draw();for(const q of state.queue.filter(q=>q.champion)){const unit=MetaBuilds.champion(q.champion);if(unit)request(unit);}};
  document.addEventListener('carousel-new-game',()=>{attempted.clear();for(const task of waiting.splice(0))pending.delete(task.requestKey);});
  document.getElementById('queue').addEventListener('click',e=>{
    const b=e.target.closest('[data-ready-pivot]');if(!b)return;
    const q=state.queue.find(q=>q.uid===b.dataset.queueUid&&!q.done);if(!q)return;
    const choice=MetaBuilds.suggest(state,q.uid,MetaBuilds.dataFor(q));
    if(!choice||choice.item.id!==b.dataset.readyPivot||!OfflineTracker.canCraft(state.owned,choice.item)){draw();return;}
    const name=byId[q.item].name;
    mutate(()=>{PivotPlanner.replace(state,q.uid,choice.item.id,DATA.items,true);q.received=false;},`${choice.item.name} built instead of ${name}.`);
  });
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Build instead</b> beneath a queued item offers a one-click, craftable pivot. MetaTFT suggestions rank three-item builds around your champion’s equipped items, then show the best craftable pivot. Only S/A builds with at least 100 games qualify. The three small icons show the full build; other unbuilt targets may differ. With no strong match, no pivot is suggested. Generic similarity is only used for items without an assigned champion. Undo restores the original item and ingredients.</li>');
  render();
})();
