(() => {
  let expanded=false,catalogSignature='',exploring=false,lastComp=state.activeComp?.id||'',unitCost=0,specialType='all';
  const panel=document.createElement('section');panel.id='comp-finder';panel.className='panel comp-finder';panel.setAttribute('aria-labelledby','finder-title');
  panel.innerHTML=`<div class="finder-heading"><div><h2 id="finder-title">Explore builds</h2><p>Your board, your drops → an Academy plan to aim for.</p></div></div>
  <div class="explore-inputs"><section class="explore-board"><div class="explore-label"><h3>Current champions</h3><span>Board + bench · highest star per champion</span></div><div class="unit-search-row"><label class="visuallyhidden" for="explore-unit-search">Add a champion</label><input id="explore-unit-search" class="search" placeholder="Add champion… type a name, Enter" autocomplete="off" type="search" aria-controls="explore-unit-results"><button id="explore-browse" class="quiet">Browse</button></div><div id="explore-unit-results" class="unit-search-results" hidden></div><div id="explore-current-units" class="current-units"></div></section>
  <section class="explore-inventory"><div class="finder-controls"><label for="first-augment-trigger">First augment</label><select id="first-augment"></select></div><p id="augment-note" class="finder-note"></p><div class="explore-label"><h3>Completed items</h3><button id="explore-items-open" class="quiet">Browse all</button></div><div class="owned-search-wrap"><label class="visuallyhidden" for="owned-item-search">Add an owned completed item</label><input id="owned-item-search" class="search" type="search" placeholder="Add owned item… Rageblade, emblem, radiant…" autocomplete="off" aria-controls="owned-item-results"><div id="owned-item-results" hidden></div></div><div id="explore-owned-items"></div><small class="explore-inventory-note">Track loose components on the component bench.</small></section></div>
  <p id="finder-tier-notice" class="finder-note"></p><div class="finder-list-heading"><strong>Closest routes from what you have</strong><span>S, A, B and X · badges = Academy tier</span></div><div id="comp-suggestions"></div><button id="finder-more" class="quiet"></button>
  <details class="finder-method"><summary>How this is ranked</summary><p>Academy tier leads until a lower-tier comp has at least ${CompFinder.tierFitGap} more fit points from your items, champions and augments.</p><p>Owned emblems put Academy’s final builds and single-emblem alternatives first, with up to +${CompFinder.primaryEmblemCap} fit for those matches and +${CompFinder.flexEmblemCap} total for other emblem fits.</p></details>`;
  document.querySelector('.plan-queue').prepend(panel);
  const exploreInputs=panel.querySelector('.explore-inputs');
  const boardEditor=exploreInputs.querySelector('.explore-board');
  const planEditor=document.createElement('details');
  planEditor.className='panel plan-champions';
  planEditor.innerHTML='<summary>Edit current champions</summary>';
  panel.before(planEditor);
  const alternatives=document.createElement('section');
  alternatives.className='panel pivot-section';
  alternatives.setAttribute('aria-labelledby','comp-alternative-title');
  alternatives.innerHTML='<div><h2 id="comp-alternative-title">No better fit yet</h2><p id="comp-alternative-status"></p></div><button type="button" data-choose-comp="" hidden></button>';
  panel.after(alternatives);
  const alternativeTitle=alternatives.querySelector('h2');
  const alternativeButton=alternatives.querySelector('button');
  const compFit=document.getElementById('comp-fit');
  const alternativeStatus=alternatives.querySelector('p');
  const mode=document.createElement('button');mode.id='explore-mode';mode.className='quiet';mode.textContent='Explore builds';document.querySelector('.actions').prepend(mode);
  mode.addEventListener('click',()=>{
    exploring=!exploring;draw();
    if(exploring)panel.scrollIntoView({block:'start'});
  });
  const select=panel.querySelector('select');select.innerHTML='<option value="">Not chosen yet</option>';
  const picker=IconUI.picker(select,'augment','First augment',query=>AugmentAdvisor.searchNotice(query));
  select.addEventListener('change',()=>{
    const id=select.value,augment=CompFinder.augment(id);
    if(augment&&id!==state.firstAugment&&!AugmentAdvisor.eligible(augment,0)){
      select.value=state.firstAugment||'';
      AugmentUI.open(0,id);
      return;
    }
    mutate(()=>{state.firstAugment=id;state.chosenAugments||=['','',''];state.chosenAugments[0]=id;},'First augment updated.');
  });
  panel.querySelector('#finder-more').addEventListener('click',()=>{expanded=!expanded;draw();});
  panel.parentElement.addEventListener('click',e=>{
    const b=e.target.closest('[data-choose-comp]');if(!b)return;
    try{
      exploring=false;
      mutate(()=>CompFinder.choose(state,b.dataset.chooseComp),'Academy plan loaded. Board and inventory kept.');
      if(panel.contains(b))window.scrollTo(0,0);
    }catch(err){toast(err.message);}
  });
  const unitsDialog=document.createElement('dialog');unitsDialog.id='explore-unit-dialog';unitsDialog.setAttribute('aria-labelledby','unit-dialog-title');
  unitsDialog.innerHTML='<div class="modal-heading"><h2 id="unit-dialog-title">Your champions</h2><button data-close="explore-unit-dialog" aria-label="Close champion picker">×</button></div><input class="search" id="unit-dialog-search" type="search" placeholder="Find a champion…" aria-label="Find a champion"><div id="unit-costs" class="explore-tabs" role="group" aria-label="Champion cost"></div><div id="unit-dialog-list" class="unit-catalog"></div><p class="finder-note">Click to add or remove. Set stars on your board.</p>';
  document.body.append(unitsDialog);
  const itemsDialog=document.createElement('dialog');itemsDialog.id='explore-item-dialog';itemsDialog.setAttribute('aria-labelledby','explore-item-title');
  itemsDialog.innerHTML='<div class="modal-heading"><h2 id="explore-item-title">Items you own</h2><button data-close="explore-item-dialog" aria-label="Close owned item picker">×</button></div><input class="search" id="explore-item-search" type="search" placeholder="Find an item…" aria-label="Find an owned item"><div id="explore-item-tabs" class="explore-tabs" role="group" aria-label="Item type"></div><div id="explore-item-list" class="special-catalog"></div><p class="finder-note">Record items you already own. One click per copy; components stay unchanged.</p>';
  document.body.append(itemsDialog);
  const search=panel.querySelector('#explore-unit-search'),results=panel.querySelector('#explore-unit-results');
  function unitButton(c,attr='data-add-unit'){
    const selected=(state.currentUnits||[]).some(u=>u.apiName===c.apiName);
    return `<button ${attr}="${esc(c.apiName)}" class="unit-pick cost-${c.cost}" ${attr==='data-toggle-unit'?`aria-pressed="${selected}"`:''} aria-label="${attr==='data-toggle-unit'&&selected?'Remove':'Add'} ${esc(c.name)}"><span>${IconUI.champion(c.apiName)}${selected?'<b>✓</b>':''}</span><span>${esc(c.name)}</span><small>${c.cost}g</small></button>`;
  }
  function drawSearch(){const q=Academy.normalizeName(search.value);results.hidden=!q;results.innerHTML=q?CompFinder.champions().filter(c=>Academy.normalizeName(c.name).includes(q)).slice(0,12).map(c=>unitButton(c)).join('')||'<p class="finder-note">No champions found.</p>':'';}
  function drawUnitDialog(){
    const q=Academy.normalizeName(document.getElementById('unit-dialog-search').value);
    document.getElementById('unit-costs').innerHTML=[0,1,2,3,4,5].map(n=>`<button data-unit-cost="${n}" aria-pressed="${n===unitCost}">${n?n+'g':'All'}</button>`).join('');
    document.getElementById('unit-dialog-list').innerHTML=CompFinder.champions().filter(c=>(!unitCost||c.cost===unitCost)&&Academy.normalizeName(c.name).includes(q)).map(c=>unitButton(c,'data-toggle-unit')).join('')||'<p class="finder-note">No champions found.</p>';
  }
  function drawItemsDialog(){
    const q=Academy.normalizeName(document.getElementById('explore-item-search').value);
    document.getElementById('explore-item-tabs').innerHTML=[['all','All'],['craftables','Standard'],['emblems','Emblems'],['radiants','Radiant'],['ornns','Artifacts'],['others','Other']].map(([id,name])=>`<button data-special-type="${id}" aria-pressed="${specialType===id}">${name}</button>`).join('');
    const found=CompFinder.ownedCatalog().filter(i=>(specialType==='all'||i.type===specialType)&&Academy.normalizeName(i.name).includes(q));
    document.getElementById('explore-item-list').innerHTML=found.flatMap(i=>{const id=i.id;if(!byId[id])return [];const count=state.queue.filter(q=>q.done&&q.item===id).length;
      return [`<button class="special-pick" data-owned-add="${esc(id)}" aria-label="Add owned ${esc(i.name)}${count?', '+count+' already recorded':''}" title="${esc(i.name)}">${icon(id)}<span>${esc(i.name.replace(/^Radiant /,''))}</span>${count?`<b>×${count}</b>`:''}</button>`];}).join('')||'<p class="finder-note">No matching items in this category.</p>';
  }
  const ownedSearch=document.getElementById('owned-item-search'),ownedResults=document.getElementById('owned-item-results');
  function drawOwnedSearch(){
    const q=Academy.normalizeName(ownedSearch.value);ownedResults.hidden=!q;
    const labels={craftables:'Standard',radiants:'Radiant',ornns:'Artifact',emblems:'Emblem',others:'Other'};
    const found=CompFinder.ownedCatalog().filter(i=>Academy.normalizeName(i.name).includes(q)).sort((a,b)=>Number(!Academy.normalizeName(a.name).startsWith(q))-Number(!Academy.normalizeName(b.name).startsWith(q))||a.name.localeCompare(b.name)).slice(0,10);
    ownedResults.innerHTML=q?found.map(i=>`<button data-owned-quick="${esc(i.id)}" aria-label="Record owned ${esc(i.name)}">${icon(i.id)}<span>${esc(i.name)}</span><small>${labels[i.type]||'Other'}</small></button>`).join('')||'<p class="finder-note">No matching items. Try the item name or Browse all.</p>':'';
  }
  function receiveOwned(id){if(!byId[id])return;mutate(()=>{const q=state.queue.find(q=>!q.done&&q.item===id&&Academy.canEquip(state,q.champion,id));if(q)OfflineTracker.receive(state,q);else state.queue.push({uid:crypto.randomUUID(),item:id,done:true,received:true,used:{},usedSources:{},champion:''});},byId[id].name+' recorded.');}
  ownedSearch.addEventListener('input',drawOwnedSearch);
  ownedSearch.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=ownedResults.querySelector('button');if(b){e.preventDefault();b.click();}}else if(e.key==='Escape'){ownedSearch.value='';drawOwnedSearch();}else if(e.key==='ArrowDown'){e.preventDefault();ownedResults.querySelector('button')?.focus();}});
  search.addEventListener('input',drawSearch);
  search.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=results.querySelector('button');if(b){e.preventDefault();b.click();}}else if(e.key==='Escape'){search.value='';drawSearch();}else if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}});
  panel.querySelector('#explore-browse').addEventListener('click',()=>{unitCost=0;document.getElementById('unit-dialog-search').value='';drawUnitDialog();unitsDialog.showModal();document.getElementById('unit-dialog-search').focus();});
  panel.querySelector('#explore-items-open').addEventListener('click',()=>{specialType='all';document.getElementById('explore-item-search').value='';drawItemsDialog();itemsDialog.showModal();document.getElementById('explore-item-search').focus();});
  document.getElementById('unit-dialog-search').addEventListener('input',drawUnitDialog);document.getElementById('explore-item-search').addEventListener('input',()=>{specialType='all';drawItemsDialog();});
  document.addEventListener('click',e=>{
    let b=e.target.closest('[data-add-unit]');if(b){mutate(()=>CompFinder.addUnit(state,b.dataset.addUnit),'Champion added.');search.value='';drawSearch();search.focus();}
    b=e.target.closest('[data-toggle-unit]');if(b){const id=b.dataset.toggleUnit;mutate(()=>{if((state.currentUnits||[]).some(u=>u.apiName===id))state.currentUnits=state.currentUnits.filter(u=>u.apiName!==id);else CompFinder.addUnit(state,id);},'Board updated.');}
    b=e.target.closest('[data-unit-stars]');if(b)mutate(()=>{const u=state.currentUnits?.find(u=>u.apiName===b.dataset.unit);if(u)u.stars=Number(b.dataset.unitStars);},'Star level updated.');
    b=e.target.closest('[data-unit-remove]');if(b)mutate(()=>{state.currentUnits=(state.currentUnits||[]).filter(u=>u.apiName!==b.dataset.unitRemove);},'Champion removed.');
    b=e.target.closest('[data-unit-cost]');if(b){unitCost=Number(b.dataset.unitCost);drawUnitDialog();}
    b=e.target.closest('[data-special-type]');if(b){specialType=b.dataset.specialType;drawItemsDialog();}
    b=e.target.closest('[data-owned-add]');if(b)receiveOwned(b.dataset.ownedAdd);
    b=e.target.closest('[data-owned-quick]');if(b){receiveOwned(b.dataset.ownedQuick);ownedSearch.value='';drawOwnedSearch();ownedSearch.focus();}
    if(!e.target.closest('.owned-search-wrap'))ownedResults.hidden=true;
    b=e.target.closest('[data-owned-remove]');if(b)mutate(()=>{state.queue=state.queue.filter(q=>q.uid!==b.dataset.ownedRemove);},'Owned item removed. Undo to restore.');
    if(!e.target.closest('.explore-board'))results.hidden=true;
  });
  document.addEventListener('error',e=>{if(!e.target.classList?.contains('augment-icon'))return;const fallback=document.createElement('span');fallback.className='augment-icon augment-fallback';fallback.textContent='✦';fallback.setAttribute('aria-hidden','true');e.target.replaceWith(fallback);},true);
  const chips=ids=>ids.map(id=>`<span class="finder-item" title="${esc(byId[id]?.name||id)}" aria-label="${esc(byId[id]?.name||id)}">${icon(id)}</span>`).join('');
  const unitChips=units=>units.map(u=>`<span class="fit-unit" title="${esc(u.name)} ${u.stars}★${u.targetStars&&u.targetStars>u.stars?' → target '+u.targetStars+'★':''}" aria-label="${esc(u.name)}, ${u.stars} stars">${IconUI.champion(u.apiName)}<b>${u.stars}★</b></span>`).join('');
  function drawBoard(){
    const units=CompFinder.units(state);
    document.getElementById('explore-current-units').innerHTML=units.map(u=>`<div class="current-unit"><div>${IconUI.champion(u.apiName)}<strong>${esc(u.name)}</strong><button class="unit-remove" data-unit-remove="${esc(u.apiName)}" aria-label="Remove ${esc(u.name)}">×</button></div><div class="unit-stars" role="group" aria-label="${esc(u.name)} star level">${[1,2,3].map(n=>`<button data-unit-stars="${n}" data-unit="${esc(u.apiName)}" data-focus="unit-${esc(u.apiName)}-${n}" aria-pressed="${u.stars===n}" aria-label="${esc(u.name)} ${n} star${n>1?'s':''}">${n}★</button>`).join('')}</div></div>`).join('')||'<p class="finder-note">Add a few units to see which boards you’re closest to.</p>';
    if(unitsDialog.open)drawUnitDialog();drawSearch();
  }
  function draw(){
    const comp=state.activeComp?.id||'';if(comp!==lastComp){exploring=false;lastComp=comp;}
    panel.hidden=!!state.activeComp&&!exploring;mode.hidden=!state.activeComp;mode.textContent=exploring?'Back to plan':'Explore builds';mode.setAttribute('aria-pressed',String(exploring));
    planEditor.hidden=!panel.hidden;
    const editorParent=panel.hidden?planEditor:exploreInputs;
    if(boardEditor.parentElement!==editorParent){
      if(panel.hidden)planEditor.append(boardEditor);
      else exploreInputs.prepend(boardEditor);
    }
    drawBoard();
    document.querySelector('.centercol').classList.toggle('exploring-plan',!!state.activeComp&&exploring);
    alternatives.hidden=!state.activeComp;
    const current=Academy.currentGuide(state),guide=current||Academy.guide(state);
    const fit=current&&CompFinder.evaluate(state,current);
    compFit.hidden=!state.activeComp;
    const tier=fit?.unlocked?'X · Unlocked':guide?.tier==='X'&&fit?'X · Situational':guide?.tier;
    compFit.innerHTML=`${tier?academyTierBadges(guide,tier):''}<span>${fit?.selectable?'Fit score '+Number(fit.fitScore.toFixed(2)):'Fit score unavailable'}</span>`;
    const alternative=CompFinder.alternative(state)?.guide;
    alternativeTitle.textContent=alternative?'A better fit for your board':'No better fit yet';
    alternativeStatus.textContent=alternative?'Better fit for your current board and items.':Academy.isCurrent()
      ?'No better-fitting pivot available for your board and items.'
      :'Refresh live data to compare your plan with other comps.';
    alternativeButton.hidden=!alternative;
    alternativeButton.dataset.chooseComp=alternative?.id||'';
    alternativeButton.textContent=alternative?'Pivot to '+alternative.title:'';
    if(panel.hidden){picker.close();return;}
    document.getElementById('explore-owned-items').innerHTML=state.queue.filter(q=>q.done).map(q=>{
      const name=esc(byId[q.item].name), item=Academy.itemInfo(q.item);
      const art=item?.type==='emblems'
        ? `<button class="owned-emblem" data-explore-emblem="${esc(item.apiName)}" aria-haspopup="dialog" aria-label="Explore ${name}">${icon(q.item)}</button>`
        : icon(q.item);
      return `<span class="explore-owned" title="${name}">${art}<button data-owned-remove="${esc(q.uid)}" aria-label="Remove owned ${name}">×</button></span>`;
    }).join('')||'<span class="finder-note">No completed items recorded</span>';
    if(itemsDialog.open)drawItemsDialog();
    const selected=state.firstAugment||'';
    const catalog=CompFinder.augments().map(a=>({...a,value:a.ids.includes(selected)?selected:a.apiName}));
    const signature=JSON.stringify(catalog.map(a=>[a.value,a.name]))+'|'+selected;
    if(signature!==catalogSignature){
      catalogSignature=signature;
      select.innerHTML='<option value="">Not chosen yet</option>'+catalog.map(a=>`<option value="${esc(a.value)}">${esc(a.name)}</option>`).join('');
      if(selected&&!catalog.some(a=>a.value===selected))select.insertAdjacentHTML('beforeend',`<option value="${esc(selected)}">Saved augment (unavailable)</option>`);
      select.value=selected;picker.refresh();
    }
    const {rows,tierNotice,notice,guidance}=CompFinder.recommendations(state);
    const note=panel.querySelector('#augment-note');
    const held=CompFinder.heldAugments(state).length,hasMatch=rows.some(r=>r.augmentMatches.some(a=>a.academy||a.recommended));
    note.textContent=held?(hasMatch?'★ marks an Academy recommendation or a rules-based augment fit.':'Review each fit score for your augment’s contribution.'):'Optional · select your 2-1 augment.';
    note.title=CompFinder.augment(selected)?.description||'';
    panel.querySelector('#finder-tier-notice').textContent=tierNotice;
    panel.querySelector('.finder-list-heading').hidden=!rows.length;
    panel.querySelector('#comp-suggestions').innerHTML=(expanded?rows:rows.slice(0,5)).map((r,n)=>{
      const g=r.guide,tier=r.unlocked?'X · Unlocked':g.tier==='X'?'X · Situational':academyTier(g.tier).label,carry=g.mainChampion?.apiName;
      const fit=[r.keepers.length?`<span>Keep ${unitChips(r.keepers)}</span>`:'',r.early.length?`<span>Early ${unitChips(r.early)}</span>`:'',r.bridges.length?`<span>Trait bridge ${unitChips(r.bridges)}</span>`:'',r.matched.length?`<span>Owned ${chips(r.matched)}</span>`:'',r.used.length?`<span>Fits ${chips(r.used)}</span>`:'',r.ready.length?`<span>Can build ${chips(r.ready)}</span>`:'',r.earlyMatches.length?`<span>Early items ${chips(r.earlyMatches.map(m=>m.item))}</span>`:'',r.featuredOwned?`<span>Academy key item ${chips([r.featuredOwned])}</span>`:'',r.unmatched.length?`<span class="finder-unmatched">Off-plan ${chips(r.unmatched)}</span>`:'',r.unknownSpecial.some(id=>id!==r.featuredOwned)?`<span class="finder-unmatched">No supported match ${chips(r.unknownSpecial.filter(id=>id!==r.featuredOwned))}</span>`:''].filter(Boolean).join('');
      const special=r.specialMatches.map(s=>`<span class="special-destination" title="${esc(s.source)}">${chips([s.item])}<span>→</span>${IconUI.championLabel(s.champion)}<small>${esc(s.source)}</small></span>`).join('');
      const needs=[r.missingEmblems.length?`<span>Plan needs ${chips(r.missingEmblems)}</span>`:'',r.craftableEmblems.length?`<span>Emblem ready ${chips(r.craftableEmblems)}</span>`:'',r.missingAugment?`<span>Needs ${augmentIcon(r.missingAugment)} ${esc(CompFinder.augment(r.missingAugment)?.name||'required augment')}</span>`:'',r.missingCore.length?`<span>Aim for ${unitChips(r.missingCore.map(u=>({...u,stars:u.targetStars})))}</span>`:''].filter(Boolean).join('');
      const noFit=Object.values(state.owned).some(n=>n>0)||CompFinder.units(state).length?'No strong match yet':'Add items or units to personalize';
      const stars=r.augmentMatches.filter(a=>a.academy||a.recommended).map(a=>{
        const label=a.name+' · '+(a.academy?'Academy recommendation':'Rules-based augment fit');
        return `<span class="finder-augment-match" title="${esc(label)}" aria-label="${esc(label)}">${augmentIcon(a.id)}<b aria-hidden="true">★</b></span>`;
      }).join('');
      const passed=r.passedTier;
      const promotion=passed?`Fit moves ahead of ${passed.guide.title} by ${Number((r.fitScore-passed.fitScore).toFixed(2))} points.`:'';
      const breakdown=[
        `<li>Academy tier ${esc(tier)} · ranking priority</li>`,
        promotion?`<li>${esc(promotion)}</li>`:'',
        ...r.reasons.map(({points,text})=>`<li>${points>0?'+':''}${Number(points.toFixed(2))} · ${esc(text)}</li>`)
      ].join('');
      return `<article class="comp-suggestion"><span class="finder-rank">${r.blocked?'':n+1}</span><div class="finder-comp"><div class="finder-titleline">${IconUI.champion(carry)}<h3>${esc(g.title)}</h3>${academyTierBadges(g,tier)}${stars}</div><div class="finder-fit">${fit||'<span class="muted">'+(stars?'Augment fit':noFit)+'</span>'}</div>${special?'<div class="special-destinations">'+special+'</div>':''}${needs?'<div class="finder-needs">'+needs+'</div>':''}${r.gateReason||r.unlockReason?`<p class="finder-note">${esc(r.gateReason||r.unlockReason)}</p>`:''}<details class="finder-method"><summary>Fit score ${Number(r.fitScore.toFixed(2))}</summary><ul>${breakdown}</ul></details></div><button ${r.blocked?'disabled ':''}data-choose-comp="${esc(g.id)}" aria-label="Choose ${esc(g.title)}">Aim here</button></article>`;
    }).join('')||`<div class="finder-empty"><p role="status">${esc(notice)}</p><ul>${guidance.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></div>`;
    const more=panel.querySelector('#finder-more');more.hidden=rows.length<=5;more.textContent=expanded?'Show fewer':`All ${rows.length} comps`;
    const empty=document.querySelector('#queue .empty');if(empty)empty.hidden=true;
  }
  document.addEventListener('carousel-new-game',()=>{expanded=false;exploring=false;planEditor.open=false;search.value='';ownedSearch.value='';drawOwnedSearch();picker.close();unitsDialog.close();itemsDialog.close();draw();});
  document.addEventListener('carousel-comp-imported',()=>{exploring=false;draw();window.scrollTo(0,0);});
  document.addEventListener('carousel-meta-updated',draw);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-pivot-item]:not([data-pivot-kind])');if(b)PivotDialog.open(b.dataset.pivotItem);});
  const previous=render;render=function(){const focus=document.activeElement?.dataset.focus;previous();draw();if(focus?.startsWith('unit-'))document.querySelector('[data-focus="'+CSS.escape(focus)+'"]')?.focus();for(const card of document.querySelectorAll('#queue .qcard')){const uid=card.querySelector('[data-action="remove"]')?.dataset.id,img=card.querySelector('.qtop > .icon');if(!uid||!img)continue;const b=document.createElement('button');b.className='queue-item-pivot';b.dataset.pivotItem=uid;b.setAttribute('aria-label','Pivot '+byId[state.queue.find(q=>q.uid===uid).item].name);b.setAttribute('aria-haspopup','dialog');img.before(b);b.append(img);}};
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Explore builds:</b> type a champion name and Enter, then set its stars. Record your first augment and any completed items using the owned-item search or Browse all. Standard items, emblems, radiants, artifacts and other items are supported; click once per owned copy. Academy tier leads; lower tiers move ahead only for a strong match with a clear fit advantage. Unbuilt wishlist items do not count. Suggestions update from your board and inventory. Aim here loads an Academy guide and preserves everything recorded. Radiants cover the corresponding normal-item targets. Other special-item carrier suggestions do not assign equipment automatically. Explore builds can be reopened from your plan. New game clears board, augment and inventory; Undo restores them.</li><li>Click an unfinished item icon on the board or queue to pivot. Click outside any dialog to close it.</li>');
  render();
})();
