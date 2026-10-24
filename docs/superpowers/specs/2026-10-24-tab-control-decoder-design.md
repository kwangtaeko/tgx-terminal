# 탭 제어 prefix 디코더 설계

작성일: 2026-10-24
상태: 구현 범위 확정

## 의도

P3의 탭 조작은 일반 자식 CLI 입력을 기본적으로 바꾸면 안 된다. 이 증분은 터미널 이벤트·PTY·렌더러와 분리된 순수 입력 디코더만 제공한다. 이후 `--tgx-tabs`처럼 사용자가 명시적으로 활성화한 제어면이 이 디코더를 연결한다.

## 목표

- 비활성 상태에서는 모든 입력 문자열을 원형 그대로 하나의 forward action으로 반환한다.
- 활성 상태에서만 `Ctrl+T` (`\u0014`) 뒤 `n`, `]`, `[`, `x`를 각각 새 탭, 다음 탭, 이전 탭, 탭 닫기 명령으로 해석한다.
- 알 수 없는 명령과 단일 `Ctrl+T`는 prefix를 포함해 자식 PTY로 다시 전달한다.
- prefix와 명령이 서로 다른 입력 chunk에 도착해도 동일하게 동작한다.

## 비목표

- 이번 증분은 `runCli`, `MultiSessionManager`, 부모 터미널 이벤트, CLI 인자, UI 렌더링을 수정하지 않는다.
- prefix를 기본 활성화하거나, 공급자 CLI의 키·승인·보안 경계를 변경하지 않는다.

## 접근 방식

1. 전역 키 이벤트에서 즉시 탭 동작을 수행한다. 기본 입력을 침해한다.
2. **선택: 순수 상태 디코더를 먼저 구현한다.** 호출자가 명시적으로 `enabled`를 주지 않으면 단순 pass-through이며, 활성화해도 정의된 두 글자 시퀀스만 명령으로 소비한다.
3. 제공자 CLI 출력을 파싱해 탭 제어를 추정한다. 안전하지 않고 범위 밖이다.

## 계약

- `TabControlDecoder.push(data)`는 `forward`와 `command` action의 읽기 전용 목록만 반환한다.
- `forward` action은 순서·UTF-8 JavaScript 문자열 내용을 바꾸지 않는다.
- `flush()`는 아직 명령이 뒤따르지 않은 prefix를 forward action으로 반환해 입력 손실을 방지한다.
- decoder는 세션 ID, PTY, 화면 내용, 인증 정보, 파일 시스템에 접근하지 않는다.

## 검증

- 비활성 pass-through, 한 chunk/분할 chunk 명령, 한국어·여러 줄 입력, 알 수 없는 명령, 이중 prefix, flush를 단위 테스트한다.
- 전체 테스트, strict typecheck, build, diff 검사를 실행한다.
