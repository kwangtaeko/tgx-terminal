# TGX 상태 셸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공급자 본문과 분리된 TGX 고유의 안전한 ASCII 상태 패널을 만든다.

**Architecture:** `createSidecarView`는 provider usage 계약을 읽어 고정 폭 ASCII 행을 생성한다. 레이아웃과 VT 렌더러는 바꾸지 않으므로 자식 PTY와 입력 경계는 유지된다.

**Tech Stack:** TypeScript strict, Vitest, ANSI/VT sidecar renderer.

**Spec:** `docs/superpowers/specs/2026-10-25-tgx-status-shell-design.md`

## Global Constraints

- 확인되지 않은 사용량·비용·토큰·모델·세션 데이터를 표시하지 않는다.
- 모든 행은 printable ASCII 및 요청 너비로 제한한다.
- provider 본문과 입력 경로는 수정하지 않는다.

## Review Focus

- unsupported 상태에서 `reason`이 노출되지 않는지 Task 1에서 검증한다.
- 30열 헤더와 섹션이 TGX 고유 텍스트인지 Task 1에서 검증한다.
- 좁은 12열/3행에서 고정 폭 절단을 Task 1에서 검증한다.
- 원래의 provider·CLI·상태·출처 정보가 빠지지 않는지 Task 1에서 검증한다.

### Task 1: 안전한 TGX 상태 패널

**Files:**
- Modify: `src/dashboard/sidecar-view.ts`
- Modify: `tests/unit/sidecar-view.test.ts`

**Interfaces:**
- Consumes: `createSidecarView(state: ProviderUsageState, columns: number, rows: number)`
- Produces: 같은 함수 시그니처의 TGX ASCII 상태 행

- [x] **Step 1: 실패 테스트 작성**

`unsupported` fixture에서 `TGX / TERMINAL`, `SESSION`, `USAGE SIGNAL`, `LOCAL STATE ONLY`와 기존 provider·CLI·상태·출처를 검증하고 provider 복제 헤더인 `TGX STATUS`는 없음을 검증한다.

- [x] **Step 2: 실패 확인**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-view.test.ts`
Expected: 새 TGX 헤더 또는 섹션 assertion 실패.

- [x] **Step 3: 최소 구현**

`createSidecarView`의 content 행을 명세의 섹션/값 행으로 교체하고 기존 `formatRow` 경계를 유지한다.

- [x] **Step 4: 통과 확인**

Run: `pnpm.cmd exec vitest run tests/unit/sidecar-view.test.ts`
Expected: PASS.

- [x] **Step 5: 전체 검증과 커밋**

Run: `pnpm.cmd test; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`
Expected: 전체 통과 후 관련 파일만 커밋.
