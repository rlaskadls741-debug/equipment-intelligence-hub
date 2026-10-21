# PC 제어 프로그램 분석 Tool

- 실행: [Tool](https://rlaskadls741-debug.github.io/equipment-intelligence-hub/pc-tool/)
- 사용 설명서: [설명서](https://rlaskadls741-debug.github.io/equipment-intelligence-hub/pc-tool/manual.html)
- 실행 주소는 고정이며, `main` 브랜치에 반영된 수정본이 GitHub Pages에 자동 배포됩니다.
- `index.html`은 `source-part1.txt`와 `source-part2.txt`를 순서대로 합쳐 표시합니다. 파일 분할은 업로드 요청 크기 제한 때문에 적용했습니다.
- 원문을 다시 합칠 때: `cat source-part1.txt source-part2.txt > PC제어_프로그램_분석_Tool.html`
- 수정 후에는 UTF-8 기준으로 두 파일을 다시 나누고 `index.html`의 `?v=` 값을 새 blob SHA로 바꿔 캐시를 갱신합니다.

## Ajin > WMX3 변환 체크리스트

- 우상단 버튼으로 같은 화면 안에서 60개 항목을 엽니다.
- 상태·상태별 기본 색상·메모를 변경 즉시 현재 브라우저에 저장합니다. 다른 PC와 자동 동기화하지 않습니다.
- JSON 내보내기·불러오기로 백업과 이동을 지원합니다. 문서 검토 기준과 사용자 진행 기록은 분리되어 있습니다.
- 검증 결과와 미완료 범위는 `verification.html#conversion-checklist`에 기록합니다.
