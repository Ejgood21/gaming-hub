/* Anvil entry is offer selection only. Inventory changes only on Took this.
   Numeric shortcuts are scoped to the topmost component-anvil dialog. */
const AnvilUI=(()=>{
  const types=[['components','Components'],['ornns','Artifacts'],['craftables','Completed'],['radiants','Radiant'],['emblems','Emblems']];
  let type='ornns',mode='browse',query='',rows=[],matches=[],searchIndex=0,offers={};
  const modal=document.createElement('dialog');modal.id='anvil-dialog';modal.setAttribute('aria-labelledby','anvil-dialog-title');
  modal.innerHTML='<div class="modal-heading"><h2 id="anvil-dialog-title">Anvil choices</h2><button data-close="anvil-dialog" aria-label="Close anvil choices">×</button></div><div id="anvil-tabs" class="decision-tabs" role="group" aria-label="Anvil item category"></div><div class="anvil-mode" role="group" aria-label="Browse or compare anvil offers"><button data-anvil-mode="browse">Full priority list</button><button data-anvil-mode="compare">My offers</button></div><p id="anvil-instructions" class="decision-note"></p><div id="anvil-component-keys" class="anvil-component-keys" hidden></div><div class="anvil-search-wrap"><label for="anvil-search" class="visuallyhidden">Find an offered item</label><input id="anvil-search" class="search" type="search" autocomplete="off" placeholder="Find an offered item…"><div id="anvil-search-matches" hidden></div></div><div id="anvil-offer-chips" class="anvil-offer-chips"></div><div id="anvil-verdict" role="status" aria-live="polite"></div><div id="anvil-results" class="decision-list"></div>';
  document.body.append(modal);
  const input=document.getElementById('anvil-search'),searchList=document.getElementById('anvil-search-matches');
  const picked=()=>offers[type]||[];
  function setQuery(q=''){query=q;input.value=q;searchIndex=0;}
  function matchesQuery(r,q){return Academy.normalizeName(r.item.name).includes(q)||Academy.normalizeName(shortNames[r.item.id]||'').includes(q);}
  function addOffer(id){
    if(!rows.some(r=>r.item.id===id)||picked().includes(id))return;
    offers[type]=[...picked(),id];mode='compare';setQuery();draw();input.focus();
  }
  function removeOffer(id){offers[type]=picked().filter(x=>x!==id);draw();}
  function drawSearch(){
    const q=Academy.normalizeName(query),available=rows.filter(r=>!picked().includes(r.item.id)&&matchesQuery(r,q));
    matches=q?available.sort((a,b)=>Number(!Academy.normalizeName(a.item.name).startsWith(q))-Number(!Academy.normalizeName(b.item.name).startsWith(q))).slice(0,7):[];
    searchIndex=Math.max(0,Math.min(searchIndex,matches.length-1));
    searchList.hidden=mode!=='compare'||!q;
    searchList.innerHTML=matches.map((r,n)=>`<button class="${n===searchIndex?'search-active':''}" data-anvil-offer-add="${esc(r.item.id)}">${icon(r.item.id)}<span>${esc(r.item.name)}</span><small>Add offer ↵</small></button>`).join('')||'<p>No new match in this category.</p>';
  }
  function draw(recalculate=false){
    if(recalculate)rows=DecisionPlanner.anvil(state,type);
    // A refresh can remove items from a set; never record a stale offer.
    offers[type]=picked().filter(id=>rows.some(r=>r.item.id===id));
    document.getElementById('anvil-tabs').innerHTML=types.map(([id,name])=>`<button data-anvil-type="${id}" aria-pressed="${type===id}">${name}</button>`).join('');
    for(const b of modal.querySelectorAll('[data-anvil-mode]'))b.setAttribute('aria-pressed',String(mode===b.dataset.anvilMode));
    input.placeholder=mode==='compare'?'Type an offer, Enter → add the next…':'Find an offered item… Enter adds to My offers';
    document.getElementById('anvil-instructions').textContent=mode==='compare'?'Enter the options shown in game. Use a take button to add it to inventory.':'Pick the highest-ranked item you see in game, or enter offers to compare.';
    const keys=document.getElementById('anvil-component-keys');keys.hidden=type!=='components';
    keys.innerHTML=type==='components'?'<small>1–8 add offers · Shift + number removes · no inventory changes</small><div>'+componentOrder.slice(0,8).map((id,n)=>`<button data-component-offer="${id}" aria-pressed="${picked().includes(id)}" aria-label="${n+1}: ${esc(byId[id].name)} ${picked().includes(id)?'offered, click to remove':'add offer'}"><kbd>${n+1}</kbd>${icon(id)}<span>${esc(shortNames[id])}</span></button>`).join('')+'</div>':'';
    document.getElementById('anvil-offer-chips').innerHTML=mode==='compare'?picked().map(id=>`<button data-anvil-offer-remove="${esc(id)}" title="Remove ${esc(byId[id].name)} from offers" aria-label="Remove offered ${esc(byId[id].name)}">${icon(id)}<span>${esc(byId[id].name)}</span><b>×</b></button>`).join('')+(picked().length?'<button id="anvil-clear-offers" class="quiet">Clear offers</button>':''):'';
    const q=Academy.normalizeName(query),visible=mode==='compare'?rows.filter(r=>picked().includes(r.item.id)):rows.filter(r=>matchesQuery(r,q));
    const ranked=[...visible]; // model order (including pins) is authoritative
    const best=ranked[0],second=ranked[1];
    const supported=best&&(best.component?best.score>0||state.pins.includes(best.item.id):best.score>0);
    const tied=second&&best.score===second.score&&(!best.component||(!!best.count===!!second.count&&(!best.count||best.carrierRank===second.carrierRank)&&state.pins.includes(best.item.id)===state.pins.includes(second.item.id)));
    let verdict='';
    if(mode==='compare')verdict=!ranked.length?'Add your offers to compare.':ranked.length===1?'1 offer entered — add the others to compare.':!supported?'No supported preference among these offers.':tied?'Top options are similarly supported.':'';
    document.getElementById('anvil-verdict').textContent=verdict;
    document.getElementById('anvil-verdict').hidden=!verdict;
    document.getElementById('anvil-results').innerHTML=ranked.map((r,n)=>{
      const recommended=mode==='compare'&&ranked.length>1&&n===0&&supported&&!tied;
      const count=r.component?(r.count?`<b class="component-shortage">×${r.count} needed</b>`:'<small>No queued need</small>'):'';
      const tag=r.component&&state.pins.includes(r.item.id)?'<span class="anvil-recommended">Pinned priority</span>':'';
      return `<article class="decision-row anvil-row ${r.score>0?'supported':''} ${recommended?'recommended-offer':''}">${recommended?'<span class="anvil-pick-check" role="img" aria-label="Recommended choice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>':`<span class="anvil-rank">${n+1}</span>`}<div class="decision-primary">${icon(r.item.id)}<div><strong>${esc(r.item.name)}</strong>${count}<small>${esc(r.reason)}</small>${tag}</div></div><div class="anvil-fit">${r.champion?IconUI.championLabel(r.champion):''}${!state.activeComp&&r.guide?'<small>'+IconUI.championLabel(r.guide.title,r.guide.mainChampion?.apiName||r.guide.title)+'</small>':''}</div>${mode==='browse'?`<button class="anvil-compare-add" data-anvil-offer-add="${esc(r.item.id)}" aria-label="Add ${esc(r.item.name)} to offers">+ Offer</button>`:''}<button data-take-anvil="${esc(r.item.id)}" ${r.component&&(state.owned[r.item.id]||0)>=99?'disabled':''} aria-label="${recommended?'Recommended: take':'Record'} ${esc(r.item.name)} from anvil">${recommended?'Take this':'Took this'}</button></article>`;
    }).join('')||(mode==='compare'?'':'<p class="decision-note">No matching items.</p>');
    drawSearch();
  }
  function open(){setQuery();draw(true);modal.showModal();if(type!=='components')input.focus();}
  document.getElementById('anvil-open').addEventListener('click',open);
  input.addEventListener('input',e=>{query=e.target.value;searchIndex=0;draw();});
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&matches[searchIndex]){e.preventDefault();addOffer(matches[searchIndex].item.id);}
    else if(mode==='compare'&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();searchIndex+=e.key==='ArrowDown'?1:-1;drawSearch();}
    else if(e.key==='Escape'&&query){e.preventDefault();e.stopPropagation();setQuery();draw();}
  });
  modal.addEventListener('click',e=>{
    let b=e.target.closest('[data-anvil-type]');if(b){type=b.dataset.anvilType;setQuery();draw(true);}
    b=e.target.closest('[data-anvil-mode]');if(b){mode=b.dataset.anvilMode;setQuery();draw();if(type!=='components')input.focus();}
    b=e.target.closest('[data-anvil-offer-add]');if(b)addOffer(b.dataset.anvilOfferAdd);
    b=e.target.closest('[data-anvil-offer-remove]');if(b)removeOffer(b.dataset.anvilOfferRemove);
    b=e.target.closest('#anvil-clear-offers');if(b){offers[type]=[];draw();}
    b=e.target.closest('[data-component-offer]');if(b){const id=b.dataset.componentOffer;if(picked().includes(id))removeOffer(id);else addOffer(id);}
    b=e.target.closest('[data-take-anvil]');if(b&&!b.disabled){const row=rows.find(r=>r.item.id===b.dataset.takeAnvil);if(!row)return;
      const component=!!row.component;mutate(()=>DecisionPlanner.receiveAnvil(state,row),component?row.item.name+' received from anvil.':row.item.name+' received; loose components kept.');
      offers={};mode='browse';setQuery();modal.close();
    }
  });
  document.addEventListener('keydown',e=>{
    if(!modal.open||type!=='components'||e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    const dialogs=[...document.querySelectorAll('dialog[open]')];if(dialogs[dialogs.length-1]!==modal)return;
    const match=/^(?:Digit|Numpad)([1-8])$/.exec(e.code||'');if(!match)return;
    if(document.activeElement===input&&query.trim())return;
    e.preventDefault();const id=componentOrder[Number(match[1])-1];if(e.shiftKey)removeOffer(id);else addOffer(id);
  });
  const previous=render;render=function(){previous();if(modal.open)draw(true);};
  document.addEventListener('carousel-meta-updated',()=>{if(modal.open)draw(true);});
  document.addEventListener('carousel-new-game',()=>{modal.close();offers={};mode='browse';setQuery();});
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Anvil offers:</b> keep the full priority list, or switch to My offers. Type a few letters and Enter for each option; the chosen offers are ranked automatically. Component anvils also use the displayed 1–8 keys (Shift removes an offer). These keys only enter offers inside that dialog. Took this adds exactly one selected item; component anvils are recorded as Other, not PvE. Closing and reopening keeps unfinished offers; taking an item clears them.</li><li><b>Carousel counts:</b> ×N is the number still missing from your current queue after using your loose bench components. Planned needs rank before alternatives. Pivot item means a component supports a suggested alternative build; Not needed means no current queue shortage or supported pivot. Pins move components within these priority groups. The single item icon shows the highest-priority planned target, or the top compatible pivot when there is no planned need. Completed copies and loose components are already accounted for.</li>');
  return {open,refresh:()=>draw(true)};
})();
