const AugmentUI=(()=>{
  let activeSlot=0,query='',searchRows=[],searchIndex=0,result=null,contextKey='',lastSearchResults;
  const button=document.createElement('button');button.id='augment-open';button.textContent='Augment choices';document.querySelector('.decision-controls').append(button);
  const selected=document.createElement('div');selected.id='chosen-augments';selected.className='chosen-augments';document.querySelector('.decision-controls').after(selected);
  const modal=document.createElement('dialog');modal.id='augment-dialog';modal.setAttribute('aria-labelledby','augment-title');
  modal.innerHTML='<div class="modal-heading"><h2 id="augment-title">Choose your augment</h2><button data-close="augment-dialog" aria-label="Close augment chooser">×</button></div><div class="augment-stage" role="group" aria-label="Augment round"></div><div id="augment-verdict" role="status" aria-live="polite"></div><div class="augment-search-wrap"><label id="augment-search-label" for="augment-offer-search">Offer 1</label><input id="augment-offer-search" class="search" type="search" autocomplete="off" placeholder="Type a name, Enter → next offer" aria-controls="augment-search-results"><div id="augment-search-results" hidden></div></div><div id="augment-offers"></div><details class="augment-method"><summary>How this is compared</summary><p>Academy’s comp-specific recommendations lead. Your items, components, current units and stars inform nearby comp routes. Descriptions add smaller adjustments for matching items, leveling/reroll plans, previously chosen augments, and Need strength now. Existing MetaTFT item evidence contributes through comp fit; these are not MetaTFT augment statistics.</p><p>Reroll advice compares other known augments of the same rarity and round. It does not know your actual replacement pool or remaining rerolls. “No data” never means “bad.” Choosing an augment records it only; promised items and units are not added to inventory.</p><p id="augment-source"></p></details>';
  document.body.append(modal);
  const input=document.getElementById('augment-offer-search'),list=document.getElementById('augment-search-results');
  const badge=a=>['','Silver','Gold','Prismatic'][a.tier]||'Augment';
  function offers(){return AugmentAdvisor.ensure(state);}
  function getResult(){const key=JSON.stringify(state)+'|'+Academy.snapshot.sourceUpdated+'|'+Academy.snapshot.augments.length;if(key!==contextKey){contextKey=key;result=AugmentAdvisor.compare(state);}return result;}
  function drawSelected(){const ids=AugmentAdvisor.slots(state);selected.hidden=!ids.some(Boolean);selected.innerHTML=ids.map((id,n)=>{const a=CompFinder.augment(id);if(!id)return '';return `<button data-edit-augment="${n}" title="${esc(a?.name||'Saved augment')} · ${AugmentAdvisor.stages[n]}" aria-label="Review ${esc(a?.name||'saved augment')} at ${AugmentAdvisor.stages[n]}">${augmentIcon(id)}<span>${esc(a?.name||'Saved augment')}</span><small>${AugmentAdvisor.stages[n]}</small></button>`;}).join('');}
  function search(){
    const o=offers(),norm=Academy.normalizeName(query);list.hidden=!norm;
    const held=AugmentAdvisor.held(state);
    const relevance=name=>name===norm?0:name.startsWith(norm)?1:2;
    searchRows=norm?CompFinder.augments().filter(a=>!held.includes(a.apiName)&&!o.ids.includes(a.apiName)&&Academy.normalizeName(a.name).includes(norm))
      .sort((a,b)=>relevance(Academy.normalizeName(a.name))-relevance(Academy.normalizeName(b.name))||a.name.localeCompare(b.name)).slice(0,7):[];
    searchIndex=Math.max(0,Math.min(searchIndex,searchRows.length-1));
    const results=searchRows.map((a,n)=>{
      const detail=AugmentAdvisor.eligible(a,o.round)?a.description:'Academy lists '+a.stages.join(', ');
      return `<button class="${n===searchIndex?'search-active':''}" data-offer-add="${esc(a.apiName)}" title="${esc(a.description)}">${augmentIcon(a.apiName)}<span><strong>${esc(a.name)}</strong><small>${esc(detail)}</small></span><b class="augment-rarity rarity-${a.tier}">${badge(a)}</b></button>`;
    }).join('')||'<p role="status">'+esc(AugmentAdvisor.searchNotice(query))+'</p>';
    if(results!==lastSearchResults){list.innerHTML=results;lastSearchResults=results;}
  }
  function draw(){
    drawSelected();if(!modal.open)return;
    const o=offers(),comparison=getResult(),logged=AugmentAdvisor.slots(state)[o.round];
    modal.querySelector('.augment-stage').innerHTML=AugmentAdvisor.stages.map((s,n)=>`<button data-augment-round="${n}" aria-pressed="${o.round===n}">${n+1}${['st','nd','rd'][n]} · ${s}${AugmentAdvisor.slots(state)[n]?' ✓':''}</button>`).join('');
    const verdict=document.getElementById('augment-verdict');verdict.dataset.action=comparison.action;verdict.textContent=comparison.message;
    if(comparison.reroll){const hint=document.createElement('small');hint.textContent='Stronger same-rarity fits exist in the catalog; their appearance is not guaranteed.';verdict.append(hint);}
    if(logged){const hint=document.createElement('small');hint.textContent='This round is already recorded. Taking a different augment replaces that record.';verdict.append(hint);}
    document.getElementById('augment-search-label').textContent='Offer '+(activeSlot+1)+' · type a few letters, Enter';
    document.getElementById('augment-offers').innerHTML=o.ids.map((id,slot)=>{
      const a=CompFinder.augment(id),r=comparison.rows.find(r=>r.slot===slot),best=comparison.best?.slot===slot&&['take','lean'].includes(comparison.action),reroll=comparison.reroll?.slot===slot;
      if(!a)return `<article class="augment-offer empty-offer ${slot===activeSlot?'active-slot':''}"><button data-offer-edit="${slot}"><span>${slot+1}</span>${id?'Limited evidence · Augment unavailable':'Add offer '+(slot+1)}</button></article>`;
      const name=`<span>${augmentIcon(id)}<strong>${esc(a.name)}</strong></span>`;
      const fit=best?'Best supported pick':reroll?'Consider reroll · if available':r?.invalid||r?.offRound?'Check offer':r?.evidence?'Contextual fit':'Limited evidence';
      return `<article class="augment-offer ${slot===activeSlot?'active-slot':''} ${best?'best-offer':''}"><div class="augment-offer-heading"><button data-offer-edit="${slot}" aria-label="Change offer ${slot+1}: ${esc(a.name)}">${name}</button><span class="augment-rarity rarity-${a.tier}">${badge(a)}</span><button class="quiet" data-offer-replace="${slot}">Enter reroll</button></div><div class="augment-fit-label">${fit}</div><div class="augment-reasons">${(r?.reasons||[]).slice(0,2).map(x=>`<span>${esc(x.text)}</span>`).join('')}</div>${r?.items?.length?'<div class="augment-related">'+r.items.slice(0,3).map(id=>`<span title="${esc(byId[id].name)}">${icon(id)}</span>`).join('')+'</div>':''}<details class="augment-description"><summary>Effect</summary><p>${esc(a.description)}</p></details><button class="augment-take" data-augment-take="${slot}" ${r?.invalid?'disabled':''}>Took this</button></article>`;
    }).join('');
    document.getElementById('augment-source').textContent='Academy snapshot: '+(Academy.snapshot.sourceUpdated?new Date(Academy.snapshot.sourceUpdated).toLocaleDateString():'bundled data')+'. Refreshes with the app’s Academy data.';
    search();
  }
  function open(round){offers();if(Number.isInteger(round)&&state.augmentOffers.round!==round){state.augmentOffers={round,ids:['','',''],seen:[]};save();}activeSlot=Math.max(0,offers().ids.findIndex(id=>!id));query='';input.value='';contextKey='';modal.showModal();draw();input.focus();}
  function add(id){
    const o=offers(),a=CompFinder.augment(id);if(!a||o.ids.includes(id)||AugmentAdvisor.held(state).includes(id))return;
    const slot=activeSlot;query='';input.value='';searchIndex=0;
    mutate(()=>{offers().ids[slot]=id;},'Offer '+(slot+1)+' entered.');
    const next=offers().ids.findIndex((id,n)=>n>slot&&!id);activeSlot=next>=0?next:Math.max(0,offers().ids.findIndex(id=>!id));draw();input.focus();
  }
  button.addEventListener('click',()=>open());
  input.addEventListener('input',e=>{query=e.target.value;searchIndex=0;search();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&searchRows[searchIndex]){e.preventDefault();add(searchRows[searchIndex].apiName);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();searchIndex+=e.key==='ArrowDown'?1:-1;search();}else if(e.key==='Escape'&&query){e.preventDefault();e.stopPropagation();query='';input.value='';search();}});
  document.addEventListener('click',e=>{
    let b=e.target.closest('[data-offer-add]');if(b)add(b.dataset.offerAdd);
    b=e.target.closest('[data-edit-augment]');if(b)open(Number(b.dataset.editAugment));
    b=e.target.closest('[data-augment-round]');if(b){const round=Number(b.dataset.augmentRound);if(round===offers().round)return;query='';input.value='';activeSlot=0;mutate(()=>state.augmentOffers={round,ids:['','',''],seen:[]},'Augment round changed.');input.focus();}
    b=e.target.closest('[data-offer-edit]');if(b){activeSlot=Number(b.dataset.offerEdit);query='';input.value='';draw();input.focus();}
    b=e.target.closest('[data-offer-replace]');if(b){activeSlot=Number(b.dataset.offerReplace);query='';input.value='';mutate(()=>{const o=offers(),id=o.ids[activeSlot];if(id&&!o.seen.includes(id))o.seen.push(id);o.ids[activeSlot]='';},'Enter the new offer after rerolling in game.');input.focus();}
    b=e.target.closest('[data-augment-take]');if(b){let recorded=false;mutate(()=>{recorded=AugmentAdvisor.record(state,Number(b.dataset.augmentTake));},'Augment recorded. Enter any item rewards when received.');if(recorded)modal.close();}
  });
  const previous=render;render=function(){previous();contextKey='';draw();};
  document.addEventListener('carousel-new-game',()=>{modal.close();query='';input.value='';contextKey='';drawSelected();});
  document.addEventListener('carousel-meta-updated',()=>{contextKey='';draw();});
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Augment choices:</b> type a few letters and Enter for each of the three offers. Entry advances automatically. The round defaults to your next unrecorded augment; change it if needed. Took this records the selected augment, keeps your inventory untouched and updates comp fit. Enter reroll replaces only that offer after you reroll in game. Reroll guidance is conditional; the app does not know the replacement pool or rerolls left.</li>');
  drawSelected();return {open,refresh:draw};
})();
