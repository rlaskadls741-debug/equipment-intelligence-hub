(()=>{'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const source=r=>'<a href="./?src='+encodeURIComponent(r.file)+'&amp;line='+r.start+'&amp;end='+r.end+'" target="_blank" rel="noopener">'+esc(r.file)+':'+r.start+(r.end>r.start?'–'+r.end:'')+'</a>';
 const kinds={code:'코드 근거',summary:'코드 경로 요약',device:'장치 일반 원리',unverified:'실제 설정 미확인',connector:'연결 기호',symbol:'표기 안내'};
 const groupNames={original:'통합 원본 대조',parts:'9개 PART/82개 블록',mot:'MOT 원시 값',file:'파일 SHA·행 수',annotation:'파일별 해설 배열', 'annotation-row':'동작·선언 해설 행 연결',reference:'중첩 원문 참조 범위',function:'제어 함수 정의 토큰',call:'호출 토큰·소속/메시지·스레드 연결',dictionary:'사전 ID 중복','declaration-token':'사전 선언 이름','usage-token':'사전 사용처 이름','variable-scope':'지역 변수·매개변수 사용 범위','example-code':'예제와 실제 원문 일치','function-example':'함수 예제의 선언·본문·사용 문맥','grammar-location':'문법 관련 행 범위',flow:'상세 도식 근거·링크·연결 항목','flow-edge':'상세 도식 선 양끝','system-source':'전체 도식 근거','system-edge':'전체 도식 선 양끝','system-normal':'전체 도식 경로 ID','system-map':'상세/전체 대응','system':'전체 도식 복사 일관성',metadata:'현재 통계','control-claim':'주요 제어 조건·호출 순서','io-axis':'IO·축 번호 정의','inverter-pack':'인버터 DWORD 계산'};
 fetch('./verification/report.json?v=20261021-audit-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('결과 파일 응답 '+r.status);return r.json();}).then(R=>{
  const n=v=>Number(v).toLocaleString('ko-KR'),checks=Object.values(R.summary),failed=checks.reduce((s,x)=>s+x.fail,0);
  $('runStatus').textContent='자동 검사 '+n(checks.reduce((s,x)=>s+x.total,0))+'회 · 실패 '+n(failed)+'건. 원본 79개 파일 일치 / 82개 PART 블록 일치. 남은 의미·장비 검증은 아래에 별도 기록했습니다.';
  const methods=[['원문 79개 · 28,520행','통합 원본 독립 분리, SHA·행별 비교','LF·끝 빈 행 정리 기준 모두 일치. 원본 전체 바이트 SHA도 일치.'],['상세42개·367상자 / 통합176상자·257선','근거/링크/양끝 ID 전수 검사, 도식별 문구·분기 검토','잘못된 근거 행 수정. 장치 일반 원리·실제 설정 미확인을 구분.'],['제어 함수214개 · 호출541개','정의 토큰, 호출자 범위, 스레드 등록, 메시지 ID와 수신 맵 대조','컴파일러의 오버로드 선택·동적 실행 순서는 미검증.'],['사전6,345개 · 예제'+n(R.summary['example-code'].total)+'개','모든 선언/사용처·예제 코드·지역 범위·생성자 구분','연결·예제 오류 수정. 목적·용도 문장은 코드 해석을 포함.'],['동작·선언 해설14,622행','전체 배열·행 범위·실행 텍스트 연결 검사','자연어 전 문장의 독립 의미 검증은 미완료.'],['주요 제어39개 · 번호 정의27개','실제 조건식·호출 순서·주석 제외·상수·DWORD 계산','명시한 코드 사실에 대한 검사. 설비 운전 성공 검증은 아님.'],['문법174개 · 매뉴얼/설정 자료','기초 문구·학습 예제 검토, 공식 문서 및 제품 PDF·MOT 대조','현재 설비 적용·외부 SDK 전체 계약은 미확인.']];
  $('methodRows').innerHTML=methods.map(x=>'<tr>'+x.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('');
  $('checkRows').innerHTML=Object.entries(R.summary).map(([k,v])=>'<tr><td>'+esc(groupNames[k]||k)+'</td><td>'+n(v.total)+'</td><td>'+n(v.pass)+'</td><td>'+n(v.fail)+'</td></tr>').join('');
  $('fixes').innerHTML=R.issues.map(x=>'<article class="fix"><small>'+esc(x.id+' · '+x.type+' · '+x.status)+'</small><h3>'+esc(x.item)+'</h3><p class="before">발견: '+esc(x.before)+'</p><p>수정: '+esc(x.after)+'</p></article>').join('');
  $('sourceFindings').innerHTML=R.source_findings.map(x=>'<p>'+source(x)+' · '+esc(x.item)+'</p>').join('');
  $('chartNotes').innerHTML=R.chart_review.map(x=>'<article class="fix"><small>'+esc(x.id)+' · 상자'+x.nodes+' / 선'+x.edges+'</small><h3>'+esc(x.title)+'</h3><p>'+esc(x.review)+'</p></article>').join('');
  $('controlRows').innerHTML=R.control_review.map(x=>'<tr><td>'+esc(x.finding)+'</td><td>'+source(x)+'</td><td>'+ (x.pass?'명시 규칙 일치':'불일치')+'</td></tr>').join('');
  $('externalRows').innerHTML=R.external_review.map(x=>'<article class="fix"><h3>'+esc(x.source)+'</h3>'+(x.location?'<small>'+esc(x.location)+'</small>':'')+'<p>'+esc(x.result)+'</p>'+(x.url?'<a target="_blank" rel="noopener" href="'+esc(x.url)+'">공식 참고 자료 ↗</a>':'')+'</article>').join('');
  $('pendingRows').innerHTML=R.pending.map(x=>'<article class="pending-card"><small>'+esc(x.id+' · '+x.status)+'</small><h3>'+esc(x.item)+'</h3><p>'+esc(x.scope)+'</p><p>'+esc(x.reason)+'</p></article>').join('');
  const versions=[{file:R.original.name,sha256:R.original.sha256},...R.artifacts,...R.additional_inputs,...R.manual_inputs];
  $('versionRows').innerHTML=versions.map(x=>'<details><summary>'+esc(x.file||x.name)+'</summary><code class="hash">SHA-256 '+esc(x.sha256)+'</code></details>').join('');
  $('browserRows').innerHTML='<h3>브라우저 동작 확인</h3><p>'+esc(R.browser_review.status)+'</p><ul>'+R.browser_review.cases.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
  const records={
   flows:R.flows.map(x=>[x.id,x.text.replaceAll('\n',' · '), '근거·링크·참조 범위 확인 / '+(kinds[x.kind]||x.kind), ['device','unverified'].includes(x.kind)?'제품 일반 원리 또는 실제 설정 확인 필요':x.kind==='code'||x.kind==='summary'?'도식 문구·분기 검토. 실제 장비 실증 없음.':'독립 실행 코드 없음', x.references]),
   system:R.system_nodes.map(x=>[x.id,x.text.replaceAll('\n',' · '),'전체 연결·근거 ID 확인 / '+(kinds[x.kind]||x.kind),['device','unverified'].includes(x.kind)?'실제 장치·설정 미확인':'상세 도식과 대응. 동적 실행 검증 아님',[]]),
   dictionary:R.dictionary.map(x=>[x.id,x.name,'선언·사용처 '+x.references+' / 예제 '+x.examples+' 확인',x.kind==='sdk'?'호출 확인 · 외부 API 전체 의미 미검증':x.kind==='grammar'?'기초 문구·학습 예제 검토':'정적 참조 확인 · 목적·용도 해석의 독립 의미 검증 미완료',[]]),
   files:R.files.map(x=>[x.file,x.lines+'행 · 해설 '+x.meaningful_annotations+'행','원본 일치 / 정규화 SHA 일치'+(x.trailing_blank_lines_removed?' / 끝 빈 행 '+x.trailing_blank_lines_removed+'개 정리':''),x.annotation_meaning_status,[{file:x.file,start:1,end:1}]]),
   annotations:R.annotations.flatMap(g=>g.rows.map(x=>[g.file+':'+x.line,x.kind==='declaration'?'선언 해설':'동작 해설','원문 행·실행 텍스트 연결 확인','자연어 의미 독립 검증 미완료',[{file:g.file,start:x.line,end:x.line}]])),
   grammar:R.grammar_review.map(x=>[x.id,x.name,x.status,x.meaning,[]])};
  let page=0;const size=80;
  function render(){const terms=$('inventorySearch').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),all=records[$('inventoryKind').value],found=all.filter(x=>terms.every(t=>x.slice(0,4).join(' ').toLocaleLowerCase().includes(t))),pages=Math.max(1,Math.ceil(found.length/size));page=Math.min(page,pages-1);
   $('inventoryCount').textContent=n(found.length)+'개 검색 / 전체 '+n(all.length)+'개 · '+(page+1)+' / '+pages+'페이지';
   $('prevPage').disabled=page===0;$('nextPage').disabled=page>=pages-1;
   $('inventoryRows').innerHTML=found.slice(page*size,(page+1)*size).map(x=>'<tr><td><code>'+esc(x[0])+'</code><div>'+esc(x[1])+'</div></td><td>'+esc(x[2])+(x[4].length?'<details><summary>원문 근거 '+x[4].length+'곳</summary>'+x[4].map(r=>'<p>'+source(r)+'</p>').join('')+'</details>':'')+'</td><td>'+esc(x[3])+'</td></tr>').join('')||'<tr><td colspan="3">일치하는 항목이 없습니다.</td></tr>';
  }
  $('inventorySearch').addEventListener('input',()=>{page=0;render();});$('inventoryKind').addEventListener('change',()=>{page=0;render();});$('inventoryClear').addEventListener('click',()=>{$('inventorySearch').value='';page=0;render();});$('prevPage').addEventListener('click',()=>{page--;render();});$('nextPage').addEventListener('click',()=>{page++;render();});render();
 }).catch(e=>{$('runStatus').textContent='검증 결과를 불러오지 못했습니다: '+e.message;$('runStatus').className='notice';});
})();
