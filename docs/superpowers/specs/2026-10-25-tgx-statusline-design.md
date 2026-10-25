# TGX 투명 Statusline 디자인

## 의도

기존 우측 sidecar는 넓은 화면에서만 보이고 provider 화면 폭을 줄인다. 사용자가 원한 ccstatusline 계열 정보 표현은 provider 본문 위를 덮거나 배경을 칠하지 않는 TGX 소유의 하단 한 줄로 제공한다.

## 선택

기본 single-session layout은 terminal 전체 폭을 유지하고, viewport가 2행 이상일 때 마지막 한 행을 TGX statusline으로 예약한다. statusline은 ANSI 배경색을 설정하지 않고 기본 terminal 배경을 그대로 사용한다.

형식:

`TGX | CODEX 0.164.0 | SESSION RUNNING | USAGE UNAVAILABLE | SRC NOT-COLLECTED`

## 데이터 계약

- 사용 가능: provider, 설치 확인 CLI version, TGX 세션 상태, usage status, refresh method.
- 금지: usage %, reset time, token/cost, model, 대화 내용, provider TUI parsing, 활성 세션에 자동 `/status` 입력.
- current adapter는 Codex/Claude 모두 usage `unsupported`/`not-collected`이므로 `USAGE UNAVAILABLE`로 표현한다.

## 제약

- 1행 terminal은 child viewport를 보존하고 statusline을 숨긴다.
- tab bar가 있으면 top 1행과 bottom 1행을 TGX가 소유하고 child rows만 줄인다.
- statusline 렌더 후 parent cursor는 언제나 child snapshot cursor로 복구한다.
- 기존 custom dashboard layout은 호환성을 위해 남기되 기본 layout은 이를 선택하지 않는다.

## 검증

- 80x24 기본 layout은 80x23 child + 80열 statusline을 만든다.
- 80x1은 statusline 없이 80x1 child를 유지한다.
- statusline은 fixed-width printable ASCII이고 금지 데이터가 없다.
- bottom row는 child cursor가 아닌 statusline에 그려지고 마지막 cursor는 child 위치로 복구된다.
