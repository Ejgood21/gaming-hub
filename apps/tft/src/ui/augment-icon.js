function augmentIcon(id){
    const src=ACADEMY_BUNDLED.augments?.find(a=>a.apiName===id)?.icon||'https://assets.tftacademy.com/augments/'+encodeURIComponent(id)+'.webp';
    return `<img class="augment-icon" src="${esc(src)}" alt="" width="28" height="28" loading="lazy">`;
  }
