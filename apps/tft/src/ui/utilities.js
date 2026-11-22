/* One header, compact controls, and pointer/keyboard sorting without inventory edits. */
(()=>{
  const top=document.querySelector('.topright'),actions=document.querySelector('.actions');
  const help=top.querySelector('[data-action="help"]'),settings=document.getElementById('settings-open');
  const menu=document.createElement('details');menu.id='utility-menu';menu.className='utility-menu';
  menu.innerHTML='<summary aria-label="More options" title="More options">⋯</summary><div class="utility-options"></div>';
  menu.querySelector('.utility-options').append(help,settings);actions.append(menu);top.append(actions);document.querySelector('.pagehead').remove();
  menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.removeAttribute('open');});
  document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.removeAttribute('open');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.removeAttribute('open');menu.querySelector('summary').focus();}});
  document.getElementById('academy-tierlist').addEventListener('click',e=>{e.preventDefault();MetaReference.openPage('https://tftacademy.com/tierlist/comps','TFT Academy tierlist');});
  const reset=document.createElement('button');reset.id='reset-queue-order';reset.className='quiet';reset.textContent='Reset order';reset.title='Restore recommended order; keep current targets and inventory';
  document.querySelector('.queuehead').insertBefore(reset,document.getElementById('receive-open'));
  const queue=document.getElementById('queue');
  queue.insertAdjacentHTML('beforebegin','<span id="queue-drag-help" class="visuallyhidden">Drag to reorder. Keyboard: Space to pick up, arrows to move, Enter to drop, Escape to cancel.</span><span id="queue-sort-status" class="visuallyhidden" role="status" aria-live="polite"></span>');
  const announce=text=>document.getElementById('queue-sort-status').textContent=text;
  let drag=null,frame=0;
  const cards=()=>[...queue.querySelectorAll('.qcard')];
  const cardFor=uid=>cards().find(c=>c.dataset.queueUid===uid);
  function stop(){
    if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);frame=0;
    if(drag){drag.card.classList.remove('queue-dragging');drag.card.querySelector('.queue-grip')?.setAttribute('aria-pressed','false');try{drag.handle?.releasePointerCapture(drag.pointer);}catch(e){}}
    drag=null;queue.classList.remove('is-sorting');
  }
  function begin(card,fields={}){
    if(drag||document.querySelector('dialog[open]'))return;
    drag={card,uid:card.dataset.queueUid,active:false,...fields};
  }
  function activate(){if(!drag||drag.active)return;drag.active=true;queue.classList.add('is-sorting');drag.card.classList.add('queue-dragging');drag.card.querySelector('.queue-grip').setAttribute('aria-pressed','true');announce('Moving '+byId[state.queue.find(q=>q.uid===drag.uid).item].name);}
  function preview(y){
    if(!drag?.active)return;
    const other=cards().filter(c=>c!==drag.card),before=other.find(c=>{const r=c.getBoundingClientRect();return y<r.top+r.height/2;});
    if(drag.card.nextElementSibling!==before&&(before||queue.lastElementChild!==drag.card))queue.insertBefore(drag.card,before||null);
  }
  function scrollTick(){
    if(!drag?.active||drag.keyboard){frame=0;return;}
    const height=window.innerHeight||document.documentElement.clientHeight,edge=65,y=drag.y;
    const amount=y<edge?-Math.ceil((edge-y)/5):y>height-edge?Math.ceil((y-height+edge)/5):0;
    if(amount&&typeof window.scrollBy==='function'){window.scrollBy(0,Math.max(-20,Math.min(20,amount)));preview(y);}
    if(typeof requestAnimationFrame==='function')frame=requestAnimationFrame(scrollTick);
  }
  function finish(commit){
    if(!drag)return;const {uid,active}=drag,ids=cards().map(c=>c.dataset.queueUid);stop();
    const current=QueueOrder.pending(state).map(q=>q.uid);
    if(commit&&active&&ids.length===current.length&&ids.some((id,n)=>id!==current[n]))mutate(()=>QueueOrder.apply(state,ids),'Queue reordered.');else render();
    cardFor(uid)?.querySelector('.queue-grip')?.focus({preventScroll:true});announce(commit&&active?'Queue order saved.':'Reorder cancelled.');
  }
  reset.addEventListener('click',()=>mutate(()=>QueueOrder.reset(state),'Recommended order restored.'));
  queue.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.isPrimary===false)return;
    const card=e.target.closest('.qcard'),handle=e.target.closest('.queue-grip');
    if(!card||(!handle&&(e.pointerType!=='mouse'||!e.target.closest('.qtop')||e.target.closest('button,a,input'))))return;
    begin(card,{pointer:e.pointerId,handle:handle||card,startX:e.clientX,startY:e.clientY,y:e.clientY});
    if(!drag)return;e.preventDefault();(handle||card).focus?.({preventScroll:true});try{(handle||card).setPointerCapture(e.pointerId);}catch(error){}
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||drag.keyboard||drag.pointer!==e.pointerId)return;
    if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;
    e.preventDefault();activate();drag.y=e.clientY;preview(e.clientY);if(!frame&&typeof requestAnimationFrame==='function')frame=requestAnimationFrame(scrollTick);
  },{passive:false});
  document.addEventListener('pointerup',e=>{if(drag&&!drag.keyboard&&drag.pointer===e.pointerId){e.preventDefault();finish(true);}});
  document.addEventListener('pointercancel',e=>{if(drag&&drag.pointer===e.pointerId)finish(false);});
  queue.addEventListener('dragstart',e=>e.preventDefault());
  queue.addEventListener('keydown',e=>{
    const handle=e.target.closest('.queue-grip');if(!handle)return;
    if(!drag&&(e.key===' '||e.key==='Enter')){e.preventDefault();begin(handle.closest('.qcard'),{keyboard:true});activate();return;}
    if(!drag?.keyboard)return;
    if(e.key==='Escape'){e.preventDefault();finish(false);return;}
    if(e.key===' '||e.key==='Enter'){e.preventDefault();finish(true);return;}
    if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){
      e.preventDefault();const list=cards(),at=list.indexOf(drag.card),to=e.key==='Home'?0:e.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,at+(e.key==='ArrowUp'?-1:1)));
      if(to!==at){const other=list.filter(c=>c!==drag.card);queue.insertBefore(drag.card,other[to]||null);drag.card.querySelector('.queue-grip').focus({preventScroll:true});drag.card.scrollIntoView?.({block:'nearest'});announce('Position '+(to+1)+' of '+list.length);}
    }
  });
  document.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();finish(false);}});
  const previous=render;render=function(){if(drag)stop();previous();const pending=QueueOrder.pending(state),recommended=QueueOrder.recommended(state);reset.disabled=pending.every((q,n)=>q.uid===recommended[n]?.uid);};
  render();
})();
