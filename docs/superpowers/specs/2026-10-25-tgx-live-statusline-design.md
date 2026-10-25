# TGX 실시간 상태줄 설계

## 의도

정적 provider 버전과 `NOT-COLLECTED`를 나열하는 현재 상태줄을, TGX가 직접 확인할 수 있는 실제 로컬 세션 정보로 교체한다. ccstatusline처럼 한 줄 요약을 제공하되 공급자 사용량을 추정·파싱·자동 조회하지 않는다.

## 표시 계약

기본 상태줄은 좁은 폭에서 오른쪽부터 잘리며 다음 순서의 ASCII 항목을 사용한다.

`TGX | CODEX | RUNNING | 03:42 | TABS 1 | USAGE /status | tgx-terminal @ main*`

- provider: 실제 선택한 provider.
- lifecycle: TGX가 관리하는 `CONNECTING`, `RUNNING`, `EXITED`, `ERROR`.
- elapsed: 이 TGX launch 이후 실제 경과시간(`mm:ss`, 한 시간을 넘으면 `hh:mm:ss`).
- project: 실제 실행 cwd의 마지막 폴더명; Git 저장소이면 읽기 전용으로 branch와 tracked-file dirty 여부(`*`)를 덧붙인다. 좁은 폭에서도 사용량 안내를 보존하도록 마지막에 둔다.
- tabs: TGX가 관리하는 실제 세션 수.
- usage: Codex는 `USAGE /status`, Claude는 `USAGE UNAVAILABLE`; 사용량 수치·reset 시각·토큰은 표시하지 않는다.

## 접근 비교

1. provider TUI를 파싱하거나 `/status`를 자동 입력: 사용자의 입력/승인 경계를 침범하므로 제외한다.
2. 기존 고정 provider adapter 문자열 유지: 실제 상태가 없으므로 제외한다.
3. TGX-owned lifecycle/time/project/tab 정보를 읽기 전용 Git probe와 1초 ticker로 표시: 검증 가능한 정보만 갱신하고 provider boundary를 보존하므로 선택한다.

## 제약

- Git probe는 한 번만, `git` 실행 파일과 인자 배열로 수행하며 250ms timeout·stderr discard·실패 fallback을 사용한다.
- 상태 ticker는 1초, `unref()`하고 session cleanup에서 반드시 clear한다.
- ticker와 Git probe 실패가 child PTY I/O·종료를 막지 않는다.
- 배경색·provider UI 파싱·전역 설정 변경·사용량 추정은 금지한다.
