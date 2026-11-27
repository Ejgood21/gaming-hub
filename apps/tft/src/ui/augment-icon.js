function augmentIcon(id){
    if(id.startsWith('reference:')){
      const item=Academy.itemMap.get(id.slice('reference:'.length));
      return item?icon(item):'<span class="augment-icon augment-fallback" aria-hidden="true">✦</span>';
    }
    const src=ACADEMY_BUNDLED.augments?.find(a=>a.apiName===id)?.icon||'https://assets.tftacademy.com/augments/'+encodeURIComponent(id)+'.webp';
    return `<img class="augment-icon" src="${esc(src)}" alt="" width="28" height="28" loading="lazy">`;
  }
