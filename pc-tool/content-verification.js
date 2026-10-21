/* Explanation corrections from the 2026-10-21 audit. Never edits T.source. */
(()=>{
 'use strict';
 const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function reviewData(T){
  const rows=Object.fromEntries(Object.entries(T.source).map(([f,s])=>[f,s.split(/\r?\n/)]));
  const at=r=>rows[r.file].slice(r.start-1,r.end).join('\n');
  const changes={constructorUsesRemoved:0,constructorExamplesRebuilt:0,exampleReadingsCorrected:0,constantsCorrected:0,scopedUsesRemoved:0,scopedExamplesRebuilt:0,conditionAnnotationsCorrected:0,declarationAnnotationsQualified:0};
  // Preserve the complete condition rather than translating -> or unary & as comparisons/bitwise AND.
  for(const [file,raw]of Object.entries(T.source)){
   const clean=raw.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:u8|[LuU])?"(?:\\[\s\S]|[^"\\])*"|(?:[LuU])?'(?:\\[\s\S]|[^'\\])*'/g,m=>m.replace(/[^\n]/g,' '));
   const ranges=[];
   for(const m of clean.matchAll(/\b(if|while|for)\s*\(/g)){
    const open=m.index+m[0].lastIndexOf('(');let depth=1,end=open+1;
    for(;end<clean.length&&depth;end++){if(clean[end]==='(')depth++;else if(clean[end]===')')depth--;}
    if(depth)continue;
    const startLine=clean.slice(0,m.index).split('\n').length,endLine=clean.slice(0,end).split('\n').length;
    ranges.push({type:m[1],startLine,endLine,expression:raw.slice(open+1,end-1).replace(/\s+/g,' ').trim()});
   }
   for(let i=0;i<T.annotations[file].length;i++){
    const a=T.annotations[file][i];
    if(['code','declaration','continuation'].includes(a.kind)&&(/조건\(|비트 연산 결과|앞줄과 &&/.test(a.text))){
     const range=ranges.find(r=>r.startLine<=i+1&&r.endLine>=i+1);
     if(range){a.text=(range.startLine===i+1?'':'앞에서 시작한 '+range.type+' 조건식이 이어지는 줄입니다. ')+range.type+'의 전체 괄호 안 식: '+range.expression+' . '+(range.type==='if'?'이 식이 참이면 해당 if에 속한 문장을 실행합니다.':range.type==='while'?'반복 진입 때 이 식이 참이면 본문을 실행하고 다시 조건을 검사합니다.':'초기화·조건·갱신을 원문 순서로 읽습니다. 각 항목은 세미콜론으로 구분합니다.');changes.conditionAnnotationsCorrected++;}
    }
    if(a.text.includes('초기값은 아직 대입하지 않았다')){a.text=a.text.replace('초기값은 아직 대입하지 않았다','이 선언에는 명시적 초기화식이 없습니다. 실제 초기 상태는 저장 기간·자료형·생성자에 따릅니다');changes.declarationAnnotationsQualified++;}
   }
  }
  const entries=T.dictionary.entries;
  for(const [name,r]of Object.entries(T.constants)){
   const line=rows[r.file][r.start-1],m=line.match(/^\s*#\s*define\s+\w+\s*(.*?)\s*(?:\/\/.*)?$/);
   if(m&&r.value!==m[1]){r.value=m[1]||'(치환값 없음 · 정의 여부에 사용)';changes.constantsCorrected++;}
  }
  for(const e of entries){
   const g=e.guide;if(!g)continue;
   if(['local','parameter'].includes(e.kind)&&e.bounds){
    const file=e.declarations[0]?.file,[lo,hi]=e.bounds;
    const within=r=>r.file===file&&r.start>=lo&&r.end<=hi;
    const old=e.uses.length;e.uses=e.uses.filter(within);changes.scopedUsesRemoved+=old-e.uses.length;
    g.examples=(g.examples||[]).map(x=>{
     if(within(x.ref))return x;
     const r=e.uses[0]||e.declarations[0];changes.scopedExamplesRebuilt++;
     return {ref:{...r,role:'소속 범위 안의 원문 예제'},code:at(r).trim(),reading:(e.function_scope||e.scope)+' 범위의 '+e.name+' 선언·사용입니다. 다른 파일이나 다른 함수에 있는 같은 철자의 이름과 구분합니다.'};
    });
   }
   if(e.kind==='function'&&e.type==='생성자'){
    const re=new RegExp('(?<![\\w~])'+escapeRegExp(e.name)+'\\s*\\(');
    const old=e.uses.length;e.uses=e.uses.filter(r=>re.test(at(r)));changes.constructorUsesRemoved+=old-e.uses.length;
    g.examples=e.declarations.slice(0,2).map(r=>{
     // A definition reference can cover the entire body; show the signature only.
     let end=r.start;
     while(end<Math.min(r.end,r.start+4)&&!/[{;]\s*(?:\/\/.*)?$/.test(rows[r.file][end-1]))end++;
     const ref={...r,end,role:r.role||'생성자 선언·정의'};
     return {ref,code:at(ref).trim(),reading:'생성자 '+(e.qualified||e.name)+'의 '+(r.role||'선언·정의')+'입니다. 클래스 이름이 다른 함수의 소속으로 적힌 줄과 구분합니다.'};
    });
    changes.constructorExamplesRebuilt++;
   }
   for(const x of g.examples||[]){
    if(e.kind==='grammar')continue;
    if(!x.code.includes(e.name)&&x.reading.includes(e.name)){
     const c=T.calls.find(c=>c.target===e.qualified&&c.file===x.ref.file&&c.line>=x.ref.start&&c.line<=x.ref.end);
     if(c?.kind==='메시지 전달')x.reading=c.binding.event+' 메시지를 보내는 위치입니다. 수신 측 메시지 맵이 '+e.qualified+'에 연결합니다. 이 함수 이름을 SendMessage의 값 인자로 넘기는 코드가 아닙니다.';
     else if(/ON_WM_/.test(x.code))x.reading='MFC 메시지 맵에서 '+e.name+' 처리 함수를 연결하는 매크로입니다. 이 줄은 함수 본문을 직접 실행하는 호출문이 아닙니다.';
     else x.reading=(e.qualified||e.name)+' 함수 본문에 있는 문장입니다. 이 줄에 적힌 호출·대입·반환을 읽어야 하며, 바깥 함수 이름이 이 문장의 인자로 전달된 것은 아닙니다.';
     changes.exampleReadingsCorrected++;
    }
   }
   if(e.kind==='sdk'){
    g.status='external_unverified';
    g.caution='이 SDK 항목의 호출 위치와 인자는 원문에서 확인했습니다. 위 기능 설명은 호출 문맥에 따른 해석이며, 이 검증에서 AXL/AXM/AXD 공식 API 계약·내부 구현·실제 장치 동작까지 확인하지 못했습니다.';
   }
   e.verification={date:'2026-10-21',scope:e.kind==='grammar'?'language_review':e.kind==='sdk'?'external_contract_unverified':'static_reference',
    meaning:e.kind==='grammar'?'문법 설명·예제 검토':e.kind==='sdk'?'외부 API 의미 추가 확인':'선언·사용 코드에 따른 해석 포함'};
  }
  // Incorrectly linked to OnStatusMonitorUpdate (1306–1309) in the old annotation.
  const home=T.evidence['06C_home_result:observe'];
  home.refs=home.refs.filter(r=>!(r.file==='DemoKitDlg.cpp'&&r.start===1306));
  home.refs.unshift({file:'DemoKitDlg.cpp',start:1296,end:1303,label:'Init 원점 결과 메시지 전송',function:'CDemoKitDlg::OnPositionUpdate'});
  home.functions=home.functions.filter(q=>q!=='CDemoKitDlg::OnStatusMonitorUpdate');if(!home.functions.includes('CDemoKitDlg::OnPositionUpdate'))home.functions.push('CDemoKitDlg::OnPositionUpdate');
  home.refs.push({file:'DemoKitDlg.cpp',start:921,end:923,label:'IO 스레드의 UI 갱신 호출'},
   {file:'InitDlg.cpp',start:46,end:46,label:'Init 메시지 수신 연결'});
  home.note='IO 스레드 → OnPositionUpdate → INIT_DLG_SERVO_STATUS_USER_MSG → InitDlg::OnServoStatusUpdate에서 원점 결과를 읽습니다. OnStatusMonitorUpdate는 StatusDlg로 가는 별도 메시지입니다. Oper 결과는 200 ms 타이머에서 읽습니다.';
  for(const r of T.evidence['12B_vacuum_wait:sensor'].refs){if(r.file==='AutoDlg.cpp'&&r.start===1459){r.start=1461;r.end=1461;}}
  for(const key of ['14B_motion_sensors:encoder','14B_motion_sensors:encstore'])T.evidence[key].refs.unshift({file:'DemoKitDlg.cpp',start:1387,end:1426,label:'명령·실제 위치와 속도·서보 상태 읽기'});
  for(const key of ['11B_cylinder_paths:e','11B_cylinder_paths:retE'])T.evidence[key].refs.unshift({file:'DemoKitDlg.cpp',start:1607,end:1632,label:'ECAT 메인 실린더 함수 출력 유지와 10 ms 대기'});
  for(const key of ['11B_cylinder_paths:p','11B_cylinder_paths:retP'])T.evidence[key].refs.unshift({file:'DemoKitDlg.cpp',start:1634,end:1665,label:'PM2Q 메인 실린더 함수 20 ms 펄스'});
  T.annotations['OperDlg.cpp'][973].text='OnNotify 안의 지역 bool bAutoRunning을 false로 초기화합니다. 이후 각 버튼 분기에서 GetIsAutoRunning()의 반환값을 대입합니다. 이 선언 줄은 해당 함수를 호출하지 않습니다.';
  T.annotations['DemoKitDlg.cpp'][1549].text='축 3(_PM2Q_01)의 알람 리셋 API에 dwAlarm을 전달합니다. 바로 위에서 만든 dwOnOff가 실제 인자로 쓰인 것은 아닙니다. 이 분기는 dwAlarm == 1일 때 진입합니다.';
  const counts={};for(const aa of Object.values(T.annotations))for(const a of aa)counts[a.kind]=(counts[a.kind]||0)+1;
  T.annotation_info={...T.annotation_info,version:2,total_source_lines:Object.values(T.files).reduce((s,f)=>s+f.lines,0),kinds:counts,
   evidence_lines:new Set(Object.values(T.evidence).flatMap(e=>e.refs.flatMap(r=>Array.from({length:r.end-r.start+1},(_,i)=>r.file+':'+(r.start+i))))).size,
   verification_scope:'전체 행 연결·파일 동일성은 정적 전수 검사. 자연어 동작 해설은 코드 해석이며 모든 문장의 의미를 자동 인증한 결과가 아님.'};
  T.evidence['03A_ethercat_state:safe'].note+=' SAFEOP에서 안전 출력 동작은 watchdog 설정의 영향을 받으며, 항상 OFF라는 뜻으로 확장하지 않습니다.';
  T.manuals.omron.location='고정 PDO: 인쇄 3-5·4-14 / PDF 73·92쪽. 6042h rpm: 인쇄 5-24 / PDF 124쪽. 5010h: 인쇄 5-20 / PDF 120쪽.';
  T.dictionary.readability_audit.method='전체 항목의 참조·예제 코드·소속을 정적 대조. 목적·용도 문구에는 코드 해석이 포함되며 자연어 전체의 독립 의미 검증 완료를 뜻하지 않음.';
  T.dictionary.readability_audit.by_status={};for(const e of entries){const status=e.guide?.status||'unknown';T.dictionary.readability_audit.by_status[status]=(T.dictionary.readability_audit.by_status[status]||0)+1;}
  T.verification={id:'2026-10-21-static-01',changes,original:T.provenance.sha256,meaning_status:'정적 근거 확인과 의미 해석을 구분. 장비 실증 없음.'};
  return T;
 }
 function apply(source){
  const re=/(<script[^>]*id="control-trace"[^>]*>)([\s\S]*?)(<\/script>)/;
  if(!re.test(source))throw new Error('Verification data not found');
  source=source.replace(re,(_,open,json,close)=>open+JSON.stringify(reviewData(JSON.parse(json))).replace(/</g,'\\u003c')+close);
  source=source.replaceAll('AxlOpenNoReset(7)은 기존 상태를 유지할 수 있는 라이브러리 호출입니다.', '코드는 AxlOpenNoReset(7)을 호출하며 상태 전이를 직접 구현한 소스는 확인되지 않았습니다.');
  source=source.replaceAll('독자 5010h의 0.01 Hz 단위와 혼동하지 않았습니다.', '독자 5010h는 일반 모드 0.01 Hz, 고주파 모드 0.1 Hz입니다.');
  source=source.replace("['declaration_only','empty_implementation','needs_context','continued_statement'].includes","['declaration_only','empty_implementation','needs_context','continued_statement','external_unverified'].includes");
  source=source.replace('<div id="sourceFindBar"','<p class="verification-scope-note" style="font-size:12px;color:#64768a">원문 대조·정적 참조 검사: 2026.10.21 · 추가 해설의 확인 범위는 <a href="./verification.html" target="_blank" rel="noopener">검증 이력</a>에서 확인하세요.</p><div id="sourceFindBar"');
  source=source.replace("source_context:'선언·사용처 대조'","source_context:'정적 참조 확인 · 설명은 코드 해석',external_unverified:'호출 확인 · 외부 API 의미 추가 확인'");
  source=source.replace("popupAnchor=anchor||popupAnchor;popup.innerHTML=", "popupAnchor=anchor||popupAnchor;const exactRef=e.kind==='grammar'||[...e.declarations,...e.uses].some(r=>r.file===context.file&&r.start<=context.line&&context.line<=r.end);const candidateNote=exactRef?'':'<p style=\"padding:10px 14px;background:#fff3db;color:#78521f\">이름이 같은 검색 후보입니다. 현재 줄의 선언·소속과 같은 항목인지 확인되지 않았습니다. 표시된 파일·함수를 비교해 주세요.</p>';popup.innerHTML=");
  source=source.replace("</button></header><div class=\"code-popup-body\">'+entryHTML(e,true)","</button></header>'+candidateNote+'<div class=\"code-popup-body\">'+entryHTML(e,true)");
  source=source.replace('<span>${meaningful.toLocaleString()}줄에 동작 해설이 있습니다.', '<span>행 연결·원문 동일성 검사 완료. 자연어 해설은 코드 해석이며 전 문장의 의미를 독립 검증한 상태는 아닙니다. <a href="./verification.html" target="_blank" rel="noopener">검증 범위 보기</a></span><span>${meaningful.toLocaleString()}줄에 동작 해설이 있습니다.');
  source=source.replace('<span class="explanation-label">동작 해설','<span class="explanation-label" title="원문과 연결된 추가 해설입니다. 자연어의 의미까지 자동 인증한 결과는 아닙니다.">동작 해설');
  return source;
 }
 window.DemoKitContentVerification={apply,reviewData};
})();
