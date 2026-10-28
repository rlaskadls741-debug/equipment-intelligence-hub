# 실행 경로 따라가기

별도 실행 화면: [execution-map.html](../execution-map.html)

전체 실행 지도에서 시작점 선택 → 조건 경로 선택 → 호출 함수 진입 → 호출 위치로 복귀. 오른쪽 창에서 원문·해설·현재 함수와 호출 대상의 선언을 확인한다. 스레드 생성과 동기 메시지 전달, MFC 콜백을 직접 호출과 구분한다.

기존 source-part1.txt / source-part2.txt의 control-trace 데이터를 읽어 214개 함수의 구조를 생성한다. 기존 TOOL과 원본 C++ 데이터는 수정하지 않는다. 생성된 HTML은 외부 라이브러리 없이 단독 실행한다.

갱신:
```sh
python pc-tool/execution-map/build.py
node pc-tool/tests/execution-map.test.cjs
```

정적 학습용이다. 조건 값이나 스레드 스케줄링을 실행·계산하지 않는다. if/else, while/for/do, return/break/continue의 구조를 표시하며 switch 본문은 원문 묶음으로 표시한다. SDK 내부 구현과 MFC 내부 실행 코드는 포함되지 않는다. 전처리 조건과 매크로 확장은 계산하지 않으며, 컴파일러 수준의 제어 흐름 분석을 대체하지 않는다.

검증: 214개 함수, 3,419개 노드와 3,860개 연결의 참조·원문 범위·분기·반복 복귀·반환·스레드 분리를 자동 확인. 브라우저에서 조건 경로 선택, 함수 진입·호출 위치 복귀, 선언 보기와 관련 흐름도를 확인한다.
