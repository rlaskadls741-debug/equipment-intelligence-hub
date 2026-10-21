/* User-owned progress is independent of the document/code verification baseline. */
(()=>{
 'use strict';
 const DATA=window.AjinWmxChecklistData;
 const KEY='demokit.ajin-wmx3.checklist.v1';
 const LABELS={confirmed:'확인 완료',partial:'부분 확인',unverified:'미확인'};
 const DEFAULT_PALETTE={confirmed:'#27946b',partial:'#d69a22',unverified:'#d66262'};
 const baseline=Object.fromEntries(DATA.checklist.map(row=>[row.id,row]));
 const vendorTopics={C17:'전자기어비',C19:'1SN 원점·리밋',C21:'PM2Q A/B접점',C37:'인버터 PDO'};
 const colorValid=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 const statusKey=label=>Object.keys(LABELS).find(key=>LABELS[key]===label);
 const initialItem=id=>({status:statusKey(baseline[id].status),color:null,note:'',updatedAt:''});
 function freshState(){return {schema:1,project:'ajin-wmx3',palette:{...DEFAULT_PALETTE},items:Object.fromEntries(DATA.checklist.map(row=>[row.id,initialItem(row.id)])),savedAt:''};}
 function validate(input){
  if(!input||input.schema!==1||input.project!=='ajin-wmx3'||!input.items||typeof input.items!=='object'||Array.isArray(input.items))throw new Error('이 체크리스트에서 내보낸 JSON 파일이 아닙니다.');
  const result={schema:1,project:'ajin-wmx3',items:{},palette:{...DEFAULT_PALETTE},savedAt:''};
  for(const key of Object.keys(DEFAULT_PALETTE)){
   const value=input.palette?.[key];
   if(value!==undefined&&!colorValid(value))throw new Error('기본 색상 값이 올바르지 않습니다.');
   if(value)result.palette[key]=value.toLowerCase();
  }
  for(const [id,item] of Object.entries(input.items)){
   if(!Object.hasOwn(baseline,id))throw new Error('알 수 없는 항목 번호가 있습니다: '+id);
   if(!item||!Object.hasOwn(LABELS,item.status))throw new Error(id+'의 상태가 올바르지 않습니다.');
   if(item.color!==null&&item.color!==undefined&&!colorValid(item.color))throw new Error(id+'의 색상이 올바르지 않습니다.');
   if(typeof item.note!=='string'||item.note.length>10000)throw new Error(id+'의 메모가 올바르지 않습니다.');
   result.items[id]={status:item.status,color:item.color?.toLowerCase()||null,note:item.note,updatedAt:typeof item.updatedAt==='string'&&Number.isFinite(Date.parse(item.updatedAt))?item.updatedAt:''};
  }
  if(!Object.keys(result.items).length)throw new Error('불러올 체크항목이 없습니다.');
  if(typeof input.savedAt==='string'&&Number.isFinite(Date.parse(input.savedAt)))result.savedAt=input.savedAt;
  return result;
 }
 const $=id=>document.getElementById(id);
 function el(tag,props={},text){const node=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')node.className=v;else node.setAttribute(k,v);}if(text!==undefined)node.textContent=text;return node;}
 const time=value=>value?new Date(value).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
 let state=freshState(),loadError='',pendingImport=null,allExpanded=false;
 try{
  const saved=localStorage.getItem(KEY);
  if(saved){const parsed=validate(JSON.parse(saved));state={...state,...parsed,items:{...state.items,...parsed.items}};}
 }catch(error){loadError='저장값을 읽지 못했습니다. 원래 저장값은 유지됩니다. 내보내기로 현재 작업을 보관하세요.';}
 let storageBlocked=!!loadError;
 function showStatus(message,error=false){$('saveStatus').textContent=message;$('saveStatus').classList.toggle('error',error);}
 function save(explicit=false){
  if(storageBlocked&&!explicit){showStatus('자동 저장을 사용할 수 없습니다. 저장 파일 내보내기로 보관하세요.',true);return false;}
  if(storageBlocked&&explicit&&!window.confirm('기존 브라우저 저장값을 현재 화면의 작업 기록으로 저장할까요?'))return false;
  const previous=state.savedAt;
  try{
   state.savedAt=new Date().toISOString();
   localStorage.setItem(KEY,JSON.stringify(state));
   storageBlocked=false;showStatus('자동 저장됨 · '+time(state.savedAt)+' · 현재 브라우저');return true;
  }catch(error){state.savedAt=previous;showStatus('브라우저 저장 실패 · 저장 파일 내보내기로 보관하세요.',true);return false;}
 }
 const rowNodes=new Map();
 function effectiveColor(id){const item=state.items[id];return item.color||state.palette[item.status];}
 function updateColors(){
  for(const [key,value] of Object.entries(state.palette)){
   document.documentElement.style.setProperty('--'+key,value);
   document.querySelectorAll('[data-dot="'+key+'"]').forEach(dot=>dot.style.setProperty('--dot',value));
   const pair=document.querySelector('[data-palette="'+key+'"]');
   if(pair){pair.querySelector('input[type=color]').value=value;pair.querySelector('.hex-input').value=value;}
  }
  for(const row of DATA.checklist){
   const node=rowNodes.get(row.id);if(!node)continue;
   const item=state.items[row.id],color=effectiveColor(row.id);
   node.style.setProperty('--row-color',color);
   node.querySelector('input[type=color]').value=color;
   node.querySelector('.hex-input').value=color;
   node.querySelector('.reset-color').textContent=item.color?'상태별 색상으로 되돌리기':'상태 색상 사용 중';
   node.querySelector('.reset-color').disabled=!item.color;
  }
 }
 function updateSummary(){
  const counts={confirmed:0,partial:0,unverified:0};
  Object.values(state.items).forEach(item=>counts[item.status]++);
  for(const [key,count] of Object.entries(counts)){
   $('count-'+key).textContent=count;
   document.querySelector('[data-summary-status="'+key+'"]').setAttribute('aria-pressed',String($('statusFilter').value===key));
  }
 }
 function touch(id){state.items[id].updatedAt=new Date().toISOString();rowNodes.get(id).querySelector('.updated').textContent='수정 '+time(state.items[id].updatedAt);save();}
 function colorPair(label,value,onChange){
  const wrap=el('div',{class:'row-color-controls'});
  const picker=el('input',{type:'color',class:'color-picker','aria-label':label+' 색상 선택',value});
  const hex=el('input',{type:'text',class:'hex-input','aria-label':label+' 색상 코드',value,maxlength:'7',spellcheck:'false',pattern:'#[0-9A-Fa-f]{6}'});
  picker.addEventListener('input',()=>{hex.value=picker.value;hex.removeAttribute('aria-invalid');onChange(picker.value);});
  hex.addEventListener('input',()=>{
   const good=colorValid(hex.value);hex.setAttribute('aria-invalid',String(!good));
   if(good){picker.value=hex.value;onChange(hex.value.toLowerCase());}
  });
  hex.addEventListener('blur',()=>{if(!colorValid(hex.value)){hex.value=picker.value;hex.removeAttribute('aria-invalid');}});
  wrap.append(picker,hex);return wrap;
 }
 function buildPalette(){
  for(const key of Object.keys(LABELS)){
   const control=el('div',{class:'palette-control','data-palette':key});
   control.append(el('label',{},LABELS[key]),colorPair(LABELS[key],state.palette[key],value=>{state.palette[key]=value;updateColors();save();}));
   $('paletteControls').append(control);
  }
 }
 function buildRows(){
  let category='';
  for(const row of DATA.checklist){
   if(row.category!==category){category=row.category;const heading=el('h3',{class:'category-heading','data-category-heading':category},category);heading.append(el('span',{},'6'));$('checklistRows').append(heading);$('categoryFilter').append(el('option',{value:category},category));}
   const node=el('article',{class:'check-row','data-id':row.id,'aria-label':row.id+' '+row.item});
   rowNodes.set(row.id,node);
   const item=state.items[row.id],main=el('div',{class:'item-cell'}),meta=el('div',{class:'item-meta'});
   meta.append(el('span',{class:'item-id'},row.id));
   if(vendorTopics[row.id])meta.append(el('span',{class:'vendor-tag'},'이전 문의 · '+vendorTopics[row.id]));
   main.append(meta,el('h3',{class:'item-title'},row.item));
   const detail=el('details',{class:'row-evidence'}),body=el('div',{class:'detail-body'});
   detail.append(el('summary',{},'확인 근거 · 남은 작업 보기'));
   const baselineP=el('p');baselineP.append(el('span',{class:'detail-label'},'최초 검토 상태 · 2026.10.21'),el('span',{class:'baseline-status'},row.status+' · 문서/코드 검토 기준'));
   body.append(baselineP);
   for(const [label,text] of [['확인한 내용',row.found],['남은 확인·작업',row.remaining]]){const p=el('p');p.append(el('span',{class:'detail-label'},label),document.createTextNode(text));body.append(p);}
   body.append(el('p',{class:'evidence-ref'},'근거: '+row.evidence),el('p',{class:'route'},'후속 경로: '+row.route+' · 최초 구현/실물 시험: 미실시'));
   detail.append(body);main.append(detail);
   const status=el('div',{class:'status-cell'}),select=el('select',{class:'status-select','aria-label':row.id+' 현재 상태'});
   for(const [key,label] of Object.entries(LABELS))select.append(el('option',{value:key},label));
   select.value=item.status;
   select.addEventListener('change',()=>{state.items[row.id].status=select.value;state.items[row.id].color=null;touch(row.id);updateColors();updateSummary();applyFilters();});
   status.append(select,el('span',{class:'status-caption'},'내가 관리하는 현재 상태'));
   const colorCell=el('div',{class:'color-cell'}),reset=el('button',{type:'button',class:'reset-color','aria-label':row.id+' 상태별 색상으로 되돌리기'});
   colorCell.append(colorPair(row.id,effectiveColor(row.id),value=>{state.items[row.id].color=value;touch(row.id);updateColors();}),reset);
   reset.addEventListener('click',()=>{state.items[row.id].color=null;touch(row.id);updateColors();});
   const notes=el('div',{class:'notes-cell'}),textarea=el('textarea',{class:'row-note','aria-label':row.id+' 내 메모',placeholder:'확인값·결과·다음 작업 기록',maxlength:'10000'});
   textarea.value=item.note;
   textarea.addEventListener('input',()=>{state.items[row.id].note=textarea.value;touch(row.id);});
   notes.append(textarea,el('span',{class:'updated'},item.updatedAt?'수정 '+time(item.updatedAt):''));
   node.append(main,status,colorCell,notes);$('checklistRows').append(node);
  }
 }
 function applyFilters(){
  const term=$('checklistSearch').value.trim().toLocaleLowerCase(),category=$('categoryFilter').value,status=$('statusFilter').value,vendor=$('vendorOnly').checked;
  let visible=0;const categories={};
  for(const row of DATA.checklist){
   const item=state.items[row.id];
   const haystack=[row.id,row.item,row.category,row.found,row.remaining,row.evidence,item.note,vendorTopics[row.id]||''].join(' ').toLocaleLowerCase();
   const show=(!term||haystack.includes(term))&&(!category||category===row.category)&&(!status||status===item.status)&&(!vendor||!!vendorTopics[row.id]);
   rowNodes.get(row.id).hidden=!show;
   if(show){visible++;categories[row.category]=(categories[row.category]||0)+1;}
  }
  document.querySelectorAll('[data-category-heading]').forEach(heading=>{const count=categories[heading.dataset.categoryHeading]||0;heading.hidden=!count;heading.querySelector('span').textContent=count;});
  $('resultCount').textContent=visible+' / 60';$('emptyState').hidden=visible>0;updateSummary();
 }
 function refresh(){
  for(const row of DATA.checklist){const item=state.items[row.id],node=rowNodes.get(row.id);node.querySelector('select').value=item.status;node.querySelector('textarea').value=item.note;node.querySelector('.updated').textContent=item.updatedAt?'수정 '+time(item.updatedAt):'';}
  updateColors();applyFilters();
 }
 function table(headers,rows){
  const wrapper=el('div',{class:'table-scroll'}),t=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  for(const label of headers)tr.append(el('th',{scope:'col'},label));head.append(tr);t.append(head);
  for(const values of rows){const line=el('tr');for(const value of values)line.append(el('td',{},String(value??'')));body.append(line);}
  t.append(body);wrapper.append(t);return wrapper;
 }
 function buildEvidence(){
  for(const [id,title,scope,note,source,hash] of DATA.sources){
   const record=el('div',{class:'source-record'});record.append(el('strong',{},id+' · '+title),el('p',{},scope+' · '+note));
   if(/^https:\/\//.test(source))record.append(el('a',{href:source,target:'_blank',rel:'noopener noreferrer'},'공식 자료 열기 ↗'));else record.append(el('p',{},source));
   record.append(el('p',{},hash.length===64?'SHA256':hash));if(hash.length===64)record.append(el('code',{},hash));$('sourceRegistry').append(record);
  }
  // Tables use the authored records verbatim; no manual/API facts are generated here.
  function recordsTable(records){
   if(!records.length)return el('div');
   if(Array.isArray(records[0]))return table(records[0].map((_,i)=>'근거 '+(i+1)),records);
   const keys=Object.keys(records[0]);
   const names={id:'번호',name:'이름',ajin:'아진 API',status:'검토 상태',wmx:'WMX3 대응',found:'확인 내용',remaining:'남은 확인',evidence:'근거',source:'원문·출처',device:'장치',pdo:'PDO',index:'Index',sub:'SubIndex',subindex:'SubIndex',bits:'Bit 수',type:'자료형',offset:'Bit Offset',byte_offset:'PDO 내 Byte Offset',axis:'축',item:'항목',value:'값',note:'비고',meaning:'의미',access:'접근',object:'Object',api:'API',count:'사용 수',uses:'사용 위치',route:'전환 경로',mapping:'대응',contract:'확인 범위',purpose:'아진 사용 목적',target:'WMX3 대응·설계 방향',difference:'차이·미확인 범위',references:'매뉴얼 근거',implementation:'구현',equipment_test:'실물 시험',direction:'방향',state:'확인 범위'};
   return table(keys.map(key=>names[key]||key),records.map(row=>keys.map(key=>typeof row[key]==='object'?JSON.stringify(row[key]):row[key])));
  }
  $('apiEvidence').append(recordsTable(DATA.api));
  $('configurationEvidence').append(el('h3',{},'선택 PDO 정의 · 51개 엔트리'),recordsTable(DATA.pdos));
  $('configurationEvidence').append(el('h3',{},'PM2Q 제조사 파라미터 · 24개'),table(['Index','SubIndex','이름','자료형','Bit 수','접근','확인 범위','출처'],DATA.pm_params));
  const motFields=Object.keys(DATA.mot[0]).filter(key=>key!=='axis');
  $('configurationEvidence').append(el('h3',{},'motion.mot · 4축 원시 설정'),table(['설정 항목',...DATA.mot.map(row=>'축 '+row.axis)],motFields.map(key=>[key,...DATA.mot.map(row=>row[key])])));
 }
 $('saveNow').addEventListener('click',()=>save(true));
 $('exportState').addEventListener('click',()=>{
  const payload={...state,exportedAt:new Date().toISOString(),baselineDate:DATA.date};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const link=el('a',{href:url,download:'Ajin-WMX3-checklist-'+new Date().toISOString().slice(0,10)+'.json'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  showStatus('저장 파일 다운로드 요청됨 · 상태·색상·메모 포함');
 });
 $('importState').addEventListener('click',()=>$('importFile').click());
 $('importFile').addEventListener('change',async()=>{
  const file=$('importFile').files[0];if(!file)return;
  try{
   if(file.size>2*1024*1024)throw new Error('파일은 2MB 이하만 불러올 수 있습니다.');
   pendingImport=validate(JSON.parse(await file.text()));
   $('importDescription').textContent='항목 '+Object.keys(pendingImport.items).length+'개의 작업 기록을 불러옵니다. 원래 확인 근거는 유지됩니다.';
   $('importConfirm').showModal();
  }catch(error){pendingImport=null;showStatus('불러오기 실패 · '+error.message,true);}
  finally{$('importFile').value='';}
 });
 $('cancelImport').addEventListener('click',()=>{pendingImport=null;$('importConfirm').close();});
 $('importConfirm').addEventListener('cancel',()=>{pendingImport=null;});
 $('applyImport').addEventListener('click',()=>{
  if(!pendingImport)return;
  state={...state,...pendingImport,items:{...state.items,...pendingImport.items}};pendingImport=null;$('importConfirm').close();refresh();save();
 });
 for(const id of ['checklistSearch','categoryFilter','statusFilter','vendorOnly'])$(id).addEventListener(id==='checklistSearch'?'input':'change',applyFilters);
 document.querySelectorAll('[data-summary-status]').forEach(button=>button.addEventListener('click',()=>{$('statusFilter').value=$('statusFilter').value===button.dataset.summaryStatus?'':button.dataset.summaryStatus;applyFilters();}));
 $('expandAll').addEventListener('click',()=>{allExpanded=!allExpanded;document.querySelectorAll('.row-evidence').forEach(detail=>{detail.open=allExpanded;});$('expandAll').textContent=allExpanded?'근거 모두 접기':'근거 모두 펼치기';});
 buildPalette();buildRows();buildEvidence();refresh();
 if(loadError)showStatus(loadError,true);else showStatus(state.savedAt?'저장값 불러옴 · '+time(state.savedAt)+' · 현재 브라우저':'변경 시 자동 저장 · 현재 브라우저');
})();
