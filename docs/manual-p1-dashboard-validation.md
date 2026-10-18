# P1 Sidecar Dashboard 수동 검증 기록

## 목적

P1은 넓은 부모 터미널에서만 상태 대시보드를 표시한다. 대시보드가 표시되거나 숨겨져도 Codex·Claude Code 자식 PTY의 입력, 승인 메뉴, 종료 복구 경로가 유지되는지 Windows 콘솔에서 확인한다.

## 사전 조건

- Windows PowerShell 또는 Windows Terminal에서 프로젝트 루트를 연다.
- `pnpm.cmd build`가 성공한 상태여야 한다.
- `codex` 또는 `claude`가 로그인된 대화형 CLI여야 한다.
- 창 폭을 정확히 92열 이상과 91열 이하로 조절할 수 있어야 한다.

## 시나리오

| ID | 제공자 | 부모 크기 | 절차 | 기대 결과 | 결과 |
| --- | --- | --- | --- | --- | --- |
| P1-01 | Codex | 92x24 이상 | `node dist/cli.js codex`를 실행한다. | 왼쪽 자식 터미널은 60열 이상이고, 63열부터 오른쪽 상태 대시보드가 보인다. | pending manual verification |
| P1-02 | Codex | 91x24 이하 | P1-01 실행 중 창 폭을 91열 이하로 줄인다. | 대시보드와 구분선이 완전히 지워지고 자식 터미널이 전체 폭을 사용한다. | pending manual verification |
| P1-03 | Codex | 92x24 이상 | 다시 92열 이상으로 넓힌다. | 자식 PTY와 VT 화면은 새 자식 폭으로 resize되고 대시보드가 깨끗하게 다시 그려진다. | pending manual verification |
| P1-04 | Codex | 92x24 이상 | 오른쪽 상태를 확인한다. | `Unsupported`, CLI 버전, 공식 문서 호스트만 보이며 `0%`나 reset 시각은 보이지 않는다. | pending manual verification |
| P1-05 | Codex | 양쪽 폭 | 한글 입력, 여러 줄 붙여넣기, 승인 메뉴 선택, Ctrl+C를 각각 수행한다. | 모든 입력이 왼쪽 자식 PTY로 그대로 전달되고 대시보드는 입력을 가로채지 않는다. | pending manual verification |
| P1-06 | Claude | 양쪽 폭 | `node dist/cli.js claude`로 P1-01~P1-05를 반복한다. | 동일한 resize·입력·종료 복구 경로가 유지된다. | pending manual verification |
| P1-07 | Codex 또는 Claude | 양쪽 폭 | 정상 종료 후 쉘 프롬프트로 돌아온다. | alternate screen, cursor, 부모 터미널 입력 모드가 복구된다. | pending manual verification |

## 자동 검증과의 경계

자동 테스트는 91/92열 경계, PTY·VT 모델의 자식 폭 전달, 안전한 `unsupported` 상태 표현, 첫 화면 전체 렌더와 변경 행 렌더를 검증한다. 실제 Windows 콘솔의 넓은 창에서 보이는 레이아웃, 한글·붙여넣기·승인 메뉴의 체감 동작은 위 시나리오로 별도 확인한다.
