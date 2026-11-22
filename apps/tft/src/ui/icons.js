/* Shared portraits and searchable icon selectors. Native selects remain the
   state/event source; visible controls support mouse and keyboard navigation. */
const IconUI = {
  champion(name,cls=''){
    const c=Academy.snapshot.champions.find(c=>c.apiName===name||Academy.normalizeName(c.name)===Academy.normalizeName(name));
    if(!c)return `<span class="champ-fallback ${cls}" aria-hidden="true">?</span>`;
    const embedded=ACADEMY_BUNDLED.champions.find(u=>u.apiName===c.apiName)?.icon;
    const src=embedded?.startsWith('data:')?embedded:c.icon||'https://assets.tftacademy.com/champions/champion_icons/'+encodeURIComponent(c.apiName)+'.webp';
    return `<img class="champ-icon ${cls}" src="${esc(src)}" alt="" width="28" height="28">`;
  },
  itemLabel(id){return `<span class="inline-entity">${icon(id)}<span>${esc(byId[id].name)}</span></span>`;},
  championLabel(name){return `<span class="inline-entity">${this.champion(name)}<span>${esc(name)}</span></span>`;},
  picker(select,kind,label){
    select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    const wrap=document.createElement('div');wrap.className='icon-select';
    const trigger=document.createElement('button');trigger.type='button';trigger.id=select.id+'-trigger';trigger.className='icon-select-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-expanded','false');
    const pop=document.createElement('div');pop.className='icon-select-popup';pop.hidden=true;pop.id=select.id+'-choices';trigger.setAttribute('aria-controls',pop.id);
    pop.innerHTML=`<input type="search" class="icon-select-search" placeholder="Search ${kind==='champion'?'champions':kind==='augment'?'augments':'items'}…" aria-label="Search ${label.toLowerCase()}" autocomplete="off"><div class="icon-select-options" role="group" aria-label="${esc(label)} options"></div>`;
    wrap.append(trigger,pop);select.after(wrap);
    const search=pop.querySelector('input'),list=pop.querySelector('.icon-select-options');
    const picture=value=>!value?'<span class="any-icon" aria-hidden="true">✦</span>':kind==='champion'?IconUI.champion(value):kind==='augment'?augmentIcon(value):byId[value]?icon(value):'';
    const close=()=>{pop.hidden=true;trigger.setAttribute('aria-expanded','false');};
    const draw=()=>{const q=search.value.toLowerCase();list.innerHTML=[...select.querySelectorAll('option')].filter(o=>o.textContent.toLowerCase().includes(q)).map(o=>`<button type="button" data-option-value="${esc(o.value)}" class="icon-select-option" aria-pressed="${o.value===select.value}">${picture(o.value)}<span>${esc(o.textContent)}</span>${o.value===select.value?'<b>✓</b>':''}</button>`).join('')||'<span class="picker-no-match">No matches</span>';};
    const open=()=>{search.value='';draw();pop.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus();};
    const refresh=()=>{const o=[...select.querySelectorAll('option')].find(o=>o.value===select.value)||select.querySelector('option');trigger.innerHTML=picture(o?.value||'')+'<span>'+esc(o?.textContent||'Choose')+'</span><span class="picker-chevron">⌄</span>';if(!pop.hidden)draw();};
    trigger.addEventListener('click',()=>pop.hidden?open():close());
    trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();}});
    search.addEventListener('input',draw);
    pop.addEventListener('keydown',e=>{const options=[...list.querySelectorAll('button')],at=options.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();options[e.key==='Home'?0:e.key==='End'?options.length-1:e.key==='ArrowDown'?Math.min(options.length-1,at+1):Math.max(0,at-1)]?.focus();}else if(e.key==='Enter'&&document.activeElement===search){e.preventDefault();options[0]?.click();}});
    list.addEventListener('click',e=>{const b=e.target.closest('[data-option-value]');if(!b)return;select.value=b.dataset.optionValue;close();select.dispatchEvent(new Event('change',{bubbles:true}));refresh();trigger.focus();});
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
    select.addEventListener('change',refresh);refresh();
    return {refresh,close};
  }
};
