(() => {
  const completed=document.createElement('section');completed.id='completed-strip';completed.className='completed-strip';completed.setAttribute('aria-labelledby','completed-heading');
  completed.innerHTML='<h2 id="completed-heading">Completed <span id="completed-total"></span></h2>';
  const list=document.getElementById('completed');document.querySelector('.queuehead').before(completed);completed.append(list);list.setAttribute('role','list');
  const oldRender=render;
  render=function(){oldRender();const count=state.queue.filter(q=>q.done).length;completed.hidden=!count;document.getElementById('completed-total').textContent=count;};
  render();
})();
