/* Add the conversion checklist without changing the original analysis archive. */
(()=>{
 'use strict';
 const dialog=document.createElement('dialog');
 dialog.id='conversionChecklistDialog';
 dialog.setAttribute('aria-label','Ajin > WMX3 변환 체크리스트');
 dialog.innerHTML='<div class="conversion-dialog-bar"><span>Ajin &gt; WMX3 변환 체크리스트</span><button type="button" id="conversionChecklistClose">흐름도로 돌아가기 ×</button></div><iframe id="conversionChecklistFrame" title="변환 체크리스트 편집"></iframe>';
 document.body.append(dialog);
 const style=document.createElement('style');
 style.textContent='#conversionChecklistDialog{padding:0;border:1px solid #c6d4e2;border-radius:12px;width:calc(100vw - 32px);max-width:1600px;height:calc(100dvh - 32px);max-height:none;box-sizing:border-box;background:#f3f6fa;overflow:hidden}#conversionChecklistDialog[open]{display:flex;flex-direction:column}#conversionChecklistDialog::backdrop{background:#142b46aa}.conversion-dialog-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;background:#fff;border-bottom:1px solid #dce4ed;color:#344960;font-size:12px;font-weight:700}.conversion-dialog-bar button{padding:7px 11px;background:#edf3f9;border:1px solid #c6d4e2;border-radius:6px;color:#24547d;cursor:pointer}#conversionChecklistFrame{position:static;inset:auto;display:block;width:100%;height:100%;min-height:0;flex:1;border:0}@media(max-width:650px){#conversionChecklistDialog{width:100vw;height:100dvh;border:0;border-radius:0}.conversion-dialog-bar{padding:8px 10px}.conversion-dialog-bar>span{display:none}.conversion-dialog-bar button{margin-left:auto}}';
 document.head.append(style);
 const frame=dialog.querySelector('iframe');
 let opener;
 function close(){dialog.close();opener?.focus();}
 document.getElementById('conversionChecklistClose').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 frame.addEventListener('load',()=>{
  frame.contentDocument?.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&!frame.contentDocument.querySelector('dialog[open]')){event.preventDefault();close();}
  });
 });
 function mount(){
  if(document.getElementById('conversionChecklistToolbar'))return;
  const toolbar=document.createElement('div');toolbar.id='conversionChecklistToolbar';
  toolbar.innerHTML='<span>PC 제어 프로그램 분석 Tool</span>';
  const css=document.createElement('style');
  css.textContent='#conversionChecklistToolbar{position:fixed;inset:0 0 auto;height:49px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;padding:6px 20px;background:#fff;border-bottom:1px solid #d6e2ec;color:#62798e;font-size:11px}#app{top:49px;height:calc(100% - 49px)}#conversionChecklistOpen{display:inline-flex;align-items:center;gap:12px;padding:7px 13px;border:1px solid #adc4d9;border-radius:6px;background:#edf4fa;color:#205584;font:700 12px/1.5 system-ui,sans-serif;cursor:pointer}#conversionChecklistOpen:hover{background:#dfedf8}#conversionChecklistOpen:focus-visible{outline:3px solid #5792bf;outline-offset:2px}#conversionChecklistOpen small{font-size:10px;font-weight:500;color:#55748e}@media(max-width:650px){#conversionChecklistToolbar{padding:6px 10px;justify-content:flex-end}#conversionChecklistToolbar>span{display:none}#conversionChecklistOpen{font-size:11px;padding:7px 10px;gap:8px}}';
  document.head.append(css);
  const button=document.createElement('button');
  button.id='conversionChecklistOpen';button.type='button';
  button.setAttribute('aria-haspopup','dialog');
  button.innerHTML='<span>Ajin &gt; WMX3 변환 체크리스트</span><small>상태 편집 ↗</small>';
  button.addEventListener('click',()=>{
   opener=button;
   if(!frame.hasAttribute('src'))frame.src='./conversion-checklist.html?v=20261021-4';
   dialog.showModal();
  });
  toolbar.append(button);document.body.append(toolbar);
 }
 window.AjinWmxChecklistLauncher={mount};
})();
