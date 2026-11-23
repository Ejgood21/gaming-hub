function academyTierBadges(guide,label=guide.tier){
  const primary=`<span class="academy-tier tier-${esc(guide.tier)}">${esc(label)}</span>`;
  if(guide.tier!=='X')return primary;
  const secondary=Academy.secondaryTier(guide);
  return primary+(secondary
    ?` <span class="academy-tier tier-${secondary.tier}" title="${secondary.fromXRow?'Academy Situational row badge':'Saved Academy tier'}">${secondary.tier} · Patch ${esc(secondary.patch)}</span>`
    :' <span class="academy-tier">Secondary tier unavailable</span>');
}

(() => {
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
    const label=Number.isNaN(updated.getTime())?'unknown time':updated.toLocaleString();
    const saved=new Date(s.fetchedAt||s.sourceUpdated);
    const date=Number.isNaN(saved.getTime())?'an unknown date':saved.toISOString().slice(0,10);
    const el=document.getElementById('academy-status');
    el.textContent=checking?'Checking live data…':Academy.live?`Live · Patch ${s.patch} · updated ${label}`:`Saved · Patch ${s.patch} · ${date}`;
    document.getElementById('recipe-freshness').hidden=Academy.live&&s.patch===DATA.patch;
    bar.querySelector('#refresh-live-data').disabled=checking;
    warning.hidden=checking||Academy.live;
    const message=`Live data unavailable — showing saved Patch ${s.patch} data from ${date}. Recommendations may be wrong for the current patch.`;
    if(warning.textContent!==message)warning.textContent=message;
    warning.title=error;
    if(listed!==s){
      listed=s;
      const guides=s.guides.slice().sort((a,b)=>academyTier(a.tier).rank-academyTier(b.tier).rank||a.title.localeCompare(b.title));
      reference.querySelector('ul').innerHTML=guides.map(g=>`<li>${academyTierBadges(g)} <a href="https://tftacademy.com/tierlist/comps/${encodeURIComponent(g.compSlug)}" target="_blank" rel="noopener">${esc(g.title)}</a></li>`).join('');
    }
    reference.querySelector('summary').textContent=`${Academy.live?'Live Academy tier list':'Stale Academy tier list · reference only'} · Set ${s.set} · Patch ${s.patch}`;
  }
  const priority=document.createElement('div');priority.id='academy-priority';priority.className='academy-priority';priority.hidden=true;
  document.querySelector('.queuehead').before(priority);
  function drawPriority(){
    const current=Academy.currentGuide(state),list=current?Academy.priorities(current):[];priority.hidden=!list.length;
    priority.innerHTML=list.length?'<span>Academy priority</span>'+list.map((p,n)=>`${n?'<span aria-hidden="true">›</span>':''}<span class="academy-priority-item" title="${esc(byId[p.id]?.name||p.id)}${p.component?' · component preference':''}" aria-label="${n+1}. ${esc(byId[p.id]?.name||p.id)}${p.component?', component preference':''}">${icon(p.id)}${p.component?'<small>component</small>':''}</span>`).join(''):'';
  }
  const oldRender=render;render=function(){oldRender();document.getElementById('app-title').textContent=state.activeComp?.title||'Carousel';status();drawPriority();};
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
      feedback.textContent='Live data could not be verified for this team code. Your plan is still saved.';
      feedback.classList.add('error');
      return;
    }
    let choice;
    try{choice=QuickImport.choose(code,state);}catch(e){feedback.textContent=e.message;feedback.classList.add('error');return;}
    let counts;
    mutate(()=>{counts=QuickImport.replace(state,choice,code);},`${choice.guide.title} imported. Bench and completed items kept.`);
    document.dispatchEvent(new Event('carousel-comp-imported'));
    feedback.textContent=`${counts.pending} targets${counts.covered?' · '+counts.covered+' already owned':''}.`+
      (choice.variants>1?` ${choice.variants} guides share this code. Using ${choice.guide.title}.`:'');
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
  }
  document.addEventListener('paste',e=>{
    const text=e.clipboardData?.getData('text/plain')?.trim()||'';
    // Intercept team codes only. Ordinary text/backup JSON pastes keep their
    // normal behavior, including inside search fields and textareas.
    if(!/^(?:01|02)[0-9a-f]*TFTSet\d+(?:_(?:Act2|Stage2_Revival))?$/i.test(text))return;
    e.preventDefault();void importCode(text);
  },true);
  bar.querySelector('#refresh-live-data').addEventListener('click',()=>void refreshData(plannedSet()));
  document.addEventListener('carousel-backup-imported',()=>void refreshData(plannedSet()));
  document.addEventListener('carousel-new-game',()=>{intent++;feedback.textContent='';feedback.classList.remove('error');void refreshData();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="undo"],#apply-import')){intent++;feedback.textContent='';feedback.classList.remove('error');}},true);
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li>Paste a TFT Academy team code anywhere with <b>Ctrl/Cmd + V</b>. Its final-board items immediately replace unfinished targets, ordered by Academy’s Item Priority list. Each listed item promotes one copy; component-only lists use the guide’s early-board items first, then favor recipes using its preferred components. Early holder → final holder appears on those cards. Loose components and completed items stay; matching completed items count toward the new build. Undo reverses the import.</li><li><b>New game</b> immediately clears targets, completed items, components, and pins. Live data is checked when you open Carousel, start a new game, paste a code or select <b>Refresh live data</b>. Saved tier lists remain available as stale reference during an outage.</li><li>Only exact champion matches are imported. If multiple guides use the same code, the highest-tier, most recently updated guide is used and shown in the heading.</li>');
  void refreshData(plannedSet());
})();
