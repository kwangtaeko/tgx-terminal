# 공급자 상태 데이터 출처

이 문서는 TGX Terminal이 표시할 수 있는 공급자 상태의 출처와 한계를 기록한다. 기본 구현은 인증 비밀·대화 내용·세션 토큰·로컬 인증 파일을 읽지 않으며, 실행 중인 공급자 CLI에 자동 입력을 보내지 않는다.

| 공급자 | 확인한 CLI 버전 | 공식 출처 | 자동 수집 항목 | 상태 | 갱신 방식 | TTL·단위·reset 시각 | 실패·백오프 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | 0.164.0 | [ChatGPT 플랜에서 Codex 사용](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) | 없음 | `unsupported` | 수집기 미설치 | not available | 재시도 없음 |
| Claude Code | 2.1.302 | [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage) | 없음 | `unsupported` | 수집기 미설치 | not available | 재시도 없음 |

## Codex

공식 안내는 활성 Codex CLI 세션에서 `/status`로 사용량을 확인하도록 설명한다. 이는 사용자가 대화형 세션에 직접 입력하는 명령이므로, TGX는 자동 입력으로 실행하거나 화면 텍스트에서 추출하지 않는다. 따라서 사용량 값, 남은 비율, reset 시각, window, 단위를 만들지 않고 `unsupported` 사유만 제공한다.

## Claude Code

공식 CLI 문서의 `--output-format json`은 `-p` 비대화형 실행의 출력 형식이다. 이는 이미 실행 중인 대화형 세션의 사용량·한도 조회 인터페이스가 아니므로 TGX의 상태 수집 출처로 사용하지 않는다. 공식 문서에서 별도 읽기 전용 사용량 조회 경로가 확인되기 전까지 같은 방식으로 `unsupported`로 표시한다.

## 후속 수집기 기준

새 수집기는 공식 문서와 실제 설치 버전에서 지원되는 읽기 전용 인터페이스가 확인된 경우에만 추가한다. 값은 출처·관측 시각·단위·TTL·갱신 방식·실패/백오프 규칙을 함께 기록한다. TTL이 지난 마지막 정상 값은 `stale`, 실제 수집 실패는 `error`이며, 두 상태는 `unsupported`와 섞지 않는다.
