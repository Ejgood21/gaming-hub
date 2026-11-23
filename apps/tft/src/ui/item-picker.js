/* Compact item picker and per-item pivots. */
(() => {
  const view=()=>state;
  let showNames=false,previewId=null,targetId=null,pivotQuery='';
  const tools=document.querySelector('.catalogtools');
  tools.querySelector('.filters').remove();
  const pickerControls=document.createElement('div');
  pickerControls.innerHTML=`<div class="picker-label"><span>Start with a component</span><button id="toggle-names" aria-pressed="false">Show names</button></div><div id="component-picker" class="component-picker" role="group" aria-label="Filter items by component"></div><div class="picker-caption"><span id="picker-caption">All recipes</span><span id="picker-results"></span></div><div id="item-preview" class="item-preview" aria-live="polite"></div>`;
  tools.append(pickerControls);
  document.querySelector('.catalogfoot').textContent='Click an icon to add. Click again for another copy. / to search.';
  const search=document.getElementById('search');search.placeholder='Name, role or component…';
  function matches(item,text){const words=text.toLowerCase().trim().split(/\s+/).filter(Boolean);const hay=[item.name,...item.recipe.map(id=>byId[id].name),...PivotPlanner.profile(item.id).flatMap(r=>[r,PivotPlanner.labels[r]])].join(' ').toLowerCase();return words.every(w=>hay.includes(w));}
  function drawPreview(id){
    previewId=id;const i=byId[id];
    document.getElementById('item-preview').innerHTML=i?`<strong>${esc(i.name)}</strong><span>${i.recipe.map(c=>`${icon(c)}<span>${shortNames[c]}</span>`).join('<b>+</b>')}</span>`:'<strong>Pick your next build</strong><span>Hover or focus an item to see its recipe.</span>';
  }
  renderCatalog=function(){
    const v=view(),found=DATA.items.filter(i=>!i.academyOnly&&(!filter||i.recipe.includes(filter))&&matches(i,query));
    document.getElementById('component-picker').innerHTML=`<button class="base-filter all" data-base="" aria-pressed="${!filter}" title="All item recipes">All</button>`+components.map(c=>`<button class="base-filter" data-base="${c.id}" aria-pressed="${filter===c.id}" title="${esc(c.name)} recipes" aria-label="Show ${esc(c.name)} recipes">${icon(c.id)}</button>`).join('');
    document.getElementById('picker-caption').textContent=filter?byId[filter].name+' recipes':'All recipes';
    document.getElementById('picker-results').textContent=`${found.length} items`;
    const catalog=document.getElementById('catalog');catalog.className='catalog fast-catalog'+(showNames?' with-names':'');
    catalog.innerHTML=found.map(i=>{
      const n=v.queue.filter(q=>q.item===i.id&&!q.done).length;
      const recipe=i.recipe.map(id=>byId[id].name).join(' + ');
      return `<button class="quick-item" data-action="add" data-id="${i.id}" data-focus="add-${i.id}" aria-label="Add ${esc(i.name)}. ${esc(recipe)}${n?'. '+n+' already planned':''}" title="${esc(i.name)} — ${esc(recipe)}">${icon(i.id)}${showNames?`<span>${esc(i.name)}</span>`:''}${n?`<b class="quick-count">${n}</b>`:''}</button>`;
    }).join('')||'<p class="emptysearch">No matching items. Try another component or clear your search.</p>';
    drawPreview(found.some(i=>i.id===previewId)?previewId:found[0]?.id);
  };
  document.getElementById('component-picker').addEventListener('click',e=>{const b=e.target.closest('[data-base]');if(!b)return;filter=filter===b.dataset.base?'':b.dataset.base;renderCatalog();document.querySelector(`[data-base="${filter}"]`)?.focus();});
  document.getElementById('toggle-names').addEventListener('click',e=>{showNames=!showNames;e.currentTarget.setAttribute('aria-pressed',String(showNames));e.currentTarget.textContent=showNames?'Hide names':'Show names';renderCatalog();});
  const catalog=document.getElementById('catalog');
  for(const event of ['mouseover','focusin'])catalog.addEventListener(event,e=>{const b=e.target.closest('.quick-item');if(b)drawPreview(b.dataset.id);});
  search.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=catalog.querySelector('.quick-item');if(first){e.preventDefault();first.click();search.focus();}}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();document.getElementById('item-drawer').setAttribute('open','');search.focus();}});

  const drawer=document.createElement('details');drawer.id='item-drawer';drawer.className='item-drawer panel';
  drawer.innerHTML='<summary><span>+ Add an item</span><span class="drawer-key"><kbd>/</kbd></span></summary>';
  document.querySelector('.workspace').before(drawer);drawer.append(document.querySelector('.leftcol'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.hasAttribute('open')&&!document.querySelector('dialog[open]')){drawer.removeAttribute('open');drawer.querySelector('summary').focus();}});
  document.addEventListener('carousel-new-game',()=>{drawer.removeAttribute('open');query='';filter='';search.value='';renderCatalog();});
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
    document.getElementById('pivot-results').innerHTML=results.map(r=>{
      const i=r.item,costs={...pool};
      const recipe=i.recipe.map(c=>{const have=(costs[c]||0)>0;if(have)costs[c]--;return `<span class="pivot-ingredient ${have?'have':''}" aria-label="${esc(byId[c].name)} ${have?'owned':'needed'}">${icon(c)}<span>${shortNames[c]}${have?' ✓':''}</span></span>`;}).join('<b>+</b>');
      return `<article class="pivot-option"><div class="pivot-itemhead">${icon(i.id)}<h3>${esc(i.name)}</h3>${ranks.has(i.id)?`<small class="pivot-meta-tier">MetaTFT ${ranks.get(i.id).tier}${ranks.get(i.id).rankFilter==='ALL'?' · all ranks':''}</small>`:''}</div><div class="pivot-recipe">${recipe||'Received item'}<small>${esc(r.reasons.filter(reason=>reason.points).map(reason=>reason.text).join(' · '))}</small></div><div class="pivot-actions"><button data-pivot-item="${i.id}" data-pivot-kind="plan">Plan instead</button>${i.recipe.length===2?`<button class="primary" data-pivot-item="${i.id}" data-pivot-kind="built" ${Tracker.canCraft(state.owned,i)?'':'disabled title="Track both recipe components first"'}>Build instead</button>`: ''}</div></article>`;
    }).join('')||'<p class="emptysearch">No matching items.</p>';
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
    if(applyItemPivot(next=>PivotPlanner.replace(next,targetId,id,DATA.items,built),`${byId[id].name} ${built?'built':'planned'} instead of ${original}.`))dialog.close();
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
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li>Use <b>Add an item</b> or press <b>/</b> to open the picker. Escape collapses it. On an item, <b>Pivot</b> ranks alternatives by MetaTFT for assigned champions; unassigned items use similarity. <b>Plan instead</b> replaces its target; <b>Build instead</b> also consumes tracked ingredients. Undo reverses either action.</li>');
  render();
})();
