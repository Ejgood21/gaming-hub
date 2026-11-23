(() => {
  const bench=document.querySelector('.bench');
  document.getElementById('bench-title').textContent='Component bench';
  document.querySelector('.benchnote').innerHTML='<kbd>1</kbd>–<kbd>8</kbd> add · <kbd>Shift</kbd> + number removes';
  bench.querySelector('.panelhead').append(bench.querySelector('.benchnote'));
  const owned=document.createElement('div');owned.id='owned-bench';owned.className='owned-bench';
  owned.setAttribute('aria-label','Loose components in hand');bench.append(owned);
  function drawOwned(){
    const held=components.filter(c=>(state.owned[c.id]||0)>0);
    owned.innerHTML='<span class="owned-bench-label">In hand</span><div class="owned-bench-items" role="list">'+(held.length?held.map(c=>`<span class="owned-component" role="listitem" data-owned-component="${c.id}" aria-label="${esc(c.name)}: ${state.owned[c.id]}" title="${esc(c.name)}">${icon(c.id)}<b>×${state.owned[c.id]}</b></span>`).join(''):'<span class="owned-bench-empty">No loose components</span>')+'</div>';
  }
  const completed=document.createElement('section');completed.id='completed-strip';completed.className='completed-strip';completed.setAttribute('aria-labelledby','completed-heading');
  completed.innerHTML='<h2 id="completed-heading">Completed <span id="completed-total"></span></h2>';
  const list=document.getElementById('completed');document.querySelector('.queuehead').before(completed);completed.append(list);list.setAttribute('role','list');
  const oldRender=render;
  render=function(){oldRender();drawOwned();const count=state.queue.filter(q=>q.done).length;completed.hidden=!count;document.getElementById('completed-total').textContent=count;};
  render();
})();
