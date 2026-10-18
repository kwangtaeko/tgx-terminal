# P1 Sidecar Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 Codex 또는 Claude Code PTY의 입력·승인·종료 경로를 보존하면서, 충분히 넓은 호스트 터미널에만 우측 상태 대시보드를 표시한다.

**Architecture:** `src/layout/`은 물리 터미널 크기에서 자식 PTY 크기와 대시보드 표시 여부를 계산한다. `src/dashboard/`는 공급자 상태를 너비가 고정된 안전한 텍스트 행으로 바꾸며, `src/terminal/`의 sidecar renderer는 파싱된 VT 행과 대시보드 행을 절대 커서 좌표로 합성한다. `src/cli.ts`는 물리 크기를 레이아웃 컨트롤러에 전달하고, 계산된 자식 크기만 PTY와 VT 모델에 전달한다.

**Tech Stack:** Node.js 22, TypeScript strict, node-pty 1.1.0, @xterm/headless 6.0.0, Vitest 5

**Spec:** `docs/superpowers/specs/2026-10-17-tgx-terminal-design.md` §2–§6; 승인된 `Sidecar` 목업

## Global Constraints

- 일반 입력, Tab, Ctrl+C, Esc, 붙여넣기는 선택된 자식 PTY에 그대로 전달한다.
- 공급자 CLI에 자동 명령을 입력하거나, 설정·승인·샌드박스 정책·인증 파일을 바꾸거나 읽지 않는다.
- 대시보드는 `ProviderUsageState`만 소비한다. 화면 텍스트·세션 토큰·컨텍스트 점유율로 사용량을 추정하지 않는다.
- 물리 폭이 92열 미만이면 대시보드를 숨기고 자식 PTY에 전체 폭을 준다. 표시 시 대시보드는 30열, 구분·여백은 2열, 자식 PTY의 최소 폭은 60열이다.
- 대시보드의 오류·미지원 상태는 사용량 0%처럼 보이지 않아야 하며, 수집 실패가 PTY·입력·렌더링을 멈추지 않아야 한다.
- 자식 VT에서 나온 제어 바이트를 부모 터미널로 직접 전달하지 않는다. 기존 안전한 `ScreenSnapshot` 세그먼트만 렌더한다.
- UI 작업 전 사용자가 승인한 Sidecar 목업을 따른다. 이번 단계는 탭·분할·마우스 포커스·실제 사용량 수집을 포함하지 않는다.

## Review Focus

- 91열과 92열 경계에서 자식 PTY 폭이 각각 91/60열인지, 대시보드 표시가 정확히 전환되는지 Task 1에서 검증한다.
- 물리 크기 변경 때 PTY와 VT 모델은 같은 자식 크기를 받고, 대시보드 표시 전환 때 전체 재도색되는지 Task 4에서 검증한다.
- `unsupported` 상태는 숫자·퍼센트·reset 시각을 만들지 않고, 출처와 짧은 사유만 표시하는지 Task 2에서 검증한다.
- 색상·wide character가 포함된 자식 행은 대시보드 구분선과 겹치지 않고, 허용되지 않은 VT 제어 시퀀스가 합성 결과에 없는지 Task 3에서 검증한다.
- 대시보드 렌더·상태 어댑터 오류가 발생해도 왼쪽 자식 출력 렌더와 입력 구독이 계속되는지 Task 4에서 검증한다.

---

### Task 1: 단일 세션 Sidecar 레이아웃 계약

**Files:**
- Create: `src/layout/single-session-layout.ts`
- Create: `tests/unit/single-session-layout.test.ts`

**Interfaces:**
- Produces: `SingleSessionLayout`, `computeSingleSessionLayout(outerSize: TerminalSize): SingleSessionLayout`.
- Consumes: `TerminalSize`, `validateTerminalSize`.

- [ ] **Step 1: 실패하는 폭 경계 테스트를 작성한다**

91열 × 24행은 `dashboard: undefined`, `terminal: { columns: 91, rows: 24 }`이고, 92열 × 24행은 `dashboard: { columns: 30, startColumn: 63 }`, `terminal: { columns: 60, rows: 24 }`인지 검증한다. 행 수 보존과 0·음수 크기 거부도 검증한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/single-session-layout.test.ts`

Expected: `single-session-layout` 모듈을 찾지 못해 실패.

- [ ] **Step 3: `computeSingleSessionLayout`을 구현한다**

상수 `MIN_TERMINAL_COLUMNS = 60`, `DASHBOARD_COLUMNS = 30`, `DASHBOARD_GUTTER_COLUMNS = 2`를 사용한다. `startColumn`은 부모 ANSI 좌표(1부터 시작)로 `terminal.columns + DASHBOARD_GUTTER_COLUMNS + 1`이다. 유효한 물리 크기만 결과로 만든다.

- [ ] **Step 4: 레이아웃 테스트가 통과하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/single-session-layout.test.ts`

Expected: PASS.

### Task 2: 미지원 상태용 대시보드 행 모델

**Files:**
- Create: `src/dashboard/sidecar-view.ts`
- Create: `tests/unit/sidecar-view.test.ts`

**Interfaces:**
- Consumes: `ProviderUsageState`, `SingleSessionLayout`의 대시보드 폭.
- Produces: `createSidecarView(state: ProviderUsageState, columns: number, rows: number): readonly string[]`.

- [ ] **Step 1: 실패하는 대시보드 행 테스트를 작성한다**

Codex `unsupported` fixture에 대해 정확히 지정된 행 수를 반환하고, 제목·공급자·CLI 버전·`Unsupported`·출처 도메인은 포함하지만 `0%`, reset 시각, 원본 사유 전문은 포함하지 않는지 검증한다. 모든 행의 표시 폭이 지정 열을 넘지 않는지 ASCII fixture로 검증한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-view.test.ts`

Expected: `sidecar-view` 모듈을 찾지 못해 실패.

- [ ] **Step 3: `createSidecarView`를 구현한다**

P1은 고정 ASCII 레이블을 사용해 독립적인 문자 폭 계산을 요구하지 않는다. 상태 값은 한 줄 `Unsupported`로만 나타내며, 문서 URL은 `URL` 생성자로 hostname만 추출한다. 행은 공백으로 패딩하거나 자르고, 제공된 `rows`보다 길어지지 않는다.

- [ ] **Step 4: 대시보드 행 테스트가 통과하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-view.test.ts`

Expected: PASS.

### Task 3: 절대 좌표 Sidecar 렌더러

**Files:**
- Create: `src/terminal/sidecar-renderer.ts`
- Modify: `src/terminal/outer-renderer.ts`
- Create: `tests/unit/sidecar-renderer.test.ts`

**Interfaces:**
- Consumes: `ScreenSnapshot`, `SingleSessionLayout`, `createSidecarView` 결과.
- Produces: `SidecarRenderer.render(snapshot: ScreenSnapshot, layout: SingleSessionLayout, dashboardLines: readonly string[]): string`.

- [ ] **Step 1: 실패하는 렌더러 테스트를 작성한다**

60열 자식 snapshot과 30열 대시보드 fixture를 렌더할 때 첫 프레임이 화면을 지운 뒤, 자식 행은 1열에서, 구분선은 62열에서, 대시보드 행은 63열에서 시작하는 ANSI 커서 위치를 포함하는지 검증한다. 두 번째 동일 프레임은 빈 문자열이고, 대시보드 표시/숨김 전환은 전체 재도색인지 검증한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-renderer.test.ts`

Expected: `sidecar-renderer` 모듈을 찾지 못해 실패.

- [ ] **Step 3: Sidecar renderer와 공용 안전 렌더 함수를 구현한다**

`outer-renderer.ts`의 세그먼트→안전 ANSI 변환을 export 가능한 내부 헬퍼로 분리한다. Sidecar renderer는 child-originated ANSI를 받지 않고 `ScreenSnapshot.styledLines`만 렌더한다. 프레임 키에는 레이아웃 표시 여부·자식 행·대시보드 행을 포함해, 크기/표시 변경 시 전체 재도색하고 그 외에는 바뀐 행만 갱신한다.

- [ ] **Step 4: 렌더러 테스트가 통과하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-renderer.test.ts tests/unit/screen-model.test.ts`

Expected: PASS.

### Task 4: CLI의 레이아웃 기반 resize와 기본 대시보드 결합

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/integration/cli-lifecycle.test.ts`
- Modify: `docs/validation.md`

**Interfaces:**
- Consumes: Task 1~3의 layout, sidecar view, renderer와 `createProviderUsageAdapter`.
- Produces: 물리 크기 변경을 자식 PTY·VT 모델·Sidecar renderer에 같은 레이아웃으로 전달하는 단일 세션 CLI.

- [ ] **Step 1: 실패하는 CLI 수명주기 테스트를 작성한다**

92열 부모 크기에서 세션·화면 모델 생성 크기가 60열인지, parent resize가 91열로 오면 둘 다 91열로 재조정되는지, 렌더 함수가 공급자 상태를 받아 대시보드 프레임을 만든다는 것을 fake 포트로 검증한다. 대시보드 구성 실패 fake는 child data write·terminal render를 계속 수행하는지도 검증한다.

- [ ] **Step 2: 테스트가 실패하는지 실행한다**

Run: `pnpm.cmd exec vitest run tests/integration/cli-lifecycle.test.ts`

Expected: 현재 CLI가 물리 크기를 직접 child 크기로 사용하므로 경계 assertions가 실패.

- [ ] **Step 3: `runCli`와 기본 의존성을 결합한다**

`CliDependencies`에 레이아웃 생성과 safe dashboard render 포트를 추가한다. 시작·resize에서 물리 크기 → `SingleSessionLayout` → child 크기 순으로 계산하고, screen resize를 먼저 적용한 뒤 PTY를 resize한다. dashboard 렌더 실패는 빈 sidecar 행 또는 숨김 상태로 격리하고, 자식 데이터 처리 체인을 reject시키지 않는다.

- [ ] **Step 4: 통합과 전체 검증을 실행한다**

Run: `pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`

Expected: 모든 테스트 통과, TypeScript strict와 build exit 0, diff check clean.

### Task 5: 수동 P1 확인 절차

**Files:**
- Create: `docs/manual-p1-dashboard-validation.md`
- Modify: `docs/validation.md`

**Interfaces:**
- Consumes: 구현된 P1 sidecar 동작.
- Produces: Windows 호스트에서 92열 이상/미만 resize, 대시보드 숨김, 한글 입력, Ctrl+C, 종료 복구의 판정 기준.

- [ ] **Step 1: 수동 검사 문서를 작성한다**

지원 호스트·provider·창 크기·결과·증거·미검증 사유를 기록할 표를 만들고, 대시보드가 표시되어도 입력은 왼쪽 PTY에 전달되는지와 91열 이하에서 전체 폭으로 복구되는지를 포함한다.

- [ ] **Step 2: 자동 검증 결과를 기록한다**

`docs/validation.md`에 실제 실행한 테스트·typecheck·build 결과를 추가한다. 직접 실행하지 못한 대화형 P1 시나리오는 `pending manual verification`으로 기록한다.
