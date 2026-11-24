const KEY='carousel-tracker-v1';
const components=componentOrder.map(id=>byId[id]);
const shortNames={BFSword:'B.F. Sword',RecurveBow:'Bow',NeedlesslyLargeRod:'Rod',TearOfTheGoddess:'Tear',ChainVest:'Vest',NegatronCloak:'Cloak',GiantsBelt:'Belt',SparringGloves:'Gloves',Spatula:'Spatula',FryingPan:'Pan'};
let state={queue:[],owned:{},pins:[]},history=[],storageOK=true;
try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved)state=OfflineTracker.cleanState(saved);} catch(e){storageOK=false;}
LootTracker.ensure(state);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(id,cls='')=>`<img class="icon ${cls}" src="${byId[id].icon}" alt="" width="38" height="38">`;
const btn=(action,id,label,text,cls='',disabled=false)=>`<button data-action="${action}" data-id="${id}" data-focus="${action}-${id}" aria-label="${esc(label)}" title="${esc(label)}" class="${cls}" ${disabled?'disabled':''}>${text}</button>`;
const componentRail=`<aside class="component-rail panel" aria-label="Component bench">
  <div class="component-heading"><h2>Components</h2><small><kbd>1</kbd>–<kbd>8</kbd> add · <kbd>Shift</kbd> + number removes</small></div>
  <button id="component-toggle" type="button" aria-expanded="false" aria-controls="bench">
    <strong>Components</strong><span id="component-stock"></span><span class="component-chevron" aria-hidden="true">⌃</span>
  </button>
  <div id="bench" class="benchgrid"></div>
</aside>`;
document.getElementById('app').innerHTML=`<header class="topbar"><div class="brand"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2 29 9v14l-13 7L3 23V9Z" stroke="currentColor" stroke-width="1.8"/><path d="m16 8 7 4v8l-7 4-7-4v-8Z" stroke="currentColor" stroke-width="1.8"/></svg><div><h1 id="app-title">Carousel</h1><div id="comp-fit" hidden></div><small>Ctrl + V anywhere to import</small></div></div><div class="topright"><button data-action="help" class="helpbutton">How it works</button></div></header><main class="wrap"><div class="pagehead"><div class="actions"><button data-action="undo" id="undo" class="quiet" disabled>↶ Undo</button><button data-action="reset" class="quiet">New game</button></div></div><div id="storage-warning"></div><div class="climb-layout"><div class="climb-plan"><div id="next-build" hidden></div><div class="workspace"><section class="centercol" aria-labelledby="queue-title"><div class="queuehead"><div><h2 id="queue-title">Build Queue</h2></div></div><div id="queue"></div><div id="completed"></div></section><aside class="rightcol panel shopping" aria-labelledby="shopping-title"><div class="panelhead"><h2 id="shopping-title">Carousel priorities</h2></div><p class="shoppingintro">The components your builds still need.</p><div id="shopping" class="shoppinglist"></div><div class="shoppingfoot">★ Pin within planned needs or alternatives.</div></aside></div></div>${componentRail}</div><section class="bench panel" aria-labelledby="game-decisions-title"><div class="panelhead"><h2 id="game-decisions-title">Game decisions</h2></div></section><footer class="footer"><span id="saved">Saved in this browser · Export a backup before moving this file</span><span>Bundled recipes · Patch ${esc(DATA.patch)} · verified ${esc(DATA.curatedAt)} · <a href="https://tftacademy.com/api/assets/items?set=${DATA.set}" target="_blank" rel="noopener">${esc(DATA.source)}</a><span id="recipe-freshness"> · may be stale</span></span></footer></main><div class="toast" id="toast" role="status" aria-live="polite"></div><dialog id="help"><h2>A little planning. A better carousel.</h2><ol><li>Drag a card by its grip to reorder. Reset order restores the recommended sequence without changing targets. Keyboard: focus the grip, press Space, move with arrow keys, then Enter; Escape cancels. Loose components are reserved from the top down; each component counts only once.</li><li>Add components on your bench, or click <b>Got one</b> on your carousel priorities. Green ingredients are already covered. Click a missing ingredient in a build to record one.</li><li><b>Mark made</b> completes a queued item. It spends a full recipe automatically when available. Otherwise, it records the item as received and keeps your loose components.</li><li>Star a component to prioritize it within planned needs or alternatives. Stars do not change your build order.</li></ol><p>This is a manual tracker. No live-game connection or API key is used. Progress stays in this browser; other devices have their own tracker.</p><p>Comp plans can include emblems and special items; items without a recipe do not add component needs. Offline tracking uses saved recipes. Current comp recommendations require a successful live refresh.</p><p>Item assets belong to Riot Games. This companion is not endorsed by Riot Games.</p><div class="dialogactions"><button data-action="close-help" class="primary">Got it</button></div></dialog>`;
const componentToggle=document.getElementById('component-toggle');
componentToggle.addEventListener('click',()=>{
 componentToggle.setAttribute('aria-expanded',String(componentToggle.getAttribute('aria-expanded')==='false'));
});
function render(){
 const focus=document.activeElement?.dataset.focus;
 QueueOrder.ensure(state);
 const a=Tracker.allocate(state,DATA.items),done=state.queue.filter(q=>q.done);
 const next=a.rows[0],nextBuild=document.getElementById('next-build');
 nextBuild.hidden=!state.activeComp;
 if(next){
   const item=byId[next.item],covered=next.slots.filter(slot=>slot.have).length;
   const status=item.special?'Record when received':covered===next.slots.length?'Ready to make':covered+' / '+next.slots.length+' components';
   nextBuild.innerHTML=`<span class="next-build-label">Next item</span>${icon(item.id)}<div class="next-build-target"><strong>${esc(item.name)}</strong>${next.champion?`<span>For ${next.earlyChampion&&next.earlyChampion!==next.champion?esc(next.earlyChampion)+' → ':''}${esc(next.champion)}</span>`:''}</div><span class="next-build-status">${status}</span>`;
 }else{
   nextBuild.innerHTML='<span class="next-build-label">Next item</span><strong>Queue complete</strong>';
 }
 document.getElementById('queue').innerHTML=a.rows.map((q,n)=>{const i=byId[q.item],ready=i.recipe.length===2&&q.slots.every(c=>c.have);return `<article class="qcard" data-queue-uid="${q.uid}" aria-label="${esc(i.name)} · ${esc(q.champion||'Unassigned')}"><div class="qtop"><button class="queue-grip" aria-label="Reorder ${esc(i.name)}" aria-describedby="queue-drag-help" aria-pressed="false" data-focus="drag-${q.uid}">⠿</button>${icon(i.id)}<div class="itemtitle"><h3>${esc(i.name)}</h3>${q.champion?`<small class="item-owner">For ${q.earlyChampion&&q.earlyChampion!==q.champion?`${IconUI.championLabel(q.earlyChampion)} → `:''}${IconUI.championLabel(q.champion)}</small>`:'<small class="item-owner">Unassigned</small>'}</div><div class="recipe">${q.slots.map((c,idx)=>`${idx?'<span class="plus">+</span>':''}${c.have?`<span class="componentpill have" title="${esc(byId[c.id].name)} reserved for this item">${icon(c.id)}<span aria-hidden="true">✓</span></span>`:`<button class="componentpill" data-action="gain" data-id="${c.id}" data-focus="slot-${q.uid}-${idx}" aria-label="Record one ${esc(byId[c.id].name)} received">${icon(c.id)}<span aria-hidden="true">+</span></button>`}`).join('')}</div>${btn('remove',q.uid,`Remove ${i.name}`,'×','remove')}</div><div class="qbottom">${btn('make',q.uid,i.special?`Record ${i.name} received; no components used`:`Mark ${i.name} made`,i.special?'✓ Received':ready?'✓ Ready · Mark made':'✓ Mark made',`make ${ready?'ready':''}`)}</div></article>`;}).join('')||`<div class="empty"><div class="emptyicon" aria-hidden="true">${done.length?'✓':'+'}</div><h3>${done.length?'Every build, checked off.':'No items queued yet'}</h3><p>${done.length?'Your completed items are tracked above.':'Choose a comp in Explore builds or paste an Academy team code.'}</p></div>`;
 document.getElementById('completed').innerHTML=done.map(q=>`<div class="completeitem" role="listitem" title="${esc(byId[q.item].name)}${q.champion?' · '+esc(q.champion):''}" aria-label="${esc(byId[q.item].name)}${q.champion?' for '+esc(q.champion):''}">${icon(q.item)}${btn('restore',q.uid,`Restore ${byId[q.item].name}${q.champion?' for '+q.champion:''} to queue and return its tracked ingredients`,'Restore','quiet')}</div>`).join('');
 const needs=Object.entries(a.needs).sort(([x,v],[y,w])=>(Number(state.pins.includes(y))-Number(state.pins.includes(x)))||v.rank-w.rank||Academy.componentPreference(state,x)-Academy.componentPreference(state,y)||w.count-v.count||LootTracker.compare(state,x,y)||componentOrder.indexOf(x)-componentOrder.indexOf(y));
 document.getElementById('shopping').innerHTML=needs.map(([id,n])=>`<div class="need ${state.pins.includes(id)?'pinned':''}"><div class="needtop">${icon(id)}<div class="needname">${esc(byId[id].name)}<small title="${esc(n.items.join(', '))}">For ${esc(n.items[0])}${n.items.length>1?` +${n.items.length-1}`:''}</small></div><span class="needed" aria-label="${n.count} needed">×${n.count}</span></div><div class="needactions"><button class="pin ${state.pins.includes(id)?'active':''}" data-action="pin" data-id="${id}" data-focus="pin-${id}" aria-label="Prioritize ${esc(byId[id].name)}" aria-pressed="${state.pins.includes(id)}">${state.pins.includes(id)?'★':'☆'}</button>${btn('gain',id,`Record one ${byId[id].name} received`,'+ Got one','got')}</div></div>`).join('')||`<div class="shopempty" style="grid-column:1/-1"><b>${a.rows.some(q=>byId[q.item].special)?'No components left to chase.':a.rows.length?'You have the ingredients.':done.length?'All planned items made.':'Your shopping list starts here.'}</b>${a.rows.length?'Check off your items as you make them.':'Add a build to see which components to collect.'}</div>`;
 document.getElementById('bench').innerHTML=components.map(c=>`<div class="benchitem ${(state.owned[c.id]||0)?'has':''}">${icon(c.id)}<strong>${esc(c.name)}</strong><div class="counter">${btn('lose',c.id,`Remove one ${c.name}`,'−','',!(state.owned[c.id]>0))}<output aria-label="${esc(c.name)} owned">${state.owned[c.id]||0}</output>${btn('gain',c.id,`Add one ${c.name}`,'+','',(state.owned[c.id]||0)>=99)}</div></div>`).join('');
 document.getElementById('undo').disabled=!history.length;
 const stock=components.filter(c=>state.owned[c.id]>0);
 document.getElementById('component-stock').innerHTML=stock.map(c=>{
   const count=state.owned[c.id],label=esc(`${c.name}: ${count} in hand`);
   return `<span class="component-stock-item" role="img" aria-label="${label}" title="${label}">${icon(c.id)}<b aria-hidden="true">${count}</b></span>`;
 }).join('')||'<span class="component-stock-empty">None in hand</span>';
 document.getElementById('storage-warning').innerHTML=storageOK?'':'<p class="storagewarn">Browser storage is unavailable or could not be read. Keep this tab open and use Export backup to preserve your tracker.</p>';
 document.getElementById('saved').textContent=storageOK?'Saved in this browser · Export a backup before moving this file':'Session only · Changes may not survive closing this tab';
 if(focus) document.querySelector(`[data-focus="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});
}
function save(){QueueOrder.ensure(state);try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;}}
let toastTimer;function toast(s){document.getElementById('toast').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>document.getElementById('toast').textContent='',2400);}
function mutate(fn,message){history.push(JSON.stringify(state));if(history.length>40)history.shift();fn();save();render();if(message)toast(message);}
const itemPivotConfirm=document.createElement('dialog');
itemPivotConfirm.setAttribute('aria-labelledby','item-pivot-confirm-title');
itemPivotConfirm.setAttribute('aria-describedby','item-pivot-confirm-message');
itemPivotConfirm.innerHTML=`<h2 id="item-pivot-confirm-title">Confirm item pivot</h2>
 <p id="item-pivot-confirm-message"></p><form method="dialog" class="dialogactions">
 <button value="cancel" autofocus>Cancel</button><button value="confirm" class="primary">Confirm</button></form>`;
document.body.append(itemPivotConfirm);
let pendingItemPivot;
itemPivotConfirm.querySelector('form').addEventListener('submit',event=>{
 event.preventDefault();
 const commit=pendingItemPivot;
 pendingItemPivot=null;
 itemPivotConfirm.close();
 if(event.submitter?.value==='confirm')commit?.();
});
itemPivotConfirm.addEventListener('close',()=>{if(!itemPivotConfirm.open)pendingItemPivot=null;});
function applyItemPivot(apply,message,onApplied){
 if(itemPivotConfirm.open)return;
 const next=structuredClone(state);
 if(!apply(next))return;
 const holders=rows=>rows.map(q=>q.champion||'an unassigned holder').join(', ');
 const warnings=PivotPlanner.addedQueueCopies(state,next).map(({item,added,existing})=>{
   const name=byId[item].name;
   return existing.length?`${name} is already queued for ${holders(existing)}. Also queue it for ${holders(added)}?`
     :`Queue ${name} for ${holders(added)}? Each assignment needs its own copy.`;
 });
 if(!warnings.length){
   mutate(()=>{state=next;},message);
   onApplied?.();
   return;
 }
 const before=JSON.stringify(state),revision=Academy.revision;
 pendingItemPivot=()=>{
   if(Academy.revision!==revision||JSON.stringify(state)!==before){
     toast('The plan changed. Review the pivot again.');
     return;
   }
   mutate(()=>{state=next;},message);
   onApplied?.();
 };
 itemPivotConfirm.querySelector('p').textContent=warnings.join('\n\n');
 itemPivotConfirm.showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const {action,id}=b.dataset,q=state.queue.find(q=>q.uid===id);
 if(action==='help'){document.getElementById('help').showModal();return;}
 if(action==='close-help'){document.getElementById('help').close();return;}
 if(action==='reset'){componentToggle.setAttribute('aria-expanded','false');mutate(()=>state={queue:[],owned:{},pins:[]},'New game. Queue and bench cleared.');document.dispatchEvent(new Event('carousel-new-game'));return;}
 if(action==='undo'){if(history.length){state=JSON.parse(history.pop());save();render();toast('Last change undone.');}return;}
 if(action==='gain'&&(state.owned[id]||0)<99)mutate(()=>LootTracker.gain(state,id,b.closest('#shopping')?'carousel':b.closest('#bench')?'loot':'other'),`${byId[id].name} collected.`);
 if(action==='lose'&&state.owned[id]>0)mutate(()=>LootTracker.remove(state,id),`${byId[id].name} removed from bench.`);
 if(action==='pin')mutate(()=>state.pins=state.pins.includes(id)?state.pins.filter(x=>x!==id):[...state.pins,id],`${byId[id].name} priority changed.`);
 if(action==='remove'&&q)mutate(()=>state.queue=state.queue.filter(x=>x.uid!==id),`${byId[q.item].name} removed. Undo to bring it back.`);
 if(action==='make'&&q&&!q.done){
   const item=byId[q.item];
   if(!Academy.canEquip(state,q.champion,q.item)){toast(q.champion+' has no room for this item.');return;}
   const message=Tracker.canCraft(state.owned,item)
     ? `${item.name} marked made.`
     : `Received ${item.name}; loose components kept.`;
   mutate(()=>OfflineTracker.markMade(state,q),message);
 }
 if(action==='restore'&&q&&q.done)mutate(()=>Tracker.restore(state,q),`${byId[q.item].name} returned to queue${Object.values(q.used||{}).some(Boolean)?'; recorded ingredients returned to bench':''}.`);
});
render();
