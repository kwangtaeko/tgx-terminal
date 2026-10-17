# ADR 0002: P0 호환성 결과

## 상태

P0 자동 검증과 실제 공급자 CLI의 비대화형 시작·정상 종료·부모 터미널 복구는 통과했습니다. 다만 제품 요구의 대화형 핵심 항목은 아직 수동 검증하지 않았으므로 P0 전체 호환성을 `pass`로 판정하지 않습니다.

## 확인된 범위

- Windows에서 `node-pty`와 ConPTY 경유로 `codex --version` 및 `claude --version`이 각각 exit code 0으로 종료했습니다.
- `PtySession` fixture는 입력, 한글·여러 줄 전달, resize 포트 호출, 자연 종료를 자동 검증합니다.
- VT 화면 모델 fixture는 alternate buffer, 색상, 커서·지우기, 한글, OSC, window-operation CSI 경계를 자동 검증합니다.
- CLI 수명주기 fixture는 `terminal.enter → session.close → terminal.restore` 순서와 종료 코드 전달, 생성 실패 복구, 중복 복구 방지를 검증합니다.

## 보류 항목과 판정

| 항목 | Codex CLI | Claude Code | 판정 |
| --- | --- | --- | --- |
| 대화형 한글 입력·여러 줄 붙여넣기 | 미검증 | 미검증 | 수동 검증 필요 |
| 승인 메뉴 | 미검증 | 미검증 | 수동 검증 필요 |
| Ctrl+C | 미검증 | 미검증 | 수동 검증 필요 |
| resize | 미검증 | 미검증 | 수동 검증 필요 |
| alternate screen | 미검증 | 미검증 | 수동 검증 필요 |
| 강제 중단 뒤 입력·커서 복구 | 미검증 | 미검증 | 수동 검증 필요 |

따라서 다음 단계로 넘어가기 전, 인증된 별도 작업 폴더에서 각 공급자를 한 번씩 대화형으로 실행해 위 표를 채워야 합니다. 대화 내용·인증 비밀·토큰은 기록하지 않습니다. 구체적 절차와 판정 기준은 [P0 수동 호환성 검증 절차](../manual-p0-validation.md)를 따릅니다.

## 알려진 제약

`node-pty@1.1.0`의 Windows ConPTY는 자연 종료 후에도 worker handle을 유지할 수 있습니다. `dist/cli.js` 엔트리포인트는 `runCli`의 자식 종료·VT 처리·부모 터미널 복구가 모두 완료된 뒤 명시적으로 프로세스를 종료합니다. 라이브러리 함수 `runCli`는 이 동작을 포함하지 않습니다.

Codex의 `--version` probe는 성공했지만, 이 실행 환경에서 PATH alias 생성 시 home directory를 찾지 못했다는 경고를 출력했습니다. 인증·대화형 실행에는 영향을 확인하지 않았으므로 해당 항목은 미검증으로 유지합니다.
