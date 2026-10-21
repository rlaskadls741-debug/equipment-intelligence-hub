#!/usr/bin/env python3
"""Package actual audit output, review notes and unresolved scope without inflating 'pass'."""
import argparse,hashlib,json
from pathlib import Path

notes=[
 '기호·색상은 문서의 표기 규칙이다. 실행 코드나 표준 적합성 인증으로 취급하지 않는다.',
 '상위 명령 경로를 묶은 요약이다. UI·감시·IO·자동 스레드가 하나의 순차 루프로 실행된다고 해석하지 않는다.',
 'AxlOpenNoReset(7), IO 모듈 존재 검사, 1<<ModuleNo 합산과 0x000F 비교·실패 반환을 대조했다.',
 'MOT 로드·축2/3 STOP 설정·4축 인식·m_bDeviceOpen 변경 경로를 대조했다.',
 '초기화 시도 뒤 스레드 생성과 200 ms 타이머·리셋이 이어진다. 성공 가드와 혼동하지 않는다.',
 'Beckhoff의 일반 상태 설명과 대조했다. 앱이 INIT→OP를 직접 수행한다는 코드 근거는 없으며 SAFEOP 출력은 watchdog 설정 예외가 있다.',
 '앱 호출과 통신·장치 실행 경로를 구분했다. 앱 API 하나와 프레임 하나가 일대일이라는 주장은 하지 않는다.',
 '감시 함수 호출 순서·DI/DO 캐시·4축 상태·Sleep(50)을 대조했다. 실제 루프 및 버스 주기는 별개다.',
 'START=1/STOP=0, 이전 플래그, AUTO 탭 조건과 메시지 경로를 대조했다.',
 'STOP의 반대 조건·RESET의 탭 제한 없음·50 ms 대기를 대조했다.',
 '축별 IsServoOn→필요 시 ServoOn→100 ms 대기를 대조했다. Ready·정상 완료 반복 확인이 아니다.',
 '축0/1·2/3의 코드 별칭과 PM2Q 제품의 지원 경로를 대조했다. 실제 드라이브·엔코더·배선은 미확인이다.',
 '4축 HOME 요청 순서와 HomeEnd 초기화를 대조했다. dAccFirst 뒤 dVelFirst를 검사하는 원문을 확인했다.',
 '선택 축 HOME의 오류 메시지·반환과 원점 결과 타이머 경로를 대조했다.',
 '잘못 남아 있던 StatusDlg 메시지 근거를 InitDlg 메시지 경로로 수정했다. Oper는 200 ms 타이머다.',
 '시작 가드·리셋·서보·버튼 비활성화·스레드 생성·RUN 표시를 순서대로 대조했다. StartAutoRun 반환값은 호출자가 무시한다.',
 'ECAT 루프·Abort·DI12/4/8·자기 플래그·전역 오류 조건·50 ms·인버터 종료 요청을 대조했다.',
 'ECAT 픽업의 출력/이동/진공 ON·지역 오류 분기·플래그 해제를 대조했다.',
 'ECAT 언로딩 정상 경로에서 진공 OFF 결과를 다시 검사하지 않고 다음 호출로 진행함을 확인했다.',
 'ECAT 진공 ON 오류 저장·OFF·UP·루프 복귀를 대조했다. 이 복구 분기는 인버터 정지를 직접 요청하지 않는다.',
 'PM2Q 루프는 ECAT 플래그를 검사하고 안쪽에서 자기 플래그도 검사한다. 대칭 잠금으로 설명하지 않는다.',
 'PM2Q 픽업 순서·m_nError=0 초기화·흡착 결과 분기를 대조했다.',
 'PM2Q 정상 언로딩에서도 진공 OFF 오류를 검사하지 않는 경로를 확인했다.',
 'PM2Q 전역 오류 저장과 복구 뒤 반복 유지 경로를 대조했다.',
 '로딩/언로딩 목표 배열·좌표계0/1·V/A/D 선택·작업 좌표·Clear/Map/LineMove 순서를 대조했다.',
 '두 InMotion=0 대기 while에 Sleep/Timeout/Abort/API 오류 판정이 없음을 확인했다. 목표 도착 보장으로 확장하지 않는다.',
 '자동 실린더의 출력 순서·80 ms·TRUE 반환을 대조했다. 센서/Abort 대기 예제는 주석이다.',
 '메인 실린더의 실제 함수 근거를 보강했다. ECAT 10 ms 유지와 PM2Q 20 ms 후 요청 출력 OFF를 구분했다.',
 '진공 DO·압력 DI 대응, 출력 뒤 10 ms, 2초 설정과 입력 캐시 사용을 대조했다.',
 '시간 초과 우선 판정·목표 입력·20 ms/DoEvents·오류 반환을 대조했다. PM2Q OFF 센서의 잘못된 근거 행을 수정했다.',
 '자동 ±511·수동 ±1023 및 하위0x000F의 32비트 패킹을 계산하고 모듈2/3 호출과 대조했다.',
 'OMRON PDF73/92의 고정 PDO 및 PDF120/124 단위를 대조했다. 실제 1700h 매핑 여부는 확인하지 못했다.',
 'DI0~15의 정의/미정 채널·원시 논리 캐시·자동 진입 및 진공 대기 사용을 대조했다.',
 '기계 비트0/1/4/5/6·Busy bit0의 저장 코드를 대조했다. 위치·속도·서보 읽기 근거를 추가했다. SDK 비트 의미와 실제 배선은 별도다.',
 '축0~3 JOG 속도 부호와 GetIsAutoRunning 구현을 대조했다. ECAT 중복 OR·PM2Q 누락을 원문 검토 항목으로 유지한다.',
 '입력 공백 검사·선택 축·ABS/INC·이동 요청·오류 메시지·INI 저장을 대조했다. 모든 입력 유효성을 검증하는 가드로 확장하지 않는다.',
 '자동 상태 가드·TEST 모드·비트 반전·출력 호출과 DO 상태 표시 경로를 대조했다.',
 'STOP의 Abort/Exe 변경, 내부 함수가 끝난 뒤 바깥 while 재평가, 인버터0 기록·정리 경로를 대조했다.',
 '진공 오류 저장/재진입 차단과 별도 RESET의 전역 오류 초기화를 대조했다. 재개 가능은 루프 유지·다른 조건 충족 시의 정적 해석이다.',
 '종료 콜백의 감시/IO 플래그·대기·장치 닫기와 자동 플래그 경로를 대조했다. 종료 콜백 상대 순서·안전 정지는 실증하지 않았다.',
 'AXL include·링크, 코드의 축 구분 및 PM2Q 제품 지원을 대조했다. 마스터 모델·주기·케이블 순서는 미확인이다.',
 'DO/밸브, 인버터/컨베이어, DI/공유 상태의 논리 경로와 번호 정의를 대조했다. 물리 결선은 미확인이다.'
]

p=argparse.ArgumentParser();p.add_argument('--audit',required=True);p.add_argument('--data',required=True);p.add_argument('--manual-dir',required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];T=json.loads(Path(a.data).read_text());r=json.loads(Path(a.audit).read_text())
assert len(notes)==len(T['model'])==42
assert not [c for c in r['checks'] if not c['pass']], 'Do not publish a passing report with failed automated checks.'
out={k:v for k,v in r.items() if k!='checks'}
out['id']='2026-10-21-static-01'
out['overall_status']='정적 전수 검사 완료 · 자연어 전체의 독립 의미 검증 및 설비 실증 미완료'
out['scope_notice']='전체 구성 요소를 목록에 넣어 검사 범위를 누락하지 않았다. 통과 수는 범위·토큰·예제·스코프 등 명시한 검사만을 뜻한다. 모든 자연어 해설이 참이라는 인증은 아니다.'
out['corrections']=T['verification']['changes']
out['artifacts']=[{'file':f,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest(),'bytes':(root/f).stat().st_size} for f in ['source-part1.txt','source-part2.txt','reader-updates.js','content-verification.js','index.html','history.html','manual.html','verification.html','verification/view.js','verification/audit.py','verification/control-checks.json']]
out['manual_inputs']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in Path(a.manual_dir).glob('*.pdf')]
out['chart_review']=[{'id':m['id'],'title':m['title'],'nodes':len(m['nodes']),'edges':len(m['edges']),'review':note} for m,note in zip(T['model'],notes)]
out['system_nodes']=[{k:n[k] for k in ['id','text','kind','sources','section']} for n in T['system']['nodes']]
out['system_edges']=T['system']['edges']
out['annotations']=[{'file':f,'rows':[{'line':i+1,'kind':n['kind'],'status':'source_row_confirmed_meaning_not_independently_certified'} for i,n in enumerate(A) if n['kind'] in ['code','declaration']]} for f,A in T['annotations'].items()]
out['grammar_review']=[{'id':e['id'],'name':e['name'],'meaning':e['meaning'],'status':'문구·학습 예제 검토 / 원문 위치 범위 검사','sources':e.get('sources',[])} for e in T['dictionary']['entries'] if e['kind']=='grammar']
out['dictionary_functions']={'definitions':len(T['dictionary']['function_ranges']),'function_entries':sum(e['kind']=='function' for e in T['dictionary']['entries']),'control_graph_functions':len(T['functions'])}
out['pending']=[
 {'id':'P01','item':'자연어 해설 전체의 독립 의미 검증','scope':'동작·선언 해설 14,622행, 프로젝트 사전 목적·용도 문구','status':'미완료','reason':'전수 검사로 확인한 것은 원문 연결·코드 예제·스코프 등이다. 원문과 설명을 각각 독립적으로 읽는 전 문장 의미 검토를 마쳤다고 주장하지 않는다.'},
 {'id':'P02','item':'외부 SDK API 계약','scope':'SDK 사전 47개','status':'일부 공식 일반 설명 확인 / 전체 계약 미검증','reason':'AXL/AXM/AXD 공식 문서의 일부 내용은 확인했으나 API별 전체 인자·반환·장치별 예외와 적용 SDK 버전은 확정하지 못했다. 47개 모두 호출 확인·외부 의미 추가 확인으로 표시한다.'},
 {'id':'P03','item':'실제 EtherCAT·PDO·운전 설정','scope':'마스터 모델, 주기, 장치 순서, 1700h 실제 적용, 현재 INI/MOT','status':'미검증','reason':'업로드된 motion.mot 원시 값과 현재 설비에서 실제 읽는 파일은 구분한다. 매핑·현재 설정·실행 기록이 없어 장비 적용을 확인할 수 없다.'},
 {'id':'P04','item':'실제 배선·접점·기구 및 설비 실행','scope':'단자·COM·드라이브·엔코더·모터·밸브·센서·STOP/RESET 반응','status':'미실시','reason':'전기도면·공압도·실물/로그와 대조하지 않았다. 코드 요청과 물리 완료는 별개다.'},
 {'id':'P05','item':'컴파일·AST·동적 호출 관계','scope':'C++ 이름 해석·오버로드·매크로 전개·스레드 간 실행 순서','status':'미실시','reason':'문자열/소속 기반 정적 색인이다. 전체 SDK·MFC 빌드 환경 없이 컴파일러 수준으로 동일성을 보증하지 않는다.'}
]
out['issues']=[
 {'id':'F01','type':'HTML 표시 수정','item':'생성자와 클래스 사용처 혼동','before':'다른 멤버의 CAutoDlg:: 표기와 메시지 맵을 생성자 사용으로 연결','after':str(out['corrections']['constructorUsesRemoved'])+'건 제외, 생성자 '+str(out['corrections']['constructorExamplesRebuilt'])+'항목의 예제 재구성','status':'수정·재검사'},
 {'id':'F02','type':'HTML 표시 수정','item':'소속 범위를 벗어난 변수 연결','before':'같은 철자·헤더 선언 등이 지역 변수/매개변수 사용처와 예제에 혼입','after':'사용처 '+str(out['corrections']['scopedUsesRemoved'])+'건 제외, 예제 '+str(out['corrections']['scopedExamplesRebuilt'])+'건을 해당 파일·범위 안에서 재구성','status':'수정·재검사'},
 {'id':'F03','type':'해설 수정','item':'예제에 없는 이름을 값·인자로 설명','before':'바깥 함수 이름이 내부 호출의 인자인 것처럼 설명','after':str(out['corrections']['exampleReadingsCorrected'])+'건을 함수 본문·메시지 연결·MFC 등록으로 구분','status':'수정·재검사'},
 {'id':'F04','type':'근거 수정','item':'Init 원점 메시지 연결','before':'StatusDlg로 가는 OnStatusMonitorUpdate 1306~1309행 잔존','after':'OnPositionUpdate 1296~1303행, IO 호출 921~923행, Init 메시지 맵46행으로 교체·보강','status':'수정·재검사'},
 {'id':'F05','type':'근거 수정','item':'PM2Q 진공 OFF 센서','before':'AutoDlg.cpp1459행은 시간 초과 flag 대입','after':'실제 압력 FALSE 조건인1461행으로 수정','status':'수정·재검사'},
 {'id':'F06','type':'근거 보강','item':'위치·속도·서보 읽기 / 메인 실린더','before':'일부 상세 설명의 첫 근거가 호출부나 Busy 읽기만 가리킴','after':'위치·속도·서보 함수와 ECAT10 ms / PM2Q20 ms 실제 구현을 근거에 추가','status':'수정·재검사'},
 {'id':'F07','type':'통계·상수 수정','item':'오래된 9,665행 통계와 빈 매크로','before':'실제28,520행과 다른 통계, VC_EXTRALEAN의 주석을 치환값으로 표시','after':'실제 배열로 통계 재계산, 매크로를 치환값 없음으로 수정','status':'수정·재검사'},
 {'id':'F08','type':'해설 수정','item':'실제 선언·인자 구분','before':'Oper974행 초기화를 호출 결과처럼 설명 / 축3 리셋 인자 혼동 가능','after':'false 초기화와 후속 대입을 구분하고 실제 dwAlarm 전달을 명시','status':'수정·재검사'},
 {'id':'F09','type':'확인 범위 표시','item':'자동 검사와 의미 검증 혼동 방지','before':'선언·사용처 대조 상태만으로 자연어 전체까지 확인한 것처럼 읽힐 수 있음','after':'정적 참조·코드 해석·SDK 의미 추가 확인을 화면에서 구분. OMRON 직접 근거 PDF73/92/120/124쪽 명시','status':'반영·재검사'}
]
out['source_findings']=[{'item':c['finding'],'file':c['file'],'start':c['start'],'end':c['end']} for c in out['control_review'] if c['id'] in ['running-flag-duplication','pm2q-cleanup-setter','init-home-accel-typo','ini-default-duplicate-branch','auto-stop-no-direct-actuator-stop','ecat-release-unchecked','pm2q-release-unchecked','ecat-motion-wait','pm2q-motion-wait','start-guards']]
out['external_review']=[
 {'source':'PM2Q 제품 매뉴얼','location':'인쇄31·42~43 / PDF35·46~47','result':'펄스형 드라이브용 MCN1/MCN2, 펄스 출력·엔코더 입력·모션 IO 지원 확인. 실제 설비 배선은 미확인.'},
 {'source':'OMRON I574-E1','location':'고정 PDO PDF73·92, 객체 단위 PDF120·124','result':'1700h/1B00h의 객체와6042h rpm,5010h 0.01 Hz(고주파 모드0.1 Hz) 확인. 실제 매핑은 미확인.'},
 {'source':'Beckhoff EtherCAT State Machine','url':'https://infosys.beckhoff.com/content/1033/el15xx/1036980875.html','result':'일반 INIT/PREOP/SAFEOP/OP 설명 확인. SAFEOP 안전 출력은 watchdog 설정 예외를 포함해서 읽어야 함.'},
 {'source':'AJINEXTEK AXM 다축 구동','url':'https://www.ajinextek.com/webmanual/AXM/multi-move.html','result':'다축/보간 일반 설명과 축맵·절대/상대·LineMove 예시 확인. 전체47개 API 계약과 설치 버전의 일치 검증은 미완료.'},
 {'source':'Microsoft Learn C++ / Windows / MFC','url':'https://learn.microsoft.com/en-us/cpp/cpp/?view=msvc-170','result':'기초 문법174개 문구·학습 예제를 검토하고 자료형·연산자·문장·선언/정의·포인터/참조·스레드·메시지 맵 공식 설명과 대조. 프로젝트 운전 사실의 증거와 구분.'}
]
out['browser_review']={'status':'배포 후 기록 예정','cases':[]}
(root/'verification'/'report.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'counts':out['counts'],'corrections':out['corrections'],'automated_checks':sum(s['total'] for s in out['summary'].values()),'failed':sum(s['fail'] for s in out['summary'].values()),'report_bytes':(root/'verification'/'report.json').stat().st_size},ensure_ascii=False))
