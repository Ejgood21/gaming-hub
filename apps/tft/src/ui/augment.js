const AugmentUI=(()=>{
  let activeSlot=0,query='',searchRows=[],variants=null,searchIndex=0,result=null,contextKey='',lastSearchResults;
  const button=document.createElement('button');button.id='augment-open';button.textContent='Augment choices';document.querySelector('.decision-controls').append(button);
  const selected=document.createElement('div');selected.id='chosen-augments';selected.className='chosen-augments';document.querySelector('.decision-controls').after(selected);
  const modal=document.createElement('dialog');modal.id='augment-dialog';modal.setAttribute('aria-labelledby','augment-title');
  modal.innerHTML=`<div class="modal-heading"><h2 id="augment-title">Choose your augment</h2><button data-close="augment-dialog" aria-label="Close augment chooser">×</button></div>
    <div class="augment-stage" role="group" aria-label="Augment round"></div>
    <div id="augment-verdict" role="status" aria-live="polite"></div>
    <div class="augment-search-wrap"><label id="augment-search-label" for="augment-offer-search">Offer 1</label><input id="augment-offer-search" class="search" type="search" autocomplete="off" placeholder="Type a name, Enter → next offer" aria-controls="augment-search-results"><div id="augment-search-results" hidden></div></div>
    <div id="augment-offers"></div>`;
  document.body.append(modal);
  const input=document.getElementById('augment-offer-search'),list=document.getElementById('augment-search-results');
  const badge=a=>['','Silver','Gold','Prismatic'][a.tier]||'Augment';
  function offers(){return AugmentAdvisor.ensure(state);}
  function getResult(){const key=JSON.stringify(state)+'|'+Academy.snapshot.sourceUpdated+'|'+Academy.snapshot.augments.length;if(key!==contextKey){contextKey=key;result=AugmentAdvisor.compare(state);}return result;}
  function drawSelected(){const ids=AugmentAdvisor.slots(state);selected.hidden=!ids.some(Boolean);selected.innerHTML=ids.map((id,n)=>{const a=CompFinder.augment(id);if(!id)return '';return `<button data-edit-augment="${n}" title="${esc(a?.name||'Saved augment')} · ${AugmentAdvisor.stages[n]}" aria-label="Review ${esc(a?.name||'saved augment')} at ${AugmentAdvisor.stages[n]}">${augmentIcon(id)}<span>${esc(a?.name||'Saved augment')}</span><small>${AugmentAdvisor.stages[n]}</small></button>`;}).join('');}
  function search(){
    const o=offers(),norm=Academy.normalizeName(query);list.hidden=!norm;
    const relevance=name=>name===norm?0:name.startsWith(norm)?1:2;
    const groups=new Map();
    const available=norm?AugmentAdvisor.available(state,o):[];
    if(variants)variants=variants.filter(a=>available.some(choice=>choice.apiName===a.apiName));
    if(norm&&!variants){
      for(const a of available){
        const key=a.name.trim().replace(/\s+/g,' ').toLowerCase();
        if(!Academy.normalizeName(a.name).includes(norm))continue;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(a);
      }
    }
    searchRows=variants||[...groups.values()].map(choices=>{
      choices.sort((a,b)=>Number(AugmentAdvisor.eligible(b,o.round))-Number(AugmentAdvisor.eligible(a,o.round)));
      return {...choices[0],choices};
    }).sort((a,b)=>relevance(Academy.normalizeName(a.name))-relevance(Academy.normalizeName(b.name))||a.name.localeCompare(b.name)).slice(0,7);
    searchIndex=Math.max(0,Math.min(searchIndex,searchRows.length-1));
    const results=searchRows.map((a,n)=>{
      const multiple=a.choices?.length>1;
      const detail=multiple?'Choose the matching effect or rarity.':AugmentAdvisor.eligible(a,o.round)?a.description:AugmentAdvisor.roundNotice(a,o.round);
      return `<button class="${n===searchIndex?'search-active':''}" data-offer-result="${n}" title="${esc(a.description)}">${augmentIcon(a.apiName)}<span>${variants?'':`<strong>${esc(a.name)}</strong>`}<small>${esc(detail)}</small></span>${multiple?'':`<b class="augment-rarity">${badge(a)}</b>`}</button>`;
    }).join('')||'<p role="status">'+esc(AugmentAdvisor.searchNotice(query))+'</p>';
    if(results!==lastSearchResults){list.innerHTML=results;lastSearchResults=results;}
  }
  function draw(){
    drawSelected();if(!modal.open)return;
    const o=offers(),comparison=getResult(),logged=AugmentAdvisor.slots(state)[o.round];
    modal.querySelector('.augment-stage').innerHTML=AugmentAdvisor.stages.map((s,n)=>`<button data-augment-round="${n}" aria-pressed="${o.round===n}">${n+1}${['st','nd','rd'][n]} · ${s}${AugmentAdvisor.slots(state)[n]?' ✓':''}</button>`).join('');
    const verdict=document.getElementById('augment-verdict');verdict.dataset.action=comparison.action;verdict.textContent=comparison.message;
    document.getElementById('augment-search-label').textContent=o.awaiting?.[activeSlot]
      ?`Offer ${activeSlot+1} · enter replacement after rerolling in game`
      :`Offer ${activeSlot+1} · type a few letters, Enter${logged?' · replaces recorded pick':''}`;
    document.getElementById('augment-offers').innerHTML=o.ids.map((id,slot)=>{
      const r=comparison.rows.find(r=>r.slot===slot),awaiting=o.awaiting?.[slot],active=slot===activeSlot?'active-slot':'';
      if(!r)return `<article class="augment-offer empty-offer ${active}" ${id?'data-verdict="avoid"':''}><button data-offer-edit="${slot}"><span>${slot+1}</span>${awaiting?'Awaiting replacement':id?'Do not take unavailable offer':'Add offer '+(slot+1)}</button></article>`;
      const a=r.augment,reroll=comparison.rerolls.find(row=>row.slot===slot);
      const reasons=r.reasons.map(x=>x.text);
      if(reroll)reasons[0]=reroll.reason;
      if(comparison.academyNotice)reasons.push(comparison.academyNotice);
      const rounds=(r.rounds||[]).map(round=>`<button class="quiet" data-offer-move="${round}" data-augment-id="${esc(id)}">Enter at ${AugmentAdvisor.stages[round]}</button>`).join('');
      return `<article class="augment-offer ${active}" data-verdict="${r.verdict}">
        <div class="augment-offer-heading"><button data-offer-edit="${slot}" aria-label="Change offer ${slot+1}: ${esc(a.name)}">${esc(a.name)}</button><strong class="augment-verdict-line">${esc(r.verdictLine)}</strong></div>
        <p class="augment-phrase">${esc(r.phrase)}</p>
        <details class="augment-description"><summary>Why and effect</summary><ul>${reasons.map(text=>`<li>${esc(text)}</li>`).join('')}</ul><p>${esc(a.description)}</p>${rounds}</details>
        <div class="augment-offer-actions"><button class="augment-take" data-augment-take="${slot}" ${r.invalid?'disabled':''}>${r.offRound?'Took this at '+AugmentAdvisor.stages[o.round]:'Took this'}</button>
        <button class="augment-reroll" data-offer-replace="${slot}">Reroll this offer</button></div>
      </article>`;
    }).join('');
    search();
  }
  function clearSearch(){query='';variants=null;input.value='';searchIndex=0;}
  function open(round,id){
    if(Number.isInteger(round)&&offers().round!==round){state.augmentOffers=AugmentAdvisor.newOffers(round);save();}
    const o=offers(),pending=o.awaiting?.findIndex(Boolean)??-1;
    activeSlot=pending>=0?pending:Math.max(0,o.ids.findIndex(id=>!id));
    clearSearch();contextKey='';modal.showModal();if(id)add(id);draw();input.focus();
  }
  function pick(result){
    if(result.choices?.length>1){
      variants=result.choices;
      searchIndex=0;
      search();
      input.focus();
    }else add(result.apiName);
  }
  function add(id){
    const slot=activeSlot,nextOffers=structuredClone(offers());
    if(!AugmentAdvisor.enter({...state,augmentOffers:nextOffers},slot,id))return;
    clearSearch();
    mutate(()=>{state.augmentOffers=nextOffers;},'Offer '+(slot+1)+' entered.');
    const next=offers().ids.findIndex((id,n)=>n>slot&&!id);activeSlot=next>=0?next:Math.max(0,offers().ids.findIndex(id=>!id));draw();input.focus();
  }
  function enterAt(round,id){
    const a=CompFinder.augment(id);
    if(!a||!AugmentAdvisor.eligible(a,round))return;
    if(modal.open){
      clearSearch();activeSlot=1;
      mutate(()=>{state.augmentOffers=AugmentAdvisor.newOffers(round);AugmentAdvisor.enter(state,0,id);});
      input.focus();
    }else open(round,id);
  }
  button.addEventListener('click',()=>open());
  input.addEventListener('input',e=>{query=e.target.value;variants=null;searchIndex=0;search();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&searchRows[searchIndex]){e.preventDefault();pick(searchRows[searchIndex]);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();searchIndex+=e.key==='ArrowDown'?1:-1;search();}else if(e.key==='Escape'&&query){e.preventDefault();e.stopPropagation();if(variants){variants=null;}else{query='';input.value='';}searchIndex=0;search();}});
  document.addEventListener('click',e=>{
    let b=e.target.closest('[data-offer-result]');if(b)pick(searchRows[Number(b.dataset.offerResult)]);
    b=e.target.closest('[data-edit-augment]');if(b)open(Number(b.dataset.editAugment));
    b=e.target.closest('[data-augment-round]');if(b){const round=Number(b.dataset.augmentRound);if(round===offers().round)return;clearSearch();activeSlot=0;mutate(()=>state.augmentOffers=AugmentAdvisor.newOffers(round),'Augment round changed.');input.focus();}
    b=e.target.closest('[data-offer-edit]');if(b){activeSlot=Number(b.dataset.offerEdit);clearSearch();draw();input.focus();}
    b=e.target.closest('[data-offer-move]');if(b)enterAt(Number(b.dataset.offerMove),b.dataset.augmentId);
    b=e.target.closest('[data-offer-replace]');if(b){
      activeSlot=Number(b.dataset.offerReplace);clearSearch();
      mutate(()=>AugmentAdvisor.replace(state,activeSlot),'Enter the new offer after rerolling in game.');
      input.focus();
    }
    b=e.target.closest('[data-augment-take]');if(b){
      const slot=Number(b.dataset.augmentTake),augment=CompFinder.augment(offers().ids[slot]);
      let recorded=false;
      mutate(()=>{recorded=AugmentAdvisor.record(state,slot);});
      if(recorded){
        modal.close();
        const items=AugmentAdvisor.itemGrants(augment).map(({name,count})=>count>1?`${count} × ${name}`:name);
        const added=new Intl.ListFormat().format(items);
        toast(added?`Augment recorded. Added ${added}.`:'Augment recorded.');
      }
    }
  });
  const previous=render;render=function(){previous();contextKey='';draw();};
  document.addEventListener('carousel-new-game',()=>{modal.close();clearSearch();contextKey='';drawSelected();});
  document.addEventListener('carousel-meta-updated',()=>{contextKey='';draw();});
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Augment choices:</b> type a few letters and press Enter for each offer. Entry advances automatically. The round defaults to your next unrecorded augment. Click Reroll this offer to clear the slot, then enter the replacement after rerolling in game. Took this records your choice and adds any named completed items it grants. Record random items, components, and chest or anvil rewards when received.</li>');
  drawSelected();return {open,refresh:draw};
})();
