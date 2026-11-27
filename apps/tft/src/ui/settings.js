/* Compact manual controls. Keyboard shortcuts and whole-item receipts. */
(() => {
  const PREF_KEY='carousel-offline-preferences-v1';let shortcuts=true,receiveQuery='',pendingImport=null;
  try{shortcuts=JSON.parse(localStorage.getItem(PREF_KEY)||'{}').shortcuts!==false;}catch(e){}
  const preferences=()=>{try{localStorage.setItem(PREF_KEY,JSON.stringify({shortcuts}));}catch(e){toast('Settings could not be saved in this browser.');}};
  mutate=function(fn,message='Tracker updated.') {history.push(JSON.stringify(state));if(history.length>40)history.shift();fn();save();render();toast(message);};
  document.querySelector('.topright').insertAdjacentHTML('beforeend','<button id="settings-open" class="quiet">Settings</button>');
  const craft=document.createElement('div');craft.id='craft-strip';craft.className='craft-strip';craft.hidden=true;
  craft.innerHTML='<span class="craft-label">Craft now</span><div id="craft-options"></div>';
  document.querySelector('.queuehead').after(craft);
  document.querySelector('.queuehead').insertAdjacentHTML('beforeend','<button id="receive-open" class="receive-open" title="Record a completed item without using loose components">+ Received item</button>');
  const dialog=(id,html)=>{const d=document.createElement('dialog');d.id=id;d.innerHTML=html;document.body.append(d);return d;};
  const receive=dialog('receive-dialog','<div class="modal-heading"><h2 id="receive-title">Received a completed item</h2><button data-close="receive-dialog" aria-label="Close item chooser">×</button></div><p>Completes the next matching target without spending loose components.</p><label class="receive-holder">For <select id="receive-champion"><option value="">Auto · next matching target</option></select></label><label for="receive-search" class="visuallyhidden">Find an item</label><input id="receive-search" class="search" type="search" placeholder="Find an item…"><div id="receive-items" class="receive-items"></div>');receive.setAttribute('aria-labelledby','receive-title');const receiveHolderPicker=IconUI.picker(document.getElementById('receive-champion'),'champion','Received item holder');
  const settings=dialog('settings-dialog','<div class="modal-heading"><h2 id="settings-title">Settings</h2><button data-close="settings-dialog" aria-label="Close settings">×</button></div><label class="shortcut-toggle"><input type="checkbox" id="shortcuts-enabled"> Enable component keyboard shortcuts</label><p><kbd>1</kbd>–<kbd>8</kbd> add · <kbd>Shift</kbd> + number removes.<br><kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd> undo.<br>Shortcuts pause while typing or using a dialog.</p><hr><p>Progress saves in this browser. Export a backup before moving this HTML file or switching browsers.</p><div class="backup-buttons"><button id="export-backup">Export backup</button><button id="import-open">Import backup</button></div>');settings.setAttribute('aria-labelledby','settings-title');
  const imp=dialog('import-dialog','<div class="modal-heading"><h2 id="import-title">Import tracker backup</h2><button data-close="import-dialog" aria-label="Close backup import">×</button></div><p>Import saved inventory and targets. Paste TFT Academy codes anywhere on the page.</p><label for="backup-file">Backup file</label><input id="backup-file" type="file" accept=".json,application/json"><label for="backup-text">Or paste backup JSON</label><textarea id="backup-text" rows="4" spellcheck="false"></textarea><button id="review-import">Review backup</button><p id="import-feedback" role="status"></p><div id="import-confirm" hidden><p id="import-summary"></p><button id="apply-import" class="primary">Replace tracker</button></div>');imp.setAttribute('aria-labelledby','import-title');
  function drawCraft(){
    const options=OfflineTracker.craftOptions(state);craft.hidden=!options.length;
    document.getElementById('craft-options').innerHTML=options.map(q=>`<button class="craft-chip" data-craft="${q.uid}" data-focus="craft-${q.uid}" aria-label="Craft ${esc(byId[q.item].name)}${q.champion?' for '+esc(q.champion):''}">${icon(q.item)}<span class="craft-champion">${q.champion?IconUI.championLabel(q.champion):esc(byId[q.item].name)}</span></button>`).join('');
  }
  function drawReceive(){
    const select=document.getElementById('receive-champion'),chosen=select.value;
    const names=[...new Set([...state.queue.map(q=>q.champion),...(Academy.guide(state)?.finalComp||[]).map(u=>Academy.snapshot.champions.find(c=>c.apiName===u.apiName)?.name)].filter(Boolean))];
    select.innerHTML='<option value="">Auto · next matching target</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');select.value=chosen;receiveHolderPicker.refresh();
    const items=DATA.items.filter(i=>(!i.academyOnly||receiveQuery.trim()||state.queue.some(q=>q.item===i.id))&&i.name.toLowerCase().includes(receiveQuery.trim().toLowerCase()));
    document.getElementById('receive-items').innerHTML=items.map(i=>`<button data-receive-item="${i.id}">${icon(i.id)}<span>${esc(i.name)}<small>${state.queue.some(q=>q.item===i.id&&!q.done)?'Completes next target':'Add as completed'}</small></span></button>`).join('')||'<p>No matching items.</p>';
  }
  const oldRender=render;render=function(){oldRender();drawCraft();document.querySelectorAll('.benchitem').forEach((el,n)=>{if(n<8)el.insertAdjacentHTML('afterbegin',`<kbd class="bench-key" title="${n+1}: add · Shift + ${n+1}: remove">${n+1}</kbd>`);});if(receive.open)drawReceive();};
  document.getElementById('receive-open').addEventListener('click',()=>{receiveQuery='';document.getElementById('receive-search').value='';drawReceive();receive.showModal();document.getElementById('receive-search').focus();});
  document.getElementById('receive-search').addEventListener('input',e=>{receiveQuery=e.target.value;drawReceive();});
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(close)document.getElementById(close.dataset.close).close();
    const rec=e.target.closest('[data-receive-item]');if(rec){const id=rec.dataset.receiveItem,holder=document.getElementById('receive-champion').value;
      if(!Academy.canEquip(state,holder,id)){toast(holder+' has no room for this item.');return;}
      mutate(()=>{let q=state.queue.find(q=>q.item===id&&!q.done&&(!holder||q.champion===holder)&&Academy.canEquip(state,q.champion,id));if(!q){q={uid:crypto.randomUUID(),item:id,champion:holder};state.queue.push(q);}OfflineTracker.receive(state,q);},`Received ${byId[id].name}; loose components kept.`);receive.close();}
    const c=e.target.closest('[data-craft]');if(c){const q=state.queue.find(q=>q.uid===c.dataset.craft&&!q.done);if(q&&Academy.canEquip(state,q.champion,q.item)&&OfflineTracker.canCraft(state.owned,byId[q.item]))mutate(()=>Tracker.complete(state,q,byId[q.item]),`${byId[q.item].name} crafted.`);}
  });
  document.getElementById('settings-open').addEventListener('click',()=>{document.getElementById('shortcuts-enabled').checked=shortcuts;settings.showModal();});
  document.getElementById('shortcuts-enabled').addEventListener('change',e=>{shortcuts=e.target.checked;preferences();});
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.repeat||e.isComposing||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();document.getElementById('undo').click();return;}
    if(e.ctrlKey||e.metaKey||e.altKey||!shortcuts)return;
    const m=/^(?:Digit|Numpad)([1-8])$/.exec(e.code||'');if(!m)return;
    e.preventDefault();const id=componentOrder[Number(m[1])-1];
    if(e.shiftKey){if(state.owned[id]>0)mutate(()=>LootTracker.remove(state,id),`${byId[id].name} removed.`);}
    else if((state.owned[id]||0)<99)mutate(()=>LootTracker.gain(state,id,'loot'),`${byId[id].name} collected.`);
  });
  document.getElementById('export-backup').addEventListener('click',()=>{
    const backup=Backup.exportBackup(model,state,shortcuts);
    const url=URL.createObjectURL(new Blob([backup],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Carousel-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Backup download started.');
  });
  function resetImport(){pendingImport=null;document.getElementById('import-confirm').hidden=true;document.getElementById('import-feedback').textContent='';}
  function review(text){resetImport();try{
    pendingImport=Backup.reviewBackup(model,text);
    const s=pendingImport.state;document.getElementById('import-summary').textContent=`Replace your tracker with ${s.queue.length} items and ${Object.values(s.owned).reduce((a,b)=>a+b,0)} loose components? Undo can restore your previous tracker.`;document.getElementById('import-confirm').hidden=false;
  }catch(e){document.getElementById('import-feedback').textContent=e instanceof SyntaxError?'That is not valid backup JSON.':e.message;}}
  document.getElementById('import-open').addEventListener('click',()=>{settings.close();resetImport();document.getElementById('backup-text').value='';document.getElementById('backup-file').value='';imp.showModal();});
  document.getElementById('backup-text').addEventListener('input',resetImport);
  document.getElementById('backup-file').addEventListener('change',async e=>{resetImport();const f=e.target.files?.[0];if(!f)return;try{if(f.size>Backup.maxBackupBytes)throw new Error('Choose a backup smaller than 5 MB.');const text=await f.text();document.getElementById('backup-text').value=text;review(text);}catch(err){document.getElementById('import-feedback').textContent=err.message;}});
  document.getElementById('review-import').addEventListener('click',()=>review(document.getElementById('backup-text').value));
  document.getElementById('apply-import').addEventListener('click',()=>{
    if(!pendingImport)return;
    const reviewed=pendingImport;
    if(reviewed.academy){
      Academy.live=false;
      Academy.useSnapshot(reviewed.academy);
      try{localStorage.setItem(Academy.cacheKey,JSON.stringify(reviewed.academy));}catch{}
    }
    if(typeof reviewed.shortcuts==='boolean')shortcuts=reviewed.shortcuts;
    mutate(()=>state=reviewed.state,'Tracker backup imported.');
    document.dispatchEvent(new Event('carousel-backup-imported'));
    preferences();imp.close();pendingImport=null;
  });
  document.querySelector('#help ol').insertAdjacentHTML('beforeend','<li><b>Craft now</b> is a compact row of ready-item shortcuts. Click an icon to craft it immediately; the name underneath is its target champion.</li><li><b>Received item</b> records completed carousel/anvil items without spending loose components.</li><li>Use <b>1–8</b> to add components, <b>Shift + number</b> to remove, and <b>Ctrl/Cmd + Z</b> to undo. Keys are shown on the bench. Manage backups in <b>Settings</b>.</li>');
  render();
})();
