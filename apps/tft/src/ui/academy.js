function academyTierBadges(guide,label=guide.tier){
  const primary=`<span class="academy-tier tier-${esc(guide.tier)}">${esc(label)}</span>`;
  if(guide.tier!=='X')return primary;
  const secondary=Academy.secondaryTier(guide);
  return primary+(secondary
    ?` <span class="academy-tier tier-${secondary.tier}" title="${secondary.fromXRow?'Academy Situational row badge':'Saved Academy tier'}">${secondary.tier} · Patch ${esc(secondary.patch)}</span>`
    :' <span class="academy-tier">Secondary tier unavailable</span>');
}

const AcademyUI=(() => {
  let intent=0,controller,checking=true,error='';
  const bar=document.createElement('div');bar.className='academy-bar';
  bar.innerHTML='<a id="academy-tierlist" href="https://tftacademy.com/tierlist/comps" aria-haspopup="dialog">TFT Academy ↗</a><button id="refresh-live-data" class="quiet">Refresh live data</button><span id="academy-status" role="status"></span>';
  document.querySelector('.footer').before(bar);
  const warning=document.createElement('p');warning.id='live-data-warning';warning.className='live-data-warning';warning.setAttribute('role','alert');document.querySelector('.workspace').before(warning);
  const reference=document.createElement('details');reference.className='academy-reference';
  reference.innerHTML='<summary></summary><ul id="academy-source-guides"></ul>';
  bar.after(reference);
  const feedback=document.createElement('p');feedback.id='comp-feedback';feedback.className='quick-import-feedback';feedback.setAttribute('role','status');warning.after(feedback);
  let listed;
  function status(){
    const s=Academy.snapshot,updated=new Date(s.sourceUpdated||s.fetchedAt);
    const label=Number.isNaN(updated.getTime())?'':updated.toLocaleString(undefined,{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
    const el=document.getElementById('academy-status');
    el.textContent=checking?'Checking live data…':Academy.live?`Live · Patch ${s.patch}${label?' · updated '+label:''}`:`Saved · Patch ${s.patch}`;
    bar.querySelector('#refresh-live-data').disabled=checking;
    warning.hidden=checking||Academy.live;
    const message=`Live data is unavailable. Showing saved Patch ${s.patch} data.`;
    if(warning.textContent!==message)warning.textContent=message;
    warning.title=error;
    if(listed!==s){
      listed=s;
      const guides=s.guides.slice().sort((a,b)=>academyTier(a.tier).rank-academyTier(b.tier).rank||a.title.localeCompare(b.title));
      reference.querySelector('ul').innerHTML=guides.map(g=>`<li>${academyTierBadges(g)} <a href="https://tftacademy.com/tierlist/comps/${encodeURIComponent(g.compSlug)}" target="_blank" rel="noopener">${IconUI.championLabel(g.title,g.mainChampion?.apiName||g.title)}</a></li>`).join('');
    }
    reference.querySelector('summary').textContent=`${Academy.live?'Live Academy tier list':'Saved Academy tier list'} · Set ${s.set} · Patch ${s.patch}`;
  }
  const priority=document.createElement('div');priority.id='academy-priority';priority.className='academy-priority';priority.hidden=true;
  document.querySelector('.queuehead').before(priority);
  function drawPriority(){
    const current=Academy.currentGuide(state),list=current?Academy.priorities(current):[];priority.hidden=!list.length;
    priority.innerHTML=list.length?'<span>Academy priority</span>'+list.map((p,n)=>`${n?'<span aria-hidden="true">›</span>':''}<span class="academy-priority-item" title="${esc(byId[p.id]?.name||p.id)}" aria-label="${n+1}. ${esc(byId[p.id]?.name||p.id)}">${icon(p.id)}${p.component?`<small>${esc(shortNames[p.id]||byId[p.id]?.name||p.id)}</small>`:''}</span>`).join(''):'';
  }
  const oldRender=render;render=function(){oldRender();const title=document.getElementById('app-title'),carry=Academy.guide(state)?.mainChampion?.apiName;title.innerHTML=(carry?IconUI.champion(carry):'')+esc(state.activeComp?.title||'Carousel');status();drawPriority();};
  function plannedSet(){
    try{return Academy.decodeCode(state.activeComp?.code).set;}catch{return undefined;}
  }
  async function refreshData(set){
    controller?.abort();
    const request=new AbortController();
    controller=request;checking=true;error='';
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
    const refresh=refreshLiveData(model,{set,signal,fetchJSON:fetch});
    render();
    const result=await refresh;
    if(controller!==request)return false;
    checking=false;error=result.notice||'';
    if(result.updated){
      try{localStorage.setItem(Academy.cacheKey,JSON.stringify(Academy.snapshot));}catch{}
    }
    render();
    return result.updated;
  }
  async function importCode(text){
    const code=text.trim(),mine=++intent;
    feedback.classList.remove('error');
    let decoded;
    try{decoded=Academy.decodeCode(code);}catch(e){feedback.textContent=e.message;feedback.classList.add('error');return;}
    feedback.textContent='Checking live data for this team code…';
    const ready=await refreshData(decoded.set);
    if(mine!==intent)return;
    if(!ready){
      feedback.textContent='Couldn’t load live data for this team code. Try again.';
      feedback.classList.add('error');
      return;
    }
    let choice;
    try{choice=QuickImport.choose(code,state);}catch(e){feedback.textContent=e.message;feedback.classList.add('error');return;}
    let counts;
    mutate(()=>{counts=QuickImport.replace(state,choice,code);},
      `${choice.guide.title} imported. Current champions, inventory and chosen augments kept.`);
    document.dispatchEvent(new Event('carousel-comp-imported'));
    feedback.textContent=`${counts.pending} targets${counts.covered?' · '+counts.covered+' already owned':''}.`+
      (choice.variants>1?` ${choice.variants} guides share this code. Using ${choice.guide.title}.`:'');
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
  }
  const importGame = document.createElement('dialog');
  importGame.id = 'team-code-dialog';
  importGame.setAttribute('aria-labelledby', 'team-code-title');
  importGame.innerHTML = '<div class="modal-heading"><h2 id="team-code-title">Import a game</h2><button data-close="team-code-dialog" aria-label="Close game import">×</button></div><form><label for="team-code">TFT Academy team code</label><input id="team-code" class="search" required autofocus autocomplete="off"><button class="primary" type="submit">Import</button><p id="team-code-error" role="status"></p></form>';
  document.body.append(importGame);
  importGame.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();
    const button = importGame.querySelector('[type="submit"]');
    button.disabled = true;
    await importCode(importGame.querySelector('input').value);
    button.disabled = false;
    importGame.querySelector('#team-code-error').textContent = feedback.textContent;
  });
  document.addEventListener('paste',e=>{
    const text=e.clipboardData?.getData('text/plain')?.trim()||'';
    // Intercept team codes only. Ordinary text/backup JSON pastes keep their
    // normal behavior, including inside search fields and textareas.
    if(e.target.closest?.('#team-code')||!/^(?:01|02)[0-9a-f]*TFTSet\d+(?:_(?:Act2|Stage2_Revival))?$/i.test(text))return;
    e.preventDefault();void importCode(text);
  },true);
  bar.querySelector('#refresh-live-data').addEventListener('click',()=>void refreshData(plannedSet()));
  document.addEventListener('carousel-backup-imported',()=>void refreshData(plannedSet()));
  document.addEventListener('carousel-new-game',()=>{intent++;feedback.textContent='';feedback.classList.remove('error');void refreshData();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="undo"],#apply-import')){intent++;feedback.textContent='';feedback.classList.remove('error');}},true);
  void refreshData(plannedSet());
  return {
    isChecking:()=>checking,
    openImport() {
      importGame.querySelector('form').reset();
      importGame.querySelector('#team-code-error').textContent = '';
      importGame.showModal();
    }
  };
})();
