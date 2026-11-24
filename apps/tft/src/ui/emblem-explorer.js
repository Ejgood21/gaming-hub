(() => {
  const openButton = document.createElement('button');
  openButton.id = 'emblem-explore';
  openButton.className = 'quiet';
  openButton.textContent = 'Explore emblems';
  openButton.setAttribute('aria-haspopup', 'dialog');
  document.getElementById('explore-mode').after(openButton);

  const dialog = document.createElement('dialog');
  dialog.id = 'emblem-explorer';
  dialog.setAttribute('aria-labelledby', 'emblem-explorer-title');
  dialog.innerHTML = `<div class="modal-heading">
    <h2 id="emblem-explorer-title">Explore emblems</h2>
    <button data-close="emblem-explorer" aria-label="Close emblem explorer">×</button>
  </div><button id="emblem-back" class="quiet" hidden>All emblems</button>
  <div id="emblem-catalog"></div><div id="emblem-results" hidden></div>`;
  document.body.append(dialog);
  const title = dialog.querySelector('h2'), back = dialog.querySelector('#emblem-back');
  const catalog = dialog.querySelector('#emblem-catalog'), results = dialog.querySelector('#emblem-results');
  const cache = new Map();
  let selection, request, revision = Academy.revision;

  function drawCatalog() {
    const owned = new Set(state.queue.filter(item=>item.done).map(item=>item.item));
    const items = EmblemExplorer.catalog().map(item=>({...item, id:Academy.itemMap.get(item.apiName)}));
    items.sort((a,b)=>Number(owned.has(b.id))-Number(owned.has(a.id)));
    catalog.innerHTML = items.map(item=>`<button class="emblem-pick" data-explore-emblem="${esc(item.apiName)}">
      ${icon(item.id)}<span>${esc(item.name)}</span>${owned.has(item.id)?'<small>Owned</small>':''}
    </button>`).join('');
  }

  function browse(focus) {
    request?.abort();
    selection = null;
    title.textContent = 'Explore emblems';
    back.hidden = results.hidden = true;
    catalog.hidden = false;
    drawCatalog();
    catalog.querySelector(`[data-explore-emblem="${CSS.escape(focus || '')}"]`)?.focus();
    dialog.scrollTop = 0;
  }

  async function showMeta(emblem, target) {
    if (!Academy.live) return;
    const {patch} = Academy.snapshot;
    const current = new AbortController();
    request = current;
    target.textContent = 'Checking MetaTFT holder stats…';
    try {
      let data = cache.get(emblem);
      if (!data || Date.now()-data.fetchedAt>=MetaBuilds.freshness) {
        const signal = AbortSignal.any([current.signal, AbortSignal.timeout(15000)]);
        data = await fetchMetaEmblem(emblem, patch, {fetchJSON:fetch, signal});
        if (current.signal.aborted) return;
        cache.set(emblem, data);
      }
      const holders = EmblemExplorer.metaHolders(emblem, data);
      const checked = new Date(data.fetchedAt).toLocaleString();
      target.innerHTML = `<p class="emblem-source">Patch ${esc(data.patch)} · ranked, last 3 days · checked ${esc(checked)}</p>` + (holders.length
        ? `<p class="emblem-source">Available holders with ${EmblemExplorer.minimumSamples}+ samples, ranked by average place.</p>
        <ol class="emblem-list">${holders.map(holder=>`<li class="emblem-holder">
          <div><strong>${esc(holder.name)}</strong><span>${holder.avg.toFixed(2)} avg · ${holder.samples.toLocaleString()} samples</span></div>
          ${holder.comps.length?`<details><summary>Academy comps featuring ${esc(holder.name)} (${holder.comps.length})</summary>
          <ul>${holder.comps.map(guide=>`<li>${esc(guide.title)} ${academyTierBadges(guide)}</li>`).join('')}</ul></details>`:'<p class="emblem-source">No current Academy comp features this holder.</p>'}
        </li>`).join('')}</ol>`
        : '<p class="emblem-source">Too few MetaTFT samples to rank holders for this emblem.</p>');
    } catch {
      if (!current.signal.aborted) target.textContent = 'MetaTFT holder stats are unavailable for this patch.';
    }
  }

  function explore(emblem, moveFocus = true) {
    request?.abort();
    const id = Academy.itemMap.get(emblem), item = Academy.itemInfo(id);
    if (item?.type!=='emblems') {
      browse();
      return;
    }
    selection = emblem;
    catalog.hidden = true;
    back.hidden = results.hidden = false;
    title.innerHTML = `${icon(id)} ${esc(item.name)}`;
    const routes = EmblemExplorer.academyRoutes(emblem);
    const labels = {final:'Final board', alternate:'Alternate build', flex:'Flex option'};
    results.innerHTML = `<section aria-labelledby="emblem-academy-title">
      <h3 id="emblem-academy-title">TFT Academy comps</h3>
      ${!Academy.isCurrent() ? '<p class="emblem-source">Current Academy routes need a successful live refresh.</p>' :
        `<p class="emblem-source">Live · Patch ${esc(Academy.snapshot.patch)} · ranked by tier</p>
        ${routes.length?`<ol class="emblem-list">${routes.map(({guide,holders})=>`<li class="emblem-route">
          <div><strong>${esc(guide.title)}</strong>${academyTierBadges(guide)}</div>
          <p>${holders.map(holder=>`${esc(holder.name)} · ${labels[holder.use]}`).join(' / ')}</p>
        </li>`).join('')}</ol>`:'<p class="emblem-source">No current Academy guide lists a holder for this emblem.</p>'}`}
    </section>${Academy.live?'<section aria-labelledby="emblem-meta-title"><h3 id="emblem-meta-title">MetaTFT best holders</h3><div id="emblem-meta-results" aria-live="polite"></div></section>':''}`;
    if (moveFocus) {
      back.focus();
      dialog.scrollTop = 0;
    }
    const meta = results.querySelector('#emblem-meta-results');
    if (meta) showMeta(emblem, meta);
  }

  openButton.addEventListener('click',()=>{browse(); dialog.showModal();});
  back.addEventListener('click',()=>browse(selection));
  dialog.addEventListener('close',()=>{if (!dialog.open) request?.abort();});
  document.addEventListener('click',event=>{
    const button = event.target.closest('[data-explore-emblem]');
    if (!button) return;
    if (!dialog.open) dialog.showModal();
    explore(button.dataset.exploreEmblem);
  });

  const oldRender = render;
  let live = Academy.live;
  render = function() {
    oldRender();
    if (revision===Academy.revision && live===Academy.live) return;
    revision = Academy.revision;
    live = Academy.live;
    cache.clear();
    if (dialog.open) {
      if (selection) explore(selection, false);
      else drawCatalog();
    }
  };
})();
