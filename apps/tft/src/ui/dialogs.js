/* Native dialog backdrops belong to the dialog element. Only a press AND
   release outside its rectangle dismisses it; clicks in padding stay open. */
const DialogDismiss = {
  outside(dialog,event){const r=dialog.getBoundingClientRect();return Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);}
};
(() => {
  let pressed=null;
  document.addEventListener('pointerdown',e=>{const d=e.target.closest?.('dialog[open]');pressed=d&&DialogDismiss.outside(d,e)?d:null;},true);
  document.addEventListener('pointercancel',()=>{pressed=null;},true);
  document.addEventListener('click',e=>{const d=e.target.closest?.('dialog[open]');if(d&&pressed===d&&DialogDismiss.outside(d,e))d.close();pressed=null;},true);
})();
