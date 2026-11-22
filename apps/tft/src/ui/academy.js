(() => {
  let intent=0,refreshTask=null,refreshSet=null,refreshNote='saved data';
  const bar=document.createElement('div');bar.className='academy-bar';
  bar.innerHTML='<a id="academy-tierlist" href="https://tftacademy.com/tierlist/comps" aria-haspopup="dialog">TFT Academy tierlist ↗</a><span id="academy-status" role="status"></span>';
  document.querySelector('.pagehead').after(bar);
  const feedback=document.createElement('p');feedback.id='comp-feedback';feedback.className='quick-import-feedback';feedback.setAttribute('role','status');bar.after(feedback);
  function status(){
    const s=Academy.snapshot,date=new Date(s.sourceUpdated||s.fetchedAt),label=Number.isNaN(date.getTime())?'unknown':date.toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const el=document.getElementById('academy-status');
    el.textContent=`Updated ${label} · Patch ${s.patch||'unknown'}${refreshNote?' · '+refreshNote:''}`;
    el.classList.toggle('source-notice',refreshNote.includes('unavailable'));
    el.title='TFT Academy’s last tierlist update. Data checks run automatically in the background.';
  }
  const priority=document.createElement('div');priority.id='academy-priority';priority.className='academy-priority';priority.hidden=true;
  document.querySelector('.queuehead').before(priority);
  function drawPriority(){
    const list=state.activeComp?.itemPriority||[];priority.hidden=!list.length;
    priority.innerHTML=list.length?'<span>Academy priority</span>'+list.map((p,n)=>`${n?'<span aria-hidden="true">›</span>':''}<span class="academy-priority-item" title="${esc(byId[p.id]?.name||p.id)}${p.component?' · component preference':''}" aria-label="${n+1}. ${esc(byId[p.id]?.name||p.id)}${p.component?', component preference':''}">${icon(p.id)}${p.component?'<small>component</small>':''}</span>`).join(''):'';
  }
  const oldRender=render;render=function(){oldRender();document.getElementById('app-title').textContent=state.activeComp?.title||'Carousel';status();drawPriority();};
  async function refreshData(set){
    const key=set||'current';
    if(refreshTask){
      if(refreshSet===key)return refreshTask;
      const previous=refreshTask;await previous;
      return refreshData(set);
    }
    refreshSet=key;refreshNote='updating…';status();
    const task=(async()=>{
      const result=await refreshAcademy(Academy,{set,bundledSet:ACADEMY_BUNDLED.set,fetchJSON:fetch});
      refreshNote=result.notice;
      if(!result.updated){status();return false;}
      try{localStorage.setItem(Academy.cacheKey,JSON.stringify(Academy.snapshot));}
      catch{refreshNote='updated for this session';}
      render();
      return true;
    })();
    refreshTask=task;
    try{return await task;}finally{if(refreshTask===task){refreshTask=null;refreshSet=null;}}
  }
  async function importCode(text){
    const code=text.trim(),mine=++intent;
    feedback.classList.remove('error');
    let decoded;
    try{decoded=Academy.decodeCode(code);}catch(e){feedback.textContent=e.message;feedback.classList.add('error');return;}
    let choice;
    try{choice=QuickImport.choose(code);}catch(e){
      feedback.textContent='Checking TFT Academy for this comp…';
      await refreshData(decoded.set);
      if(mine!==intent)return;
      try{choice=QuickImport.choose(code);}catch(err){feedback.textContent='Could not match this code exactly. Your queue and inventory are unchanged. Copy the full code from a TFT Academy final board and paste it again when online.';feedback.classList.add('error');return;}
    }
    if(mine!==intent)return;
    let counts;
    mutate(()=>{counts=QuickImport.replace(state,choice,code);},`${choice.guide.title} imported. Bench and completed items kept.`);
    document.dispatchEvent(new Event('carousel-comp-imported'));
    feedback.textContent=`${counts.pending} targets${counts.covered?' · '+counts.covered+' already owned':''}.`+(choice.variants>1?` ${choice.variants} guides share this code; using the highest-tier, most recently updated match.`:'');
    document.getElementById('item-drawer').removeAttribute('open');
    // A recognized code also works when a search field or utility dialog has
    // focus. Return directly to the tracker after importing.
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
  }
  document.addEventListener('paste',e=>{
    const text=e.clipboardData?.getData('text/plain')?.trim()||'';
    // Intercept team codes only. Ordinary text/backup JSON pastes keep their
    // normal behavior, including inside search fields and textareas.
    if(!/^(?:01|02)[0-9a-f]*TFTSet\d+(?:_(?:Act2|Stage2_Revival))?$/i.test(text))return;
    e.preventDefault();void importCode(text);
  },true);
  document.addEventListener('carousel-new-game',()=>{intent++;feedback.textContent='';feedback.classList.remove('error');void refreshData();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="undo"],#apply-import')){intent++;feedback.textContent='';feedback.classList.remove('error');}},true);
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li>Paste a TFT Academy team code anywhere with <b>Ctrl/Cmd + V</b>. Its final-board items immediately replace unfinished targets, ordered by Academy’s Item Priority list. Each listed item promotes one copy; component-only lists use the guide’s early-board items first, then favor recipes using its preferred components. Early holder → final holder appears on those cards. Loose components and completed items stay; matching completed items count toward the new build. Undo reverses the import.</li><li><b>New game</b> immediately clears targets, completed items, components, and pins. Academy data refreshes in the background on launch and on each new game. If unavailable, saved data keeps working.</li><li>Only exact champion matches are imported. If multiple guides use the same code, the highest-tier, most recently updated guide is used and shown in the heading.</li>');
  render();
  void refreshData();
})();
