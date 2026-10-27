(()=>{
 'use strict';
 const section=document.getElementById('revision-details');
 if(!section)return;
 const input=document.getElementById('revisionSearch'),rows=document.getElementById('revisionRows'),count=document.getElementById('revisionCount'),previous=document.getElementById('revisionPrev'),next=document.getElementById('revisionNext');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const display=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
 let records=[],page=0;
 function render(){
  const terms=input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches=records.filter(row=>terms.every(term=>row.search.includes(term)));
  const pages=Math.max(1,Math.ceil(matches.length/40));page=Math.min(page,pages-1);
  count.textContent=matches.length.toLocaleString()+'건 · '+(page+1)+' / '+pages+'쪽';previous.disabled=page===0;next.disabled=page===pages-1;
  rows.innerHTML=matches.slice(page*40,page*40+40).map(({record:x})=>'<article class="revision-record"><h3>'+esc(x['영역'])+' · '+esc(x['ID'])+'</h3><p class="revision-field">'+esc(x['필드'])+' · '+esc(x['근거'])+'</p><details><summary>수정 전</summary><pre>'+esc(display(x['변경 전']))+'</pre></details><details><summary>수정 후</summary><pre>'+esc(display(x['변경 후']))+'</pre></details></article>').join('')||(records.length?'<p>일치하는 수정 내역이 없습니다.</p>':'');
 }
 input.addEventListener('input',()=>{page=0;render()});
 document.getElementById('revisionReset').addEventListener('click',()=>{input.value='';page=0;render();input.focus()});
 previous.addEventListener('click',()=>{page--;render()});next.addEventListener('click',()=>{page++;render()});
 section.setAttribute('aria-busy','true');
 fetch(section.dataset.revisionSource,{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()}).then(data=>{
  if(!Array.isArray(data.changes))throw Error('수정 내역 형식 오류');
  records=data.changes.map(record=>({record,search:JSON.stringify(record).toLocaleLowerCase()}));
  render();section.dataset.loaded='true';
 }).catch(()=>{count.textContent='상세 내역을 불러오지 못했습니다. 새로고침하거나 전체 기록 JSON을 내려받아 확인해 주세요.';previous.disabled=next.disabled=true;}).finally(()=>section.setAttribute('aria-busy','false'));
})();
