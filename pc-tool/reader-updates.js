/* Keep the embedded reader behavior consistent without rewriting its source archive. */
(()=>{
 'use strict';
 function replaceOne(source,pattern,replacement,label){
  const matches=typeof pattern==='string'?source.split(pattern).length-1:[...source.matchAll(new RegExp(pattern.source,'g'))].length;
  if(matches!==1)throw new Error('Reader update target mismatch: '+label+' ('+matches+')');
  return source.replace(pattern,replacement);
 }
 const parseRange=String.raw`function parseRange(value,file,count=1){
  let text=String(value).trim();
  const withFile=text.match(/^([^:]+\.(?:cpp|h))\s*:\s*(.*)$/i);
  if(withFile){file=Object.keys(T.files).find(f=>f.toLocaleLowerCase()===withFile[1].toLocaleLowerCase())||withFile[1];text=withFile[2];}
  if(!T.files[file])return {error:'코드 파일을 선택해 주세요.'};
  const match=text.match(/^\s*(\d+)\s*(?:[-~–—:]\s*(\d+)|\+\s*(\d+))?\s*(?:행)?\s*$/);
  if(!match)return {error:'시작 행 번호를 입력해 주세요. 예: 500 · 범위 직접 입력: 500-519'};
  const start=Number(match[1]),total=T.files[file].lines;
  if(!Number.isSafeInteger(start)||start<1||start>total)return {error:'시작 행은 1~'+total.toLocaleString()+' 사이로 입력해 주세요.'};
  let end;
  if(match[2])end=Number(match[2]);
  else{
   const rawCount=match[3]??String(count).trim();
   const rows=Number(rawCount);
   if(!/^\d+$/.test(rawCount)||!Number.isSafeInteger(rows)||rows<1||rows>10000)return {error:'강조할 줄 수는 1~10,000 사이의 정수로 입력해 주세요.'};
   end=start+rows-1;
  }
  if(!Number.isSafeInteger(end)||end<start)return {error:'끝 행은 시작 행 이상으로 입력해 주세요.'};
  return {file,start,end:Math.min(end,total)};
 }`;
 const inlineSource=String.raw`<script id="ppt-stage-navigation">(()=>{'use strict';
 const routes=window.AutoSequencePptLinks,api=window.DemoKitTrace;
 if(!routes||!api)return;
 function open(entry){if(!entry)return false;api.openSource(entry.file,entry.start,entry.end,true,true);return true;}
 addEventListener('hashchange',()=>{const entry=routes.resolveSource(location.hash);if(entry)open(entry);});
 addEventListener('popstate',()=>{const entry=routes.resolveLocation(location);if(entry)open(entry);});
 if(routes.initialSource)open(routes.initialSource);
 window.AutoSequencePptSource={open,focus:open,close:()=>api.goBack(),active:()=>null,transport:'query-and-fragment',mode:'inline-source'};
 })();</script>`;
 function apply(source){
  source=replaceOne(source,/function parseRange\(value,file,count=80\)\{[^\n]+\}/,parseRange,'line and count validation');
  source=replaceOne(source,'<label for="sourceLine">행</label>','<label for="sourceLine">시작 행</label>','start line label');
  source=replaceOne(source,'<label for="sourceRows">줄 수</label>','<label for="sourceRows">강조할 줄 수</label>','selection count label');
  source=replaceOne(source,'id="sourceLine"','id="sourceLine" aria-describedby="sourceJumpHelp"','start line help');
  source=replaceOne(source,'id="sourceRows"','id="sourceRows" aria-describedby="sourceJumpHelp"','selection count help');
  source=replaceOne(source,'placeholder="512 또는 512-530"','placeholder="예: 500"','start line example');
  source=replaceOne(source,'aria-label="찾을 행 또는 행 범위"','aria-label="시작 행"','start line accessible name');
  source=replaceOne(source,'<div id="sourceFindBar"',
   '<p id="sourceJumpHelp" class="source-jump-help">예: 시작 행 <b>500</b> · 강조할 줄 수 <b>20</b> → <b>500~519행</b>을 강조합니다. 파일 전체는 그대로 표시됩니다. Enter로도 이동할 수 있습니다.</p><div id="sourceFindBar"','visible jump example');
  source=replaceOne(source,"document.getElementById('sourceLine').value=end>line?line+'-'+end:line;","document.getElementById('sourceLine').value=line;",'normalize start line');
  source=replaceOne(source,"document.getElementById('sourceLine').value=s.state.end>s.state.line?s.state.line+'-'+s.state.end:s.state.line;","document.getElementById('sourceLine').value=s.state.line;",'normalize restored start line');
  source=replaceOne(source,"document.getElementById('sourceLine').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('sourceGoto').click()});",
   "for(const id of ['sourceLine','sourceRows'])document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();document.getElementById('sourceGoto').click();}});",'Enter stays in reader');
  source=replaceOne(source,"if(id==='code_dictionary')window.DemoKitDictionary?.activate();updateSourceReturn();}",
   "if(id==='code_dictionary')window.DemoKitDictionary?.activate();if(id==='source_code')requestAnimationFrame(scrollSourceFocus);updateSourceReturn();}",'scroll after reader navigation');
  source=replaceOne(source,'entries,byName:name=>byName.get(name.toLocaleLowerCase())||[]};',
   'entries,byName:name=>byName.get(name.toLocaleLowerCase())||[]};api.renderSource();','render dictionary tokens after dictionary initialization');
  source=replaceOne(source,/<script id="ppt-stage-navigation">\s*\(\(\)=>\{'use strict';\s*const routes=window\.AutoSequencePptLinks,api=window\.DemoKitTrace;[\s\S]*?mode:'source-dialog'\};\s*\}\)\(\);\s*<\/script>/,
   inlineSource,'inline source routing');
  source=replaceOne(source,'</head>',
   '<style>.source-jump-help{margin:0 0 10px;padding:0 3px;font-size:12px;line-height:1.7;color:#526a80}.reader-count-field label{white-space:nowrap}.reader-primary-tools .reader-count-field input{max-width:90px}@media(max-width:650px){.reader-primary-tools{grid-template-columns:minmax(0,1fr) 95px 56px}.reader-count-field label{font-size:11px}}</style></head>','reader field layout');
  return source;
 }
 window.DemoKitReaderUpdates={apply};
})();
