/* Per-item pivots. */
(() => {
  let targetId=null,pivotQuery='',lastCandidates;
  function matches(item,text){const words=text.toLowerCase().trim().split(/\s+/).filter(Boolean);const hay=[item.name,...item.recipe.map(id=>byId[id].name),...PivotPlanner.profile(item.id).flatMap(r=>[r,PivotPlanner.labels[r]])].join(' ').toLowerCase();return words.every(w=>hay.includes(w));}
  const dialog=document.createElement('dialog');dialog.id='pivot-dialog';dialog.setAttribute('aria-labelledby','pivot-title');
  dialog.innerHTML='<div class="pivot-dialog-head"><div id="pivot-original"></div><button id="close-pivot" aria-label="Close pivot chooser">×</button></div><label class="visuallyhidden" for="pivot-search">Find a replacement</label><input id="pivot-search" class="search" type="search" placeholder="Find an item…"><div id="pivot-results"></div>';
  document.body.append(dialog);
  function drawCandidates(){
    const target=state.queue.find(q=>q.uid===targetId&&!q.done);
    if(!target){if(dialog.open)dialog.close();return;}
    document.getElementById('pivot-original').innerHTML=`${icon(target.item)}<div><small>Pivot${target.champion?' · '+IconUI.championLabel(target.champion):''}</small><h2 id="pivot-title">${esc(byId[target.item].name)}</h2></div>`;
    const pool=PivotPlanner.available(state,targetId,DATA.items);
    const sourceType=Academy.itemInfo(target.item)?.type;
    const results=PivotPlanner.suggest(state,targetId,DATA.items,{role:'all'}).filter(r=>
      (!r.item.academyOnly||byId[target.item].academyOnly&&Academy.itemInfo(r.item.id)?.type===sourceType)&&
      Academy.canEquip(state,target.champion,r.item.id)&&matches(r.item,pivotQuery));
    const meta=typeof MetaBuilds!=='undefined'&&MetaBuilds.dataFor?MetaBuilds.ranked(state,targetId,MetaBuilds.dataFor(target)):[];
    const ranks=new Map(meta.map((r,n)=>[r.item.id,{...r,order:n}]));
    if(target.champion)results.sort((a,b)=>(ranks.get(a.item.id)?.order??999)-(ranks.get(b.item.id)?.order??999));
    const candidates=results.map(r=>{
      const i=r.item,costs={...pool};
      const recipe=i.recipe.map(c=>{const have=(costs[c]||0)>0;if(have)costs[c]--;return `<span class="pivot-ingredient ${have?'have':''}" aria-label="${esc(byId[c].name)} ${have?'owned':'needed'}">${icon(c)}<span>${shortNames[c]}${have?' ✓':''}</span></span>`;}).join('<b>+</b>');
      return `<article class="pivot-option"><div class="pivot-itemhead">${icon(i.id)}<h3>${esc(i.name)}</h3>${ranks.has(i.id)?`<small class="pivot-meta-tier">MetaTFT ${ranks.get(i.id).tier}${ranks.get(i.id).rankFilter==='ALL'?' · all ranks':''}</small>`:''}</div><div class="pivot-recipe">${recipe||'Received item'}<small>${esc(r.reasons.filter(reason=>reason.points).map(reason=>reason.text).join(' · '))}</small></div><div class="pivot-actions"><button data-pivot-item="${i.id}" data-pivot-kind="plan">Plan instead</button>${i.recipe.length===2?`<button class="primary" data-pivot-item="${i.id}" data-pivot-kind="built" ${Tracker.canCraft(state.owned,i)?'':'disabled title="Track both recipe components first"'}>Build instead</button>`: ''}</div></article>`;
    }).join('')||'<p class="emptysearch">No matching items.</p>';
    if(candidates!==lastCandidates){
      document.getElementById('pivot-results').innerHTML=candidates;
      lastCandidates=candidates;
    }
  }
  function openPivot(uid){targetId=uid;pivotQuery='';document.getElementById('pivot-search').value='';drawCandidates();dialog.showModal();document.getElementById('pivot-results').scrollTop=0;}
  document.addEventListener('carousel-meta-updated',()=>{if(dialog.open)drawCandidates();});
  window.PivotDialog={open:uid=>{if(state.queue.some(q=>q.uid===uid&&!q.done))openPivot(uid);}};
  document.getElementById('close-pivot').addEventListener('click',()=>dialog.close());
  document.getElementById('pivot-search').addEventListener('input',e=>{pivotQuery=e.target.value;drawCandidates();});
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('[data-pivot-item]');if(!b)return;
    const target=state.queue.find(q=>q.uid===targetId&&!q.done);if(!target){dialog.close();return;}
    const id=b.dataset.pivotItem,built=b.dataset.pivotKind==='built',original=byId[target.item].name;
    if(!Academy.canEquip(state,target.champion,id)||built&&!Tracker.canCraft(state.owned,byId[id]))return;
    applyItemPivot(next=>PivotPlanner.replace(next,target.uid,id,DATA.items,built),
      `${byId[id].name} ${built?'built':'planned'} instead of ${original}.`,()=>dialog.close());
  });
  const oldRender=render;
  render=function(){
    oldRender();
    for(const card of document.querySelectorAll('.qcard')){
      const id=card.querySelector('[data-action="remove"]')?.dataset.id,q=state.queue.find(q=>q.uid===id);
      if(!q)continue;
      const b=document.createElement('button');b.className='pivot-trigger';b.textContent='Pivot';b.setAttribute('aria-label',`Pivot ${byId[q.item].name}${q.champion?' for '+q.champion:''}`);b.addEventListener('click',()=>openPivot(id));card.querySelector('.qbottom').prepend(b);
    }
    if(dialog.open)drawCandidates();
  };
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li>On a queued item, <b>Pivot</b> ranks alternatives by MetaTFT for assigned champions; unassigned items use similarity. <b>Plan instead</b> replaces its target; <b>Build instead</b> also consumes tracked ingredients. Undo reverses either action.</li>');
  render();
})();
