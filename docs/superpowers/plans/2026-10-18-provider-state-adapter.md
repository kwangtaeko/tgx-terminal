# Provider State Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** Codex와 Claude Code의 사용량·한도 상태를 추정하지 않고, 확인된 데이터가 없을 때도 출처와 사유를 갖춘 `unsupported` 상태로 제공하는 공급자 상태 어댑터를 만든다.

**아키텍처:** `src/providers/`는 터미널·PTY·UI와 독립된 순수 TypeScript 계층이다. 공통 계약은 값, 상태, 출처, 관측 시각, 선택적 reset 시각·window·단위를 표현하며, 기본 어댑터는 공급자별 공식 확인 결과를 바탕으로 사용량을 `unsupported`로 반환한다. 이후 확인된 읽기 전용 데이터 수집기를 이 어댑터 뒤에 추가할 수 있다.

**기술 스택:** Node.js 22, TypeScript strict, Vitest 5

**명세:** `docs/superpowers/specs/2026-10-17-tgx-terminal-design.md` §6

## 전역 제약

- 공급자 CLI에 자동 입력을 보내지 않고, 실행 인자·전역 설정·승인·샌드박스 정책을 바꾸지 않는다.
- 인증 비밀, 대화 내용, 세션 토큰, 로컬 인증 파일을 읽거나 저장하지 않는다.
- 세션 토큰·컨텍스트 점유율·구독 한도를 서로 대체하거나 합산하지 않는다.
- 값이 없을 때 `error`로 위장하지 않는다. 지원되지 않는 수집 경로는 `unsupported`, TTL 경과 값은 `stale`, 실제 수집 실패는 `error`로 구분한다.
- 수집 실패나 미지원 상태는 자식 PTY·CLI 실행을 멈추지 않는다.
- 이번 단계는 UI를 변경하지 않는다. 상태를 표시하는 UI 작업 전에는 목업을 사용자에게 먼저 제시한다.

## 검토 중점

- Codex의 활성 세션 `/status`를 자동으로 입력해 사용량을 얻으려는 경로는 금지되며 `unsupported`여야 한다. Task 2 fixture로 고정한다.
- Claude Code의 `-p --output-format json`은 별도 비대화형 실행이므로 현재 대화형 세션 사용량 출처가 아니며 `unsupported`여야 한다. Task 2 fixture로 고정한다.
- 값 없는 상태에는 `value`, `resetAt`, `window`, `unit`을 만들지 않는다. Task 1에서 검증한다.
- 시간 정보가 유효하지 않은 입력은 계약 생성 단계에서 거부한다. Task 1에서 검증한다.
- 미래의 수집기가 실패해도 마지막 정상 값이나 CLI 흐름을 손상하지 않도록, 이 계획에서는 어댑터가 예외를 던지지 않는 결과 계약을 제공한다. Task 2에서 검증한다.

---

### Task 1: 상태 데이터 계약

**Files:**
- Create: `src/providers/contracts.ts`
- Create: `tests/unit/provider-contracts.test.ts`

**Interfaces:**
- Produces: `ProviderId`, `DataStatus`, `DataSource`, `StateValue<T>`, `ProviderUsageState`, `createUnsupportedStateValue(reason, source, observedAt)`.
- Consumes: 없음.

- [ ] **Step 1: 실패하는 계약 테스트를 작성한다**

`createUnsupportedStateValue`가 `status: "unsupported"`, `source`, `observedAt`, `reason`만 가진 값을 만들며 값 전용 필드를 넣지 않는지 검증한다. `observedAt`이 유효하지 않은 `Date`이면 명확한 오류를 내는 테스트도 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/provider-contracts.test.ts`

Expected: `contracts` 모듈 또는 `createUnsupportedStateValue`를 찾지 못해 실패.

- [ ] **Step 3: `src/providers/contracts.ts`에 계약을 구현한다**

`DataStatus`는 정확히 `available | unsupported | stale | error`만 허용한다. `DataSource`는 공급자·공식 문서 URL·확인한 CLI 버전·갱신 방식을 포함한다. `StateValue<T>`는 `status`, `source`, `observedAt`, 선택적 `value`, `resetAt`, `reason`, `window`, `unit`으로 구성한다. `createUnsupportedStateValue`는 `value`를 넣지 않는다.

- [ ] **Step 4: 계약 테스트가 통과하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/provider-contracts.test.ts`

Expected: PASS.

### Task 2: 공급자별 기본 사용량 어댑터

**Files:**
- Create: `src/providers/usage-adapter.ts`
- Create: `tests/unit/provider-usage-adapter.test.ts`
- Consumes: `src/providers/contracts.ts`의 `ProviderId`, `ProviderUsageState`, `DataSource`, `createUnsupportedStateValue`.
- Produces: `createProviderUsageAdapter(clock?: () => Date)`와 `getUsageState(provider: ProviderId): ProviderUsageState`.

- [ ] **Step 1: 실패하는 어댑터 테스트를 작성한다**

Codex와 Claude Code 각각에 대해 고정 clock으로 `getUsageState`를 호출하고, 사용량 값 없이 `unsupported` 상태·공식 문서 출처·공급자별 구체 사유를 반환하는지 검증한다. 두 호출이 입력을 실행하지 않는 순수 함수임을 fixture로 고정한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/provider-usage-adapter.test.ts`

Expected: `usage-adapter` 모듈 또는 `createProviderUsageAdapter`를 찾지 못해 실패.

- [ ] **Step 3: `src/providers/usage-adapter.ts`에 기본 어댑터를 구현한다**

Codex에는 활성 대화형 세션의 `/status`가 자동 수집 경로가 아니므로 사용량 수집을 지원하지 않는다는 사유를 설정한다. Claude Code에는 문서화된 외부 사용량·한도 조회 경로가 없다는 사유를 설정한다. 각 출처는 공식 문서 URL과 2026-10-18에 확인한 설치 CLI 버전을 포함한다. 함수는 자식 프로세스 생성·파일 접근·네트워크 요청 없이 결과만 반환한다.

- [ ] **Step 4: 어댑터 테스트가 통과하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/provider-usage-adapter.test.ts`

Expected: PASS.

### Task 3: 수집 출처 문서화와 통합 검증

**Files:**
- Create: `docs/data-sources.md`
- Modify: `docs/validation.md`
- Consumes: Task 1~2의 계약과 어댑터.
- Produces: 공급자별 출처·버전·단위·TTL·갱신 방식·실패/백오프 판정이 기록된 검증 문서.

- [ ] **Step 1: 문서 검증 기준을 테스트에 추가한다**

Task 2 테스트에 두 공급자 모두 `source.documentationUrl`, `source.providerVersion`, `observedAt`을 갖는다는 단언을 추가한다.

- [ ] **Step 2: 확장 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/provider-usage-adapter.test.ts`

Expected: 문서 출처 메타데이터가 없어 실패.

- [ ] **Step 3: `docs/data-sources.md`와 필요한 출처 메타데이터를 작성한다**

Codex CLI 0.163.0과 Claude Code 2.1.302를 확인 버전으로 기록한다. 사용량 값·단위·reset 시각·TTL은 모두 `not available`로 명시하고, 수집 실패 백오프는 “수집기 미설치, 재시도 없음”으로 기록한다. `docs/validation.md`에는 실행한 테스트·typecheck·build 결과만 추가한다.

- [ ] **Step 4: 전체 검증을 실행한다**

Run: `pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`

Expected: 모든 테스트 통과, TypeScript strict와 build exit 0, diff check clean.
