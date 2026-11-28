/* Compact champion reference. */
(() => {
  const makeDialog=(id,html)=>{const d=document.createElement('dialog');d.id=id;d.innerHTML=html;document.body.append(d);return d;};
  const reference=makeDialog('meta-reference','<div class="modal-heading"><h2 id="reference-title">MetaTFT · S/A item builds</h2><button data-close="meta-reference" aria-label="Close builds">×</button></div><div class="reference-controls"><label>Champion <select id="reference-champion"></select></label><label>Containing item <select id="reference-item"><option value="">Any item</option></select></label></div><div class="reference-options"><label><input type="checkbox" id="reference-equipped" checked> Match completed items</label><button id="reference-pivot">Pivot to an item…</button><button id="reference-site">Open MetaTFT here ↗</button></div><div id="reference-owned" class="reference-owned"></div><div class="reference-hint"><span>Green ✓ = completed on this champion</span><button id="reference-clear">Clear item filter</button></div><details class="reference-data"><summary id="reference-data-summary">Data details</summary><p id="reference-date" class="reference-date"></p></details><div class="reference-table-heading"><span>Build</span><span>Tier</span><span>Avg place</span><span>Games</span></div><div id="reference-results"></div>');
  reference.setAttribute('aria-labelledby','reference-title');
  const site=makeDialog('meta-site','<div class="modal-heading"><h2 id="site-title">MetaTFT</h2><a id="site-external" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a><button data-close="meta-site" aria-label="Close MetaTFT page">×</button></div><p class="frame-note">If the page stays blank or embedding is blocked, use the new-tab link.</p><iframe id="meta-frame" title="MetaTFT champion page" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin"></iframe>');
  site.setAttribute('aria-labelledby','site-title');
  const champSelect=document.getElementById('reference-champion'),itemSelect=document.getElementById('reference-item');
  let selected='',itemFilter='',matchEquipped=true,opener=null,lastSnapshot;
  const champPicker=IconUI.picker(champSelect,'champion','Champion'),itemPicker=IconUI.picker(itemSelect,'item','Containing item');
  function champions(){
    lastSnapshot=Academy.snapshot;
    const all=[...new Map(Academy.snapshot.champions.filter(c=>c.name).map(c=>[c.name,c])).values()].sort((a,b)=>a.name.localeCompare(b.name));
    champSelect.innerHTML=all.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    if(!all.some(c=>c.name===selected))selected=state.queue.find(q=>q.champion)?.champion||all[0]?.name||'';
    champSelect.value=selected;champPicker.refresh();
  }
  function drawReference(){
    const data=MetaBuilds.find(selected,true)?.entry,builds=MetaBuilds.referenceBuilds(selected,data);
    const ids=[...new Set(builds.flatMap(b=>b.ids))].sort((a,b)=>byId[a].name.localeCompare(byId[b].name));
    itemSelect.innerHTML='<option value="">Any item</option>'+ids.map(id=>`<option value="${esc(id)}">${esc(byId[id].name)}</option>`).join('');
    if(itemFilter&&!ids.includes(itemFilter))ids.push(itemFilter);itemSelect.value=itemFilter;itemPicker.refresh();
    const holders=MetaBuilds.equipment(state),equipped=state.queue.filter(q=>q.done&&Academy.normalizeName(holders.get(q.uid)||'')===Academy.normalizeName(selected)).map(q=>q.item);
    const intents=MetaBuilds.isCompatible(data)?DecisionPlanner.commitments(state,selected):[];
    const filtered=builds.filter(b=>{
      const remaining=DecisionPlanner.subtract(b.ids,equipped);
      return (!itemFilter||b.ids.includes(itemFilter))&&(!matchEquipped||remaining!==null)&&
        MetaBuilds.fits(remaining||[],intents);
    });
    document.getElementById('reference-date').textContent=MetaBuilds.isCurrentSet(data)?`${filtered.length} builds · ${data.rankFilter==='ALL'?'All ranks':'Platinum+'} · Patch ${data.patch||'?'}${MetaBuilds.isCompatible(data)?'':' · saved data'}`:'No rankings available for this champion in the loaded set.';
    const connection=MetaBuilds.connection(selected);
    document.getElementById('reference-title').innerHTML=IconUI.champion(selected)+'<span>'+esc(selected)+' <small>MetaTFT · S/A builds</small></span>';
    document.getElementById('reference-data-summary').textContent=`${filtered.length} builds · ${connection.source}${data&&!MetaBuilds.isCompatible(data)?' · saved data':''}${connection.error?' · refresh unavailable':''}`;
    document.getElementById('reference-owned').innerHTML=equipped.length?'<span>Equipped</span>'+equipped.map(id=>`<span class="equipped-chip" title="${esc(byId[id].name)}">${icon(id)}<b>✓</b></span>`).join(''):'<span>No completed items assigned to this champion</span>';
    document.getElementById('reference-pivot').disabled=!MetaBuilds.isCompatible(data);
    document.getElementById('reference-clear').disabled=!itemFilter;
    document.getElementById('reference-results').innerHTML=filtered.map(b=>{
      const copies=[...equipped];
      const cells=b.ids.map(id=>{const at=copies.findIndex(x=>Academy.itemMatches(id,x)),owned=at>=0;if(owned)copies.splice(at,1);
        return `<button class="build-item ${owned?'equipped':''} ${itemFilter===id?'filter-selected':''}" data-reference-filter="${esc(id)}" title="${esc(byId[id].name)}${owned?' · completed on '+esc(selected):' · not completed on '+esc(selected)} · click to filter" aria-label="${esc(byId[id].name)}${owned?', completed on '+esc(selected):', not completed on '+esc(selected)}. Filter builds containing this item">${icon(id)}${owned?'<b class="equipped-check">✓</b>':''}<span class="build-item-name">${esc(byId[id].name)}</span></button>`;
      }).join('');
      return `<article class="reference-build"><div class="reference-items">${cells}</div><b class="build-tier tier-${b.tier}">${b.tier}</b><span class="build-average">${Number(b.avg).toFixed(2)}</span><span class="build-games">${Number(b.games).toLocaleString()}</span></article>`;
    }).join('')||'<div class="reference-empty">No matching S/A builds.<br>Clear the item filter or turn off “Match completed items”. The live page may have newer data.</div>';
    document.getElementById('reference-site').innerHTML=IconUI.champion(selected)+'<span>MetaTFT page ↗</span>';
  }

  function openReference(name,button){
    opener=button;selected=name||selected;itemFilter='';champPicker.close();itemPicker.close();champions();drawReference();reference.showModal();if(button)button.setAttribute('aria-expanded','true');MetaBuilds.request(selected);
  }
  window.MetaReference={open:openReference,selected:()=>selected,filter(id){itemFilter=id;matchEquipped=true;document.getElementById('reference-equipped').checked=true;drawReference();},refresh:drawReference,openPage(url,title,portrait=''){document.getElementById('site-title').innerHTML=portrait+'<span>'+esc(title)+'</span>';document.getElementById('site-external').href=url;document.getElementById('meta-frame').title=title;document.getElementById('meta-frame').src=url;site.showModal();}};
  document.getElementById('reference-pivot').addEventListener('click',()=>DecisionUI.openPivot(selected));
  document.getElementById('reference-clear').addEventListener('click',()=>{itemFilter='';drawReference();});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-champion-builds]');if(b)openReference(b.dataset.championBuilds,b);});
  champSelect.addEventListener('change',()=>{selected=champSelect.value;itemFilter='';drawReference();MetaBuilds.request(selected);});
  itemSelect.addEventListener('change',()=>{itemFilter=itemSelect.value;drawReference();});
  document.getElementById('reference-equipped').addEventListener('change',e=>{matchEquipped=e.target.checked;drawReference();});
  document.getElementById('reference-results').addEventListener('click',e=>{const b=e.target.closest('[data-reference-filter]');if(b){itemFilter=b.dataset.referenceFilter;drawReference();}});
  document.getElementById('reference-site').addEventListener('click',()=>{
    MetaReference.openPage('https://www.metatft.com/units/'+encodeURIComponent(selected),selected+' · MetaTFT',IconUI.champion(selected));
  });
  site.addEventListener('close',()=>document.getElementById('meta-frame').removeAttribute('src'));
  reference.addEventListener('close',()=>{champPicker.close();itemPicker.close();if(opener){opener.setAttribute('aria-expanded','false');if(opener.isConnected)opener.focus();}});
  document.addEventListener('carousel-meta-updated',()=>{if(reference.open)drawReference();});
  document.addEventListener('carousel-new-game',()=>{reference.close();site.close();document.getElementById('meta-frame').removeAttribute('src');});
  const oldRender=render;render=function(){
    oldRender();
    for(const card of document.querySelectorAll('#queue .qcard')){
      const q=state.queue.find(q=>q.uid===card.dataset.queueUid),owner=card.querySelector('.item-owner');if(!q?.champion||!owner)continue;
      const b=document.createElement('button');b.className='queue-champion';b.dataset.championBuilds=q.champion;b.innerHTML=owner.innerHTML;b.setAttribute('aria-label',q.champion+' S/A builds');b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');owner.replaceChildren(b);
    }
    if(reference.open){
      if(lastSnapshot!==Academy.snapshot)champions();
      MetaBuilds.request(selected);drawReference();
    }
  };
  render();
})();
