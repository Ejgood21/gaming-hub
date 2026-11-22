(() => {
  const center=document.querySelector('.centercol'),queueColumn=document.createElement('div');queueColumn.className='plan-queue';
  while(center.firstChild)queueColumn.append(center.firstChild);center.append(queueColumn);
  const overview=document.createElement('aside');overview.className='plan-overview';overview.setAttribute('aria-label','Academy build progress and advice');center.append(overview);
  overview.innerHTML='<section class="board-panel panel"><div class="board-heading"><span id="board-source-status" class="source-notice"></span><button id="board-source" class="quiet">Academy original ↗</button></div><div id="position-board"></div><div class="board-legend"><span>○ Planned</span><span>◐ Components ready</span><span>✓ Completed</span><span>↔ Adjusted plan</span></div><div id="board-extras"></div></section><section class="tips-panel panel"><div class="tips-heading"><h2>Academy tips</h2></div><div id="academy-tips"></div></section>';
  const origin=document.createElement('div');origin.className='academy-order';origin.innerHTML='<button id="restore-academy" class="quiet">Reset targets to Academy</button>';overview.prepend(origin);origin.prepend(document.getElementById('academy-priority'));
  document.getElementById('restore-academy').addEventListener('click',()=>mutate(()=>PlanAdvisor.restoreAcademy(state),'Academy targets restored. Inventory kept.'));
  const diagnostics=document.createElement('details');diagnostics.className='data-diagnostics';diagnostics.innerHTML='<summary>MetaTFT connection details</summary><p>Live checks run for assigned champions after a verified refresh, on focus, and while this tab is visible. Stats can guide pivots for 15 minutes. A failed check makes prior stats stale reference.</p><p>Host: <code>api-hc.metatft.com</code><br>Endpoints: <code>unit_detail_overall</code> and <code>unit_detail_items</code>. Filters: ranked, Platinum+, current patch, last 3 days, three-item builds. No API key.</p><div id="meta-diagnostics"></div>';
  document.getElementById('settings-dialog').append(diagnostics);
  if(state.activeComp&&!state.activeComp.guide){const g=Academy.guide(state);if(g){state.activeComp.guide=Academy.cleanGuide(g);save();}}
  let assignmentUid='';
  const assign=document.createElement('dialog');assign.id='assign-holder';assign.innerHTML='<div class="modal-heading"><h2 id="holder-title">Item holder</h2><button data-close="assign-holder" aria-label="Close holder chooser">×</button></div><p>Assign this completed item so the board and suggestions use it.</p><label>Champion <select id="holder-select"></select></label><button id="holder-save">Assign item</button>';document.body.append(assign);
  assign.setAttribute('aria-labelledby','holder-title');
  const holderPicker=IconUI.picker(document.getElementById('holder-select'),'champion','Item holder');
  function champNames(){return [...new Set([...(Academy.guide(state)?.finalComp||[]).map(c=>Academy.snapshot.champions.find(u=>u.apiName===c.apiName)?.name),...state.queue.map(q=>q.champion)].filter(Boolean))];}
  function openHolder(uid){const q=state.queue.find(q=>q.uid===uid&&q.done);if(!q)return;assignmentUid=uid;document.getElementById('holder-title').innerHTML=IconUI.itemLabel(q.item)+'<span> · holder</span>';const s=document.getElementById('holder-select');s.innerHTML='<option value="">Unassigned</option>'+champNames().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');s.value=Academy.equipment(state).get(uid)||'';holderPicker.refresh();holderPicker.close();assign.showModal();}
  document.getElementById('holder-save').addEventListener('click',()=>{const q=state.queue.find(q=>q.uid===assignmentUid&&q.done);const name=document.getElementById('holder-select').value;
    if(q&&!Academy.canEquip(state,name,q.item,q.uid)){toast(name+' has no room for this item.');return;}
    if(q)mutate(()=>{q.champion=name;},'Item holder updated.');assign.close();});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-assign-holder]');if(b)openHolder(b.dataset.assignHolder);});
  const champIcon=(unit)=>{const c=Academy.snapshot.champions.find(c=>c.apiName===unit.apiName),embedded=ACADEMY_BUNDLED.champions.find(c=>c.apiName===unit.apiName)?.icon;return {cost:c?.cost||1,name:c?.name||unit.apiName.replace(/^DA_/,''),src:embedded?.startsWith('data:')?embedded:c?.icon||'https://assets.tftacademy.com/champions/champion_icons/'+encodeURIComponent(unit.apiName)+'.webp'};};
  function renderBoard(){
    const guide=Academy.guide(state);overview.hidden=!guide;origin.hidden=!guide;if(!guide)return;
    const activePatch=state.activeComp?.patch;
    const current=Academy.live&&activePatch===Academy.snapshot.patch&&Academy.currentGuide(state);
    document.getElementById('board-source-status').textContent=current?'':`Saved plan${activePatch?' · Patch '+activePatch:''}`;
    document.getElementById('restore-academy').disabled=!Academy.currentGuide(state);
    document.getElementById('board-source').setAttribute('aria-label','View original '+guide.title+' guide inside the app');
    const holders=Academy.equipment(state),allocated=Tracker.allocate(state,DATA.items),rows=new Map(allocated.rows.map(q=>[q.uid,q]));
    const names=new Set(guide.finalComp.map(c=>champIcon(c).name));
    const plan=state.queue.filter(q=>names.has(q.done?holders.get(q.uid):q.champion));
    const cell=(u)=>{
      if(!u)return '<div class="board-cell empty-cell" aria-hidden="true"><span></span></div>';
      const c=champIcon(u),items=plan.filter(q=>(q.done?holders.get(q.uid):q.champion)===c.name);
      const baseline=u.items.map(id=>Academy.itemMap.get(id));const actual=items.map(q=>q.item);
      const adjusted=baseline.length!==actual.length||!MetaBuilds.fits(baseline,actual);
      const color=['','#a5a5a5','#19bc69','#158ee8','#a046d0','#eacb4e'][Math.min(5,c.cost)]||'#a5a5a5';
      return `<div class="board-cell unit-cell" style="--unit-color:${color}" aria-label="${esc(c.name)}, Academy target ${u.stars||1} star${u.stars===1?'':'s'}"><button class="board-champion" data-champion-builds="${esc(c.name)}" aria-label="Open ${esc(c.name)} S/A item builds" aria-haspopup="dialog" aria-expanded="false" title="${esc(c.name)} · S/A item builds"><span class="champion-hex"><img class="champion-portrait" src="${esc(c.src)}" alt="" width="64" height="64"></span><span class="board-stars">${u.stars>1?'★'.repeat(u.stars):''}</span><span class="board-name">${esc(c.name)}</span></button><div class="board-items">${items.map(q=>{
        const r=rows.get(q.uid),ready=!q.done&&r?.slots.length===2&&r.slots.every(s=>s.have),label=q.done?'Completed':ready?'Components ready':'Planned';
        return `<button class="board-item ${q.done?'is-done':ready?'is-ready':'is-planned'}" ${q.done?`data-assign-holder="${q.uid}"`:`data-board-target="${q.uid}"`} title="${esc(byId[q.item].name)} · ${label}${q.done?' · click to change holder':' · click to pivot'}" aria-label="${esc(c.name)}: ${esc(byId[q.item].name)}, ${label}">${icon(q.item)}<b>${q.done?'✓':ready?'◐':''}</b></button>`;
      }).join('')}</div>${adjusted?'<span class="board-adjusted" title="Your item plan differs from Academy">↔</span>':''}</div>`;
    };
    const occupied=new Map(),unplaced=[];for(const u of guide.finalComp){if(Number.isInteger(u.boardIndex)&&u.boardIndex>=0&&u.boardIndex<28&&!occupied.has(u.boardIndex))occupied.set(u.boardIndex,u);else unplaced.push(u);}
    document.getElementById('position-board').innerHTML=Array.from({length:4},(_,r)=>`<div class="hex-row">${Array.from({length:7},(_,c)=>cell(occupied.get(r*7+c))).join('')}</div>`).join('')+(unplaced.length?'<div class="unplaced-units"><small>Position not supplied by Academy</small>'+unplaced.map(cell).join('')+'</div>':'');
    const extras=state.queue.filter(q=>q.done&&!names.has(holders.get(q.uid)));
    document.getElementById('board-extras').innerHTML=extras.length?'<span>Assign completed items</span>'+extras.map(q=>`<button data-assign-holder="${q.uid}" title="Assign ${esc(byId[q.item].name)} to a champion">${icon(q.item)}<span>${q.champion?IconUI.championLabel(q.champion):'Choose holder'}</span></button>`).join(''):'';
    const tips=[{stage:'Build',tip:guide.augmentsTip||''},...[2,3,4].map(n=>({stage:'Stage '+n,tip:(guide.tips||[]).find(t=>String(t.stage).match(/\d+/)?.[0]===String(n))?.tip||''}))];
    document.getElementById('academy-tips').innerHTML=tips.map(t=>`<section class="academy-tip"><h3>${esc(t.stage)}</h3><p>${esc(t.tip||'No tip provided.')}</p></section>`).join('');
  }

  function drawConnections(){
    document.getElementById('meta-diagnostics').innerHTML=MetaBuilds.connections().map(s=>`<p><b>${IconUI.championLabel(Academy.snapshot.champions.find(c=>c.apiName===s.unit)?.name||s.unit)}</b> · ${esc(s.source||'no data')} · checked ${new Date(s.checked).toLocaleTimeString()}${s.error?`<br><span class="connection-error">${esc(s.error)} · saved stats are reference only</span>`:''}</p>`).join('')||'<p>No requests yet. Import a comp or choose a champion in S/A item builds.</p>';
  }
  overview.addEventListener('click',e=>{
    if(e.target.closest('#board-source')){const guide=Academy.guide(state);if(guide)MetaReference.openPage('https://tftacademy.com/tierlist/comps/'+encodeURIComponent(guide.compSlug),guide.title+' · TFT Academy');}
    const target=e.target.closest('[data-board-target]');if(target)PivotDialog.open(target.dataset.boardTarget);
  });
  const oldRender=render;render=function(){oldRender();renderBoard();drawConnections();
    for(const tile of document.querySelectorAll('#completed .completeitem')){const uid=tile.querySelector('[data-action="restore"]')?.dataset.id,img=tile.querySelector('img');if(!uid||!img)continue;const button=document.createElement('button');button.className='completed-holder';button.dataset.assignHolder=uid;const q=state.queue.find(q=>q.uid===uid);button.setAttribute('aria-label',`Assign ${byId[q.item].name}; holder: ${Academy.equipment(state).get(uid)||'unassigned'}`);img.before(button);button.append(img);}
  };
  document.addEventListener('carousel-meta-updated',()=>{renderBoard();drawConnections();});
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Academy is the baseline.</b> The board uses its positioning and target stars; item slots reflect your tracked plan. Dim items are planned, amber items have reserved components, and checked items are completed. Click a planned board item to choose a pivot.</li><li><b>Assign completed items</b> with the holder selector when receiving an item, or by clicking its completed icon. MetaTFT can then propose a compatible S/A combination for the remaining slots. Use the champion’s S/A builds dialog to pivot remaining targets; inventory stays intact. Undo reverses the change. Reset targets to Academy restores the baseline around existing inventory.</li>');
  render();
})();
