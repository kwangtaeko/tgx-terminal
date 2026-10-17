# 호환성 매트릭스

이 문서는 실제로 실행한 조합만 지원으로 선언합니다. `not verified`는 통과를 뜻하지 않습니다.

| 확인일 | OS | 호스트 터미널 | 셸 | ConPTY | Node | pnpm | Codex CLI | Claude Code | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-17 | Windows NT 10.0.26200.0 | VS Code 통합 터미널 | PowerShell 5.1.26100.9711 | `node-pty` 경유 비대화형 probe pass | v22.15.1 | 10.33.2 | 0.163.0 | 2.1.302 | `--version` PTY 시작·종료·복구 확인 |

## P0 수동 검증표

| 공급자 | 시작 | 한글 입력 | 여러 줄 붙여넣기 | 승인 메뉴 | Ctrl+C | resize | alternate screen | 종료 후 복구 | 판정 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex CLI 0.163.0 | pass (`--version`) | not verified | not verified | not verified | not verified | not verified | not verified | pass (`--version`) | 대화형 수동 검증 필요 |
| Claude Code 2.1.302 | pass (`--version`) | not verified | not verified | not verified | not verified | not verified | not verified | pass (`--version`) | 대화형 수동 검증 필요 |

Windows Terminal, Cursor 통합 터미널, ConHost, WSL2, Linux는 아직 검증하지 않았습니다.
