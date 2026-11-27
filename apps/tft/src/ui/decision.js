/* Compact controls; no round, HP, gold, carousel position or offer transcription. */
const DecisionUI = (()=>{
  let cacheKey='',current=null,pivotChampion='',pivotQuery='';
  const dialog=(id,title)=>{const el=document.createElement('dialog');el.id=id;el.setAttribute('aria-labelledby',id+'-title');el.innerHTML=`<div class="modal-heading"><h2 id="${id}-title">${title}</h2><button data-close="${id}" aria-label="Close">×</button></div>`;document.body.append(el);return el;};
  const pivot=dialog('champion-pivot','Pivot champion');
  pivot.innerHTML+='<p class="decision-note">Choose the new item. Completed items stay; remaining targets adjust together.</p><input id="champion-pivot-search" class="search" type="search" placeholder="Find your pivot item…" aria-label="Find a pivot item"><div id="champion-pivot-results" class="decision-list"></div>';
  const controls=document.createElement('div');controls.className='decision-controls';controls.innerHTML='<div class="tempo-control" role="group" aria-label="Item planning preference"><button data-tempo="balanced">Balanced</button><button data-tempo="urgent">Need strength now</button></div><button id="anvil-open">Anvil choices</button>';
  document.querySelector('.bench .panelhead').after(controls);
  const suggestion=document.createElement('div');suggestion.id='bench-plan';suggestion.className='bench-plan';document.getElementById('craft-strip').before(suggestion);
  const intent=document.createElement('div');intent.id='reference-intents';intent.className='reference-owned';document.getElementById('reference-owned').after(intent);
  document.querySelector('.shoppingintro').textContent='×N = still missing from your queue, after your bench. Pins override the next item.';
  document.querySelector('.shoppingfoot').textContent='★ Pin within planned needs or alternatives. Got one records a carousel pick.';
  document.querySelector('.loot-note p').textContent='A historical bag heuristic, not verified current-set odds. Used only after equally useful component choices and pins. It does not predict when another component will drop.';
  function signature(){
    const names=[...new Set([...state.queue.map(q=>q.champion),...Academy.snapshot.guides.map(g=>Academy.snapshot.champions.find(c=>c.apiName===g.mainChampion?.apiName)?.name)].filter(Boolean))];
    return JSON.stringify(state)+'|'+Academy.revision+'|'+Academy.live+'|'+Academy.snapshot.sourceUpdated+'|'+names.map(n=>{const d=MetaBuilds.dataFor({champion:n});return (d?.updated||0)+':'+(d?.fetchedAt||0);}).join(',');
  }
  function get(){const key=signature();if(key!==cacheKey){cacheKey=key;const groups=DecisionPlanner.groups(state);current={groups,craft:DecisionPlanner.solve(state,groups),carousel:DecisionPlanner.carousel(state,groups)};}return current;}
  const compactItem=(id)=>`<span class="decision-item" title="${esc(byId[id].name)}" aria-label="${esc(byId[id].name)}">${icon(id)}</span>`;
  function drawPlan(){
    const result=get().craft,crafts=result.actions.flatMap(a=>a.crafts.map(id=>({id,champion:a.choice.champion,source:a.choice.source})));
    suggestion.hidden=!crafts.length;
    suggestion.innerHTML=crafts.length?'<span class="decision-label">'+(state.tempo==='urgent'?'Strength now':'Good together')+'</span><div class="bench-plan-items">'+crafts.map(c=>`<span class="bench-plan-item">${compactItem(c.id)}<small>${c.champion?IconUI.championLabel(c.champion):esc(byId[c.id].name)}</small></span>`).join('')+'</div><button id="craft-plan" class="quiet">Mark made'+(crafts.length>1?' · '+crafts.length:'')+'</button>':'';
    // Inline suggestions are derived from the same compatible batch, rather
    // than independently proposing mutually exclusive replacement items.
    document.querySelectorAll('.inline-pivot').forEach(el=>el.remove());
    for(const action of result.actions.filter(a=>a.choice.source==='meta')){
      const first=DecisionPlanner.pending(state,action.choice.champion)[0];if(!first)continue;
      const card=[...document.querySelectorAll('#queue .qcard')].find(el=>el.querySelector('[data-action="remove"]')?.dataset.id===first.uid);if(!card)continue;
      const box=document.createElement('div');box.className='inline-pivot decision-pivot';
      box.innerHTML=`<span>Compatible ${esc(action.choice.tier)} pivot · ${IconUI.championLabel(action.choice.champion)}</span><div>${action.crafts.map(compactItem).join('')}</div><button data-batch-champion="${esc(action.choice.champion)}">Build & adjust</button>`;card.append(box);
    }
  }
  function carouselIcon(target){
    if(!target)return '';
    const label=byId[target.item].name+(target.champion?' · '+target.champion:'')+(target.tier?' · MetaTFT '+target.tier+' build':'');
    return `<span class="carousel-target" data-carousel-item="${esc(target.item)}" data-source="${esc(target.source)}" title="${esc(label)}" aria-label="${esc(label)}">${icon(target.item)}</span>`;
  }
  function drawCarousel(){
    const rows=get().carousel;
    const row=(r,n)=>{
      const target=r.targets?.[0]||r.pivotTargets?.[0];
      const label=r.count||r.discovery?'':r.pivot?'Pivot item':'Not needed';
      const pinned=state.pins.includes(r.id);
      return `<div class="need decision-need ${state.pins.includes(r.id)?'pinned':''}"><span class="pick-rank">${n+1}</span>${icon(r.id)}<div class="needname">${esc(shortNames[r.id])} ${r.count?`<b class="component-shortage" aria-label="${r.count} still needed">×${r.count}</b>`:''}${label?`<span class="component-option">${label}</span>`:''}${pinned?'<span class="carousel-pin-label">Pinned</span>':''}</div>${carouselIcon(target)}${target?`<small class="carousel-for">For ${esc(byId[target.item].name)}</small>`:''}<button data-action="pin" data-id="${r.id}" class="pin" aria-pressed="${state.pins.includes(r.id)}" aria-label="Pin ${esc(byId[r.id].name)}">${state.pins.includes(r.id)?'★':'☆'}</button><button data-action="gain" data-id="${r.id}" class="got" aria-label="Got one ${esc(byId[r.id].name)} from carousel">+ Got one</button></div>`;
    };
    document.getElementById('shopping').innerHTML=rows.map(row).join('');
  }
  function drawIntents(){
    const name=MetaReference.selected(),ids=DecisionPlanner.commitments(state,name);
    intent.hidden=!ids.length;intent.innerHTML=ids.length?'<span>Pivot target</span>'+ids.map(compactItem).join('')+'<button id="clear-pivot-intent" class="quiet" aria-label="Release pivot target">×</button>':'';
  }
  function drawPivot(){
    document.getElementById('champion-pivot-title').innerHTML=IconUI.champion(pivotChampion)+'<span>Pivot '+esc(pivotChampion)+'</span>';
    const query=Academy.normalizeName(pivotQuery),rows=[];
    for(const i of DATA.items){if(!Academy.normalizeName(i.name).includes(query))continue;const choice=DecisionPlanner.pivot(state,pivotChampion,i.id);if(choice)rows.push({item:i,choice,ready:OfflineTracker.canCraft(state.owned,i)});}
    rows.sort((a,b)=>Number(b.ready)-Number(a.ready)||'SA'.indexOf(a.choice.tier)-'SA'.indexOf(b.choice.tier)||b.choice.score-a.choice.score||a.item.name.localeCompare(b.item.name));
    const notice=MetaBuilds.pivotNotice(pivotChampion);
    document.getElementById('champion-pivot-results').innerHTML=rows.map(({item:i,choice:b,ready})=>{
      const owned=state.queue.some(q=>q.done&&q.item===i.id&&!q.champion);
      return `<article class="decision-row"><div class="decision-primary">${icon(i.id)}<div><strong>${esc(i.name)}</strong><small>MetaTFT ${b.tier} · ${b.games.toLocaleString()} games</small></div></div><div class="pivot-combination">${b.items.map(id=>`<span class="${DecisionPlanner.equipped(state,pivotChampion).some(x=>Academy.itemMatches(id,x))?'is-equipped':''}">${compactItem(id)}</span>`).join('')}</div><div class="decision-actions"><button data-plan-pivot="${esc(i.id)}">Plan pivot</button>${ready?`<button data-build-pivot="${esc(i.id)}">Build now</button>`:''}${owned?`<button data-owned-pivot="${esc(i.id)}">Use owned</button>`:''}</div></article>`;
    }).join('')||`<p class="decision-note">${notice||'No supported S/A combination contains that item alongside your completed items. Your current plan stays intact.'}</p>`;
  }
  function openPivot(name){pivotChampion=name;pivotQuery='';document.getElementById('champion-pivot-search').value='';drawPivot();pivot.showModal();MetaBuilds.request(name);document.getElementById('champion-pivot-search').focus();}
  function draw(){
    for(const b of document.querySelectorAll('[data-tempo]'))b.setAttribute('aria-pressed',String(b.dataset.tempo===(state.tempo||'balanced')));
    drawPlan();drawCarousel();drawIntents();
    if(pivot.open)drawPivot();
  }
  document.getElementById('champion-pivot-search').addEventListener('input',e=>{pivotQuery=e.target.value;drawPivot();});
  document.addEventListener('click',e=>{
    let b=e.target.closest('[data-tempo]');if(b)mutate(()=>state.tempo=b.dataset.tempo,b.dataset.tempo==='urgent'?'Prioritizing useful crafts now.':'Balanced planning.');
    b=e.target.closest('#craft-plan');if(b){const result=get().craft;if(result.actions.length)applyItemPivot(next=>DecisionPlanner.execute(next,result),'Items recorded. Remaining targets updated; Undo restores the whole change.');}
    b=e.target.closest('[data-batch-champion]');if(b){const action=get().craft.actions.find(a=>a.choice.champion===b.dataset.batchChampion);if(action)applyItemPivot(next=>DecisionPlanner.execute(next,{actions:[action]}),'Pivot crafted and remaining targets adjusted.');}
    b=e.target.closest('[data-plan-pivot],[data-build-pivot],[data-owned-pivot]');if(b){
      const id=b.dataset.planPivot||b.dataset.buildPivot||b.dataset.ownedPivot,mode=b.dataset.buildPivot?'craft':b.dataset.ownedPivot?'owned':'plan';
      applyItemPivot(next=>DecisionPlanner.applyPivot(next,pivotChampion,id,mode),'Champion plan updated. Completed items kept.',()=>{
        pivot.close();MetaReference.filter(id);drawIntents();
      });
    }
    b=e.target.closest('#clear-pivot-intent');if(b)mutate(()=>{delete state.pivotIntents?.[Academy.normalizeName(MetaReference.selected())];},'Pivot target released. Current queue kept.');

  });
  const oldRender=render;render=function(){oldRender();draw();};
  document.addEventListener('carousel-meta-updated',()=>{cacheKey='';draw();});
  document.addEventListener('carousel-new-game',()=>{pivot.close();cacheKey='';draw();});
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Balanced / Need strength now:</b> one optional preference. Both compare compatible crafts across your whole bench. Strength now tolerates more deviation from Academy for immediate crafts. These are fit estimates, not win probabilities. Suggestions never rewrite your queue until you use a build/pivot action.</li><li><b>Good together:</b> a bounded search of Academy targets and supported MetaTFT S/A combinations. Mark made records the entire displayed combination and spends components once. Undo reverses the transaction. Manual Craft now shortcuts remain available.</li><li><b>Champion pivot:</b> open S/A builds from a champion, then Pivot to an item. Plan pivot preserves equipment and replaces unfinished targets with a compatible S/A combination. Build now also spends the recipe; Use owned assigns an unassigned completed copy. A pivot target stays locked until built, removed, or released.</li><li><b>Anvil choices:</b> scan ranked icons and record only the item selected. Holder names are suggestions; an exact queued target is completed, otherwise the item remains unassigned. Component anvils follow the carousel ranking and record Other automatically. Browse the full list or compare only your offers; entering offers does not add inventory.</li>');
  for(const li of document.querySelectorAll('#help li'))if(li.textContent.startsWith('Build instead'))li.textContent='Build & adjust beneath a queued champion shows a compatible S/A pivot from the whole-bench plan. It updates that champion’s unfinished targets together. Completed items stay; Undo restores the transaction.';
  render();return {openPivot,refresh:draw,get};
})();
